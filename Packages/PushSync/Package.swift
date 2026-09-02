// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PushSync",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "PushSync", targets: ["PushSync"])],
    targets: [
        // No third-party dependencies on purpose. Supabase's auth and
        // PostgREST endpoints are plain HTTP+JSON, and a dependency here would
        // buy convenience at the cost of version risk in the one part of the
        // app that talks to the network.
        .target(name: "PushSync"),
        .testTarget(name: "PushSyncTests", dependencies: ["PushSync"]),
    ]
)
