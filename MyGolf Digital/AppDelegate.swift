import UIKit
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self

        // Cold start from a notification tap: iOS passes the notification
        // payload in launchOptions. Forward it to PushManager so the deep
        // link is loaded once the WebView is ready. PushManager buffers the
        // request if the WebView doesn't exist yet, and replays it inside
        // attach(to:).
        if let remoteNotification = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
            Diagnostics.shared.log("AppDelegate cold start from notification")
            PushManager.shared.handleNotificationTap(userInfo: remoteNotification)
        }

        return true
    }

    // MARK: - URL handling (mygolfdigital:// scheme)

    /// Handles URLs delivered to the app, either by the system opening a
    /// mygolfdigital:// link or by our own code (PushManager) forwarding one.
    /// iOS calls this when the app is running or was cold-started by a URL.
    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        Diagnostics.shared.log("AppDelegate open url \(url)")
        PushManager.shared.handleDeepLink(url: url)
        return true
    }

    // MARK: - UISceneSession Lifecycle

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        // A scene may be connecting because the app was launched with a URL
        // (e.g. a mygolfdigital:// link from a notification on iOS 13+). If
        // so, forward it to PushManager — otherwise the URL is dropped.
        for connectionOption in options.urlContexts {
            Diagnostics.shared.log("AppDelegate scene connecting with url \(connectionOption.url)")
            PushManager.shared.handleDeepLink(url: connectionOption.url)
        }
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(
        _ application: UIApplication,
        didDiscardSceneSessions sceneSessions: Set<UISceneSession>
    ) {
        // No-op.
    }

    // MARK: - Remote notification registration

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        PushManager.shared.didRegister(deviceToken: deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        PushManager.shared.didFailToRegister(error: error)
    }

    // MARK: - Silent push handling

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        Diagnostics.shared.log("AppDelegate didReceiveRemoteNotification")
        completionHandler(.newData)
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension AppDelegate: UNUserNotificationCenterDelegate {

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        PushManager.shared.handleNotificationTap(userInfo: userInfo)
        completionHandler()
    }
}
