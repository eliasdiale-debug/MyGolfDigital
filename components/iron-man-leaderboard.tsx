'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface IronManEntry {
  member_id: number;
  member_name: string;
  total_points: number;
  games_played: number;
  game1_points: number | null;
  game2_points: number | null;
  position: number;
}

interface MemberData {
  member_id: number;
  member_name: string;
}

interface Props {
  memberData?: MemberData | null;
}

export function IronManLeaderboard({ memberData }: Props) {
  const [leaderboard, setLeaderboard] = useState<IronManEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('iron_man_leaderboard')
          .select('*')
          .eq('club_id', 1)
          .eq('competition_id', 1)
          .order('position', { ascending: true })
          .limit(30);

        if (!error && data) {
          setLeaderboard(data);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return <div className="text-center text-xs text-slate-400 py-8">Loading...</div>;
  }

  if (leaderboard.length === 0) {
    return <div className="text-center text-xs text-slate-400 py-8">No results available yet</div>;
  }

  const leader = leaderboard[0];

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
        <div className="col-span-1 text-center">Pos</div>
        <div className="col-span-5">Member</div>
        <div className="col-span-3 text-right">R1 / R2</div>
        <div className="col-span-3 text-right">Total</div>
      </div>

      {/* Rows */}
      {leaderboard.map((entry, idx) => {
        const isMe = entry.member_id === memberData?.member_id;
        const isFirst = idx === 0;
        const isSecond = idx === 1;
        const isThird = idx === 2;
        const gap = leader.total_points - entry.total_points;
        return (
          <div
            key={entry.member_id}
            className={`grid grid-cols-12 gap-1 items-center px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 ${isMe ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
          >
            <div className="col-span-1 text-center">
              {isFirst ? (
                <span className="text-amber-500 text-xs font-bold">1</span>
              ) : isSecond ? (
                <span className="text-slate-400 text-xs font-bold">2</span>
              ) : isThird ? (
                <span className="text-amber-700 text-xs font-bold">3</span>
              ) : (
                <span className="text-[10px] text-slate-400">{idx + 1}</span>
              )}
            </div>
            <div className="col-span-5 flex items-center gap-1.5">
              {isFirst && (
                <svg className="w-3 h-3 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
              <span className={`text-xs ${isMe ? "font-bold text-blue-700 dark:text-blue-300" : isFirst ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                {entry.member_name.split(" ").slice(0, 2).join(" ")}
                {isMe && <span className="ml-1 text-[9px] text-blue-500">(You)</span>}
              </span>
            </div>
            <div className="col-span-3 text-right text-[10px] text-slate-500">
              {entry.game1_points ?? "-"} / {entry.game2_points ?? "-"}
            </div>
            <div className={`col-span-3 text-right text-xs font-bold ${isFirst ? "text-amber-600" : isMe ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"}`}>
              {isFirst
                ? <span className="text-green-600 font-semibold text-[9px]">Leader</span>
                : <span className="text-[10px] text-slate-400">-{gap}</span>
              }
              <div>{entry.total_points} pts</div>
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-[9px] text-slate-400 text-center">
        {leaderboard.length} players · Cumulative IPS · Highest total wins
      </div>
    </div>
  );
}
