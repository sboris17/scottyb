import Foundation

/// A workout as the server stores it.
///
/// Deliberately a flat, separate type from the SwiftData model: the local
/// schema should be free to change without breaking the wire format, and vice
/// versa. `id` is the client-generated UUID, which is what makes uploads
/// idempotent - a retry after a dropped connection updates the same row rather
/// than creating a duplicate workout.
public struct RemoteSession: Codable, Equatable, Sendable {
    public var id: UUID
    public var userId: String
    public var startedAt: Date
    public var endedAt: Date?
    public var totalReps: Int
    public var bestSet: Int
    public var countingMode: String
    public var isVerified: Bool
    public var programSlug: String?

    public init(id: UUID, userId: String, startedAt: Date, endedAt: Date?,
                totalReps: Int, bestSet: Int, countingMode: String,
                isVerified: Bool, programSlug: String?) {
        self.id = id
        self.userId = userId
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.totalReps = totalReps
        self.bestSet = bestSet
        self.countingMode = countingMode
        self.isVerified = isVerified
        self.programSlug = programSlug
    }
}

public actor SyncService {
    private let config: SupabaseConfig
    private let auth: SupabaseAuth
    private let http: HTTPClient

    public init(config: SupabaseConfig, auth: SupabaseAuth, http: HTTPClient = URLSessionHTTPClient()) {
        self.config = config
        self.auth = auth
        self.http = http
    }

    private func authorized(_ url: URL, method: String) async throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(try await auth.validAccessToken())",
                         forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }

    /// Uploads sessions, updating any the server already has.
    ///
    /// Upsert rather than insert because the alternative is asking the client
    /// to track what it has already sent, and getting that wrong duplicates a
    /// user's workout history - which is worse than sending the same row twice.
    public func push(_ sessions: [RemoteSession]) async throws {
        guard !sessions.isEmpty else { return }
        var request = try await authorized(
            config.restURL.appendingPathComponent("workout_sessions"), method: "POST")
        request.setValue("resolution=merge-duplicates,return=minimal",
                         forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONEncoder.supabase.encode(sessions)
        try await expectSuccess(request)
    }

    public func pull(since: Date? = nil) async throws -> [RemoteSession] {
        var items = [URLQueryItem(name: "select", value: "*"),
                     URLQueryItem(name: "order", value: "started_at.desc")]
        if let since {
            items.append(URLQueryItem(name: "started_at",
                                      value: "gte.\(ISO8601DateFormatter().string(from: since))"))
        }
        let url = config.restURL.appendingPathComponent("workout_sessions").appending(queryItems: items)
        let request = try await authorized(url, method: "GET")

        let (data, response) = try await http.send(request)
        guard (200..<300).contains(response.statusCode) else {
            throw SupabaseError.badResponse(status: response.statusCode,
                                            body: String(data: data, encoding: .utf8) ?? "")
        }
        do {
            return try JSONDecoder.supabase.decode([RemoteSession].self, from: data)
        } catch {
            throw SupabaseError.decoding("\(error)")
        }
    }

    private func expectSuccess(_ request: URLRequest) async throws {
        let (data, response) = try await http.send(request)
        guard (200..<300).contains(response.statusCode) else {
            throw SupabaseError.badResponse(status: response.statusCode,
                                            body: String(data: data, encoding: .utf8) ?? "")
        }
    }
}
