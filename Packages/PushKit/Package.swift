// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PushKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "PushKit", targets: ["PushKit"])],
    targets: [
        .target(name: "PushKit"),
        .testTarget(name: "PushKitTests", dependencies: ["PushKit"]),
    ]
)
