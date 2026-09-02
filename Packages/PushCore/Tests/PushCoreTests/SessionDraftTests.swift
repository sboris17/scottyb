import XCTest
@testable import PushCore

final class SessionDraftTests: XCTestCase {
    private var defaults: UserDefaults!
    private var store: SessionDraftStore!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "draft-tests-\(UUID().uuidString)")
        store = SessionDraftStore(defaults: defaults)
    }

    private func draft(startedAt: Date = Date(), completed: [Int] = [15],
                       targets: [Int] = [15, 15, 15]) -> SessionDraft {
        SessionDraft(startedAt: startedAt, source: .program, countingMode: .camera,
                     targets: targets, restSeconds: [60, 60, 60], completedSets: completed)
    }

    func testRoundTrips() {
        let original = draft()
        store.save(original)
        XCTAssertEqual(store.load(), original)
    }

    func testEmptyStoreLoadsNothing() {
        XCTAssertNil(store.load())
    }

    /// Resuming a workout from yesterday is worse than dropping it.
    func testStaleDraftIsDiscarded() {
        store.save(draft(startedAt: Date().addingTimeInterval(-7 * 60 * 60)))
        XCTAssertNil(store.load())
        XCTAssertNil(defaults.data(forKey: SessionDraftStore.key), "stale drafts should be cleaned up")
    }

    /// Nothing was done yet, so there is nothing to offer to resume.
    func testDraftWithNoRepsIsNotWorthResuming() {
        store.save(draft(completed: []))
        XCTAssertNil(store.load())
    }

    /// All sets done means the session finished; the draft is just leftover.
    func testCompletedDraftIsNotResumable() {
        store.save(draft(completed: [15, 15, 15]))
        XCTAssertNil(store.load())
    }

    func testClearRemovesDraft() {
        store.save(draft())
        store.clear()
        XCTAssertNil(store.load())
    }

    func testTotalRepsSumsCompletedSets() {
        XCTAssertEqual(draft(completed: [12, 10, 8]).totalReps, 30)
    }
}
