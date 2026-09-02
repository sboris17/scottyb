import SwiftUI
import AVFoundation
import RepEngine
import PushUI
import PushCore
import TrainingEngine

struct SessionContainerView: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var model: SessionModel
    @State private var camera = PoseCameraController()
    @State private var cameraError: String?
    @State private var summary: IdentifiedResult?

    init(launch: SessionLaunch) {
        _model = State(initialValue: SessionModel(prescription: launch.prescription,
                                                  source: launch.source,
                                                  programSlug: launch.programSlug,
                                                  programDayIndex: launch.programDayIndex))
    }

    var body: some View {
        ZStack {
            Push.Palette.background.ignoresSafeArea()

            switch model.phase {
            case .framing:
                FramingView(model: model, camera: camera, error: cameraError) {
                    model.begin(mode: .camera)
                } onManual: {
                    model.switchToManual()
                    model.begin(mode: .manual)
                }
            case .counting:
                CountingView(model: model)
            case .resting:
                RestView(model: model)
            case .finished:
                Color.clear
            }
        }
        .onAppear(perform: startCamera)
        .onDisappear { camera.stop() }
        .onChange(of: model.phase) { _, phase in
            if phase == .finished {
                camera.stop()
                let outcome = model.result()
                store.record(outcome)
                summary = IdentifiedResult(outcome)
            }
        }
        // Held as state rather than derived in a Binding getter: a getter that
        // mints a fresh id on every evaluation makes SwiftUI re-present forever.
        .fullScreenCover(item: $summary) { wrapper in
            SessionSummaryView(result: wrapper.value) { dismiss() }
                .environment(store)
        }
        // The set survives a phone call or a stray notification.
        .interactiveDismissDisabled()
    }

    private func startCamera() {
        camera.onFrame = { frame in model.ingest(frame) }
        camera.onFailure = { error in
            cameraError = error.localizedDescription
            model.switchToManual()
        }
        camera.resetClock()
        Task { await camera.start() }
    }
}

struct IdentifiedResult: Identifiable {
    let id = UUID()
    let value: SessionResult
    init(_ value: SessionResult) { self.value = value }
}

// MARK: - Framing

private struct FramingView: View {
    let model: SessionModel
    let camera: PoseCameraController
    let error: String?
    let onReady: () -> Void
    let onManual: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            CameraPreview(session: camera.captureSession)
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .overlay(alignment: .bottom) {
                    if let issue = model.framingIssue {
                        Text(issue.rawValue)
                            .font(Push.Typography.headline)
                            .foregroundStyle(Push.Palette.textPrimary)
                            .padding(.horizontal, 16).padding(.vertical, 10)
                            .background(.ultraThinMaterial, in: Capsule())
                            .padding(.bottom, 16)
                    }
                }
                .padding(.horizontal)

            VStack(spacing: 8) {
                Text("Prop your phone up to your side")
                    .font(Push.Typography.title)
                    .foregroundStyle(Push.Palette.textPrimary)
                Text("It needs to see your shoulders, arms and hips.")
                    .font(Push.Typography.body)
                    .foregroundStyle(Push.Palette.textSecondary)
                    .multilineTextAlignment(.center)
            }

            if let error {
                Text(error)
                    .font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.flame)
                    .multilineTextAlignment(.center)
            }

            VStack(spacing: 10) {
                PrimaryButton(model.framingIssue == nil ? "I'm ready" : "Start anyway", action: onReady)
                // Never a dead end: manual is always one tap away, never
                // buried behind a menu.
                SecondaryButton("Count manually instead", action: onManual)
            }
            .padding(.horizontal)
        }
        .padding(.vertical)
    }
}

struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.videoPreviewLayer.session = session
        view.videoPreviewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var videoPreviewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }
}

// MARK: - Counting

private struct CountingView: View {
    @Bindable var model: SessionModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            header

            Spacer()

            // The count is the hero. Everything else is deliberately quiet:
            // at the bottom of a rep this is the only thing legible.
            HeroCount(model.repsThisSet, label: model.mode == .manual ? "tap to count" : "push-ups")
                .contentShape(Rectangle())
                .onTapGesture { model.addManualRep() }

            if let target = model.currentTarget {
                Text("Goal: \(target)")
                    .font(Push.Typography.headline)
                    .foregroundStyle(Push.Palette.textSecondary)
                    .padding(.top, 4)
                ProgressView(value: model.setProgress)
                    .tint(Push.Palette.accent)
                    .frame(maxWidth: 220)
                    .padding(.top, 12)
            }

            if let hint = model.currentHint {
                Text(hint.rawValue)
                    .font(Push.Typography.body)
                    .foregroundStyle(Push.Palette.flame)
                    .padding(.top, 18)
                    .transition(.opacity)
            }

            Spacer()

            if model.shouldOfferManual && model.mode == .camera {
                offerManual
            }
            controls
        }
        .padding()
        .animation(.snappy, value: model.currentHint)
    }

    private var header: some View {
        HStack {
            Button {
                model.finish()
            } label: {
                Image(systemName: "xmark")
                    .font(.headline)
                    .foregroundStyle(Push.Palette.textSecondary)
            }
            Spacer()
            Text("Set \(model.currentSetIndex + 1) of \(model.prescription.count)")
                .font(Push.Typography.label)
                .foregroundStyle(Push.Palette.textSecondary)
            Spacer()
            Text(model.mode == .camera ? "\u{1F4F7}" : "\u{270B}")
        }
    }

    /// Shown only once pose has been unusable for several seconds. Nagging
    /// about framing while somebody is mid-set is worse than just counting.
    private var offerManual: some View {
        VStack(spacing: 8) {
            Text("Can't see you clearly")
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)
            SecondaryButton("Switch to tapping") { model.switchToManual() }
        }
        .padding(.bottom, 12)
    }

    private var controls: some View {
        VStack(spacing: 10) {
            if model.mode == .manual {
                HStack(spacing: 12) {
                    SecondaryButton("\u{2212} 1") { model.removeManualRep() }
                    PrimaryButton("+ 1") { model.addManualRep() }
                }
            }
            SecondaryButton(model.isLastSet ? "Finish workout" : "Done with this set") {
                model.completeSet()
            }
        }
    }
}

// MARK: - Rest

private struct RestView: View {
    @Bindable var model: SessionModel

    private var nextTarget: Int? {
        let index = model.currentSetIndex
        guard index < model.prescription.count else { return nil }
        let target = model.prescription[index].targetReps
        return target > 0 ? target : nil
    }

    var body: some View {
        VStack(spacing: 24) {
            Text("REST")
                .font(Push.Typography.label)
                .tracking(3)
                .foregroundStyle(Push.Palette.textSecondary)

            HeroCount(Int(model.restRemaining.rounded()), label: "seconds")

            if let nextTarget {
                Text("Next: \(nextTarget) push-ups")
                    .font(Push.Typography.title)
                    .foregroundStyle(Push.Palette.textPrimary)
            }

            Text("Last set: \(model.completedSets.last ?? 0)")
                .font(Push.Typography.body)
                .foregroundStyle(Push.Palette.textSecondary)

            PrimaryButton("Skip rest") { model.skipRest() }
                .padding(.horizontal)
        }
        .padding()
    }
}
