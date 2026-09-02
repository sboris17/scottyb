// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PushUI",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "PushUI", targets: ["PushUI"])],
    targets: [.target(name: "PushUI")]
)
