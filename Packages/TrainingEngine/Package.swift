// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TrainingEngine",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "TrainingEngine", targets: ["TrainingEngine"])],
    targets: [
        .target(name: "TrainingEngine"),
        .testTarget(name: "TrainingEngineTests", dependencies: ["TrainingEngine"]),
    ]
)
