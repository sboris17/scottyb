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

    public var spokenCadence: Cadence = .everyFive
    public var hapticsEnabled = true

    private let synthesizer = AVSpeechSynthesizer()

    #if canImport(UIKit)
    private let light = UIImpactFeedbackGenerator(style: .light)
    private let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private let notice = UINotificationFeedbackGenerator()
    #endif

    private init() {}

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

    public func setComplete() {
        #if canImport(UIKit)
        if hapticsEnabled { heavy.impactOccurred() }
        #endif
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
