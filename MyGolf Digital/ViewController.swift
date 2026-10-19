import UIKit
import WebKit
import SwiftData

// MARK: - External Link Handler
class ExternalLinkHandler: NSObject, WKScriptMessageHandler {
    weak var presenter: UIViewController?

    init(presenter: UIViewController) {
        self.presenter = presenter
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let urlString = message.body as? String,
              let url = URL(string: urlString) else { return }

        let allowedSchemes = ["http", "https", "mailto", "tel"]
        guard let scheme = url.scheme?.lowercased(),
              allowedSchemes.contains(scheme) else { return }

        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
    }
}

// MARK: - Diagnostics Handler
class DiagnosticsHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let msg = message.body as? String else { return }
        Diagnostics.shared.log("[JS] \(msg)")
    }
}

// MARK: - Offline Score Handler
class OfflineScoreHandler: NSObject, WKScriptMessageHandlerWithReply {
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        Diagnostics.shared.log("offlineScore ENTRY")
        guard let dict = message.body as? [String: Any] else {
            Diagnostics.shared.log("offlineScore FAIL invalid payload")
            replyHandler(nil, "Invalid payload")
            return
        }
        Task { @MainActor in
            do {
                guard let pairingId = dict["pairingId"] as? Int,
                      let adhocGameId = dict["adhocGameId"] as? Int,
                      let memberId = dict["memberId"] as? Int,
                      let actorMemberId = dict["actorMemberId"] as? Int,
                      let holeNumber = dict["holeNumber"] as? Int,
                      let fourballMemberIds = dict["fourballMemberIds"] as? [Int] else {
                    Diagnostics.shared.log("offlineScore FAIL missing fields")
                    replyHandler(nil, "Missing required fields")
                    return
                }
                let strokes = dict["strokes"] as? Int
                let isLady = dict["isLady"] as? Bool ?? false
                let guestId = dict["guestId"] as? Int

                SyncEngine.shared.rememberMemberId(actorMemberId)

                let row = OfflineScore(
                    pairingId: pairingId,
                    adhocGameId: adhocGameId,
                    memberId: memberId,
                    actorMemberId: actorMemberId,
                    fourballMemberIds: fourballMemberIds,
                    holeNumber: holeNumber,
                    strokes: strokes,
                    isLady: isLady,
                    guestId: guestId
                )
                try OfflineScoreStore.shared.enqueue(row)

                let total = OfflineScoreStore.shared.totalRowCount()
                let pending = OfflineScoreStore.shared.pendingRowCount()
                Diagnostics.shared.log("offlineScore OK pairing=\(pairingId) hole=\(holeNumber) strokes=\(strokes.map(String.init) ?? "nil") guest=\(guestId.map(String.init) ?? "-") totalRows=\(total) pending=\(pending)")
                replyHandler(["ok": true], nil)
            } catch {
                Diagnostics.shared.log("offlineScore FAIL queue \(error)")
                replyHandler(nil, error.localizedDescription)
            }
        }
    }
}

// MARK: - Cache Game Handler
class CacheGameHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        Diagnostics.shared.log("cacheGame ENTRY")
        guard let dict = message.body as? [String: Any] else {
            Diagnostics.shared.log("cacheGame FAIL invalid payload")
            return
        }
        Task { @MainActor in
            do {
                guard let gameId = dict["gameId"] as? Int,
                      let courseId = dict["courseId"] as? Int,
                      let courseName = dict["courseName"] as? String,
                      let gameDate = dict["gameDate"] as? String,
                      let teeOffTime = dict["teeOffTime"] as? String,
                      let holesJSON = dict["holesJSON"] as? String,
                      let myPairingsJSON = dict["myPairingsJSON"] as? String,
                      let fourballMemberIds = dict["fourballMemberIds"] as? [Int] else {
                    Diagnostics.shared.log("cacheGame FAIL missing fields")
                    return
                }
                let snapshot = CachedGame(
                    gameId: gameId,
                    courseId: courseId,
                    courseName: courseName,
                    gameDate: gameDate,
                    teeOffTime: teeOffTime,
                    holesJSON: holesJSON,
                    myPairingsJSON: myPairingsJSON,
                    fourballMemberIds: fourballMemberIds
                )
                try OfflineScoreStore.shared.cacheGame(snapshot)
                Diagnostics.shared.log("cacheGame OK game=\(gameId) fourballMembers=\(fourballMemberIds)")
            } catch {
                Diagnostics.shared.log("cacheGame FAILED \(error)")
            }
        }
    }
}

