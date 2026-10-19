import Foundation
import SwiftData

@Model
final class OfflineScore {
    @Attribute(.unique) var key: String
    var pairingId: Int
    var adhocGameId: Int
    var memberId: Int
    var actorMemberId: Int
    var fourballMemberIds: [Int]
    var holeNumber: Int
    var strokes: Int?
    var isLady: Bool
    var guestId: Int?
    var syncState: String
    var retryCount: Int
    var queuedAt: Date
    var rejectedAt: Date?
    var updatedAt: Date

    init(
        pairingId: Int,
        adhocGameId: Int,
        memberId: Int,
        actorMemberId: Int,
        fourballMemberIds: [Int],
        holeNumber: Int,
        strokes: Int?,
        isLady: Bool,
        guestId: Int?
    ) {
        self.key = OfflineScore.makeKey(pairingId: pairingId, holeNumber: holeNumber, guestId: guestId, memberId: memberId)
        self.pairingId = pairingId
        self.adhocGameId = adhocGameId
        self.memberId = memberId
        self.actorMemberId = actorMemberId
        self.fourballMemberIds = fourballMemberIds
        self.holeNumber = holeNumber
        self.strokes = strokes
        self.isLady = isLady
        self.guestId = guestId
        self.syncState = "pending"
        self.retryCount = 0
        self.queuedAt = Date()
        self.rejectedAt = nil
        self.updatedAt = Date()
    }

    static func makeKey(pairingId: Int, holeNumber: Int, guestId: Int?, memberId: Int) -> String {
        let who = guestId.map(String.init) ?? "m\(memberId)"
        return "\(pairingId)-\(holeNumber)-\(who)"
    }
}

@Model
final class CachedGame {
    @Attribute(.unique) var gameId: Int
    var courseId: Int
    var courseName: String
    var gameDate: String
    var teeOffTime: String
    var holesJSON: String
    var myPairingsJSON: String
    var fourballMemberIds: [Int]
    var cachedAt: Date

    init(
        gameId: Int,
        courseId: Int,
        courseName: String,
        gameDate: String,
        teeOffTime: String,
        holesJSON: String,
        myPairingsJSON: String,
        fourballMemberIds: [Int]
    ) {
        self.gameId = gameId
        self.courseId = courseId
        self.courseName = courseName
        self.gameDate = gameDate
        self.teeOffTime = teeOffTime
        self.holesJSON = holesJSON
        self.myPairingsJSON = myPairingsJSON
        self.fourballMemberIds = fourballMemberIds
        self.cachedAt = Date()
    }
}

final class OfflineScoreStore {
    static let shared = OfflineScoreStore()

    let container: ModelContainer
    let storeURL: URL?

    private init() {
        var resolvedURL: URL? = nil
        do {
            let fileManager = FileManager.default
            let appSupport = try fileManager.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            let storeDir = appSupport.appendingPathComponent("MyGolfOffline", isDirectory: true)
            if !fileManager.fileExists(atPath: storeDir.path) {
                try fileManager.createDirectory(at: storeDir, withIntermediateDirectories: true)
            }
            let storeFile = storeDir.appendingPathComponent("offline.store")
            resolvedURL = storeFile
            let config = ModelConfiguration(url: storeFile)
            container = try ModelContainer(
                for: OfflineScore.self, CachedGame.self,
                configurations: config
            )
        } catch {
            let config = ModelConfiguration(isStoredInMemoryOnly: true)
            container = try! ModelContainer(
                for: OfflineScore.self, CachedGame.self,
                configurations: config
            )
            NSLog("[OfflineScoreStore] Persistent store failed, using in-memory: \(error)")
        }
        storeURL = resolvedURL
    }

    // MARK: - Score queue

    @MainActor
    func enqueue(_ score: OfflineScore) throws {
        let context = container.mainContext
        let key = score.key
        let descriptor = FetchDescriptor<OfflineScore>(
            predicate: #Predicate { $0.key == key }
        )
        if let existing = try context.fetch(descriptor).first {
            existing.strokes = score.strokes
            existing.isLady = score.isLady
            existing.actorMemberId = score.actorMemberId
            existing.fourballMemberIds = score.fourballMemberIds
            existing.syncState = "pending"
            existing.updatedAt = Date()
        } else {
            context.insert(score)
        }
        try context.save()
    }

