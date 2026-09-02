import Foundation

/// Where the backend lives and the public key used to reach it.
///
/// The anon key is designed to be shipped in a client - it grants nothing on
/// its own. Every table must still be protected by row-level security, which
/// is what actually stops one user reading another's data. See schema.sql.
public struct SupabaseConfig: Sendable, Equatable {
    public let url: URL
    public let anonKey: String

    public init(url: URL, anonKey: String) {
        self.url = url
        self.anonKey = anonKey
    }

    /// Loads from `Supabase.plist` in the app bundle.
    ///
    /// Kept out of source control so the key is not committed, and so a
    /// missing config fails loudly at startup rather than silently degrading
    /// into an app that looks fine but never syncs.
    public static func fromBundle(_ bundle: Bundle = .main,
                                  named name: String = "Supabase") throws -> SupabaseConfig {
        guard let path = bundle.url(forResource: name, withExtension: "plist"),
              let data = try? Data(contentsOf: path),
              let dict = try? PropertyListSerialization.propertyList(
                    from: data, format: nil) as? [String: String]
        else { throw SupabaseError.missingConfiguration }

        guard let rawURL = dict["SupabaseURL"], let url = URL(string: rawURL),
              let key = dict["SupabaseAnonKey"], !key.isEmpty, !rawURL.isEmpty
        else { throw SupabaseError.missingConfiguration }

        return SupabaseConfig(url: url, anonKey: key)
    }

    var authURL: URL { url.appendingPathComponent("auth/v1") }
    var restURL: URL { url.appendingPathComponent("rest/v1") }
}

public enum SupabaseError: Error, LocalizedError, Equatable {
    case missingConfiguration
    case notAuthenticated
    case badResponse(status: Int, body: String)
    case decoding(String)

    public var errorDescription: String? {
        switch self {
        case .missingConfiguration:
            return "Supabase.plist is missing or incomplete. Copy Supabase.example.plist and fill it in."
        case .notAuthenticated:
            return "You need to sign in first."
        case .badResponse(let status, let body):
            return "Server returned \(status): \(body)"
        case .decoding(let detail):
            return "Unexpected response: \(detail)"
        }
    }
}
