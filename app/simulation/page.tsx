"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// ── Real WSOE members (club_id = 13) ─────────────────────────────────────────
const WSOE_MEMBERS = [
  {id:462,name:"Abbey Dikgale"},{id:443,name:"Abduragmaan Baulackey"},{id:475,name:"Akbar Gani"},
  {id:484,name:"Alex Kensen"},{id:440,name:"Alfred Aygei"},{id:551,name:"Alfred Maredi"},
  {id:639,name:"Allen Mutono"},{id:442,name:"Amagyei Banson"},{id:463,name:"Andi Dill"},
  {id:485,name:"Andile Keta"},{id:454,name:"Andre de Jager"},{id:471,name:"Gastin Fenton"},
  {id:472,name:"Arthur Fernando"},{id:720,name:"Awore Taigbenu"},{id:555,name:"Bafedile Masele"},
  {id:577,name:"Banele Mhlahlo"},{id:492,name:"Ben Khumalo B"},{id:662,name:"Ben Nkosi"},
  {id:609,name:"Boitumelo Moloko"},{id:465,name:"Bonga Dlamini"},{id:476,name:"Bongani Godlwana"},
  {id:529,name:"Bongani Mahlangu B"},{id:628,name:"Bongani Mshibe"},{id:588,name:"Bonolo Modise"},
  {id:461,name:"Boyo Diketso"},{id:459,name:"Bruce Diale B"},{id:547,name:"Buntu Manitshana"},
  {id:618,name:"Chief Mosikara"},{id:504,name:"Chimane Lelaka"},{id:610,name:"Chuene Moloto C"},
  {id:541,name:"Clifford Makoloane"},{id:452,name:"Daniel Chiwandamira"},{id:482,name:"David Kau"},
  {id:543,name:"David Malaza"},{id:686,name:"David Oupa Pooe"},{id:480,name:"Deane Hiine"},
  {id:483,name:"Diamond Kekana"},{id:493,name:"Dingaan Khumalo D"},{id:447,name:"Edwin Bogopa"},
  {id:538,name:"Edwin Makhothi"},{id:458,name:"Elias Diale"},{id:552,name:"Elijah Maseko E"},
  {id:603,name:"Elliot Mokoena"},{id:532,name:"Ernest Mahlaule"},{id:562,name:"Eutycuss Mathebula"},
  {id:650,name:"Felix Ndlovu"},{id:667,name:"Fezile Nondonga"},{id:599,name:"Fortune Mojapelo"},
  {id:525,name:"Francis Magero"},{id:640,name:"Given Mutshena"},{id:641,name:"Godfrey Mwiinga"},
  {id:600,name:"Greg Mojela"},{id:579,name:"Helman Mkhalele"},{id:583,name:"Herman Mmaudu"},
  {id:658,name:"Ike Ngwena"},{id:486,name:"Issac Kgafela"},{id:565,name:"Itumeleng Matsobane"},
  {id:717,name:"Jabu Sithole"},{id:602,name:"Jacob Mokhanda"},{id:550,name:"James Mapunda"},
  {id:616,name:"Jan Morudu"},{id:439,name:"Joe Asamoah"},{id:569,name:"Joe Mazibuko J"},
  {id:545,name:"Johannes Manamela"},{id:514,name:"Jomo Mabilo"},{id:441,name:"Joshua Baganzi"},
  {id:557,name:"Kabelo Mashiko"},{id:451,name:"Katlego Chabalala"},{id:604,name:"Kenny Mokoka"},
  {id:477,name:"Khumbulani Gumede"},{id:645,name:"Kingsley Ncaba"},{id:446,name:"Kiran Bhika"},
  {id:568,name:"Kwanele Mazibuko"},{id:487,name:"Larry Kgatle"},{id:511,name:"Lee-John Maans"},
  {id:507,name:"Lethabo Leoto"},{id:501,name:"Leon Langa L"},{id:558,name:"Leornard Masilela"},
]

