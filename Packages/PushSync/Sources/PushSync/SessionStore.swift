import Foundation
import Security

public protocol SessionStoring: Sendable {
    func save(_ session: AuthSession) throws
    func load() throws -> AuthSession?
    func clear() throws
}

/// Tokens go in the Keychain, not UserDefaults.
///
/// A refresh token is a long-lived credential for the user's account.
/// UserDefaults is a plist in the app container - readable from a backup and
/// not protected when the device is locked.
public struct KeychainSessionStore: SessionStoring {
    private let service: String
    private let account: String

    public init(service: String = "app.push.auth", account: String = "supabase-session") {
        self.service = service
        self.account = account
    }

    private var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    public func save(_ session: AuthSession) throws {
        let data = try JSONEncoder().encode(session)
        SecItemDelete(baseQuery as CFDictionary)
        var query = baseQuery
        query[kSecValueData as String] = data
        // Never syncs to iCloud and unreadable until the device has been
        // unlocked once since boot.
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw SupabaseError.decoding("keychain write failed: \(status)")
        }
    }

    public func load() throws -> AuthSession? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status != errSecItemNotFound else { return nil }
        guard status == errSecSuccess, let data = item as? Data else {
            throw SupabaseError.decoding("keychain read failed: \(status)")
        }
        return try JSONDecoder().decode(AuthSession.self, from: data)
    }

    public func clear() throws {
        let status = SecItemDelete(baseQuery as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SupabaseError.decoding("keychain delete failed: \(status)")
        }
    }
}

/// In-memory store for tests and previews.
public final class InMemorySessionStore: SessionStoring, @unchecked Sendable {
    private var stored: AuthSession?
    public init(_ initial: AuthSession? = nil) { stored = initial }
    public func save(_ session: AuthSession) throws { stored = session }
    public func load() throws -> AuthSession? { stored }
    public func clear() throws { stored = nil }
}