// MARK: - Request Sync Handler
class RequestSyncHandler: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any],
              let currentMemberId = dict["currentMemberId"] as? Int else {
            Diagnostics.shared.log("requestSync FAIL invalid payload")
            return
        }
        Diagnostics.shared.log("requestSync ENTRY currentMemberId=\(currentMemberId)")
        SyncEngine.shared.rememberMemberId(currentMemberId)
        Task {
            await SyncEngine.shared.requestSync(currentMemberId: currentMemberId)
        }
    }
}

// MARK: - Request Push Permission Handler ← ADDED
class RequestPushPermissionHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any],
              let memberId = dict["memberId"] as? Int else {
            Diagnostics.shared.log("requestPushPermission invalid payload")
            return
        }
        Diagnostics.shared.log("requestPushPermission ENTRY memberId=\(memberId)")
        PushManager.shared.requestPermission(memberId: memberId)
    }
}

// MARK: - Main View Controller
class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, UIGestureRecognizerDelegate {

    var webView: WKWebView!
    var refreshControl: UIRefreshControl!
    var externalLinkHandler: ExternalLinkHandler?
    var diagnosticsHandler: DiagnosticsHandler?
    var offlineScoreHandler: OfflineScoreHandler?
    var cacheGameHandler: CacheGameHandler?
    var requestSyncHandler: RequestSyncHandler?
    var requestPushPermissionHandler: RequestPushPermissionHandler?  // ← ADDED
    var loadingIndicator: UIActivityIndicatorView!

