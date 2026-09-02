import Foundation
import CryptoKit

/// Nonce handling for Sign in with Apple.
///
/// The flow is easy to get subtly wrong in a way that still appears to work
/// locally: Apple must be given the SHA256 *hash* of the nonce, while Supabase
/// must be given the *raw* nonce so it can hash it and compare. Sending the
/// same value to both, or hashing twice, fails only at the server - which is
/// why this is isolated here and tested.
public enum Nonce {
    public static func random(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        result.reserveCapacity(length)
        for _ in 0..<length {
            result.append(charset[Int.random(in: 0..<charset.count)])
        }
        return result
    }

    /// Lowercase hex SHA256, which is the form Apple expects.
    public static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}