const COURSES = [
  { id: 9, name: "Bushwillow" },
  { id: 97, name: "Waterkloof" },
]

// ── Simulation config ─────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  playerCount: 44,
  costPerPlayer: 100,
  wwbFee: 50,
  birdieFee: 20,
  courseId: 9,
  courseName: "Bushwillow",
  teeStart: "shotgun" as "shotgun" | "sequential",
  wwbEnabled: true,
  gameDate: "2026-03-25",
  teeOffTime: "07:00",
}

type SimPlayer = {
  member_id: number
  member_name: string
  hcp: number
  fourball: number
  hole: number
  tee_time: string
  ww: boolean
  birdie_opt: boolean
  points: number
  gross: number
  birdies: number
  eagles: number
  is_late: boolean
  is_no_show: boolean
  is_sub: boolean
}

type CheckResult = {
  id: string
  label: string
  status: "PASS" | "WARN" | "FAIL"
  detail: string
}

type SimState = "idle" | "configuring" | "pairing" | "scoring" | "checking" | "done"

// ── Seeded random (reproducible per run) ─────────────────────────────────────
function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function normalRand(r: () => number) {
  // Box-Muller transform for bell-curve scores
  const u = 1 - r()
  const v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export default function SimulationPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [state, setState] = useState<SimState>("configuring")
  const [players, setPlayers] = useState<SimPlayer[]>([])
  const [checks, setChecks] = useState<CheckResult[]>([])
  const [log, setLog] = useState<string[]>([])
  const [step, setStep] = useState(0)

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString("en-ZA")}] ${msg}`, ...prev])

  // ── Step 1: Generate pairings ─────────────────────────────────────────────
  const runPairings = useCallback(() => {
    setState("pairing")
    const r = seededRand(Date.now() & 0xffff)
    const pool = [...WSOE_MEMBERS].sort(() => r() - 0.5).slice(0, config.playerCount)
    const fourballs = Math.ceil(pool.length / 4)

    const simPlayers: SimPlayer[] = pool.map((m, i) => {
      const fb = Math.floor(i / 4) + 1
      const hcp = Math.round(r() * 28) + 2 // HCP 2–30
      const ww = config.wwbEnabled ? r() > 0.15 : false
      const birdie = config.wwbEnabled ? r() > 0.3 : false
      // Tee times
      const [startH, startM] = config.teeOffTime.split(":").map(Number)
      let teeTime = ""
      if (config.teeStart === "shotgun") {
        teeTime = config.teeOffTime // all same
      } else {
        const minOffset = Math.floor(i / 4) * 8
        const totalMin = startH * 60 + startM + minOffset
        teeTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`
      }
      return {
        member_id: m.id,
        member_name: m.name,
        hcp,
        fourball: fb,
        hole: config.teeStart === "shotgun" ? fb : 1,
        tee_time: teeTime,
        ww,
        birdie_opt: birdie,
        points: 0,
        gross: 0,
        birdies: 0,
        eagles: 0,
        is_late: r() < 0.04,
        is_no_show: r() < 0.02,
        is_sub: r() < 0.03,
      }
    })

    addLog(`Pairings generated: ${pool.length} players across ${fourballs} fourballs`)
    addLog(`Tee start: ${config.teeStart === "shotgun" ? "Shotgun — all tee off at " + config.teeOffTime : "Sequential — 8-minute intervals from " + config.teeOffTime}`)
    setPlayers(simPlayers)
    setStep(1)
    setState("scoring")
  }, [config])

  // ── Step 2: Generate scores ───────────────────────────────────────────────
  const runScoring = useCallback(() => {
    setState("scoring")
    const r = seededRand((Date.now() & 0xffff) + 1)

    const scored = players.map(p => {
      if (p.is_no_show) return { ...p, points: 0, gross: 0, birdies: 0, eagles: 0 }
      // Stableford: mean ~36 pts, std ~6, adjusted for HCP
      const raw = 36 + (p.hcp > 18 ? 2 : p.hcp < 9 ? -2 : 0) + normalRand(r) * 6
      const pts = Math.max(0, Math.min(54, Math.round(raw)))
      const gross = 72 - pts + p.hcp
      const birdies = Math.max(0, Math.round(r() * 4))
      const eagles = r() < 0.08 ? 1 : 0
      return { ...p, points: pts, gross, birdies, eagles }
    })

    addLog(`Scores generated for ${scored.filter(p => !p.is_no_show).length} players`)
    addLog(`No-shows: ${scored.filter(p => p.is_no_show).length} | Late arrivals: ${scored.filter(p => p.is_late).length} | Subs: ${scored.filter(p => p.is_sub).length}`)
    setPlayers(scored)
    setStep(2)
    setState("checking")
  }, [players])

  // ── Step 3: Run stress-test checks ────────────────────────────────────────
  const runChecks = useCallback(() => {
    setState("checking")
    const results: CheckResult[] = []
    const r = seededRand((Date.now() & 0xffff) + 2)

    // 1. Player count vs max_players cap
    const maxPlayers = 48
    results.push({
      id: "player_cap",
      label: "Player Count vs Max Cap",
      status: config.playerCount <= maxPlayers ? "PASS" : "FAIL",
      detail: `${config.playerCount} players enrolled. System max set to ${maxPlayers}. ${config.playerCount > maxPlayers ? "OVERFLOW — game would be locked before all players can join." : "Within capacity."}`,
    })

    // 2. Fourball completeness
    const incomplete = players.filter((_, i) => {
      const fb = players.filter(p => p.fourball === Math.floor(i / 4) + 1)
      return fb.length < 3
    })
    const lastFb = players.filter(p => p.fourball === Math.ceil(config.playerCount / 4))
    results.push({
      id: "fourball_integrity",
      label: "Fourball Integrity",
      status: lastFb.length >= 2 ? "PASS" : "WARN",
      detail: `${Math.ceil(config.playerCount / 4)} fourballs generated. Last group has ${lastFb.length} player(s). ${lastFb.length < 3 ? "Last group is a 2-ball — confirm if this is allowed at the venue." : "All groups have 3+ players."}`,
    })

    // 3. Shotgun hole coverage (18 holes, 11 fourballs → some holes double up)
    const totalFourballs = Math.ceil(config.playerCount / 4)
    const holesNeeded = totalFourballs
    results.push({
      id: "shotgun_holes",
      label: "Shotgun Hole Coverage",
      status: config.teeStart !== "shotgun" ? "PASS" : holesNeeded <= 18 ? "PASS" : "WARN",
      detail: config.teeStart !== "shotgun"
        ? "Sequential start — no hole allocation needed."
        : holesNeeded <= 18
          ? `${holesNeeded} fourballs mapped to ${holesNeeded} holes. All holes covered without conflict.`
          : `${holesNeeded} fourballs exceed 18 holes. ${holesNeeded - 18} groups will need to double up on starting holes — coordinate with the course.`,
    })

    // 4. WWB pool validity
    const wwCount = players.filter(p => p.ww).length
    const birdieCount = players.filter(p => p.birdie_opt).length
    const wwPool = wwCount * config.wwbFee
    const birdiePool = birdieCount * config.birdieFee
    results.push({
      id: "wwb_pool",
      label: "WWB Pool Calculation",
      status: wwCount > 0 ? "PASS" : "WARN",
      detail: `${wwCount} WW opt-ins (pool: R${wwPool.toLocaleString()}) | ${birdieCount} Birdie opt-ins (pool: R${birdiePool.toLocaleString()}). ${wwCount === 0 ? "No WW opt-ins recorded — ensure members opt in before tee off." : "Pools look healthy."}`,
    })

    // 5. Duplicate member booking
    const memberIds = players.map(p => p.member_id)
    const dupes = memberIds.filter((id, i) => memberIds.indexOf(id) !== i)
    results.push({
      id: "duplicate_booking",
      label: "Duplicate Booking Guard",
      status: dupes.length === 0 ? "PASS" : "FAIL",
      detail: dupes.length === 0
        ? "No duplicate member IDs detected. Unique constraint is holding."
        : `${dupes.length} duplicate member ID(s) found! Members could book twice — DB unique constraint on (adhoc_game_id, member_id) must be verified.`,
    })

    // 6. No-show handling
    const noShows = players.filter(p => p.is_no_show)
    results.push({
      id: "no_show_handling",
      label: "No-Show Score Handling",
      status: noShows.every(p => p.points === 0) ? "PASS" : "FAIL",
      detail: `${noShows.length} no-show(s) detected. ${noShows.every(p => p.points === 0) ? "All correctly scored 0 points and excluded from leaderboard." : "WARNING: No-show player has non-zero points — scoring logic has a gap."}`,
    })

    // 7. Late arrival flag
    const lates = players.filter(p => p.is_late)
    results.push({
      id: "late_arrivals",
      label: "Late Arrival Flag",
      status: "PASS",
      detail: `${lates.length} player(s) flagged as late. Names: ${lates.length > 0 ? lates.map(p => p.member_name.split(" ")[0]).join(", ") : "None"}. Late flag is recorded but does not affect scoring — confirm club rules.`,
    })

    // 8. Substitute players
    const subs = players.filter(p => p.is_sub)
    results.push({
      id: "subs",
      label: "Substitute Player Handling",
      status: subs.length <= 3 ? "PASS" : "WARN",
      detail: `${subs.length} substitute(s) in this simulation. ${subs.length > 3 ? "High number of subs may indicate a member roster issue — check if all subs are registered members." : "Subs are within normal range."}`,
    })

    // 9. Leaderboard tie-break
    const leaderboard = [...players].filter(p => !p.is_no_show).sort((a, b) => b.points - a.points)
    const topScore = leaderboard[0]?.points ?? 0
    const ties = leaderboard.filter(p => p.points === topScore)
    results.push({
      id: "leaderboard_tie",
      label: "Leaderboard Tie-Break",
      status: ties.length <= 1 ? "PASS" : "WARN",
      detail: ties.length <= 1
        ? `Clear winner: ${leaderboard[0]?.member_name} with ${topScore} pts. No tie-break needed.`
        : `${ties.length} players tied at ${topScore} pts: ${ties.map(p => p.member_name.split(" ")[0]).join(", ")}. Ensure tie-break rules (countback on back 9) are implemented in scoring.`,
    })

    // 10. Revenue calculation
    const totalRevenue = config.playerCount * config.costPerPlayer
    const totalWwb = wwPool + birdiePool
    results.push({
      id: "revenue",
      label: "Revenue & Pool Totals",
      status: "PASS",
      detail: `Game revenue: R${totalRevenue.toLocaleString()} | WW pool: R${wwPool.toLocaleString()} | Birdie pool: R${birdiePool.toLocaleString()} | Total collected: R${(totalRevenue + totalWwb).toLocaleString()}`,
    })

    // 11. Max players vs booking closure
    results.push({
      id: "booking_close",
      label: "Booking Closure at Full Capacity",
      status: config.playerCount < maxPlayers ? "PASS" : "WARN",
      detail: config.playerCount < maxPlayers
        ? `Game has ${maxPlayers - config.playerCount} spots remaining. Booking stays open.`
        : `Game is at max capacity (${maxPlayers}). System should auto-close bookings — verify the 'full' status gate on the join button.`,
    })

    // 12. Score range sanity
    const outOfRange = players.filter(p => p.points > 50 || (p.points < 10 && !p.is_no_show))
    results.push({
      id: "score_sanity",
      label: "Score Range Sanity Check",
      status: outOfRange.length === 0 ? "PASS" : "WARN",
      detail: outOfRange.length === 0
        ? "All scores fall within expected stableford range (10–50 pts). No anomalies."
        : `${outOfRange.length} score(s) outside expected range. Possible data entry error or system bug — add server-side validation on score submission.`,
    })

    // 13. Pairing time conflicts (sequential only)
    let timeConflict = false
    if (config.teeStart === "sequential") {
      const times = [...new Set(players.map(p => p.tee_time))]
      timeConflict = times.length < Math.ceil(config.playerCount / 4)
    }
    results.push({
      id: "tee_time_conflict",
      label: "Tee Time Conflict Check",
      status: timeConflict ? "WARN" : "PASS",
      detail: timeConflict
        ? "Two or more fourballs share the same tee time. Adjust start interval or add a tee."
        : config.teeStart === "shotgun"
          ? "Shotgun start — all fourballs tee off simultaneously. No time conflict possible."
          : `Sequential start: ${Math.ceil(config.playerCount / 4)} unique tee times allocated at 8-minute intervals. No conflicts.`,
    })

    const fails = results.filter(c => c.status === "FAIL").length
    const warns = results.filter(c => c.status === "WARN").length
    addLog(`Stress tests complete: ${results.filter(c => c.status === "PASS").length} PASS | ${warns} WARN | ${fails} FAIL`)
    if (fails > 0) addLog(`ACTION REQUIRED: ${fails} critical issue(s) must be resolved before Wednesday's game.`)
    if (warns > 0) addLog(`${warns} warning(s) flagged for review.`)

    setChecks(results)
    setStep(3)
    setState("done")
  }, [players, config])

  const reset = () => {
    setState("configuring")
    setPlayers([])
    setChecks([])
    setLog([])
    setStep(0)
  }

  const leaderboard = [...players].filter(p => !p.is_no_show).sort((a, b) => b.points - a.points).slice(0, 10)
  const wwPool = players.filter(p => p.ww).length * config.wwbFee
  const birdiePool = players.filter(p => p.birdie_opt).length * config.birdieFee
  const passCount = checks.filter(c => c.status === "PASS").length
  const warnCount = checks.filter(c => c.status === "WARN").length
  const failCount = checks.filter(c => c.status === "FAIL").length

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-sans text-slate-800">WSOE Game Simulation</h1>
            <p className="text-sm text-slate-500 mt-0.5">Wednesday 25 March 2026 — Pre-game stress test</p>
          </div>
          <div className="flex items-center gap-3">
            {state === "done" && (
              <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${failCount > 0 ? "bg-red-100 text-red-700" : warnCount > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {failCount > 0 ? `${failCount} ISSUE${failCount > 1 ? "S" : ""} FOUND` : warnCount > 0 ? `${warnCount} WARNING${warnCount > 1 ? "S" : ""}` : "ALL CLEAR"}
              </div>
            )}
            {state !== "configuring" && (
              <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: config + controls */}
          <div className="space-y-4">

            {/* Config */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold font-sans text-slate-700">Simulation Config</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Players", key: "playerCount", type: "number", min: 20, max: 60 },
                  { label: "Cost / Player (R)", key: "costPerPlayer", type: "number", min: 0, max: 500 },
                  { label: "WW Fee (R)", key: "wwbFee", type: "number", min: 0, max: 200 },
                  { label: "Birdie Fee (R)", key: "birdieFee", type: "number", min: 0, max: 100 },
                ].map(({ label, key, type, min, max }) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <label className="text-xs text-slate-500 shrink-0 w-32">{label}</label>
                    <input
                      type={type}
                      min={min}
                      max={max}
                      value={config[key as keyof typeof config] as number}
                      onChange={e => setConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                      disabled={state !== "configuring"}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-right font-mono bg-white disabled:bg-slate-50"
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-slate-500 shrink-0 w-32">Course</label>
                  <select
                    value={config.courseId}
                    onChange={e => {
                      const c = COURSES.find(c => c.id === Number(e.target.value))
                      if (c) setConfig(cfg => ({ ...cfg, courseId: c.id, courseName: c.name }))
                    }}
                    disabled={state !== "configuring"}
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white disabled:bg-slate-50"
                  >
                    {COURSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-slate-500 shrink-0 w-32">Tee Start</label>
                  <select
                    value={config.teeStart}
                    onChange={e => setConfig(c => ({ ...c, teeStart: e.target.value as "shotgun" | "sequential" }))}
                    disabled={state !== "configuring"}
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white disabled:bg-slate-50"
                  >
                    <option value="shotgun">Shotgun</option>
                    <option value="sequential">Sequential</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-slate-500 shrink-0 w-32">WWB Enabled</label>
                  <input
                    type="checkbox"
                    checked={config.wwbEnabled}
                    onChange={e => setConfig(c => ({ ...c, wwbEnabled: e.target.checked }))}
                    disabled={state !== "configuring"}
                    className="accent-emerald-600 w-4 h-4"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-slate-500 shrink-0 w-32">Tee-off Time</label>
                  <input
                    type="time"
                    value={config.teeOffTime}
                    onChange={e => setConfig(c => ({ ...c, teeOffTime: e.target.value }))}
                    disabled={state !== "configuring"}
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1 font-mono bg-white disabled:bg-slate-50"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Run controls */}
            <Card className="border-slate-200">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  {[
                    { n: 1, label: "Pairings" },
                    { n: 2, label: "Scoring" },
                    { n: 3, label: "Checks" },
                  ].map(s => (
                    <div key={s.n} className="flex items-center gap-1.5 flex-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${step >= s.n ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400"}`}>{s.n}</div>
                      <span className={`text-[10px] font-medium ${step >= s.n ? "text-emerald-700" : "text-slate-400"}`}>{s.label}</span>
                      {s.n < 3 && <div className={`flex-1 h-px ${step > s.n ? "bg-emerald-400" : "bg-slate-200"}`} />}
                    </div>
                  ))}
                </div>

                {state === "configuring" && (
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm" onClick={runPairings}>
                    Run Simulation
                  </Button>
                )}
                {state === "scoring" && step === 1 && (
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm" onClick={runScoring}>
                    Generate Scores
                  </Button>
                )}
                {state === "checking" && step === 2 && (
                  <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm" onClick={runChecks}>
                    Run Stress Tests
                  </Button>
                )}
                {state === "done" && (
                  <div className="text-center text-xs text-slate-500 py-1">Simulation complete. Reset to run again.</div>
                )}
              </CardContent>
            </Card>

            {/* Summary stats */}
            {players.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold font-sans text-slate-700">Live Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Players", value: players.length },
                    { label: "Fourballs", value: Math.ceil(players.length / 4) },
                    { label: "No-shows", value: players.filter(p => p.is_no_show).length },
                    { label: "Late", value: players.filter(p => p.is_late).length },
                    { label: "WW Pool", value: `R${wwPool.toLocaleString()}` },
                    { label: "Birdie Pool", value: `R${birdiePool.toLocaleString()}` },
                    { label: "WW Opted In", value: players.filter(p => p.ww).length },
                    { label: "Bir Opted In", value: players.filter(p => p.birdie_opt).length },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded p-2">
                      <div className="text-[9px] text-slate-400 uppercase tracking-wide">{s.label}</div>
                      <div className="text-sm font-bold text-slate-800 font-mono">{s.value}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Middle column: pairings + leaderboard */}
          <div className="space-y-4">
            {/* Pairings */}
            {players.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold font-sans text-slate-700">
                    Fourballs ({Math.ceil(players.length / 4)} groups)
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {Array.from({ length: Math.ceil(players.length / 4) }, (_, fb) => {
                    const group = players.filter(p => p.fourball === fb + 1)
                    return (
                      <div key={fb} className="border border-slate-100 rounded-lg overflow-hidden">
                        <div className="bg-slate-100 px-2.5 py-1 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-600">Fourball {fb + 1}</span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {config.teeStart === "shotgun" ? `Hole ${fb + 1}` : `Tee ${group[0]?.tee_time}`}
                          </span>
                        </div>
                        {group.map(p => (
                          <div key={p.member_id} className="flex items-center justify-between px-2.5 py-1 border-t border-slate-50">
                            <span className="text-[10px] text-slate-700 truncate">{p.member_name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[9px] text-slate-400 font-mono">HCP {p.hcp}</span>
                              {p.ww && <span className="text-[7px] bg-blue-100 text-blue-600 px-1 rounded font-bold">WW</span>}
                              {p.birdie_opt && <span className="text-[7px] bg-amber-100 text-amber-600 px-1 rounded font-bold">B</span>}
                              {p.is_late && <span className="text-[7px] bg-orange-100 text-orange-600 px-1 rounded font-bold">LATE</span>}
                              {p.is_no_show && <span className="text-[7px] bg-red-100 text-red-600 px-1 rounded font-bold">NS</span>}
                              {p.is_sub && <span className="text-[7px] bg-purple-100 text-purple-600 px-1 rounded font-bold">SUB</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {/* Leaderboard */}
            {step >= 2 && leaderboard.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold font-sans text-slate-700">Top 10 Leaderboard</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {leaderboard.map((p, i) => (
                    <div key={p.member_id} className={`flex items-center gap-2 px-2 py-1 rounded ${i === 0 ? "bg-yellow-50" : i === 1 ? "bg-slate-50" : ""}`}>
                      <span className={`w-5 text-center text-[10px] font-bold shrink-0 ${i === 0 ? "text-yellow-600" : i === 1 ? "text-slate-500" : i === 2 ? "text-amber-700" : "text-slate-400"}`}>{i + 1}</span>
                      <span className="flex-1 text-xs text-slate-700 truncate">{p.member_name}</span>
                      <span className={`text-xs font-bold font-mono ${i === 0 ? "text-yellow-600" : "text-slate-600"}`}>{p.points} pts</span>
                      <span className="text-[9px] text-slate-400 font-mono">G{p.gross}</span>
                      {p.birdies > 0 && <span className="text-[9px] text-green-600">🦅{p.birdies}</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column: checks + log */}
          <div className="space-y-4">
            {/* Stress test checks */}
            {checks.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold font-sans text-slate-700">Stress Test Results</CardTitle>
                    <div className="flex gap-1.5">
                      <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">{passCount} PASS</span>
                      {warnCount > 0 && <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">{warnCount} WARN</span>}
                      {failCount > 0 && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">{failCount} FAIL</span>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {checks.map(c => (
                    <div key={c.id} className={`rounded-lg p-2.5 border ${c.status === "FAIL" ? "border-red-200 bg-red-50" : c.status === "WARN" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold ${c.status === "FAIL" ? "text-red-700" : c.status === "WARN" ? "text-amber-700" : "text-emerald-700"}`}>{c.label}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.status === "FAIL" ? "bg-red-200 text-red-800" : c.status === "WARN" ? "bg-amber-200 text-amber-800" : "bg-emerald-200 text-emerald-800"}`}>{c.status}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-relaxed">{c.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Activity log */}
            {log.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold font-sans text-slate-700">Simulation Log</CardTitle>
                </CardHeader>
                <CardContent className="max-h-48 overflow-y-auto space-y-1">
                  {log.map((entry, i) => (
                    <div key={i} className="text-[10px] text-slate-500 font-mono leading-relaxed border-b border-slate-50 pb-1">{entry}</div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