    override func viewDidLoad() {
        super.viewDidLoad()

        _ = Diagnostics.shared
        Diagnostics.shared.log("viewDidLoad START")

        if let url = OfflineScoreStore.shared.storeURL {
            Diagnostics.shared.log("storeURL=\(url.path)")
        } else {
            Diagnostics.shared.log("storeURL=<in-memory fallback>")
        }
        Diagnostics.shared.log("launch queue totalRows=\(OfflineScoreStore.shared.totalRowCount()) pending=\(OfflineScoreStore.shared.pendingRowCount())")

        _ = SyncEngine.shared

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        externalLinkHandler = ExternalLinkHandler(presenter: self)
        config.userContentController.add(externalLinkHandler!, name: "openExternal")

        diagnosticsHandler = DiagnosticsHandler()
        config.userContentController.add(diagnosticsHandler!, name: "diagnostics")

        offlineScoreHandler = OfflineScoreHandler()
        config.userContentController.addScriptMessageHandler(
            offlineScoreHandler!,
            contentWorld: .page,
            name: "offlineScore"
        )

        cacheGameHandler = CacheGameHandler()
        config.userContentController.add(cacheGameHandler!, name: "cacheGame")

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self

        SyncEngine.shared.webView = webView
        PushManager.shared.attach(to: webView)  // ← ADDED

        requestSyncHandler = RequestSyncHandler(webView: webView)
        config.userContentController.add(requestSyncHandler!, name: "requestSync")

        requestPushPermissionHandler = RequestPushPermissionHandler()  // ← ADDED
        config.userContentController.add(requestPushPermissionHandler!, name: "requestPushPermission")  // ← ADDED

        let nativeOfflineJS = """
        (function() {
          if (!window.webkit || !window.webkit.messageHandlers) return;
          var handlers = window.webkit.messageHandlers;

          window.nativeOffline = {
            available: true,
            cacheGame: function(payload) {
              try { handlers.cacheGame.postMessage(payload); } catch (e) {}
            },
            saveScore: function(payload) {
              return handlers.offlineScore.postMessage(payload)
                .then(function(result) { return result; })
                .catch(function(err) { return { ok: false, reason: String(err) }; });
            },
            requestSync: function(currentMemberId) {
              try { handlers.requestSync.postMessage({ currentMemberId: currentMemberId }); } catch (e) {}
            },
            diagnostics: {
              log: function(msg) {
                try { handlers.diagnostics.postMessage(String(msg)); } catch (e) {}
              }
            }
          };
        })();
        """
        let script = WKUserScript(
            source: nativeOfflineJS,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(script)

        Diagnostics.shared.log("nativeOffline WKUserScript added")

        SyncEngine.shared.emitProgress = { [weak self] current, total in
            let js = "window.dispatchEvent(new CustomEvent('nativeSyncProgress', { detail: { current: \(current), total: \(total) } }))"
            DispatchQueue.main.async { self?.webView?.evaluateJavaScript(js) }
        }
        SyncEngine.shared.emitComplete = { [weak self] synced, failed, orphaned, names in
            let namesJSON = (try? JSONSerialization.data(withJSONObject: names))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            let js = "window.dispatchEvent(new CustomEvent('nativeSyncComplete', { detail: { synced: \(synced), failed: \(failed), orphaned: \(orphaned), orphanedNames: \(namesJSON) } }))"
            DispatchQueue.main.async { self?.webView?.evaluateJavaScript(js) }
        }

        webView.scrollView.contentInsetAdjustmentBehavior = .always
        webView.scrollView.maximumZoomScale = 1.0
        webView.scrollView.minimumZoomScale = 1.0
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = true

        refreshControl = UIRefreshControl()
        refreshControl.tintColor = UIColor(red: 0.1, green: 0.23, blue: 0.17, alpha: 1.0)
        refreshControl.addTarget(self, action: #selector(handleRefresh(_:)), for: .valueChanged)
        webView.scrollView.addSubview(refreshControl)

        view.addSubview(webView)

        loadingIndicator = UIActivityIndicatorView(style: .large)
        loadingIndicator.color = UIColor(red: 0.1, green: 0.23, blue: 0.17, alpha: 1.0)
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        loadingIndicator.hidesWhenStopped = true
        view.addSubview(loadingIndicator)
        NSLayoutConstraint.activate([
            loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        loadingIndicator.startAnimating()

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillShow(_:)),
            name: UIResponder.keyboardWillShowNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillHide),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )

        if let url = URL(string: "https://www.mygolf-digital.co.za/login") {
            Diagnostics.shared.log("loading URL \(url.absoluteString)")
            webView.load(URLRequest(url: url))
        }

        Diagnostics.shared.log("viewDidLoad END")
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        webView.frame = view.bounds
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc func handleRefresh(_ sender: UIRefreshControl) {
        webView.evaluateJavaScript("window.location.reload();") { [weak self] _, _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self?.refreshControl.endRefreshing()
            }
        }
    }

    @objc func keyboardWillShow(_ notification: Notification) {
        guard let keyboardFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
            return
        }
        let keyboardHeight = keyboardFrame.height
        webView.scrollView.contentInset.bottom = keyboardHeight
        webView.scrollView.verticalScrollIndicatorInsets.bottom = keyboardHeight
    }

    @objc func keyboardWillHide() {
        webView.scrollView.contentInset.bottom = 0
        webView.scrollView.verticalScrollIndicatorInsets.bottom = 0

        webView.evaluateJavaScript("""
            (function() {
                var meta = document.querySelector('meta[name=viewport]');
                if (!meta) {
                    meta = document.createElement('meta');
                    meta.name = 'viewport';
                    document.head.appendChild(meta);
                }
                meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
                document.body.style.zoom = '1';
            })();
        """) { [weak self] _, _ in
            self?.webView.scrollView.setZoomScale(1.0, animated: false)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loadingIndicator.stopAnimating()
        Diagnostics.shared.log("nav didFinish \(webView.url?.absoluteString ?? "unknown")")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loadingIndicator.stopAnimating()
        Diagnostics.shared.log("nav didFail \(error)")
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        Diagnostics.shared.log("nav didStartProvisional")
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(true)
        })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { textField in
            textField.text = defaultText
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
            completionHandler(nil)
        })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(alert.textFields?.first?.text)
        })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    func webView(_ webView: WKWebView,
                 navigationAction: WKNavigationAction,
                 didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload,
                  decideDestinationUsing response: URLResponse,
                  suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let destination = docs.appendingPathComponent(suggestedFilename)
        completionHandler(destination)
    }

    func downloadDidFinish(_ download: WKDownload) {
        let alert = UIAlertController(title: "Download Complete",
                                      message: "The file has been saved to your Files app.",
                                      preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                           shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        return true
    }
}
