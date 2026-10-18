'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface IronManEntry {
  competition_id: number;
  competition_name: string;
  member_id: number;
  member_name: string;
  total_points: number;
  games_played: number;
  game1_points: number | null;
  game2_points: number | null;
  position: number;
}

export default function IronManPage() {
  const [leaderboard, setLeaderboard] = useState<IronManEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  async function fetchLeaderboard() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('iron_man_leaderboard')
      .select('*')
      .eq('club_id', 1)
      .eq('game_date', today)
      .order('position', { ascending: true });

    if (!error && data) {
      setLeaderboard(data);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🏆</div>
          <p className="text-lg text-amber-900 font-semibold">Loading Iron Man Championship...</p>
        </div>
      </div>
    );
  }

  const competition = leaderboard[0];

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-block mb-4">
            <Badge className="bg-amber-500 text-white text-2xl px-6 py-3">🏆 IRON MAN CHAMPIONSHIP 🏆</Badge>
          </div>
          {competition && (
            <div className="mt-4">
              <h1 className="text-4xl font-bold text-amber-900 mb-2">{competition.competition_name}</h1>
              <p className="text-lg text-amber-700">
                {new Date(competition.competition_name.includes('Benoni') ? new Date().toISOString() : competition.competition_name).toLocaleDateString('en-ZA', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}
        </div>

        {/* Main Leaderboard Card */}
        <Card className="w-full bg-white border-4 border-amber-300 shadow-2xl mb-8">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white pb-6">
            <CardTitle className="text-3xl text-center">Two Round Championship</CardTitle>
            <p className="text-center text-amber-100 mt-2 font-semibold">Benoni Lake Club • Benoni Country Club</p>
            <p className="text-center text-amber-50 text-sm mt-1">Cumulative IPS Points • Highest Total Wins</p>
          </CardHeader>

          <CardContent className="pt-8">
            {leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-2xl mb-2">📍</p>
                <p className="text-lg text-slate-600">No scores posted yet</p>
                <p className="text-sm text-slate-500 mt-1">Check back as games progress</p>
              </div>
            ) : (
              <div className="space-y-4">
                {leaderboard.map((entry: IronManEntry, index: number) => {
                  let bgColor = 'bg-white border-amber-200 hover:border-amber-400';
                  let medalIcon = '';

                  if (entry.position === 1) {
                    bgColor = 'bg-gradient-to-r from-yellow-300 to-amber-300 border-amber-500 shadow-lg';
                    medalIcon = '🥇';
                  } else if (entry.position === 2) {
                    bgColor = 'bg-gradient-to-r from-gray-200 to-gray-300 border-gray-500';
                    medalIcon = '🥈';
                  } else if (entry.position === 3) {
                    bgColor = 'bg-gradient-to-r from-orange-200 to-red-200 border-orange-400';
                    medalIcon = '🥉';
                  }

                  return (
                    <div
                      key={`${entry.member_id}-${entry.position}`}
                      className={`flex items-center justify-between p-5 rounded-lg border-2 transition-all ${bgColor}`}
                    >
                      <div className="flex items-center gap-5 flex-1">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-200 font-bold text-lg">
                          {medalIcon || entry.position}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-xl text-slate-900">{entry.member_name}</p>
                          <div className="flex gap-2 mt-2">
                            {entry.game1_points !== null && (
                              <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                                ⛳ Round 1: {entry.game1_points} pts
                              </span>
                            )}
                            {entry.game2_points !== null && (
                              <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                                ⛳ Round 2: {entry.game2_points} pts
                              </span>
                            )}
                            {entry.games_played === 1 && (
                              <span className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full">
                                Awaiting Round 2...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-black text-amber-900">{entry.total_points}</p>
                        <p className="text-xs text-amber-700 font-bold uppercase tracking-wider">Total Points</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stats Footer */}
            {leaderboard.length > 0 && (
              <div className="mt-8 p-5 bg-amber-50 border-2 border-amber-200 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-amber-900">{leaderboard.length}</p>
                    <p className="text-xs text-amber-700 font-semibold uppercase mt-1">Players</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600">{leaderboard[0].game1_points || '-'}</p>
                    <p className="text-xs text-slate-600 font-semibold uppercase mt-1">Leader R1</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{leaderboard[0].game2_points || '-'}</p>
                    <p className="text-xs text-slate-600 font-semibold uppercase mt-1">Leader R2</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-amber-600">{leaderboard[0].total_points}</p>
                    <p className="text-xs text-amber-700 font-semibold uppercase mt-1">Leader</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back to Dashboard */}
        <div className="text-center">
          <Link href="/dashboard">
            <Button variant="outline" size="lg" className="border-2 border-amber-400 text-amber-900 hover:bg-amber-50">
              ← Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
