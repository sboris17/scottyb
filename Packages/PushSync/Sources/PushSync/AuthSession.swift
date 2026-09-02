import Foundation

public struct AuthSession: Codable, Equatable, Sendable {
    public let accessToken: String
    public let refreshToken: String
    public let expiresAt: Date
    public let userID: String
    public let email: String?

    public init(accessToken: String, refreshToken: String, expiresAt: Date,
                userID: String, email: String?) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.userID = userID
        self.email = email
    }

    /// Treated as expired a minute early, so a token does not die mid-request.
    public func isExpired(asOf now: Date = Date()) -> Bool {
        now.addingTimeInterval(60) >= expiresAt
    }
}

/// Supabase's token response. Named to match the wire format so decoding needs
/// no custom keys beyond snake_case conversion.
struct TokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Double
    let user: User

    struct User: Decodable {
        let id: String
        let email: String?
    }

    func session(now: Date = Date()) -> AuthSession {
        AuthSession(accessToken: accessToken,
                    refreshToken: refreshToken,
                    expiresAt: now.addingTimeInterval(expiresIn),
                    userID: user.id,
                    email: user.email)
    }
}
