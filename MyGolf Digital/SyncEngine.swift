import Foundation
import Network
import Observation
import WebKit

@Observable
final class SyncEngine {
    static let shared = SyncEngine()

    enum State: String {
        case idle
        case syncing
        case success
        case partial
        case offline
        case failed
    }

    private(set) var state: State = .idle
    private(set) var lastSyncedCount: Int = 0
    private(set) var lastFailedCount: Int = 0
    private(set) var lastOrphanedCount: Int = 0
    private(set) var lastOrphanedNames: [String] = []

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "MyGolf.SyncEngine.monitor")
    private var isOnline: Bool = true
    private var inFlight: Task<Void, Never>? = nil
    private(set) var lastKnownMemberId: Int = 0

    /// Weak reference set by ViewController so we can push native network
    /// state changes into the WebView. The web app listens for the
    /// `nativeNetworkChange` event and uses it as a second source of truth
    /// alongside (unreliable) `navigator.onLine`.
    weak var webView: WKWebView?

    /// Last network state we reported to the web app, so we only fire the
    /// event when something actually changes.
    private var lastReportedOnline: Bool? = nil

    var emitProgress: ((Int, Int) -> Void)?
    var emitComplete: ((Int, Int, Int, [String]) -> Void)?

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            let online = path.status == .satisfied
            let wasOffline = !self.isOnline
            self.isOnline = online
            Diagnostics.shared.log("NWPath online=\(online) wasOffline=\(wasOffline) knownMemberId=\(self.lastKnownMemberId)")

            // Push the true network state into the WebView so the web app can
            // update its isOffline state even when navigator.onLine is wrong.
            if self.lastReportedOnline != online {
                self.lastReportedOnline = online
                let js = "window.dispatchEvent(new CustomEvent('nativeNetworkChange', { detail: { online: \(online) } }))"
                DispatchQueue.main.async {
                    self.webView?.evaluateJavaScript(js)
                }
            }

            if online && wasOffline && self.lastKnownMemberId > 0 {
                Task { await self.requestSync(currentMemberId: self.lastKnownMemberId) }
            }
        }
        monitor.start(queue: queue)
        Diagnostics.shared.log("SyncEngine init")
    }

    func rememberMemberId(_ memberId: Int) {
        guard memberId > 0 else { return }
        if lastKnownMemberId != memberId {
            lastKnownMemberId = memberId
            Diagnostics.shared.log("remembered memberId=\(memberId)")
        }
    }

    @MainActor
    func requestSync(currentMemberId: Int) async {
        Diagnostics.shared.log("requestSync called currentMemberId=\(currentMemberId) inFlight=\(inFlight != nil)")
        if currentMemberId > 0 {
            lastKnownMemberId = currentMemberId
        }
        if let existing = inFlight {
            await existing.value
            return
        }
        let task = Task { @MainActor in
            await self.drain(currentMemberId: currentMemberId)
        }
        inFlight = task
        await task.value
        inFlight = nil
    }

    @MainActor
    private func drain(currentMemberId: Int) async {
        Diagnostics.shared.log("drain START currentMemberId=\(currentMemberId) isOnline=\(isOnline)")
        guard currentMemberId > 0 else {
            Diagnostics.shared.log("drain EXIT no member id")
            return
        }
        guard isOnline else {
            Diagnostics.shared.log("drain EXIT offline")
            state = .offline
            emitComplete?(0, 0, 0, [])
            return
        }

        state = .syncing
        do {
            try OfflineScoreStore.shared.purgeSynced()
            try OfflineScoreStore.shared.purgeOrphaned()

            let totalBefore = OfflineScoreStore.shared.totalRowCount()
            let pendingBefore = OfflineScoreStore.shared.pendingRowCount()
            Diagnostics.shared.log("drain queue total=\(totalBefore) pending=\(pendingBefore)")

            let eligible = try OfflineScoreStore.shared.pendingRows(forCurrentMember: currentMemberId)
            let orphaned = try OfflineScoreStore.shared.orphanRows(forCurrentMember: currentMemberId)
            Diagnostics.shared.log("drain filter eligible=\(eligible.count) orphaned=\(orphaned.count)")

            for row in orphaned {
                try OfflineScoreStore.shared.markOrphaned(row)
            }
            let orphanedNames = Array(Set(orphaned.compactMap { _ in "a teammate" })).sorted()

            var synced = 0
            var failed = 0
            let total = eligible.count

            for (index, row) in eligible.enumerated() {
                emitProgress?(index, total)
                Diagnostics.shared.log("drain POST pairing=\(row.pairingId) hole=\(row.holeNumber) actor=\(row.actorMemberId)")
                let ok = await postScore(row)
                if ok {
                    try OfflineScoreStore.shared.markSynced(row)
                    synced += 1
                } else {
                    row.retryCount += 1
                    if row.retryCount >= 5 {
                        try OfflineScoreStore.shared.markFailed(row)
                        failed += 1
                    } else {
                        Diagnostics.shared.log("drain break on failure retryCount=\(row.retryCount)")
                        break
                    }
                }
            }

            emitProgress?(total, total)
            lastSyncedCount = synced
            lastFailedCount = failed
            lastOrphanedCount = orphaned.count
            lastOrphanedNames = orphanedNames

            if failed == 0 && orphaned.isEmpty {
                state = .success
            } else if synced > 0 {
                state = .partial
            } else {
                state = .failed
            }
            Diagnostics.shared.log("drain END synced=\(synced) failed=\(failed) orphaned=\(orphaned.count) state=\(state.rawValue)")
            emitComplete?(synced, failed, orphaned.count, orphanedNames)
        } catch {
            Diagnostics.shared.log("drain EXCEPTION \(error)")
            state = .failed
            emitComplete?(0, 0, 0, [])
        }
    }

    private func postScore(_ row: OfflineScore) async -> Bool {
        guard let url = URL(string: "https://www.mygolf-digital.co.za/api/finalize-game/score") else {
            Diagnostics.shared.log("postScore bad URL")
            return false
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 20

        let body: [String: Any?] = [
            "adhocGameId": row.adhocGameId,
            "pairingId": row.pairingId,
            "holeNumber": row.holeNumber,
            "strokes": row.strokes,
            "actorMemberId": row.actorMemberId,
        ]
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body.compactMapValues { $0 })
        } catch {
            Diagnostics.shared.log("postScore encode failed \(error)")
            return false
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            let bodyText = String(data: data, encoding: .utf8)?.prefix(200) ?? ""
            if status >= 200 && status < 300 {
                Diagnostics.shared.log("postScore OK pairing=\(row.pairingId) hole=\(row.holeNumber) status=\(status)")
                return true
            }
            Diagnostics.shared.log("postScore FAIL pairing=\(row.pairingId) hole=\(row.holeNumber) status=\(status) body=\(bodyText)")
            return false
        } catch {
            Diagnostics.shared.log("postScore THREW pairing=\(row.pairingId) hole=\(row.holeNumber) error=\(error)")
            return false
        }
    }
}
