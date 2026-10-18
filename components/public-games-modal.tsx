"use client";

import Link from "next/link";

interface AdhocGame {
  adhoc_game_id: number;
  course_name: string;
  game_date: string;
  tee_off_time: string;
  max_players: number;
  booked_count: number;
  status: string;
  game_visibility?: "club" | "public";
  club_id?: number | null;
  organizer_name: string;
}

interface PublicGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  adhocGames: AdhocGame[];
  allClubNames: Record<number, string>;
}

// Format e.g. "Mon, 20 Jan at 14:30"
function formatDateTime(dateStr: string, teeOff: string) {
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
  const time = (teeOff || "").slice(0, 5);
  return time ? `${datePart} at ${time}` : datePart;
}

export default function PublicGamesModal({ isOpen, onClose, adhocGames, allClubNames }: PublicGamesModalProps) {
  if (!isOpen) return null;

  // Same filter logic as the dashboard rolling banner
  const publicGames = adhocGames.filter(
    (g) =>
      g.game_visibility === "public" &&
      g.status === "open" &&
      g.max_players - (g.booked_count || 0) > 0,
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Public Games"
        className="relative w-full sm:max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-gray-700 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-gray-700 shrink-0">
          <h2 className="text-sm font-bold text-slate-800 dark:text-gray-100">{"\u{1F3CC}\u{FE0F}"} Public Games</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {publicGames.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">{"\u{1F4ED}"} No games published</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">There are no public games available at this time.</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">Check back later or create your own game!</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {publicGames.map((game) => {
                const slots = game.max_players - (game.booked_count || 0);
                const clubName = (game.club_id != null && allClubNames[game.club_id]) || "Club";
                return (
                  <li
                    key={game.adhoc_game_id}
                    className="rounded-lg border border-slate-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{"\u{1F4CD}"} {game.course_name}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{"\u{1F550}"} {formatDateTime(game.game_date, game.tee_off_time)}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{"\u{1F3EB}"} {clubName} &middot; {game.organizer_name}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{"\u{1F3AF}"} {slots} slot{slots !== 1 ? "s" : ""} available</p>

                    <div className="mt-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-2.5">
                      <p className="text-xs text-emerald-800 dark:text-emerald-300">
                        {"\u{1F4A1}"} Recommendation: Go to{" "}
                        <Link href="/play" onClick={onClose} className="font-bold underline hover:text-emerald-600">
                          Play
                        </Link>{" "}
                        to join this game!
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="w-full h-9 text-sm font-semibold rounded-md bg-[#1C3A2A] text-white hover:bg-[#16301f] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