    @MainActor
    func pendingRows(forCurrentMember currentMemberId: Int) throws -> [OfflineScore] {
        let descriptor = FetchDescriptor<OfflineScore>(
            predicate: #Predicate { $0.syncState == "pending" },
            sortBy: [SortDescriptor(\.queuedAt, order: .forward)]
        )
        let all = try container.mainContext.fetch(descriptor)
        return all.filter { $0.fourballMemberIds.contains(currentMemberId) }
    }

    @MainActor
    func orphanRows(forCurrentMember currentMemberId: Int) throws -> [OfflineScore] {
        let descriptor = FetchDescriptor<OfflineScore>(
            predicate: #Predicate { $0.syncState == "pending" },
            sortBy: [SortDescriptor(\.queuedAt, order: .forward)]
        )
        let all = try container.mainContext.fetch(descriptor)
        return all.filter { !$0.fourballMemberIds.contains(currentMemberId) }
    }

    @MainActor
    func markSynced(_ row: OfflineScore) throws {
        row.syncState = "synced"
        row.updatedAt = Date()
        try container.mainContext.save()
    }

    @MainActor
    func markFailed(_ row: OfflineScore) throws {
        row.syncState = "failed"
        row.updatedAt = Date()
        try container.mainContext.save()
    }

    @MainActor
    func markOrphaned(_ row: OfflineScore) throws {
        row.syncState = "orphaned"
        row.rejectedAt = Date()
        row.updatedAt = Date()
        try container.mainContext.save()
    }

    /// Purges orphaned rows older than the retention window (default 30 days).
    ///
    /// NOTE: SwiftData's `#Predicate` macro does not support the forced-unwrap
    /// operator (`!`) inside the predicate, and multi-statement predicate
    /// bodies are not allowed. The previous version used `$0.rejectedAt!`,
    /// which threw `unsupportedPredicate` at runtime and aborted the entire
    /// drain before any POST ran. This version keeps the predicate to a
    /// single trivial expression (`syncState == "orphaned"`) and does the
    /// date comparison in Swift, which avoids the SwiftData restriction.
    @MainActor
    func purgeOrphaned(olderThan days: Int = 30) throws {
        let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        let descriptor = FetchDescriptor<OfflineScore>(
            predicate: #Predicate { $0.syncState == "orphaned" }
        )
        let allOrphaned = try container.mainContext.fetch(descriptor)
        let rowsToDelete = allOrphaned.filter { row in
            guard let rejected = row.rejectedAt else { return false }
            return rejected < cutoff
        }
        for row in rowsToDelete {
            container.mainContext.delete(row)
        }
        try container.mainContext.save()
    }

    @MainActor
    func purgeSynced(olderThan hours: Int = 24) throws {
        let cutoff = Calendar.current.date(byAdding: .hour, value: -hours, to: Date()) ?? Date()
        let descriptor = FetchDescriptor<OfflineScore>(
            predicate: #Predicate { $0.syncState == "synced" && $0.updatedAt < cutoff }
        )
        let rows = try container.mainContext.fetch(descriptor)
        for row in rows {
            container.mainContext.delete(row)
        }
        try container.mainContext.save()
    }

    // MARK: - Cached game snapshot

    @MainActor
    func cacheGame(_ snapshot: CachedGame) throws {
        let context = container.mainContext
        let gameId = snapshot.gameId
        let descriptor = FetchDescriptor<CachedGame>(
            predicate: #Predicate { $0.gameId == gameId }
        )
        if let existing = try context.fetch(descriptor).first {
            existing.courseId = snapshot.courseId
            existing.courseName = snapshot.courseName
            existing.gameDate = snapshot.gameDate
            existing.teeOffTime = snapshot.teeOffTime
            existing.holesJSON = snapshot.holesJSON
            existing.myPairingsJSON = snapshot.myPairingsJSON
            existing.fourballMemberIds = snapshot.fourballMemberIds
            existing.cachedAt = Date()
        } else {
            context.insert(snapshot)
        }
        try context.save()
    }

    @MainActor
    func cachedGame(gameId: Int) throws -> CachedGame? {
        let descriptor = FetchDescriptor<CachedGame>(
            predicate: #Predicate { $0.gameId == gameId }
        )
        return try container.mainContext.fetch(descriptor).first
    }

    // MARK: - Diagnostics counters

    @MainActor
    func totalRowCount() -> Int {
        (try? container.mainContext.fetchCount(FetchDescriptor<OfflineScore>())) ?? 0
    }

    @MainActor
    func pendingRowCount() -> Int {
        let descriptor = FetchDescriptor<OfflineScore>(
            predicate: #Predicate { $0.syncState == "pending" }
        )
        return (try? container.mainContext.fetchCount(descriptor)) ?? 0
    }
}
