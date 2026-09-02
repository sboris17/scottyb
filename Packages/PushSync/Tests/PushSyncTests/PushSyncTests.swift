import XCTest
@testable import PushSync

final class StubHTTPClient: HTTPClient, @unchecked Sendable {
    var status = 200
    var body = Data()
    private(set) var requests: [URLRequest] = []

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status,
                                       httpVersion: nil, headerFields: nil)!
        return (body, response)
    }

    var lastBodyJSON: [String: Any]? {
        guard let data = requests.last?.httpBody else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}

private let config = SupabaseConfig(url: URL(string: "https://abc.supabase.co")!,
                                    anonKey: "anon-key-123")

private func tokenPayload(expiresIn: Double = 3600) -> Data {
    Data("""
    {"access_token":"at-1","refresh_token":"rt-1","expires_in":\(expiresIn),
     "user":{"id":"user-uuid","email":"a@b.c"}}
    """.utf8)
}

final class NonceTests: XCTestCase {
    /// Apple gets the SHA256 of the nonce, Supabase gets the raw value. Send
    /// the same thing to both and it fails only at the server, so this is
    /// pinned to a known vector.
    func testSHA256MatchesKnownVector() {
        XCTAssertEqual(Nonce.sha256("abc"),
                       "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }

    func testHashIsLowercaseHexOfExpectedLength() {
        let hash = Nonce.sha256(Nonce.random())
        XCTAssertEqual(hash.count, 64)
        XCTAssertEqual(hash, hash.lowercased())
    }

    func testRandomNoncesDifferAndRespectLength() {
        XCTAssertEqual(Nonce.random(length: 40).count, 40)
        XCTAssertNotEqual(Nonce.random(), Nonce.random())
    }
}

final class AuthSessionTests: XCTestCase {
    private func session(expiresIn: TimeInterval) -> AuthSession {
        AuthSession(accessToken: "a", refreshToken: "r",
                    expiresAt: Date().addingTimeInterval(expiresIn),
                    userID: "u", email: nil)
    }

    func testFreshSessionIsNotExpired() {
        XCTAssertFalse(session(expiresIn: 3600).isExpired())
    }

    func testPastSessionIsExpired() {
        XCTAssertTrue(session(expiresIn: -1).isExpired())
    }

    /// Expiring 30s from now counts as expired: a token that dies mid-request
    /// produces a spurious failure the user sees.
    func testSessionNearExpiryIsTreatedAsExpired() {
        XCTAssertTrue(session(expiresIn: 30).isExpired())
    }
}

final class SupabaseAuthTests: XCTestCase {
    func testAppleSignInSendsRawNonceAndIdentityToken() async throws {
        let http = StubHTTPClient()
        http.body = tokenPayload()
        let auth = SupabaseAuth(config: config, http: http, storage: InMemorySessionStore())

        let session = try await auth.signInWithApple(identityToken: "apple-jwt", rawNonce: "raw-nonce")

        XCTAssertEqual(session.userID, "user-uuid")
        XCTAssertEqual(session.accessToken, "at-1")

        let request = try XCTUnwrap(http.requests.last)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "apikey"), "anon-key-123")
        XCTAssertTrue(request.url?.absoluteString.contains("grant_type=id_token") == true)

        let body = try XCTUnwrap(http.lastBodyJSON)
        XCTAssertEqual(body["provider"] as? String, "apple")
        XCTAssertEqual(body["id_token"] as? String, "apple-jwt")
        // The raw nonce, never the hash.
        XCTAssertEqual(body["nonce"] as? String, "raw-nonce")
    }

    func testSignInPersistsSession() async throws {
        let http = StubHTTPClient()
        http.body = tokenPayload()
        let store = InMemorySessionStore()
        let auth = SupabaseAuth(config: config, http: http, storage: store)

        _ = try await auth.signInWithApple(identityToken: "t", rawNonce: "n")
        XCTAssertEqual(try store.load()?.accessToken, "at-1")
    }

    func testServerErrorSurfacesStatusAndBody() async throws {
        let http = StubHTTPClient()
        http.status = 400
        http.body = Data(#"{"error":"invalid nonce"}"#.utf8)
        let auth = SupabaseAuth(config: config, http: http, storage: InMemorySessionStore())

        do {
            _ = try await auth.signInWithApple(identityToken: "t", rawNonce: "n")
            XCTFail("expected a failure")
        } catch let error as SupabaseError {
            guard case .badResponse(let status, let body) = error else {
                return XCTFail("wrong error: \(error)")
            }
            XCTAssertEqual(status, 400)
            XCTAssertTrue(body.contains("invalid nonce"))
        }
    }

    func testTokenIsNotRequestedWhenSignedOut() async {
        let auth = SupabaseAuth(config: config, http: StubHTTPClient(),
                                storage: InMemorySessionStore())
        do {
            _ = try await auth.validAccessToken()
            XCTFail("expected notAuthenticated")
        } catch {
            XCTAssertEqual(error as? SupabaseError, .notAuthenticated)
        }
    }

    /// An expired token must refresh transparently rather than failing a sync.
    func testExpiredTokenTriggersRefresh() async throws {
        let http = StubHTTPClient()
        http.body = tokenPayload()
        let expired = AuthSession(accessToken: "old", refreshToken: "rt-old",
                                  expiresAt: Date().addingTimeInterval(-10),
                                  userID: "u", email: nil)
        let auth = SupabaseAuth(config: config, http: http,
                                storage: InMemorySessionStore(expired))

        let token = try await auth.validAccessToken()
        XCTAssertEqual(token, "at-1")
        XCTAssertTrue(http.requests.last?.url?.absoluteString.contains("grant_type=refresh_token") == true)
        XCTAssertEqual(http.lastBodyJSON?["refresh_token"] as? String, "rt-old")
    }

    func testValidTokenIsReusedWithoutNetwork() async throws {
        let http = StubHTTPClient()
        let live = AuthSession(accessToken: "still-good", refreshToken: "r",
                               expiresAt: Date().addingTimeInterval(3600),
                               userID: "u", email: nil)
        let auth = SupabaseAuth(config: config, http: http, storage: InMemorySessionStore(live))

        // Hoisted out of the assertion: XCTAssert* take autoclosures, which
        // cannot be async.
        let token = try await auth.validAccessToken()
        XCTAssertEqual(token, "still-good")
        XCTAssertTrue(http.requests.isEmpty, "a valid token should not hit the network")
    }
}

final class SyncServiceTests: XCTestCase {
    private func signedInAuth(_ http: StubHTTPClient) -> SupabaseAuth {
        let live = AuthSession(accessToken: "at-live", refreshToken: "r",
                               expiresAt: Date().addingTimeInterval(3600),
                               userID: "user-uuid", email: nil)
        return SupabaseAuth(config: config, http: http, storage: InMemorySessionStore(live))
    }

