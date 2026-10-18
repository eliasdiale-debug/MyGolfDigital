"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@supabase/ssr"

type BirdieRecord = {
  birdie_id: number
  member_name: string
  course_name: string
  game_date: string
  birdie_count: number
  gross_score: number | null
  stableford_points: number | null
}

type BirdieLeaderboard = {
  member_name: string
  total_birdies: number
  total_games: number
  avg_birdies: number
}

export default function BirdiesPage() {
  const [birdies, setBirdies] = useState<BirdieRecord[]>([])
  const [leaderboard, setLeaderboard] = useState<BirdieLeaderboard[]>([])
  const [loading, setLoading] = useState(true)
  const [totalBirdies, setTotalBirdies] = useState(0)

  useEffect(() => {
    async function fetchBirdies() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      // Fetch all birdie records
      const { data: birdieData } = await supabase
        .from("birdies")
        .select(`
          birdie_id,
          game_date,
          birdie_count,
          members!inner(member_name),
          courses!inner(course_name),
          performance_records(gross_score, points)
        `)
        .order("game_date", { ascending: false })

      if (birdieData) {
        const formattedBirdies = birdieData.map((b: any) => ({
          birdie_id: b.birdie_id,
          member_name: b.members.member_name,
          course_name: b.courses.course_name,
          game_date: b.game_date,
          birdie_count: b.birdie_count,
          gross_score: b.performance_records?.[0]?.gross_score || null,
          stableford_points: b.performance_records?.[0]?.points || null,
        }))
        setBirdies(formattedBirdies)
        setTotalBirdies(formattedBirdies.reduce((sum: number, b: BirdieRecord) => sum + b.birdie_count, 0))
      }

      // Fetch leaderboard
      const { data: leaderboardData } = await supabase.rpc("get_birdie_leaderboard")

      if (leaderboardData) {
        setLeaderboard(leaderboardData)
      } else {
        // Calculate manually if RPC doesn't exist
        const memberStats = new Map<string, { birdies: number; games: Set<string> }>()

        birdieData?.forEach((b: any) => {
          const name = b.members.member_name
          if (!memberStats.has(name)) {
            memberStats.set(name, { birdies: 0, games: new Set() })
          }
          const stats = memberStats.get(name)!
          stats.birdies += b.birdie_count
          stats.games.add(b.game_date + b.courses.course_name)
        })

        const leaderboardArray = Array.from(memberStats.entries())
          .map(([name, stats]) => ({
            member_name: name,
            total_birdies: stats.birdies,
            total_games: stats.games.size,
            avg_birdies: Number((stats.birdies / stats.games.size).toFixed(2)),
          }))
          .sort((a, b) => b.total_birdies - a.total_birdies)

        setLeaderboard(leaderboardArray)
      }

      setLoading(false)
    }

    fetchBirdies()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-12 flex items-center justify-center">
        <div className="text-lg">Loading birdies data...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-balance">🦅 Birdies Statistics</h1>
          <p className="text-lg text-muted-foreground">Complete birdie tracking for all members across all courses</p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-slate-900">
            <CardHeader>
              <CardTitle className="text-rose-600 dark:text-rose-400">Total Birdies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{totalBirdies}</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-900">
            <CardHeader>
              <CardTitle className="text-blue-600 dark:text-blue-400">Total Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{birdies.length}</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-slate-900">
            <CardHeader>
              <CardTitle className="text-green-600 dark:text-green-400">Members with Birdies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{leaderboard.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Birdie Leaderboard */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Birdie Leaderboard</CardTitle>
            <CardDescription>Top performers by total birdies scored</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Member Name</TableHead>
                  <TableHead className="text-right">Total Birdies</TableHead>
                  <TableHead className="text-right">Games Played</TableHead>
                  <TableHead className="text-right">Avg per Game</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.slice(0, 10).map((member, index) => (
                  <TableRow key={member.member_name} className={index === 0 ? "bg-rose-50 dark:bg-rose-950/20" : ""}>
                    <TableCell className="font-bold">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                    </TableCell>
                    <TableCell className="font-medium">{member.member_name}</TableCell>
                    <TableCell className="text-right font-semibold text-rose-600 dark:text-rose-400">
                      {member.total_birdies}
                    </TableCell>
                    <TableCell className="text-right">{member.total_games}</TableCell>
                    <TableCell className="text-right">{member.avg_birdies.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* All Birdie Records */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>All Birdie Records</CardTitle>
            <CardDescription>Complete history of birdies scored (most recent first)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">Birdies</TableHead>
                    <TableHead className="text-right">Gross Score</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {birdies.map((birdie) => (
                    <TableRow key={birdie.birdie_id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(birdie.game_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">{birdie.member_name}</TableCell>
                      <TableCell>{birdie.course_name}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-full text-sm font-semibold">
                          {birdie.birdie_count} 🦅
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{birdie.gross_score || "-"}</TableCell>
                      <TableCell className="text-right">{birdie.stableford_points || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
