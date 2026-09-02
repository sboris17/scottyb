import Foundation

/// Exchanges an Apple identity token for a Supabase session, and keeps it fresh.
public actor SupabaseAuth {
    private let config: SupabaseConfig
    private let http: HTTPClient
    private let storage: SessionStoring
    private var cached: AuthSession?

    public init(config: SupabaseConfig,
                http: HTTPClient = URLSessionHTTPClient(),
                storage: SessionStoring = KeychainSessionStore()) {
        self.config = config
        self.http = http
        self.storage = storage
        self.cached = try? storage.load()
    }

    public var currentSession: AuthSession? { cached }
    public var isSignedIn: Bool { cached != nil }

    /// `rawNonce` must be the unhashed value; Apple received its SHA256.
    public func signInWithApple(identityToken: String, rawNonce: String) async throws -> AuthSession {
        var request = URLRequest(url: config.authURL
            .appendingPathComponent("token")
            .appending(queryItems: [URLQueryItem(name: "grant_type", value: "id_token")]))
        request.httpMethod = "POST"
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "provider": "apple",
            "id_token": identityToken,
            "nonce": rawNonce,
        ])

        let session = try await perform(request)
        try storage.save(session)
        cached = session
        return session
    }

    /// Returns a usable access token, refreshing first if it is close to expiry.
    public func validAccessToken() async throws -> String {
        guard let session = cached else { throw SupabaseError.notAuthenticated }
        guard session.isExpired() else { return session.accessToken }
        return try await refresh(session).accessToken
    }

    @discardableResult
    public func refresh(_ session: AuthSession) async throws -> AuthSession {
        var request = URLRequest(url: config.authURL
            .appendingPathComponent("token")
            .appending(queryItems: [URLQueryItem(name: "grant_type", value: "refresh_token")]))
        request.httpMethod = "POST"
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(
            withJSONObject: ["refresh_token": session.refreshToken])

        let refreshed = try await perform(request)
        try storage.save(refreshed)
        cached = refreshed
        return refreshed
    }

    public func signOut() throws {
        try storage.clear()
        cached = nil
    }

    private func perform(_ request: URLRequest) async throws -> AuthSession {
        let (data, response) = try await http.send(request)
        guard (200..<300).contains(response.statusCode) else {
            throw SupabaseError.badResponse(status: response.statusCode,
                                            body: String(data: data, encoding: .utf8) ?? "")
        }
        do {
            return try JSONDecoder.supabase.decode(TokenResponse.self, from: data).session()
        } catch {
            throw SupabaseError.decoding("\(error)")
        }
    }
}
