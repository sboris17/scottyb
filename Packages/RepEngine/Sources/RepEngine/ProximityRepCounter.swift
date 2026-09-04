import Foundation

/// Turns a near/far sensor into a rep count.
///
/// The whole of floor mode's counting logic, kept here rather than in the app
/// so it can be tested without a device. It is small, and that is the point -
/// but small is not the same as obviously correct, and this is now a primary
/// counting path rather than a fallback. Every counting bug in this project so
/// far has been in code that looked too simple to test.
///
/// One bit arrives: something is close, or it is not. A rep is a complete
/// near-then-far cycle, credited on the way up - the same moment the camera
/// engine completes a rep, and the moment the person is upright enough to hear
/// it announced.
public struct ProximityRepCounter: Sendable {

    /// Reps closer together than this are a bounce or a sensor twitch. Shares
    /// the camera engine's floor for the same reason: somebody coming off the
    /// floor and back down inside half a second has not done two of anything.
    public var minimumRepSeconds: Double

    /// A chest resting on the sensor while somebody catches their breath must
    /// not read as one very slow rep when they finally get up.
    public var maximumNearSeconds: Double

    public private(set) var count = 0
    public private(set) var isNear = false

    private var wentNearAt: Double?
    private var lastRepAt: Double?

    public init(minimumRepSeconds: Double = 0.45, maximumNearSeconds: Double = 8.0) {
        self.minimumRepSeconds = minimumRepSeconds
        self.maximumNearSeconds = maximumNearSeconds
    }

    /// Adopts the sensor's current reading as the starting state, without
    /// treating it as a transition.
    ///
    /// Matters when a set begins with somebody already lying on the phone: the
    /// first reading would otherwise look like a descent, and standing up
    /// afterwards would be credited as a rep nobody did.
    public mutating func prime(near: Bool) {
        isNear = near
        wentNearAt = nil
    }

    public mutating func reset() {
        count = 0
        isNear = false
        wentNearAt = nil
        lastRepAt = nil
    }

    /// Feeds one sensor reading. Returns true when it completed a rep.
    ///
    /// `time` is seconds on any steady clock; the counter only ever takes
    /// differences, so where zero sits does not matter.
    @discardableResult
    public mutating func update(near: Bool, at time: Double) -> Bool {
        defer { isNear = near }
        guard near != isNear else { return false }

        if near {
            wentNearAt = time
            return false
        }

        // Rising. Without a recorded descent there is no rep - which is what
        // stops a session that begins with the sensor already covered from
        // crediting a rep for standing up.
        guard let start = wentNearAt else { return false }
        wentNearAt = nil

        guard time - start <= maximumNearSeconds else { return false }
        if let lastRepAt, time - lastRepAt < minimumRepSeconds { return false }

        lastRepAt = time
        count += 1
        return true
    }
}
