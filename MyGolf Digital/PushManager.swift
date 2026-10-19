import Foundation
import UIKit
import UserNotifications
import WebKit

/// Owns push notification registration, permission, and delivery. Kept as a
/// singleton so the AppDelegate and ViewController can both talk to it
/// without threading references through the responder chain.
final class PushManager: NSObject {

    static let shared = PushManager()

    /// WebView reference so we can dispatch the token to the JS side as a
    /// `nativePushToken` event once it arrives.
    weak var webView: WKWebView?

    /// Latest APNs device token (hex string). Cached so we can re-register
    /// with the backend on every app launch without waiting for a new token.
    private(set) var currentToken: String?

    /// Whether the current token is sandbox or production. Derived from the
    /// build configuration: Debug builds register against the APNs sandbox,
    /// Release builds against production.
    private(set) var currentEnvironment: String = "production"

    /// Deep link path (e.g. "/dashboard?traffic_check=123") that arrived before
    /// the WebView was ready. Replayed as soon as `attach(to:)` is called.
    /// Covers cold-start notification taps, where iOS launches the app with
    /// the notification payload before the WebView exists.
    private var pendingDeepLink: String?

    private override init() {
        super.init()
        #if DEBUG
        currentEnvironment = "sandbox"
        #else
        currentEnvironment = "production"
        #endif
    }

    /// Set the WebView reference and immediately replay any cached token into
    /// the page as a `nativePushToken` event, so the web app can register it.
    /// Also replays any deep link that was buffered before the WebView existed
    /// — for example, a notification tap during cold start.
    func attach(to webView: WKWebView) {
        self.webView = webView
        if let token = currentToken {
            emitTokenToWeb(token)
        }
        if let pending = pendingDeepLink {
            pendingDeepLink = nil
            loadDeepLinkPath(pending)
        }
    }

    /// Called by the JS side when the dashboard loads. Presents the iOS
    /// permission dialog (only shown once) and registers with APNs if the
    /// user grants permission.
    func requestPermission(memberId: Int) {
        Diagnostics.shared.log("PushManager.requestPermission memberId=\(memberId)")
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error {
                Diagnostics.shared.log("PushManager permission error \(error.localizedDescription)")
                return
            }
            Diagnostics.shared.log("PushManager permission granted=\(granted)")
            guard granted else { return }
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    /// Called from AppDelegate when APNs hands us the device token. Converts
    /// Data -> hex string, caches it, and pushes it into the WebView.
    func didRegister(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        currentToken = hex
        Diagnostics.shared.log("PushManager token received len=\(hex.count) env=\(currentEnvironment)")
        emitTokenToWeb(hex)
    }

    func didFailToRegister(error: Error) {
        Diagnostics.shared.log("PushManager didFailToRegister \(error.localizedDescription)")
    }

    /// Called from the UNUserNotificationCenter delegate in AppDelegate when
    /// the user taps a notification. Routes to a URL in the WebView if the
    /// payload contains a `deeplink` field. Buffers the request if the
    /// WebView isn't ready yet (e.g. cold start).
    func handleNotificationTap(userInfo: [AnyHashable: Any]) {
        Diagnostics.shared.log("PushManager notification tap \(userInfo)")
        guard let deeplink = userInfo["deeplink"] as? String else { return }
        // Route through the same pipeline as a URL-scheme tap so cold-start
        // buffering works uniformly.
        loadDeepLinkPath(deeplink)
    }

    /// Handles a URL delivered to the app. Accepts mygolfdigital:// URLs and
    /// resolves them to the equivalent https://www.mygolf-digital.co.za path,
    /// then loads that path into the WebView — or buffers it if the WebView
    /// isn't ready yet.
    func handleDeepLink(url: URL) {
        Diagnostics.shared.log("PushManager deep link \(url)")

        // Only handle our own scheme.
        guard url.scheme == "mygolfdigital" else { return }

        // Reconstruct the path portion: host + path + query.
        // mygolfdigital://dashboard?traffic_check=123
        //   → host = "dashboard", path = "", query = "traffic_check=123"
        //   → resolved = "/dashboard?traffic_check=123"
        var resolved = "/"
        if let host = url.host, !host.isEmpty {
            resolved += host
        }
        if !url.path.isEmpty {
            resolved += url.path
        }
        if let query = url.query, !query.isEmpty {
            resolved += "?\(query)"
        }

        loadDeepLinkPath(resolved)
    }

    // MARK: - Private

    /// Loads a resolved path (starting with "/") into the WebView, or buffers
    /// it until the WebView is available.
    private func loadDeepLinkPath(_ path: String) {
        guard let webURL = URL(string: "https://www.mygolf-digital.co.za\(path)") else {
            Diagnostics.shared.log("PushManager deep link could not build URL from \(path)")
            return
        }
        guard let webView else {
            // WebView not ready. Store the path so `attach(to:)` can replay it.
            Diagnostics.shared.log("PushManager deep link buffered until WebView ready: \(path)")
            pendingDeepLink = path
            return
        }
        DispatchQueue.main.async {
            Diagnostics.shared.log("PushManager loading deep link \(webURL)")
            webView.load(URLRequest(url: webURL))
        }
    }

    /// Fire a `nativePushToken` event at the WebView with the current token
    /// and environment. Also caches the token on `window.nativeCachedPushToken`
    /// so the web app can re-register it on subsequent launches without
    /// waiting for a fresh APNs callback.
    private func emitTokenToWeb(_ token: String) {
        let escaped = token.replacingOccurrences(of: "\"", with: "")
        let env = currentEnvironment
        let js = """
        (function() {
          try { window.nativeCachedPushToken = "\(escaped)"; } catch (e) {}
          window.dispatchEvent(new CustomEvent('nativePushToken', { detail: { token: "\(escaped)", environment: "\(env)" } }));
        })();
        """
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(js)
        }
    }
}
