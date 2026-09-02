import SwiftUI
import SwiftData
import PushUI
import PushCore

struct RootView: View {
    @State private var store: Store
    @AppStorage("hasOnboarded") private var hasOnboarded = false

    init(context: ModelContext) {
        _store = State(initialValue: Store(context: context))
    }

    var body: some View {
        Group {
            if hasOnboarded {
                MainTabs()
                    .environment(store)
            } else {
                OnboardingView(store: store) { hasOnboarded = true }
            }
        }
        .tint(Push.Palette.accent)
    }
}

struct MainTabs: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Today", systemImage: "flame.fill") }
            ProgramsView()
                .tabItem { Label("Programs", systemImage: "list.bullet.rectangle") }
            StatsView()
                .tabItem { Label("Stats", systemImage: "chart.bar.fill") }
            ProfileView()
                .tabItem { Label("You", systemImage: "person.fill") }
        }
    }
}
