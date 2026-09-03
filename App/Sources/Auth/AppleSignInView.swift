import SwiftUI
import AuthenticationServices
import PushUI

/// Sign in with Apple, wired to Supabase.
///
/// The nonce dance is the part that goes wrong: Apple receives the SHA256 of
/// a random value and Supabase receives the raw value. `AuthModel` owns both
/// halves so they cannot drift apart.
struct AppleSignInView: View {
    @Bindable var model: AuthModel

    var body: some View {
        VStack(spacing: 12) {
            switch model.state {
            case .notConfigured(let reason):
                VStack(spacing: 6) {
                    Text("Accounts aren't set up yet")
                        .font(Push.Typography.headline)
                        .foregroundStyle(Push.Palette.textPrimary)
                    Text(reason)
                        .font(Push.Typography.caption)
                        .foregroundStyle(Push.Palette.textSecondary)
                        .multilineTextAlignment(.center)
                }

            case .signedIn(let email):
                VStack(spacing: 8) {
                    Text("Signed in\(email.map { " as \($0)" } ?? "")")
                        .font(Push.Typography.headline)
                        .foregroundStyle(Push.Palette.textPrimary)
                    SecondaryButton("Sign out") { model.signOut() }
                }

            // signingIn deliberately shares this branch. Swapping the button
            // out for a spinner tears it out of the view hierarchy, and
            // SwiftUI tears down the authorization request with it - so
            // Apple's sheet completes and the callback never arrives. The
            // button stays mounted for the whole request; the spinner goes on
            // top of it.
            case .signedOut, .failed, .signingIn:
                if case .failed(let message) = model.state {
                    Text(message)
                        .font(Push.Typography.caption)
                        .foregroundStyle(Push.Palette.flame)
                        .multilineTextAlignment(.center)
                }
                signInButton
                    .overlay {
                        if model.isSigningIn {
                            ZStack {
                                RoundedRectangle(cornerRadius: Push.Metrics.cornerRadius,
                                                 style: .continuous)
                                    .fill(.ultraThinMaterial)
                                ProgressView().tint(Push.Palette.accent)
                            }
                        }
                    }
                    .disabled(model.isSigningIn)
                    .allowsHitTesting(!model.isSigningIn)
                    // Pins the button's identity across state changes, so
                    // nothing above it can cause SwiftUI to rebuild it
                    // mid-request either.
                    .id("apple-sign-in-button")
            }
        }
    }

    private var signInButton: some View {
        SignInWithAppleButton(.signIn) { request in
            request.requestedScopes = [.fullName, .email]
            // Only the nonce here. This closure runs during a view update, and
            // moving to a spinner from inside it is what used to unmount the
            // button before Apple could call back.
            request.nonce = model.startAppleRequest()
        } onCompletion: { result in
            switch result {
            case .success(let authorization):
                guard
                    let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                    let tokenData = credential.identityToken,
                    let token = String(data: tokenData, encoding: .utf8)
                else {
                    model.failAppleSignIn("Apple didn't return an identity token.")
                    return
                }
                Task { await model.completeAppleSignIn(identityToken: token) }

            case .failure(let error):
                // Cancelling is not an error worth showing as one.
                if (error as NSError).code == ASAuthorizationError.canceled.rawValue {
                    model.cancelAppleSignIn()
                } else {
                    model.failAppleSignIn(error.localizedDescription)
                }
            }
        }
        .signInWithAppleButtonStyle(.white)
        .frame(height: 50)
        .clipShape(RoundedRectangle(cornerRadius: Push.Metrics.cornerRadius, style: .continuous))
    }
}
