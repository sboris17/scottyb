import SwiftUI
#if canImport(UIKit)
import UIKit
#endif
import AVFoundation

/// Haptics and speech.
///
/// This matters more than it looks. Mid-set the user is face-down on the floor
/// and cannot see the screen at the bottom of a rep, so touch and sound are
/// the primary feedback channel and the display is secondary.
public final class Feedback {
    public static let shared = Feedback()

    public enum Cadence: Int, CaseIterable, Identifiable {
        case everyRep = 1
        case everyFive = 5
        case silent = 0

        public var id: Int { rawValue }
        public var title: String {
            switch self {
            case .everyRep: return "Every rep"
            case .everyFive: return "Every 5 reps"
            case .silent: return "Silent"
            }
        }
    }

    /// Every rep by default.
    ///
    /// It used to be every fifth, which reads as the tidier choice and is the
    /// wrong one. The phone is several feet away and unreadable - that is the
    /// whole reason this class exists - so between reps one and four the app
    /// gives no sign it is working at all. Someone who has been let down by
    /// the counter before will stop and go and look, which is exactly what
    /// happened. Counting out loud from the first rep is the difference
    /// between trusting it and checking on it.
    public var spokenCadence: Cadence = .everyRep {
        didSet { defaults.set(spokenCadence.rawValue, forKey: Self.cadenceKey) }
    }
    public var hapticsEnabled = true {
        didSet { defaults.set(hapticsEnabled, forKey: Self.hapticsKey) }
    }

    private static let cadenceKey = "feedback.spokenCadence"
    private static let hapticsKey = "feedback.hapticsEnabled"
    private let defaults = UserDefaults.standard

    private let synthesizer = AVSpeechSynthesizer()

    #if canImport(UIKit)
    private let light = UIImpactFeedbackGenerator(style: .light)
    private let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private let notice = UINotificationFeedbackGenerator()
    #endif

    /// Both preferences lived only in memory, so every choice made in Profile
    /// was silently forgotten the next time the app launched.
    private init() {
        if let stored = defaults.object(forKey: Self.cadenceKey) as? Int,
           let cadence = Cadence(rawValue: stored) {
            spokenCadence = cadence
        }
        if defaults.object(forKey: Self.hapticsKey) != nil {
            hapticsEnabled = defaults.bool(forKey: Self.hapticsKey)
        }
    }

    /// Warm the generators up before a set: the first haptic after a cold
    /// start is late, and a late haptic on rep one feels like a miscount.
    public func prepare() {
        #if canImport(UIKit)
        light.prepare()
        heavy.prepare()
        notice.prepare()
        #endif
    }

    public func repCounted(_ count: Int) {
        #if canImport(UIKit)
        if hapticsEnabled { light.impactOccurred(intensity: 0.7) }
        #endif
        switch spokenCadence {
        case .silent: break
        case .everyRep: speak("\(count)")
        case .everyFive: if count % 5 == 0 { speak("\(count)") }
        }
    }

    /// Announced, not just tapped out. A haptic says "something happened"; it
    /// cannot say whether the set ended, how many you got, or how long the
    /// rest is - and those are the moments a person lifts their head to look.
    public func setComplete(reps: Int? = nil, restSeconds: Int? = nil) {
        #if canImport(UIKit)
        if hapticsEnabled { heavy.impactOccurred() }
        #endif
        guard spokenCadence != .silent, let reps else { return }
        if let restSeconds, restSeconds > 0 {
            speak("Set done. \(reps) reps. Rest \(restSeconds) seconds.")
        } else {
            speak("Set done. \(reps) reps.")
        }
    }

    public func setBeginning(_ index: Int) {
        #if canImport(UIKit)
        if hapticsEnabled { heavy.impactOccurred() }
        #endif
        guard spokenCadence != .silent else { return }
        speak("Set \(index). Go.")
    }

    public func celebrate() {
        #if canImport(UIKit)
        if hapticsEnabled { notice.notificationOccurred(.success) }
        #endif
    }

    public func warn() {
        #if canImport(UIKit)
        if hapticsEnabled { notice.notificationOccurred(.warning) }
        #endif
    }

    public func speak(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = 0.52
        utterance.volume = 0.9
        synthesizer.speak(utterance)
    }
}
