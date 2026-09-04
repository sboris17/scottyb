import Foundation
import RepEngine
#if canImport(UIKit)
import UIKit
#endif

/// Counts push-ups with the proximity sensor instead of the camera.
///
/// Phone on the floor, screen up, under your chest. Every rep your chest comes
/// within a few centimetres of the sensor - `near` - and pushing back up
/// returns it to `far`. A completed near-then-far cycle is one rep.
///
/// This is a better primary method than the camera for almost everybody, and
/// the reasons are not subtle. It has no opinion about camera angle, distance,
/// height, lighting, background clutter or what you are wearing - every one of
/// which cost a real test session. It works in the dark. It costs almost no
/// battery. And the phone ends up directly under your face rather than propped
/// across the room, so the count is readable while you work.
///
/// It also enforces depth honestly and for free: the sensor cannot be
/// triggered without your chest genuinely reaching the floor. That is a
/// stricter rep than any threshold the camera engine applies.
///
/// What it gives up is detail. One bit - close or not - says nothing about
/// hip sag, tempo or form, and a hand over the sensor would fool it. So this
/// counts, and the camera stays the mode that can judge.
@Observable
final class ProximityCounter {

    enum Availability: Equatable {
        case ready
        case unsupported          // iPad, simulator, or no sensor
    }

    private(set) var availability: Availability = .unsupported
    private(set) var count = 0
    private(set) var isNear = false

    /// The counting itself lives in RepEngine, where it is unit-tested without
    /// a device. This class is only the sensor plumbing.
    private var engine = ProximityRepCounter()
    private var observer: NSObjectProtocol?
    private let started = Date()

    var onRep: ((Int) -> Void)?

    // MARK: - Lifecycle

    func start() {
        #if canImport(UIKit)
        let device = UIDevice.current
        device.isProximityMonitoringEnabled = true

        // Setting it is a request, not a guarantee. On hardware without the
        // sensor the property simply stays false, which is the only honest way
        // to find out.
        guard device.isProximityMonitoringEnabled else {
            availability = .unsupported
            return
        }
        availability = .ready
        // Adopted as the starting state rather than treated as a change: a set
        // begun while already lying on the phone would otherwise credit a rep
        // for standing up.
        isNear = device.proximityState
        engine.prime(near: isNear)

        observer = NotificationCenter.default.addObserver(
            forName: UIDevice.proximityStateDidChangeNotification,
            object: device,
            queue: .main
        ) { [weak self] _ in
            self?.handle(UIDevice.current.proximityState)
        }
        #else
        availability = .unsupported
        #endif
    }

    func stop() {
        #if canImport(UIKit)
        if let observer { NotificationCenter.default.removeObserver(observer) }
        observer = nil
        // Left on, the screen keeps blanking whenever anything comes near the
        // phone - long after the workout is over.
        UIDevice.current.isProximityMonitoringEnabled = false
        #endif
        engine.reset()
    }

    func reset() {
        count = 0
        engine.reset()
        #if canImport(UIKit)
        if availability == .ready { engine.prime(near: UIDevice.current.proximityState) }
        #endif
    }

    // MARK: - Counting

    private func handle(_ near: Bool) {
        let counted = engine.update(near: near, at: Date().timeIntervalSince(started))
        isNear = near
        if counted {
            count = engine.count
            onRep?(count)
        }
    }
}
