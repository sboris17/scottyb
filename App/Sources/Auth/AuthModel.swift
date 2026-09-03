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

    /// Called when building the Apple request. Returns the hashed nonce.
    func startAppleRequest() -> String {
        let raw = Nonce.random()
        pendingNonce = raw
        state = .signingIn
        return Nonce.sha256(raw)
    }

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
            let session = try await auth.signInWithApple(identityToken: identityToken, rawNonce: raw)
            state = .signedIn(email: session.email)
        } catch {
            state = .failed(error.localizedDescription)
        }
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
