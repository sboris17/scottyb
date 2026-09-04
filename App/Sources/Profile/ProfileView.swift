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
    @State private var confirmingReset = false
    @State private var nameDraft = ""
    @State private var exportError: String?
    @AppStorage("showCountingDebug") private var showCountingDebug = true
    @AppStorage("recordPoseData") private var recordPoseData = false
    // Replaying onboarding otherwise means deleting the app, which also throws
    // away the history you were testing against.
    @AppStorage("hasOnboarded") private var hasOnboarded = false
    @State private var authModel = AuthModel()
    @Environment(SyncCoordinator.self) private var syncer
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    profileHeader
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 16, trailing: 0))
                }

                Section("Your name") {
                    TextField("What should we call you?", text: $nameDraft)
                        .onSubmit { store.updateDisplayName(nameDraft) }
                        .submitLabel(.done)
                }

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

                // Shown whenever a project is configured, rather than behind
                // a switch. The switch existed because nothing actually synced
                // yet; now that it does, it is pure friction - and it hid the
                // whole feature behind a toggle buried in a section called
                // "Testing", which is exactly where nobody looks for a login.
                if authModel.isConfigured {
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
                Section {
                    Toggle("Show counting debug", isOn: $showCountingDebug)
                    Toggle("Record sets for debugging", isOn: $recordPoseData)
                    Button("Show onboarding again") { hasOnboarded = false }
                    Button("Reset all progress", role: .destructive) { confirmingReset = true }
                } header: {
                    Text("Testing")
                } footer: {
                    Text("Overlays what the counter is seeing during a set \u{2014} angles, thresholds, and which check rejected a rep.\n\nRecording saves where your joints were, so a set can be replayed against the counter afterwards instead of guessed at. No video and nothing that identifies you: twelve coordinates a frame, and the summary asks what you really did so the clip means something.")
                }
            }
            .navigationTitle("Profile")
            .onAppear {
                goalDraft = store.profile.dailyGoal
                nameDraft = store.profile.displayName
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
            // It deletes every workout on this phone and, when signed in, on
            // the server as well. One tap was never the right amount of
            // friction for that, and it is now less recoverable than it was.
            .confirmationDialog("Reset all progress?",
                                isPresented: $confirmingReset,
                                titleVisibility: .visible) {
                Button("Delete everything", role: .destructive) {
                    Task {
                        // Server first. Clearing the phone first and failing
                        // here would leave rows behind that the next pull
                        // quietly restores.
                        await syncer.deleteEverythingRemote()
                        store.resetProgress()
                        syncer.refreshPendingCount(modelContext)
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(authModel.isSignedIn
                     ? "Every workout, streak and record is deleted from this phone and from your account. This cannot be undone."
                     : "Every workout, streak and record on this phone is deleted. This cannot be undone.")
            }
        }
    }

    /// Who this is, and the one number worth leading with.
    ///
    /// The screen was a settings list with a heading of "You" and nothing on
    /// it that was about anybody. A name, how long you have been at it, and
    /// your lifetime total costs one card and makes the rest read as yours
    /// rather than as preferences.
    private var profileHeader: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Push.Palette.accent.opacity(0.18))
                    .frame(width: 76, height: 76)
                Text(initials)
                    .font(Push.Typography.stat(28))
                    .foregroundStyle(Push.Palette.accent)
            }
            Text(store.profile.displayName.isEmpty ? "Push-up in progress" : store.profile.displayName)
                .font(Push.Typography.title)
                .foregroundStyle(Push.Palette.textPrimary)
            Text(memberSince)
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)

            HStack(spacing: 10) {
                StatChip(emoji: "\u{1F4AA}", value: "\(store.records.lifetimeTotal)", caption: "Lifetime")
                StatChip(emoji: "\u{1F525}", value: "\(store.currentStreak)", caption: "Streak")
                StatChip(emoji: "\u{1F3C6}", value: "\(store.records.bestSet)", caption: "Best set")
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
    }

    private var initials: String {
        let parts = store.profile.displayName
            .split(separator: " ")
            .compactMap(\.first)
            .prefix(2)
        return parts.isEmpty ? "\u{1F4AA}" : String(parts).uppercased()
    }

    private var memberSince: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return "Pushing since \(formatter.string(from: store.profile.createdAt))"
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
            // Anything under a minute came back as "in 0 seconds": future
            // tense, for something that had already happened.
            if Date().timeIntervalSince(last) < 60 { return "Last synced just now." }
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
