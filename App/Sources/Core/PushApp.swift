import SwiftUI
import SwiftData
import PushCore

@main
struct PushApp: App {
    private let container: ModelContainer

    init() {
        do {
            let schema = Schema(PushSchema.models)
            container = try ModelContainer(
                for: schema,
                configurations: ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
            )
        } catch {
            // Nothing useful can happen without a store, and silently running
            // in memory would quietly discard the user's streak.
            fatalError("Could not create the local store: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView(context: container.mainContext)
        }
        .modelContainer(container)
    }
}
