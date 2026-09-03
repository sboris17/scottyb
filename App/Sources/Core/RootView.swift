import SwiftUI
import SwiftData
import PushUI
import PushCore

struct RootView: View {
    @State private var store: Store
    @State private var syncer: SyncCoordinator
    @AppStorage("hasOnboarded") private var hasOnboarded = false
    @AppStorage("enableAccounts") private var enableAccounts = false
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.modelContext) private var modelContext

    init(context: ModelContext) {
        _store = State(initialValue: Store(context: context))
        _syncer = State(initialValue: SyncCoordinator(
            enabled: UserDefaults.standard.bool(forKey: "enableAccounts")))
    }

    var body: some View {
        Group {
            if hasOnboarded && !Screenshots.forcesOnboarding {
                MainTabs()
                    .environment(Screenshots.store ?? store)
                    .environment(syncer)
            } else {
                OnboardingView(store: store) { hasOnboarded = true }
            }
        }
        .tint(Push.Palette.accent)
        .onChange(of: enableAccounts) { _, on in
            syncer = SyncCoordinator(enabled: on)
        }
        // Coming back to the app is the natural moment to retry: it is when
        // the phone is most likely to have found a network again, and it costs
        // nothing when there is nothing pending.
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            syncer.syncSoon(modelContext)
        }
    }
}

struct MainTabs: View {
    @State private var selection = Screenshots.tab

    var body: some View {
        TabView(selection: $selection) {
            HomeView()
                .tabItem { Label("Today", systemImage: "flame.fill") }
                .tag(Screenshots.Tab.today)
            ProgramsView()
                .tabItem { Label("Programs", systemImage: "list.bullet.rectangle") }
                .tag(Screenshots.Tab.programs)
            StatsView()
                .tabItem { Label("Stats", systemImage: "chart.bar.fill") }
                .tag(Screenshots.Tab.stats)
            ProfileView()
                .tabItem { Label("You", systemImage: "person.fill") }
                .tag(Screenshots.Tab.you)
        }
    }
}

/// Lets a launch argument open the app straight onto a given screen, with
/// history already in it.
///
/// Screenshotting a build is otherwise stuck on whatever the app opens to,
/// which on a fresh install is onboarding and after that is an empty Today.
/// Neither is the screen anybody wants to look at when they are judging how
/// something looks. Xcode's canvas covers this for one view at a time; this
/// covers the whole app, from a script, in the real simulator.
///
/// DEBUG only, and inert unless the arguments are passed, so a release build
/// cannot be talked into a fake store.
enum Screenshots {
    enum Tab: Hashable { case today, programs, stats, you }

    #if DEBUG
    private static let arguments = ProcessInfo.processInfo.arguments

    static var tab: Tab {
        guard let index = arguments.firstIndex(of: "-screen"),
              index + 1 < arguments.count else { return .today }
        switch arguments[index + 1] {
        case "programs": return .programs
        case "stats": return .stats
        case "you", "profile": return .you
        default: return .today
        }
    }

    static var forcesOnboarding: Bool {
        arguments.contains("-screen") && arguments.contains("onboarding")
    }

    /// A fortnight of plausible history, shared with the Xcode previews so the
    /// two never drift apart.
    @MainActor static let store: Store? =
        arguments.contains("-demoData") ? PreviewSupport.populatedStore() : nil
    #else
    static var tab: Tab { .today }
    static var forcesOnboarding: Bool { false }
    @MainActor static let store: Store? = nil
    #endif
}
