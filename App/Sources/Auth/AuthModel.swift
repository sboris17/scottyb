import Foundation
import Observation
import PushSync

/// Account state for the UI.
///
/// Every failure path lands in `.failed` with something a person can act on,
/// because the most common outcome of a broken auth setup is a button that
/// does nothing and gives no reason.
/// Pinned to the main actor, and that is load-bearing rather than tidy.
///
/// It was not, and the symptom was a sign-in that worked and never looked like
/// it had: Apple returned, the token was exchanged, `state` was set to
/// signedIn - on a background thread, because awaiting a nonisolated async
/// method hops off the main actor - and SwiftUI never picked the change up.
/// The spinner span forever over a session that had already been established.
/// `signOut` had a `MainActor.run` bolted on for exactly this reason, which
/// should have been the clue that the whole class wanted isolating instead.
@MainActor
@Observable
final class AuthModel {
    enum State: Equatable {
        case notConfigured(String)
        case signedOut
        case signingIn
        case signedIn(email: String?)
        case failed(String)
    }

    private(set) var state: State
    private let auth: SupabaseAuth?

    /// Nonce for the in-flight Apple request. Apple is handed its SHA256; this
    /// raw value goes to Supabase, which hashes it and compares.
    private var pendingNonce: String?

    init() {
        do {
            let config = try SupabaseConfig.fromBundle()
            let auth = SupabaseAuth(config: config)
            self.auth = auth
            self.state = .signedOut
            Task { [weak self] in
                if await auth.isSignedIn {
                    let email = await auth.currentSession?.email
                    self?.state = .signedIn(email: email)
                }
            }
        } catch {
            // Missing config must not crash the app or silently pretend to
            // work: accounts are simply unavailable, and the reason is shown.
            self.auth = nil
            self.state = .notConfigured(error.localizedDescription)
        }
    }

    /// Whether a Supabase project is configured. Drives whether the account
    /// UI appears at all: with no `Supabase.plist` there is nothing to sign
    /// in to, and a section explaining that to somebody who never asked for
    /// accounts is just clutter.
    var isConfigured: Bool {
        if case .notConfigured = state { return false }
        return true
    }

    var isSignedIn: Bool {
        if case .signedIn = state { return true }
        return false
    }

    var isSigningIn: Bool {
        if case .signingIn = state { return true }
        return false
    }

    /// Called when building the Apple request. Returns the hashed nonce.
    func startAppleRequest() -> String {
        let raw = Nonce.random()
        pendingNonce = raw
        state = .signingIn
        return Nonce.sha256(raw)
    }

    /// Fifteen seconds, enforced here rather than trusted to the network layer.
    ///
    /// Twice now this has been debugged from a screenshot of a spinner, because
    /// a stuck sign-in produced no message of any kind - and a symptom that
    /// carries no information is the most expensive kind to chase. Whatever
    /// goes wrong below, something readable appears.
    private static let signInTimeout: Duration = .seconds(15)

    private struct SignInTimedOut: Error {}

    func completeAppleSignIn(identityToken: String) async {
        // Every path out of here must move the state. `signingIn` renders as
        // a spinner, so an early return is a spinner that never stops.
        guard let auth else {
            state = .failed("Accounts aren't set up on this build.")
            return
        }
        guard let raw = pendingNonce else {
            state = .failed("Sign-in expired. Please try again.")
            return
        }
        pendingNonce = nil
        do {
            let session = try await withThrowingTaskGroup(of: AuthSession.self) { group in
                group.addTask {
                    try await auth.signInWithApple(identityToken: identityToken, rawNonce: raw)
                }
                group.addTask {
                    try await Task.sleep(for: Self.signInTimeout)
                    throw SignInTimedOut()
                }
                guard let first = try await group.next() else { throw SignInTimedOut() }
                group.cancelAll()
                return first
            }
            state = .signedIn(email: session.email)
        } catch is SignInTimedOut {
            state = .failed("Couldn't reach the server. Check the Supabase URL, then try again.")
        } catch {
            state = .failed(Self.explain(error))
        }
    }

    /// Supabase's own words, kept rather than flattened.
    ///
    /// A generic "sign-in failed" would have cost another round trip to find
    /// out which of the several setup steps was wrong; the server already says
    /// which, so pass it through.
    private static func explain(_ error: Error) -> String {
        if case SupabaseError.badResponse(let status, let body) = error {
            let detail = body.isEmpty ? "" : " \(body.prefix(300))"
            return "Server returned \(status).\(detail)"
        }
        return error.localizedDescription
    }

    func failAppleSignIn(_ message: String) {
        pendingNonce = nil
        state = .failed(message)
    }

    func cancelAppleSignIn() {
        pendingNonce = nil
        state = .signedOut
    }

    func signOut() {
        guard let auth else { return }
        Task { [weak self] in
            try? await auth.signOut()
            self?.state = .signedOut
        }
    }
}
