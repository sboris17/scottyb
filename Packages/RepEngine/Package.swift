// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "RepEngine",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "RepEngine", targets: ["RepEngine"])
    ],
    targets: [
        // Deliberately free of Vision, AVFoundation and SwiftUI so the whole
        // engine runs in a plain unit test, on any platform, in milliseconds.
        .target(name: "RepEngine"),
        .testTarget(
            name: "RepEngineTests",
            dependencies: ["RepEngine"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
