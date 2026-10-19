import Foundation

/// Durable file logger. Writes timestamped lines to
/// Documents/mgd-diag.log AND echoes each line to NSLog. Retrieval is via
/// Xcode's Devices window → Download Container (no plist changes required).
final class Diagnostics {
    static let shared = Diagnostics()

    private let fileURL: URL
    private let queue = DispatchQueue(label: "MyGolf.Diagnostics")
    private let maxBytes = 512 * 1024

    private init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        fileURL = docs.appendingPathComponent("mgd-diag.log")
        trimIfNeeded()

        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        log("──── Diagnostics session started ────")
        log("app version \(version) build \(build)")
        log("log path \(fileURL.path)")
    }

    func log(_ message: String) {
        let ts = Self.formatter.string(from: Date())
        let line = "[\(ts)] \(message)\n"
        NSLog("[MGD] \(message)")
        queue.async { [fileURL] in
            if let handle = try? FileHandle(forWritingTo: fileURL) {
                defer { try? handle.close() }
                _ = try? handle.seekToEnd()
                if let data = line.data(using: .utf8) {
                    try? handle.write(contentsOf: data)
                }
            } else {
                try? line.write(to: fileURL, atomically: true, encoding: .utf8)
            }
        }
    }

    private func trimIfNeeded() {
        guard
            let attrs = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
            let size = attrs[.size] as? Int,
            size > maxBytes
        else { return }
        try? FileManager.default.removeItem(at: fileURL)
    }

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss.SSS"
        f.locale = Locale(identifier: "en_ZA")
        return f
    }()
}
