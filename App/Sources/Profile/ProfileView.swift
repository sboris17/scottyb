import SwiftUI
import PushUI
import PushCore

struct ProfileView: View {
    @Environment(Store.self) private var store
    @State private var goalDraft: Int = 25
    @State private var cadence: Feedback.Cadence = .everyFive
    @State private var haptics = true
    @State private var exportFile: ExportFile?
    @State private var exportError: String?
    @AppStorage("showCountingDebug") private var showCountingDebug = true
    @AppStorage("enableAccounts") private var enableAccounts = false
    @State private var authModel = AuthModel()

    var body: some View {
        NavigationStack {
            Form {
                Section("Daily goal") {
                    Stepper("\(goalDraft) push-ups", value: $goalDraft, in: 5...500, step: 5)
                        .onChange(of: goalDraft) { _, value in store.updateDailyGoal(value) }
                }

                Section("Counting") {
                    Picker("Spoken count", selection: $cadence) {
                        ForEach(Feedback.Cadence.allCases) { option in
                            Text(option.title).tag(option)
                        }
                    }
                    .onChange(of: cadence) { _, value in Feedback.shared.spokenCadence = value }

                    Toggle("Haptics", isOn: $haptics)
                        .onChange(of: haptics) { _, value in Feedback.shared.hapticsEnabled = value }

                    Text("Mid-set you can't see the screen, so the app counts out loud and taps you on every rep.")
                        .font(Push.Typography.caption)
                        .foregroundStyle(Push.Palette.textSecondary)
                }

                if enableAccounts {
                    Section {
                        AppleSignInView(model: authModel)
                            .listRowBackground(Color.clear)
                    } header: {
                        Text("Account")
                    } footer: {
                        Text("Signing in lets your history sync across devices. Everything works without it.")
                    }
                }

                Section {
                    Toggle("Show counting debug", isOn: $showCountingDebug)
                    Toggle("Enable accounts (preview)", isOn: $enableAccounts)
                } header: {
                    Text("Testing")
                } footer: {
                    Text("Overlays what the counter is seeing during a set \u{2014} angles, thresholds, and which check rejected a rep. Also lets you cycle the camera rotation if counts look wrong.")
                }

                Section("Your numbers") {
                    LabeledContent("Lifetime", value: "\(store.records.lifetimeTotal)")
                    LabeledContent("Best set", value: "\(store.records.bestSet)")
                    LabeledContent("Longest streak", value: "\(store.records.longestStreak) days")
                    LabeledContent("Sessions", value: "\(store.sessionCount)")
                }

                Section {
                    Button("Export my data") { export() }
                    if let exportError {
                        Text(exportError).font(Push.Typography.caption).foregroundStyle(Push.Palette.flame)
                    }
                } footer: {
                    Text("Your data stays on your device and in your own iCloud. Camera frames are analysed and discarded \u{2014} never recorded, never uploaded.")
                }
            }
            .navigationTitle("You")
            .onAppear {
                goalDraft = store.profile.dailyGoal
                cadence = Feedback.shared.spokenCadence
                haptics = Feedback.shared.hapticsEnabled
            }
            .sheet(item: $exportFile) { file in
                ShareSheet(url: file.url)
            }
        }
    }

    private func export() {
        do {
            let data = try store.exportJSON()
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("push-export.json")
            try data.write(to: url, options: .atomic)
            exportFile = ExportFile(url)
        } catch {
            exportError = "Could not build the export: \(error.localizedDescription)"
        }
    }
}

private struct ExportFile: Identifiable {
    let id = UUID()
    let url: URL
    init(_ url: URL) { self.url = url }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
