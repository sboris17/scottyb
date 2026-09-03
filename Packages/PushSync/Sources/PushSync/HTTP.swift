import Foundation

/// Seam for testing. Everything network-facing goes through this, so the
/// request-building and error-handling logic can be exercised without a
/// server or a live Supabase project.
public protocol HTTPClient: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

public struct URLSessionHTTPClient: HTTPClient {
    private let session: URLSession

    /// Twenty seconds, not the default sixty.
    ///
    /// Every one of these calls has somebody waiting on a spinner, and a
    /// minute of that is indistinguishable from the app being broken. Failing
    /// costs nothing here - workouts are already saved locally and the sync
    /// retries - so it is better to say so and let them try again.
    public init(session: URLSession? = nil) {
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.default
            configuration.timeoutIntervalForRequest = 20
            configuration.waitsForConnectivity = false
            self.session = URLSession(configuration: configuration)
        }
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError.decoding("response was not HTTP")
        }
        return (data, http)
    }
}

/// Postgres `timestamptz` comes back as ISO-8601, but whether it carries
/// fractional seconds depends on the value stored - `10:00:00Z` and
/// `10:00:00.123456Z` both appear in the same column.
///
/// Foundation's `.iso8601` strategy handles only the first and throws on the
/// second: a decoding failure that appears against real rows while passing
/// against hand-written test JSON. So try both.
enum SupabaseDate {
    private static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func parse(_ string: String) -> Date? {
        withFractionalSeconds.date(from: string) ?? plain.date(from: string)
    }
}

extension JSONDecoder {
    static var supabase: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            guard let date = SupabaseDate.parse(raw) else {
                throw DecodingError.dataCorrupted(.init(
                    codingPath: decoder.codingPath,
                    debugDescription: "Not an ISO-8601 timestamp: \(raw)"))
            }
            return date
        }
        return decoder
    }
}

extension JSONEncoder {
    static var supabase: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}
