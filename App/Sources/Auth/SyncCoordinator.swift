import Foundation
import Observation
import SwiftData
import PushCore
import PushSync

/// Gets finished workouts to the server, and the server's workouts back.
///
/// The whole design follows from one rule: **the phone is the source of truth
/// and a workout is never lost.** Somebody who has just done fifty push-ups in
/// a basement with no signal has earned that record, and no amount of network
/// trouble is allowed to take it away. So the local database is written first
/// and unconditionally, syncing is something that happens to it afterwards,
/// and a failure to sync is a normal state rather than an error - it leaves
/// the workout exactly where it was, still marked as needing to go.
///
/// Inert unless a Supabase project is configured and somebody is signed in.
@MainActor
@Observable
final class SyncCoordinator {
    enum Status: Equatable {
        case disabled
        case signedOut
        case idle(lastSynced: Date?)
        case syncing
        case failed(String)

        var isBusy: Bool { self == .syncing }
    }

    private(set) var status: Status = .disabled
    private(set) var pendingCount = 0

    private let auth: SupabaseAuth?
    private let sync: SyncService?
    private var inFlight = false

    /// Configured by the presence of `Supabase.plist`, nothing else. There is
    /// no user-facing switch: a build with no project cannot sync and does not
    /// pretend to, and a build with one has no reason to be asked twice.
    init() {
        guard let config = try? SupabaseConfig.fromBundle() else {
            self.auth = nil
            self.sync = nil
            return
        }
        let auth = SupabaseAuth(config: config)
        self.auth = auth
        self.sync = SyncService(config: config, auth: auth)
        self.status = .signedOut
    }

    // MARK: - Entry points

    /// Called after a workout is saved, on sign-in, and when the app comes
    /// back to the foreground.
    ///
    /// Deliberately fire-and-forget with no completion: nothing in the app is
    /// allowed to wait on the network, and nothing downstream should be able
    /// to fail because a sync did.
    func syncSoon(_ context: ModelContext) {
        Task { await self.sync(context) }
    }

    func sync(_ context: ModelContext) async {
        guard let sync, let auth else { return }
        guard !inFlight else { return }               // one at a time, not a queue
        guard await auth.isSignedIn, let session = await auth.currentSession else {
            status = .signedOut
            refreshPendingCount(context)
            return
        }

        inFlight = true
        status = .syncing
        defer { inFlight = false }

        do {
            try await push(context, userID: session.userID, using: sync)
            try await pull(context, userID: session.userID, using: sync)
            status = .idle(lastSynced: Date())
        } catch {
            // Offline is the common case and is not worth alarming anybody
            // about. Nothing was lost; the rows are still marked as pending.
            status = .failed(Self.describe(error))
        }
        refreshPendingCount(context)
    }

    // MARK: - Up

    private func push(_ context: ModelContext, userID: String, using sync: SyncService) async throws {
        let pending = try context.fetch(FetchDescriptor<Session>()).filter(\.needsSync)
        guard !pending.isEmpty else { return }

        let payload = pending.map { session in
            RemoteSession(id: session.id,
                          userId: userID,
                          startedAt: session.startedAt,
                          endedAt: session.endedAt,
                          totalReps: session.totalReps,
                          bestSet: session.bestSet,
                          countingMode: session.countingModeRaw,
                          isVerified: session.isVerified,
                          programSlug: session.programSlug)
        }
        try await sync.push(payload)

        // Only now. If this line is reached, the server has the rows.
        let acknowledged = Date()
        for session in pending { session.syncedAt = acknowledged }
        try context.save()
    }

    // MARK: - Down

    private func pull(_ context: ModelContext, userID: String, using sync: SyncService) async throws {
        let remote = try await sync.pull()
        guard !remote.isEmpty else { return }

        let existing = Set(try context.fetch(FetchDescriptor<Session>()).map(\.id))
        var inserted = 0
        for row in remote where !existing.contains(row.id) {
            // A workout the phone has never seen: another device, or this one
            // after a reinstall. Rows already here are left completely alone -
            // the local copy is the source of truth, and a workout log is
            // append-only in practice, so there is nothing to reconcile and
            // overwriting could only ever lose something.
            let session = Session(source: .justPush,
                                  countingMode: CountingMode(rawValue: row.countingMode) ?? .manual)
            session.id = row.id
            session.startedAt = row.startedAt
            session.endedAt = row.endedAt
            session.totalReps = row.totalReps
            session.programSlug = row.programSlug
            session.isVerified = row.isVerified
            session.syncedAt = Date()
            context.insert(session)
            inserted += 1
        }
        if inserted > 0 { try context.save() }
    }

    /// Clears this account's workouts from the server as well as the phone.
    ///
    /// Without it, "reset all progress" wipes the phone and the next pull puts
    /// everything back - a destructive action that quietly undoes itself,
    /// which is the worst of both. Returns whether the server was actually
    /// cleared, so the caller can say so honestly rather than assume.
    @discardableResult
    func deleteEverythingRemote() async -> Bool {
        guard let sync, let auth,
              await auth.isSignedIn, let session = await auth.currentSession
        else { return false }
        do {
            try await sync.deleteAll(userID: session.userID)
            status = .idle(lastSynced: Date())
            return true
        } catch {
            status = .failed(Self.describe(error))
            return false
        }
    }

    // MARK: - Bookkeeping

    func refreshPendingCount(_ context: ModelContext) {
        let all = (try? context.fetch(FetchDescriptor<Session>())) ?? []
        pendingCount = all.filter(\.needsSync).count
    }

    /// Network failures get a plain sentence; anything else keeps its detail,
    /// because the unusual ones are the ones worth reporting.
    private static func describe(_ error: Error) -> String {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .timedOut,
                 .cannotConnectToHost, .cannotFindHost:
                return "No connection. Your workouts are saved and will sync later."
            default: break
            }
        }
        if case SupabaseError.badResponse(let status, _) = error, status == 401 {
            return "Signed out. Sign in again to sync."
        }
        return error.localizedDescription
    }
}
