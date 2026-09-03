import SwiftUI
import SwiftData
import PushUI
import PushCore

struct ProfileView: View {
    @Environment(Store.self) private var store
    @State private var goalDraft: Int = 25
    @State private var cadence: Feedback.Cadence = Feedback.shared.spokenCadence
    @State private var haptics = true
    @State private var exportFile: ExportFile?
    @State private var exportError: String?
    @AppStorage("showCountingDebug") private var showCountingDebug = true
    @AppStorage("enableAccounts") private var enableAccounts = false
    @State private var authModel = AuthModel()
    @Environment(SyncCoordinator.self) private var syncer
    @Environment(\.modelContext) private var modelContext

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
                        if authModel.isSignedIn {
                            SyncStatusRow(syncer: syncer) {
                                await syncer.sync(modelContext)
                            }
                        }
                    } header: {
                        Text("Account")
                    } footer: {
                        Text("Signing in lets your history sync across devices. Everything works without it \u{2014} workouts are saved on this phone first, always.")
                    }
                }

                Section {
                    Toggle("Show counting debug", isOn: $showCountingDebug)
                    Toggle("Enable accounts (preview)", isOn: $enableAccounts)
                    Button("Reset all progress", role: .destructive) { store.resetProgress() }
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
                syncer.refreshPendingCount(modelContext)
            }
            .onChange(of: authModel.isSignedIn) { _, signedIn in
                // Signing in is the moment to reconcile: everything done
                // before the account existed goes up, and anything from
                // another device comes down.
                guard signedIn else { return }
                Task { await syncer.sync(modelContext) }
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

/// Sync state, said plainly.
///
/// The one thing this must never do is imply a workout is at risk. It is not:
/// it is on the phone. "Waiting to sync" is a normal state, not a warning, and
/// nothing here is coloured as an error except an answer the server actually
/// gave.
private struct SyncStatusRow: View {
    let syncer: SyncCoordinator
    let onSyncNow: () async -> Void
    @State private var isSyncing = false

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(Push.Typography.body)
                    .foregroundStyle(Push.Palette.textPrimary)
                if let detail {
                    Text(detail)
                        .font(Push.Typography.caption)
                        .foregroundStyle(isError ? Push.Palette.flame : Push.Palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 12)
            if syncer.status.isBusy || isSyncing {
                ProgressView()
            } else {
                Button("Sync now") {
                    isSyncing = true
                    Task { await onSyncNow(); isSyncing = false }
                }
                .font(Push.Typography.caption)
            }
        }
    }

    private var title: String {
        switch syncer.status {
        case .syncing: return "Syncing…"
        case .failed: return "Not synced yet"
        case .idle where syncer.pendingCount > 0: return "\(syncer.pendingCount) waiting to sync"
        case .idle: return "Everything synced"
        case .signedOut: return "Signed out"
        case .disabled: return "Sync is off"
        }
    }

    private var detail: String? {
        switch syncer.status {
        case .failed(let reason): return reason
        case .idle(let last?):
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .full
            return "Last synced \(formatter.localizedString(for: last, relativeTo: Date()))."
        default: return nil
        }
    }

    private var isError: Bool {
        if case .failed = syncer.status { return true }
        return false
    }
}