    private func sample(id: UUID = UUID()) -> RemoteSession {
        RemoteSession(id: id, userId: "user-uuid", startedAt: Date(), endedAt: Date(),
                      totalReps: 42, bestSet: 20, countingMode: "camera",
                      isVerified: true, programSlug: "road-to-50")
    }

    /// Upsert, not insert: a retry after a dropped connection must update the
    /// same row rather than duplicate the user's workout.
    func testPushUsesUpsertSemantics() async throws {
        let http = StubHTTPClient()
        http.status = 201
        try await SyncService(config: config, auth: signedInAuth(http), http: http)
            .push([sample()])

        let request = try XCTUnwrap(http.requests.last)
        XCTAssertEqual(request.httpMethod, "POST")
        let prefer = try XCTUnwrap(request.value(forHTTPHeaderField: "Prefer"))
        XCTAssertTrue(prefer.contains("merge-duplicates"), "got: \(prefer)")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer at-live")
    }

    func testPushSerialisesSnakeCaseKeys() async throws {
        let http = StubHTTPClient()
        http.status = 201
        try await SyncService(config: config, auth: signedInAuth(http), http: http)
            .push([sample()])

        let body = try XCTUnwrap(http.requests.last?.httpBody)
        let json = try XCTUnwrap(String(data: body, encoding: .utf8))
        XCTAssertTrue(json.contains("total_reps"), "PostgREST needs snake_case columns")
        XCTAssertTrue(json.contains("user_id"))
        XCTAssertFalse(json.contains("totalReps"))
    }

    func testEmptyPushMakesNoRequest() async throws {
        let http = StubHTTPClient()
        try await SyncService(config: config, auth: signedInAuth(http), http: http).push([])
        XCTAssertTrue(http.requests.isEmpty)
    }

    /// Postgres emits fractional seconds on some rows and not others, and
    /// Foundation's stock .iso8601 strategy throws on the fractional form -
    /// a failure that only shows up against real data.
    func testPullDecodesBothTimestampFormats() async throws {
        let http = StubHTTPClient()
        http.body = Data(#"""
        [{"id":"3F2504E0-4F89-11D3-9A0C-0305E82C3301","user_id":"u",
          "started_at":"2026-09-01T10:00:00.123456Z","ended_at":"2026-09-01T10:05:00Z",
          "total_reps":10,"best_set":10,"counting_mode":"camera",
          "is_verified":true,"program_slug":null}]
        """#.utf8)

        let sessions = try await SyncService(config: config, auth: signedInAuth(http), http: http)
            .pull()
        XCTAssertEqual(sessions.count, 1)
        XCTAssertNotNil(sessions.first?.startedAt)
        XCTAssertNotNil(sessions.first?.endedAt)
    }

    func testPullDecodesSessions() async throws {
        let http = StubHTTPClient()
        http.body = Data("""
        [{"id":"3F2504E0-4F89-11D3-9A0C-0305E82C3301","user_id":"user-uuid",
          "started_at":"2026-09-01T10:00:00Z","ended_at":"2026-09-01T10:05:00Z",
          "total_reps":50,"best_set":20,"counting_mode":"camera",
          "is_verified":true,"program_slug":null}]
        """.utf8)

        let sessions = try await SyncService(config: config, auth: signedInAuth(http), http: http)
            .pull()

        XCTAssertEqual(sessions.count, 1)
        XCTAssertEqual(sessions.first?.totalReps, 50)
        XCTAssertNil(sessions.first?.programSlug)
    }
}

final class SupabaseConfigTests: XCTestCase {
    func testEndpointsAreBuiltFromBaseURL() {
        XCTAssertEqual(config.authURL.absoluteString, "https://abc.supabase.co/auth/v1")
        XCTAssertEqual(config.restURL.absoluteString, "https://abc.supabase.co/rest/v1")
    }

    /// A missing config must fail loudly at startup, not degrade into an app
    /// that looks fine and silently never syncs.
    func testMissingBundleConfigThrows() {
        XCTAssertThrowsError(try SupabaseConfig.fromBundle(.main, named: "NoSuchFile")) {
            XCTAssertEqual($0 as? SupabaseError, .missingConfiguration)
        }
    }
}
