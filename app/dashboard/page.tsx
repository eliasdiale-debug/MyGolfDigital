// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Loading from "./loading";
import { setMemberPin, adminResetMemberPin } from "@/app/login/actions";
import { IronManLeaderboard } from "@/components/iron-man-leaderboard";
import { WhatsAppImport } from "@/components/WhatsAppImport";

const ShopTab = dynamic(() => import("@/components/shop-tab"), { ssr: false });
const TravelTab = dynamic(() => import("@/components/travel-tab"), { ssr: false });
const PublicGamesModal = dynamic(() => import("@/components/public-games-modal"), { ssr: false });

// Leaflet must never run on the server


interface MemberData {
  member_id: number;
  member_name: string;
  profile_picture_url?: string | null;
  gender?: 'male' | 'female';
  member_handicap_indices: {
    official_handicap_index: number;
    remmoho_handicap_index: number;
    previous_handicap_index?: number | null;
    season?: string;
  }[];
}

interface GameRecord {
  record_id: number;
  game_date: string;
  points: number;
  gross_score: number;
  medal_game: boolean;
  current_quarter_position: number | null;
  current_quarter_points: number | null;
  current_year_position: number | null;
  current_year_points: number | null;
  medal_league_position: number | null;
  medal_league_points: number | null;
  courses: { course_name: string };
  is_official: boolean;
}

interface BirdieRecord {
  birdie_count: number;
  game_date: string;
  courses: { course_name: string };
}

interface EagleRecord {
  eagle_count: number;
  game_date: string;
  courses: { course_name: string };
}

interface LadyRecord {
  ladies_count: number;
  game_date: string;
  courses: { course_name: string };
}

interface Course {
  course_id: number;
  course_name: string;
  course_rating: string;
  slope_rating: number;

}

interface LeaderData {
  member_name: string;
  total_points: number;
}

// API response types
interface GeneratePairingsResponse {
  pairings?: Array<{
    pairing_id: number;
    adhoc_game_id: number;
    fourball_number: number;
    member_id: number | null;
    guest_id: number | null;
    is_captain: boolean;
    playing_handicap: number | null;
    tee_off_time: string | null;
    starting_hole: number | null;
    member_name: string | null;
    guest_name: string | null;
    guest_handicap_index: number | null;
    wwb_ww: boolean;
    wwb_birdie: boolean;
  }>;
  error?: string;
}

interface FinalizeGameResponse {
  allSubmitted: boolean;
  message?: string;
}

const ANNUAL_GAME_CAPACITY = 40;

// Sanitize user input to prevent XSS
const sanitizeInput = (input: string | null | undefined): string => {
  if (!input) return '';
  return input.replace(/[<>]/g, '').trim();
};

// Calculate time until game starts
function calculateTimeUntilGame(gameDate: string, teeTime: string | null): string {
  if (!teeTime) return "TBD";
  const now = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }));
  const [hours, minutes] = teeTime.split(":").map(Number);
  const gameDateTime = new Date(gameDate);
  gameDateTime.setHours(hours, minutes, 0, 0);
  
  const diffMs = gameDateTime.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffMs <= 0) return "Starting soon";
  if (diffHours >= 24) return `${Math.floor(diffHours / 24)} days away`;
  if (diffHours > 0) return `${diffHours}h ${diffMins}m`;
  return `${diffMins} minutes`;
}

// Format countdown for upcoming game
function formatCountdown(gameDate: string, teeTime: string | null): string {
  if (!teeTime) return "--:--";
  const now = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }));
  const [hours, minutes] = teeTime.split(":").map(Number);
  const gameDateTime = new Date(gameDate);
  gameDateTime.setHours(hours, minutes, 0, 0);
  
  const diffMs = gameDateTime.getTime() - now.getTime();
  if (diffMs <= 0) return "LIVE NOW!";
  
  const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
  const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secsLeft = Math.floor((diffMs % (1000 * 60)) / 1000);
  
  if (hoursLeft > 0) return `${hoursLeft}h ${minsLeft}m`;
  if (minsLeft > 0) return `${minsLeft}m ${secsLeft}s`;
  return `${secsLeft}s`;
}

// Format pairings for share
function formatPairingsForShare(pairings: Array<{ fourball_number: number; members: Array<{ member_name: string; playing_handicap: number | null }> }>): string {
  return pairings.map(p => 
    `4Ball ${p.fourball_number}: ${p.members.map(m => `${m.member_name} (${m.playing_handicap ?? '-'})`).join(', ')}`
  ).join('\n');
}

// Dynamic quarter date calculation
// Quarters: Q1 = Dec-Feb, Q2 = Mar-May, Q3 = Jun-Aug, Q4 = Sep-Nov
const getQuarterDates = (): { start: string; end: string } => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  
  if (month >= 11) { // Dec
    return { start: `${year}-12-01`, end: `${year + 1}-02-28` };
  } else if (month <= 1) { // Jan-Feb
    return { start: `${year - 1}-12-01`, end: `${year}-02-28` };
  } else if (month <= 4) { // Mar-May
    return { start: `${year}-03-01`, end: `${year}-05-31` };
  } else if (month <= 7) { // Jun-Aug
    return { start: `${year}-06-01`, end: `${year}-08-31` };
  } else { // Sep-Nov
    return { start: `${year}-09-01`, end: `${year}-11-30` };
  }
};
// All member_ids belonging to Elias Diale across his clubs (super admin everywhere)
const ELIAS_IDS = [9, 54, 111, 458];
const ANNUAL_SUPER_ADMINS = [...new Set([...ELIAS_IDS, 37])]; // Elias (all clubs), Tebele Molata
const FINANCE_ADMINS = [...new Set([...ELIAS_IDS, 36])]; // Elias (all clubs), Sydney Mhlarhi
const MEMBER_EDITORS = [...ELIAS_IDS]; // Elias - can edit member details for any club
// Club admins by club_id - can create games, add/delete members/guests, change pairings, reset PINs
const CLUB_ADMINS: Record<number, number[]> = {
  13: [612, 725, 551, 631, 646], // WSOE - Connie, Carl, Alfred, Mandla, Smart
  19: [1392], // Fairway Finders - Edwin Mpofu
  23: [1311], // WGS - Peter Ntsoko
};
// Legacy constants for backwards compatibility
const CLUB13_ADMINS = [...new Set([...ELIAS_IDS, ...CLUB_ADMINS[13]])];
const CLUB19_ADMINS = CLUB_ADMINS[19];
const CLUB13_ID = 13;
const TUESDAY_CLINIQUE_ID = 4; // Tuesday Clinique
const GOLF_BUDDIES_ID = 10;  // Golf Buddies
const WWB_CLUB_IDS = [CLUB13_ID, TUESDAY_CLINIQUE_ID]; // Clubs with WWB feature enabled
// Clubs that ALWAYS play Medal format — no ESC cap, leaderboard sorted by Net
const MEDAL_CLUB_IDS = [TUESDAY_CLINIQUE_ID, GOLF_BUDDIES_ID];

// Returns first name, but appends first letter of surname if another person in the list
// shares the same first name — e.g. "John" → "John M" when there are two Johns.
// Name aliases: always display these members with a fixed label regardless of context
const NAME_ALIASES: Record<string, string> = {
  "Elias Diale": "DIALE",
};

function getDisplayName(fullName: string, allNames: string[]): string {
  if (!fullName) return "";
  if (NAME_ALIASES[fullName]) return NAME_ALIASES[fullName];
  const parts = fullName.trim().split(" ");
  const firstName = parts[0];
  const surnameInitial = parts.length > 1 ? parts[parts.length - 1][0] : "";
  const hasDuplicate = allNames.some(n => {
    if (n === fullName) return false;
    return n.trim().split(" ")[0] === firstName;
  });
  return hasDuplicate && surnameInitial ? `${firstName} ${surnameInitial}` : firstName;
}

function formatMemberName(fullName: string): string {
  if (!fullName) return "";
  return NAME_ALIASES[fullName] ?? fullName;
}

// Calculate handicap strokes for any handicap level, with gender support
function calculateHcpStrokes(
  handicap: number, 
  strokeIndex: number, 
  gender?: string,
  ladiesStrokeIndex?: number
): number {
  if (!handicap || handicap <= 0) return 0;
  
  // Use ladies stroke index if player is female and ladies SI is provided
  const effectiveSI = (gender === 'female' && ladiesStrokeIndex !== undefined && ladiesStrokeIndex !== null) 
    ? ladiesStrokeIndex 
    : strokeIndex;
  
  const handicapInt = Math.floor(handicap);
  let totalStrokes = Math.floor(handicapInt / 18);
  const remaining = handicapInt % 18;
  if (remaining > 0 && effectiveSI <= remaining) {
    totalStrokes++;
  }
  return totalStrokes;
}

// Per-club WWB fee structure: { front9, back9, overall, birdie }
const WWB_FEES: Record<number, { front9: number; back9: number; overall: number; birdie: number }> = {
  [CLUB13_ID]:           { front9: 100, back9: 100, overall: 100, birdie: 50 },
  [TUESDAY_CLINIQUE_ID]: { front9: 150, back9: 150, overall: 200, birdie: 50 },
};
const DEFAULT_ACCOUNT_CATEGORIES = [
  "2026 membership", "Bank deposit", "Membership fee payment", "Opening balances",
  "caddy", "AVH bet", "Khathu transfer", "Nthumeni transfer", "sekete", "sydney",
  "CMR - Sins", "Dainfern - Sins", "Dainfern - CashBank", "Dainfern greenfee", "Dainfern visitor fee",
  "ERPM - Sins", "ERPM - CashBank", "ERPM greenfee", "Firethorn - Sins",
  "Gary Player - Sins", "Glenvista - Sins", "Glenvista - CashBank",
  "Jackals Creek - Sins", "Jackals Creek greenfee",
  "Kempton Park Golf Club - Sins", "Killarney - Sins", "Killarney - CashBank",
  "Krugersdorp Golf Club - Sins", "Kyalami - Sins", "Kyalami - CashBank",
  "Pretoria Golf Club - Sins", "Services - Sins", "Services - CashBank",
  "Soweto Country Club - Sins", "Waterkloof - Sins", "Ngobs refund credit",
  "Dainfern AVH/Syd transfer", "Other"
];

interface ScheduleGame {
  schedule_id: number;
  game_date: string;
  day_of_week: string;
  activity: string;
  format: string;
  course_name: string | null;
  event_type: string;
  isBooked?: boolean;
  booked_count: number;
  players: { member_id: number; member_name: string; booking_id: number }[];
  guests: { guest_name: string; guest_handicap: number | null; booking_id: number; booked_by: number }[];
  cancelled: { name: string; cancelled_at: string }[];
}

interface AdhocGame {
  adhoc_game_id: number;
  organizer_id: number;
  organizer_name: string;
  course_id: number;
  course_name: string;
  game_date: string;
  tee_off_time: string;
  max_players: number;
  notes: string | null;
  status: string;
  deleted_at: string | null;
  booked_count: number;
  isBooked?: boolean;
  players: { member_id: number; member_name: string }[];
  guests: { guest_id: number; guest_name: string; handicap_index: number | null }[];
  cancelled_players: { name: string; cancelled_at: string; isGuest?: boolean }[];
  cost_per_player: number;
  game_type?: string;
  wwb_enabled?: boolean;
  birdie_pool_fee?: number | null;
  tee_start?: '1' | 'split';
  is_multi_round?: boolean;
  total_rounds?: number;
  round_number?: number;
  round_schedule?: { round: number; date: string | null; course_id: number | null; course_name: string | null }[] | null;
  club_id?: number | null;
  game_visibility?: 'club' | 'public';
  is_official?: boolean;
}

interface PairingMember {
  pairing_id: number;
  member_id: number;
  guest_id?: number; // Set for guests (member_id will be negative = -guest_id)
  member_name: string;
  is_captain: boolean;
  gross_score: number | null;
  points: number | null;
  result_submitted: boolean;
  playing_handicap: number | null;
  birdies_count: number | null;
  eagles_count: number | null;
  hio_count: number | null;
  ladies_count: number | null;
  is_late: boolean;
  is_no_show: boolean;
  scores_submitted_at: string | null;
  wwb_ww?: boolean | null;
  wwb_birdie?: boolean | null;
  gender?: 'male' | 'female';
  front9_points?: number | null;
  back9_points?: number | null;
}

interface RecentGameResult {
  game_date: string;
  course_name: string;
  is_medal: boolean;
  revenue: number;
  leaderboard: {
  member_name: string;
  points: number;
  gross_score: number;
  playing_handicap: number;
  birdies_count: number;
  eagles_count: number;
  ladies_count: number;
  medal_points?: number;
  medal_net?: number;
  is_late?: boolean;
  is_no_show?: boolean;
  is_sub?: boolean;
  }[];
  is_official?: boolean;
  }

interface FourBallPairing {
  adhoc_game_id: number;
  fourball_number: number;
  course_id: number;
  course_name: string;
  game_date: string;
  tee_off_time: string;       // game-level start time from adhoc_games
  fourball_tee_time?: string; // per-group staggered tee time from pairings row
  starting_hole: number;      // 1 or 10 — stored on each pairing row at generation time
  course_rating: number;
  members: PairingMember[];
  isCaptain: boolean;
  allResultsSubmitted: boolean;
  game_type?: string;
}

interface WwbHistoryGame {
  adhoc_game_id: number;
  game_date: string;
  course_name: string;
  ww_front9_winner_id: number | null;
  ww_front9_winner_name: string | null;
  ww_front9_points: number | null;
  ww_back9_winner_id: number | null;
  ww_back9_winner_name: string | null;
  ww_back9_points: number | null;
  ww_overall_winner_id: number | null;
  ww_overall_winner_name: string | null;
  ww_overall_points: number | null;
  birdie_pool_total: number;
  birdie_pool_per_birdie: number;
  birdie_pool_entrants: number;
  birdie_pool_total_birdies: number;
  birdie_payouts: { member_id: number; member_name: string; birdies_scored: number; payout_amount: number }[];
}

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50 dark:bg-red-950">
          <div className="text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-bold text-red-700 dark:text-red-300 mb-2">Something went wrong</h2>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{this.state.error?.message || "Please refresh the page"}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<Array<{ id: string; operation: () => Promise<void> }>>([]);
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [recentGames, setRecentGames] = useState<GameRecord[]>([]);
  const [balance, setBalance] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<{transaction_date: string; description: string; debit: number; credit: number; balance: number}[]>([]);
  const [birdiesData, setBirdiesData] = useState<BirdieRecord[]>([]);
  const [eaglesData, setEaglesData] = useState<EagleRecord[]>([]);
  const [ladiesData, setLadiesData] = useState<LadyRecord[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const [exportingPairings, setExportingPairings] = useState<number | null>(null);

  const [quarterLeader, setQuarterLeader] = useState<LeaderData | null>(null);
  const [annualLeader, setAnnualLeader] = useState<LeaderData | null>(null);
  const [calculatedQuarterPosition, setCalculatedQuarterPosition] = useState<number | null>(null);
  const [calculatedAnnualPosition, setCalculatedAnnualPosition] = useState<number | null>(null);
  const [medalLeader, setMedalLeader] = useState<LeaderData | null>(null);
  const [calculatedMedalPosition, setCalculatedMedalPosition] = useState<number | null>(null);
  const [medalYearPoints, setMedalYearPoints] = useState<number>(0);
  const [quarterCalcPoints, setQuarterCalcPoints] = useState<number>(0);
  const [annualCalcPoints, setAnnualCalcPoints] = useState<number>(0);
  // Full sorted standings for popup
  const [quarterStandings, setQuarterStandings] = useState<{ member_id: number; member_name: string; total_points: number }[]>([]);
  const [annualStandings, setAnnualStandings] = useState<{ member_id: number; member_name: string; total_points: number }[]>([]);
  const [medalStandings, setMedalStandings] = useState<{ member_id: number; member_name: string; total_points: number }[]>([]);
  const [standingsModal, setStandingsModal] = useState<"quarter" | "annual" | "medal" | "ironman" | "coc" | "oom" | null>(null);
  
  // OOM State - for Fairway Finders (Club 19) only
  const [oomLeader, setOomLeader] = useState<LeaderData | null>(null);
  const [calculatedOomPosition, setCalculatedOomPosition] = useState<number | null>(null);
  const [oomYearPoints, setOomYearPoints] = useState<number>(0);
  const [oomStandings, setOomStandings] = useState<{ member_id: number; member_name: string; total_points: number }[]>([]);
  
  // CoC State - for Club 13 only
  const [cocTopPoints, setCocTopPoints] = useState<number>(0);
  const [cocTopPlayer, setCocTopPlayer] = useState<string>("");
  const [cocAllChampions, setCocAllChampions] = useState<Array<{ 
    member_id: number; 
    member_name: string; 
    total_points: number; 
    total_wins: number;
    wins: Array<{ game_date: string; course_name: string; points_earned: number; game_type: string }>;
  }>>([]);
  const [cocLoading, setCocLoading] = useState(true);
  
  // Join Request State - for public game approval workflow
  const [pendingJoinRequests, setPendingJoinRequests] = useState<Array<{
    request_id: number;
    adhoc_game_id: number;
    requester_id: number;
    requester_name: string;
    game_date: string;
    course_name: string;
    created_at: string;
  }>>([]);
  const [myJoinRequests, setMyJoinRequests] = useState<Array<{
    request_id: number;
    adhoc_game_id: number;
    organizer_name: string;
    game_date: string;
    course_name: string;
    status: 'pending' | 'approved' | 'denied';
    created_at: string;
    responded_at: string | null;
    game_status?: string;
  }>>([]);
  const [joinRequestProcessing, setJoinRequestProcessing] = useState<number | null>(null);
  
  const [editingOfficialHcp, setEditingOfficialHcp] = useState(false);
  const [newOfficialHcp, setNewOfficialHcp] = useState("");
  const [savingOfficialHcp, setSavingOfficialHcp] = useState(false);

  const [nextGame, setNextGame] = useState<{ course_name: string; game_date: string } | null>(null);
  const [birdiesPosition, setBirdiesPosition] = useState<number | null>(null);
  const [ladiesPosition, setLadiesPosition] = useState<number | null>(null);
  
  // Ladies golf state
  const [editingGender, setEditingGender] = useState<number | null>(null);
  const [editGender, setEditGender] = useState<'male' | 'female'>('male');
  const [guestGender, setGuestGender] = useState<'male' | 'female'>('male');
  const [ladiesStrokeMap, setLadiesStrokeMap] = useState<Record<number, Record<number, number>>>({});
  const [upcomingGames, setUpcomingGames] = useState<ScheduleGame[]>([]);
  const [bookingLoading, setBookingLoading] = useState<number | null>(null);
  const [lateCount, setLateCount] = useState(0);
  const [noShowCount, setNoShowCount] = useState(0);
  const [adhocGames, setAdhocGames] = useState<AdhocGame[]>([]);
  const [publicGamesModalOpen, setPublicGamesModalOpen] = useState(false);
  const [adhocBookingLoading, setAdhocBookingLoading] = useState<number | null>(null);
  const [openingScorecard, setOpeningScorecard] = useState<number | null>(null);
  // Ref mirror of openingScorecard for synchronous dedup (state updates are async and
  // cannot block a second openScorecard call fired in the same render cycle).
  const openingScorecardRef = useRef<number | null>(null);
  const [showCreateAdhoc, setShowCreateAdhoc] = useState(false);
  const [newAdhocCourse, setNewAdhocCourse] = useState<number | null>(null);
  const [newAdhocDate, setNewAdhocDate] = useState("");
  const [newAdhocTime, setNewAdhocTime] = useState("");
  const [newAdhocNotes, setNewAdhocNotes] = useState("");
  const [newAdhocMaxPlayers, setNewAdhocMaxPlayers] = useState(4);
  const [newAdhocCost, setNewAdhocCost] = useState("");
  const [newAdhocGameType, setNewAdhocGameType] = useState("IPS");
  const [newAdhocTeeStart, setNewAdhocTeeStart] = useState<'1' | 'split'>('1');
  const [newAdhocWwbOpts, setNewAdhocWwbOpts] = useState<{ ww: boolean; birdie: boolean }>({ ww: true, birdie: true });
  const [newAdhocIsMultiRound, setNewAdhocIsMultiRound] = useState(false);
  const [newAdhocIsOfficial, setNewAdhocIsOfficial] = useState(true); // Official game by default
  const [newAdhocIsPublic, setNewAdhocIsPublic] = useState(false); // Public visibility for nomads
  const [newAdhocTotalRounds, setNewAdhocTotalRounds] = useState(2);
  const [newAdhocEndDate, setNewAdhocEndDate] = useState("");
  const [newAdhocRoundDetails, setNewAdhocRoundDetails] = useState<{
    date: string;
    course_id: string;
    time: string;
    game_type: string;
    tee_start: string;
    max_players: number;
    cost: string;
    notes: string;
  }[]>([]);
  const [creatingAdhoc, setCreatingAdhoc] = useState(false);
  // Cross-club members - removed, use Add Guest functionality instead
  const [editingAdhocId, setEditingAdhocId] = useState<number | null>(null);
  const [editAdhocCourse, setEditAdhocCourse] = useState<number | null>(null);
  const [editAdhocDate, setEditAdhocDate] = useState("");
  const [editAdhocTime, setEditAdhocTime] = useState("");
  const [editAdhocNotes, setEditAdhocNotes] = useState("");
  const [editAdhocMaxPlayers, setEditAdhocMaxPlayers] = useState(4);
  const [editAdhocCost, setEditAdhocCost] = useState("");
  const [editAdhocTeeStart, setEditAdhocTeeStart] = useState<'1' | 'split'>('1');
  const [editAdhocIsOfficial, setEditAdhocIsOfficial] = useState(true);
  const [editAdhocIsPublic, setEditAdhocIsPublic] = useState(false);
  const [savingAdhoc, setSavingAdhoc] = useState(false);
  const [deletingAdhocId, setDeletingAdhocId] = useState<number | null>(null);
  const [nominateOrganizerGameId, setNominateOrganizerGameId] = useState<number | null>(null);
  const [nominatedMemberId, setNominatedMemberId] = useState<number | null>(null);
  const [transferringOrganizer, setTransferringOrganizer] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [forceRefreshing, setForceRefreshing] = useState(false);
  // Handicap Admin (Tebele=37, Elias=9 only)
  const [showHcpAdmin, setShowHcpAdmin] = useState(false);
  const [hcpAllMembers, setHcpAllMembers] = useState<{ member_id: number; member_name: string; remmoho_handicap_index: number | null; official_handicap_index: number | null; previous_handicap_index: number | null }[]>([]);
  const [hcpEdits, setHcpEdits] = useState<Record<number, { remmoho: string; official: string }>>({});
  const [hcpSaving, setHcpSaving] = useState(false);
  const [hcpSearch, setHcpSearch] = useState("");
  const [hcpLoading, setHcpLoading] = useState(false);
  const [myPairings, setMyPairings] = useState<FourBallPairing[]>([]);
  const [allGamePairings, setAllGamePairings] = useState<FourBallPairing[]>([]);
  const [swappingGameId, setSwappingGameId] = useState<number | null>(null);
  const [swapPlayerA, setSwapPlayerA] = useState<{ pairing_id: number; member_name: string; fourball_number: number } | null>(null);
  const [swapPlayerB, setSwapPlayerB] = useState<{ pairing_id: number; member_name: string; fourball_number: number } | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"home"|"records"|"play"|"live"|"competitions"|"shop"|"travel"|"club"|"manage">("home");
  const [liveScores, setLiveScores] = useState<{ member_name: string; member_id: number; points: number | null; gross_score: number | null; fourball_number: number; result_submitted: boolean }[]>([]);
  const [liveScoreGameInfo, setLiveScoreGameInfo] = useState<{ course_name: string; game_date: string; adhoc_game_id?: number; course_id?: number; format?: string; game_number?: number; total_games_today?: number; all_same_day_game_ids?: number[]; tee_off_time?: string | null; organizer_id?: number; game_visibility?: 'club' | 'public'; club_id?: number } | null>(null);
  const [liveRoundTab, setLiveRoundTab] = useState<number | "summary">(1); // which round tab is active in multi-round live view
  const [showLiveTopOnly, setShowLiveTopOnly] = useState(true);
  const [liveFullView, setLiveFullView] = useState(false);

  // Reset to round 1 whenever the live game changes
const prevLiveGameIdRef = React.useRef<number | undefined>(undefined);
  const isLoadingSiblingData = React.useRef(false);
  
  React.useEffect(() => {
  const newId = liveScoreGameInfo?.adhoc_game_id;
  if (newId !== prevLiveGameIdRef.current) {
  prevLiveGameIdRef.current = newId;
  setLiveRoundTab(1);
  }
  }, [liveScoreGameInfo?.adhoc_game_id]);
  
  // When the summary tab is selected, ensure pairings + hole scores for ALL sibling rounds
  // are loaded into memory so buildSummary can compute accurate cross-round totals.
  useEffect(() => {
  if (liveRoundTab !== "summary") return;
  if (isLoadingSiblingData.current) return;
  
  const liveGame = liveScoreGameInfo?.adhoc_game_id
  ? adhocGames.find(g => g.adhoc_game_id === liveScoreGameInfo.adhoc_game_id)
  : null;
  if (!liveGame?.is_multi_round) return;
  
  const siblingGames = adhocGames.filter(g =>
  g.is_multi_round &&
  g.organizer_id === liveGame.organizer_id &&
  (g.club_id ?? 0) === (liveGame.club_id ?? 0) &&
  g.total_rounds === liveGame.total_rounds &&
  g.adhoc_game_id !== liveScoreGameInfo?.adhoc_game_id
  );
  if (!siblingGames.length) return;
  
  const fetchSiblingData = async () => {
  if (isLoadingSiblingData.current) return;
  isLoadingSiblingData.current = true;
  
  const supabase = createClient();
      for (const sibling of siblingGames) {
        // If pairings are already loaded for this sibling, skip
        const alreadyLoaded = allGamePairings.some(p => p.adhoc_game_id === sibling.adhoc_game_id);

        if (!alreadyLoaded) {
          // Fetch pairings for the sibling round
          const { data: pairData } = await supabase
            .from("pairings")
            .select("pairing_id, adhoc_game_id, fourball_number, member_id, guest_id, is_captain, is_fourball_captain, playing_handicap, tee_off_time, starting_hole, gross_score, points, result_submitted, birdies_count, eagles_count, hio_count, ladies_count, is_late, is_no_show, is_sub, scores_submitted_at, wwb_ww, wwb_birdie, members(member_name), guests(guest_name, handicap_index)")
            .eq("adhoc_game_id", sibling.adhoc_game_id);

          if (pairData && pairData.length > 0) {
            type PairRow = {
              pairing_id: number; adhoc_game_id: number; fourball_number: number;
              member_id: number | null; guest_id: number | null;
              is_captain: boolean; is_fourball_captain: boolean;
              playing_handicap: number | null; tee_off_time: string | null; starting_hole: number | null;
              gross_score: number | null; points: number | null; result_submitted: boolean;
              birdies_count: number; eagles_count: number; hio_count: number; ladies_count: number;
              is_late: boolean; is_no_show: boolean; is_sub: boolean;
              scores_submitted_at: string | null; wwb_ww: boolean | null; wwb_birdie: boolean | null;
              members: { member_name: string; }[] | null;
              guests: { guest_name: string; handicap_index: number | null } | null;
            };
            const grouped: Record<number, FourBallPairing> = {};
            (pairData as unknown as PairRow[]).forEach(p => {
              const fn = p.fourball_number;
              if (!grouped[fn]) {
                grouped[fn] = {
                  adhoc_game_id: sibling.adhoc_game_id,
                  fourball_number: fn,
                  course_id: sibling.course_id,
                  course_name: sibling.course_name,
                  game_date: sibling.game_date,
                  tee_off_time: sibling.tee_off_time,
                  starting_hole: p.starting_hole ?? 1,
                  course_rating: 72,
                  members: [],
                  isCaptain: false,
                  allResultsSubmitted: false,
                };
              }
  const isGuest = !!p.guest_id && !p.member_id;
  const guestData = p.guests as { 
    guest_id: number; 
    guest_name: string; 
    handicap_index: number | null;
    gender?: string;
    club_id?: number;
    golf_clubs?: { club_name: string };
  } | null;
  const guestClubName = isGuest && guestData?.golf_clubs?.club_name ? guestData.golf_clubs.club_name : null;
  const displayName = isGuest 
    ? `${Array.isArray(guestData) ? guestData[0]?.guest_name : guestData?.guest_name || "Guest"}${guestClubName ? ` (${guestClubName})` : ' (G)'}`
    : (p.members?.[0]?.member_name ?? "Unknown");
  grouped[fn].members.push({
  pairing_id: p.pairing_id,
  member_id: p.member_id ?? -(p.guest_id ?? 0),
  guest_id: isGuest ? (p.guest_id ?? undefined) : undefined,
  member_name: displayName,
                is_captain: p.is_captain || p.is_fourball_captain,
                gross_score: p.gross_score,
                points: p.points,
                result_submitted: p.result_submitted,
                playing_handicap: p.playing_handicap,
                birdies_count: p.birdies_count,
                eagles_count: p.eagles_count,
                hio_count: p.hio_count,
                ladies_count: p.ladies_count,
                is_late: p.is_late,
                is_no_show: p.is_no_show,
                scores_submitted_at: p.scores_submitted_at,
                wwb_ww: p.wwb_ww,
                wwb_birdie: p.wwb_birdie,
              });
            });
            const fbPairings = Object.values(grouped).map(fb => ({
              ...fb,
              allResultsSubmitted: fb.members.length > 0 && fb.members.every(m => m.result_submitted),
            }));
            setAllGamePairings(prev => {
              // Remove any stale entries for this sibling then add fresh ones
              const without = prev.filter(p => p.adhoc_game_id !== sibling.adhoc_game_id);
              return [...without, ...fbPairings];
            });
          }
        }

        // Also fetch hole scores (members + guests) in case some are in progress (not yet finalised)
        const [{ data: scoresData }, { data: guestScoresData }] = await Promise.all([
          supabase.from("hole_scores").select("pairing_id, hole_number, strokes").eq("adhoc_game_id", sibling.adhoc_game_id),
          supabase.from("guest_hole_scores").select("pairing_id, hole_number, strokes").eq("course_id", sibling.course_id).eq("game_date", sibling.game_date)
        ]);
        setHoleScoreData(prev => {
          const updated = { ...prev };
          // Add member scores
          if (scoresData) {
            scoresData.forEach(s => {
              if (!updated[s.pairing_id]) updated[s.pairing_id] = {};
              updated[s.pairing_id][s.hole_number] = s.strokes;
            });
          }
          // Add guest scores
          if (guestScoresData) {
            guestScoresData.forEach(s => {
              if (!updated[s.pairing_id]) updated[s.pairing_id] = {};
              updated[s.pairing_id][s.hole_number] = s.strokes;
            });
          }
  return updated;
  });
  }
  isLoadingSiblingData.current = false;
  };
  fetchSiblingData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRoundTab, liveScoreGameInfo?.adhoc_game_id, adhocGames]);
  const [recentResults, setRecentResults] = useState<RecentGameResult[]>([]);
  const [memberRecentResults, setMemberRecentResults] = useState<RecentGameResult[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const [expandedLeaderboardPlayers, setExpandedLeaderboardPlayers] = useState<Set<number>>(new Set());
  const [expandedFullLeaderboards, setExpandedFullLeaderboards] = useState<Set<string>>(new Set()); // Track which leaderboards show all players (key = game_date + course_name)
  const [scoreViewerPlayer, setScoreViewerPlayer] = useState<{ pairing_id: number; member_name: string; playing_handicap: number } | null>(null);
  const [scoreViewerHoles, setScoreViewerHoles] = useState<Record<number, number | null>>({});
  const [scoreViewerLoading, setScoreViewerLoading] = useState(false);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);


  // PIN change (home tab)
  const [showPinChange, setShowPinChange]     = useState(false);
  const [pinNew, setPinNew]                   = useState("");
  const [pinConfirm, setPinConfirm]           = useState("");
  const [pinSaving, setPinSaving]             = useState(false);
  const [pinError, setPinError]               = useState<string | null>(null);
  const [pinSuccess, setPinSuccess]           = useState(false);
  // Admin PIN reset (manage tab)
  const [pinResetMemberId, setPinResetMemberId]   = useState<string>("");
  const [pinResetLoading, setPinResetLoading]     = useState(false);
  const [pinResetMsg, setPinResetMsg]             = useState<string | null>(null);
  const [showResultsInput, setShowResultsInput] = useState<number | null>(null);
  // Captain "Verify & Finalise" flow dialogs (PART 1)
  const [finalizeFlow, setFinalizeFlow] = useState<{
    step: "incomplete" | "confirm" | "success";
    pairing: FourBallPairing | null;
    incomplete: { name: string; missing: number }[];
    gameId?: number;
  } | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  // Login game notification popup (PART 2)
  const [gameNotification, setGameNotification] = useState<{
    kind: "active" | "recent";
    gameId: number;
    message: string;
  } | null>(null);
  const [resultCategory, setResultCategory] = useState("gross_score");

  // ── PART 2: show a one-per-session popup about the member's active/recent game ──
  useEffect(() => {
    const myId = memberData?.member_id;
    if (!myId || adhocGames.length === 0) return;
    const flagKey = `game_notification_shown_${myId}`;
    try {
      if (sessionStorage.getItem(flagKey)) return;
    } catch { return; }

    const isMine = (g: AdhocGame) =>
      g.players?.some(p => p.member_id === myId) ||
      allGamePairings.some(pr => pr.adhoc_game_id === g.adhoc_game_id && pr.members.some(m => m.member_id === myId));

    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const in48 = new Date(startOfToday.getTime() + 2 * 24 * 60 * 60 * 1000);
    const sevenAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activeStatuses = ["scheduled", "open", "full", "in_progress"];

    // Active game takes priority over a recent completed one.
    const active = adhocGames
      .filter(g => isMine(g) && activeStatuses.includes(g.status) && g.game_date)
      .map(g => ({ g, d: new Date(g.game_date) }))
      .filter(({ d }) => d >= startOfToday && d <= in48)
      .sort((a, b) => a.d.getTime() - b.d.getTime())[0]?.g;

    if (active) {
      setGameNotification({ kind: "active", gameId: active.adhoc_game_id, message: "You are part of a game today/soon. Click here to start scoring." });
      try { sessionStorage.setItem(flagKey, "1"); } catch {}
      return;
    }

    const recent = adhocGames
      .filter(g => isMine(g) && g.status === "completed" && g.game_date)
      .map(g => ({ g, d: new Date(g.game_date) }))
      .filter(({ d }) => d >= sevenAgo && d <= startOfToday)
      .sort((a, b) => b.d.getTime() - a.d.getTime())[0]?.g;

    if (recent) {
      const dateLabel = new Date(recent.game_date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      setGameNotification({ kind: "recent", gameId: recent.adhoc_game_id, message: `Your last game was on ${dateLabel} at ${recent.course_name || "the course"}. Click here to view your results.` });
      try { sessionStorage.setItem(flagKey, "1"); } catch {}
    }
  }, [memberData?.member_id, adhocGames, allGamePairings]);
  const [resultsData, setResultsData] = useState<Record<number, { 
    gross_score: string; 
    points: string; 
    playing_handicap: string;
    birdies_count: string;
    eagles_count: string;
    hio_count: string;
    ladies_count: string;
    is_late: boolean;
    is_no_show: boolean;
  }>>({});
  const [savingResults, setSavingResults] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [finalizingGame, setFinalizingGame] = useState<number | null>(null);
  const [undoingResults, setUndoingResults] = useState<number | null>(null); // adhoc_game_id being undone
  // Fourball captain: manage members (remove/add)
  const [managingFourball, setManagingFourball] = useState<{ gameId: number; fourball: number } | null>(null);
  const [removingPairingId, setRemovingPairingId] = useState<number | null>(null);
  const [fourballAddIds, setFourballAddIds] = useState<number[]>([]);
  const [fourballAddSearch, setFourballAddSearch] = useState<string>("");
  const [addingToFourball, setAddingToFourball] = useState(false);
  const [showScorecard, setShowScorecard] = useState(true);
  const [scorecardGameId, setScorecardGameId] = useState<number | null>(null);
  const [courseHoles, setCourseHoles] = useState<{ hole_number: number; par: number; stroke_index: number }[]>([]);
  const [holeScoreData, setHoleScoreData] = useState<Record<number, Record<number, number | null>>>({});
  const [ladyHoleData, setLadyHoleData] = useState<Record<number, Record<number, boolean>>>({});
  const [savingHoleScore, setSavingHoleScore] = useState(false);
  const [editingHcpPairingId, setEditingHcpPairingId] = useState<number | null>(null);
  const [editingHcpValue, setEditingHcpValue] = useState<string>("");
  const [savingHcp, setSavingHcp] = useState(false);
  const [submittingScores, setSubmittingScores] = useState(false);
  const [advancingToNextRound, setAdvancingToNextRound] = useState(false);
  const [carryingOverPairings, setCarryingOverPairings] = useState<number | null>(null);
  const [scoresSubmittedMap, setScoresSubmittedMap] = useState<Record<number, string>>({}); // pairing_id -> timestamp
  const [submitIncompleteWarning, setSubmitIncompleteWarning] = useState(false);
  const [scorecardNine, setScorecardNine] = useState<"front" | "back">("front");
  const [activeHole, setActiveHole] = useState(1);
  const [courseHolesFound, setCourseHolesFound] = useState(true);
  const [editingCourseHoles, setEditingCourseHoles] = useState(false);
  const [editCourseId, setEditCourseId] = useState<number | null>(null);
  const [editHoleData, setEditHoleData] = useState<{ hole_number: number; par: number; stroke_index: number; ladies_stroke_index?: number | null }[]>([]);
  const [showEditParWarning, setShowEditParWarning] = useState(false);
  const [pendingEditCourse, setPendingEditCourse] = useState<number | null>(null);
  const [showAnnualGuest, setShowAnnualGuest] = useState<number | null>(null);
  const [annualGuestName, setAnnualGuestName] = useState("");
  const [annualGuestHandicap, setAnnualGuestHandicap] = useState("");
  // Golf Clubs & Members directory
  const [clubData, setClubData] = useState<{ club_id: number; club_name: string; logo_url: string | null; number_of_members: number; primary_contact_name: string | null; primary_contact_surname: string | null; primary_contact_number: string | null; primary_contact_email: string | null; secondary_contact_name: string | null; secondary_contact_surname: string | null; secondary_contact_number: string | null; secondary_contact_email: string | null }[]>([]);
  const [allClubNames, setAllClubNames] = useState<Record<number, string>>({}); // For public games banner
  const [myClub, setMyClub] = useState<{ club_id: number; club_name: string; logo_url: string | null } | null>(null);
  const [memberDirectory, setMemberDirectory] = useState<{ member_id: number; member_name: string; contact_number: string | null; club_id: number | null }[]>([]);
  // Generate pairings (organizer)
  const [generatingPairings, setGeneratingPairings] = useState<number | null>(null);
  // Add player to adhoc game (organizer) — multi-select
  const [showAddPlayer, setShowAddPlayer] = useState<number | null>(null);
  const [addPlayerMemberIds, setAddPlayerMemberIds] = useState<number[]>([]);
  const [addPlayerSearch, setAddPlayerSearch] = useState<string>("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  // Member editing (Elias)
  const [editingMember, setEditingMember] = useState<number | null>(null);
  const [editMemberName, setEditMemberName] = useState("");
  const [editMemberContact, setEditMemberContact] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  // Annual game admin (Create/Edit/Cancel)
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [editingGame, setEditingGame] = useState<number | null>(null);
  const [agForm, setAgForm] = useState({ game_date: "", activity: "", format: "Stableford", course_name: "", event_type: "normal" });
  const [agSaving, setAgSaving] = useState(false);
  // Finance admin state
  const [showFinanceAdmin, setShowFinanceAdmin] = useState(false);
  const [finMemberId, setFinMemberId] = useState<string>("");
  const [finType, setFinType] = useState<"debit" | "credit">("debit");
  const [finAmount, setFinAmount] = useState("");
  const [finCategory, setFinCategory] = useState("");
  const [finDescription, setFinDescription] = useState("");
  const [finDate, setFinDate] = useState(new Date().toISOString().split("T")[0]);
  const [finSaving, setFinSaving] = useState(false);
  const [finSuccess, setFinSuccess] = useState("");
  const [finRecentEntries, setFinRecentEntries] = useState<{ member_name: string; description: string; debit: number; credit: number; balance: number; transaction_date: string }[]>([]);
  const [accountCategories, setAccountCategories] = useState(DEFAULT_ACCOUNT_CATEGORIES);
  const [showAddGuest, setShowAddGuest] = useState<number | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestHandicap, setGuestHandicap] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [savingGuest, setSavingGuest] = useState(false);
  const [existingGuests, setExistingGuests] = useState<{ guest_id: number; guest_name: string; handicap_index: number | null; phone: string | null }[]>([]);
  // Cross-club member search when adding guests - finds existing members from other clubs
  const [guestSearchResults, setGuestSearchResults] = useState<{ member_id: number; member_name: string; club_name: string; handicap_index: number | null }[]>([]);
  const [searchingGuestName, setSearchingGuestName] = useState(false);
  // Cross-club member search (for public social games)
  const [showCrossClubSearch, setShowCrossClubSearch] = useState<number | null>(null);
  const [crossClubSearchText, setCrossClubSearchText] = useState("");
  const [crossClubSearchResults, setCrossClubSearchResults] = useState<{ member_id: number; member_name: string; club_name: string; handicap_index: number | null }[]>([]);
  const [searchingCrossClub, setSearchingCrossClub] = useState(false);
  const [addingCrossClubMember, setAddingCrossClubMember] = useState<number | null>(null);
  // Club 13 WWB Competition state
  const [newAdhocWwbEnabled, setNewAdhocWwbEnabled] = useState(false);
  // Birdie pool fee is fixed per club via WWB_FEES — no user input needed
  const [wwbOptIns, setWwbOptIns] = useState<Record<number, { ww: boolean; birdie: boolean }>>({});
  // gameWwbOptIns: keyed by adhoc_game_id → member_id → { ww, birdie } — loaded from adhoc_game_wwb_optins table
  const [gameWwbOptIns, setGameWwbOptIns] = useState<Record<number, Record<number, { ww: boolean; birdie: boolean }>>>({});
  const [savingWwbOptIn, setSavingWwbOptIn] = useState<number | null>(null);
  // Pending WWB selections captured at join/add time — keyed by memberId (negative for guests)
  const [pendingWwbJoin, setPendingWwbJoin] = useState<{ ww: boolean; birdie: boolean }>({ ww: true, birdie: true });
  const [showWwbJoinPrompt, setShowWwbJoinPrompt] = useState<number | null>(null); // adhocGameId
  const [pendingWwbAdd, setPendingWwbAdd] = useState<Record<number, { ww: boolean; birdie: boolean }>>({}); // memberId -> opts
  const [pendingWwbGuest, setPendingWwbGuest] = useState<{ ww: boolean; birdie: boolean }>({ ww: true, birdie: true });
  const [wwbOptInMismatches, setWwbOptInMismatches] = useState<string[]>([]); // Member IDs with opt-ins but not in pairings
  // View all toggles for WWB leaderboard sections
  const [showFullWwEntrants, setShowFullWwEntrants] = useState(false);
  const [showFullBirdieEntrants, setShowFullBirdieEntrants] = useState(false);
  const [wwbResults, setWwbResults] = useState<{
    adhoc_game_id: number;
    ww_front9_winner_id: number | null; ww_front9_winner_name: string; ww_front9_points: number | null;
    ww_back9_winner_id: number | null;  ww_back9_winner_name: string;  ww_back9_points: number | null;
    ww_overall_winner_id: number | null; ww_overall_winner_name: string; ww_overall_points: number | null;
    birdie_pool_total: number; birdie_pool_per_birdie: number; birdie_pool_entrants: number; birdie_pool_total_birdies: number;
    birdie_entrant_details: { member_name: string; birdies: number; payout: number }[];
  } | null>(null);

  const [wwbHistory, setWwbHistory] = useState<WwbHistoryGame[]>([]);
  const [expandedHistoryGames, setExpandedHistoryGames] = useState<Set<number>>(new Set());

  // PWA install prompt listener + iOS detection
  useEffect(() => {
    // Android/Chrome automatic prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: show manual instruction modal once per device
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;
    const dismissed = localStorage.getItem("pwa_ios_modal_dismissed");
    if (isIos && !isStandalone && !dismissed) {
      // Small delay so the dashboard finishes loading before the modal pops
      const t = setTimeout(() => setShowIosInstallModal(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Load ladies stroke indices for a course
  async function loadLadiesStrokeIndices(courseId: number) {
    const supabase = createClient();
    const { data } = await supabase
      .from("course_holes")
      .select("hole_number, ladies_stroke_index")
      .eq("course_id", courseId)
      .not("ladies_stroke_index", "is", null);
    
    if (data) {
      const map: Record<number, Record<number, number>> = {};
      map[courseId] = {};
      data.forEach(row => {
        if (row.ladies_stroke_index) {
          map[courseId][row.hole_number] = row.ladies_stroke_index;
        }
      });
      setLadiesStrokeMap(prev => ({ ...prev, ...map }));
  }
  }
  
  // Fetch CoC data for Club 13 - uses RPC to bypass RLS
  useEffect(() => {
    async function fetchCoCData() {
      if (!myClub) return;
      
      const clubId = Number(myClub.club_id);
      if (clubId !== 13) {
        setCocLoading(false);
        return;
      }
      
      setCocLoading(true);
      const supabase = createClient();
      
  // Use RPC function to get CoC standings (bypasses RLS)
  const { data, error } = await supabase.rpc('get_coc_standings');
  
  if (error) {
    setCocLoading(false);
    return;
  }
      
  if (!data || data.length === 0) {
    setCocLoading(false);
    return;
  }
  
  // RPC doesn't return member_name, so fetch names separately
  const memberIds = data.map((item: any) => item.member_id);
  const { data: members } = await supabase
    .from("members")
    .select("member_id, member_name")
    .in("member_id", memberIds);
  
  // Fetch tournament wins with course details using RPC (bypasses RLS)
  const { data: winsData, error: winsError } = await supabase.rpc('get_coc_wins', { 
    member_ids: memberIds 
  });
  
  // Create lookup maps
  const memberNameMap = new Map<number, string>();
  members?.forEach(m => memberNameMap.set(m.member_id, m.member_name));
  
  // Group wins by member (RPC returns flat data with game_date, course_name directly)
  // Only include wins that have valid game_date and course_name
  const winsByMember = new Map<number, Array<{ game_date: string; course_name: string; points_earned: number; game_type: string }>>();
  winsData?.forEach((win: any) => {
    // Skip wins without game_date or course_name (records with null adhoc_game_id)
    if (!win.game_date || !win.course_name) return;
    
    const memberId = win.member_id;
    if (!winsByMember.has(memberId)) {
      winsByMember.set(memberId, []);
    }
    winsByMember.get(memberId)!.push({
      game_date: win.game_date,
      course_name: win.course_name,
      points_earned: win.points_earned || 0,
      game_type: win.game_type || "IPS"
    });
  });
  
  const formatted = data.map((item: any) => ({
    member_id: item.member_id,
    member_name: memberNameMap.get(item.member_id) || "Unknown",
    total_points: item.total_points,
    total_wins: item.total_wins,
    wins: winsByMember.get(item.member_id) || []
  }));
  
  setCocAllChampions(formatted);
  setCocTopPoints(formatted[0]?.total_points || 0);
  setCocTopPlayer(formatted[0]?.member_name?.split(" ")[0] || "");
  setCocLoading(false);
    }
    
    fetchCoCData();
  }, [myClub]);
  
  useEffect(() => {
    let isMounted = true;
    
    async function loadDashboard() {
      // AUTHENTICATION & AUTHORIZATION CHECK
      // The logged-in member_session in localStorage is the source of truth.
      // A member_id in the URL may only be used if it matches the session, so
      // users cannot view other members' data via ?member_id=123.
      let sessionMemberId: string | undefined;
      const stored = localStorage.getItem("member_session");
      if (stored) {
        try {
          sessionMemberId = JSON.parse(stored).member_id?.toString();
        } catch {
          // Invalid JSON in storage
        }
      }

      // No valid session = not logged in
      if (!sessionMemberId) {
        if (isMounted) router.push("/login");
        return;
      }

      // localStorage session is the source of truth — always load the logged-in
      // member's own data. We intentionally ignore any ?member_id= URL param so a
      // stale or shared link cannot trigger a redirect loop. (Data is never loaded
      // from the URL param; memberId is always the session's member id.)
      const memberId = sessionMemberId;

      // Restore live game state from localStorage immediately for instant UI
      if (typeof window !== "undefined") {
        const cachedGameInfo = localStorage.getItem(`liveGameInfo_${memberId}`);
        const cachedScores = localStorage.getItem(`liveScores_${memberId}`);
        const cachedPairings = localStorage.getItem(`pairings_${memberId}`);
        const cachedHoleScores = localStorage.getItem(`holeScores_${memberId}`);
        if (cachedGameInfo && isMounted) {
          try { setLiveScoreGameInfo(JSON.parse(cachedGameInfo)); } catch { /* ignore */ }
        }
        if (cachedScores && isMounted) {
          try { setLiveScores(JSON.parse(cachedScores)); } catch { /* ignore */ }
        }
if (cachedPairings && isMounted) {
  try {
  // Keep all cached pairings — the DB fetch below will refresh and correct any stale entries
  const parsed = JSON.parse(cachedPairings);
  // Ensure parsed value is an array before setting state
  if (Array.isArray(parsed)) {
  setAllGamePairings(parsed);
  }
  } catch { /* ignore */ }
  }
        if (cachedHoleScores && isMounted) {
          try { setHoleScoreData(JSON.parse(cachedHoleScores)); } catch { /* ignore */ }
        }
      }

      const supabase = createClient();

      try {
        // First: get this member's club_id so we can scope all data to their club
        const { data: myMemberRow } = await supabase.from("members").select("club_id").eq("member_id", memberId).single();
const myClubId = myMemberRow?.club_id || null;
        
        // Check if current user is a Nomad (club_id = 999) - they have no home club
        const isNomad = myClubId === 999;
  
        // Get ALL game IDs where the user is confirmed (regardless of club) for Live Scoring access
        const { data: userBookings } = await supabase
          .from("adhoc_game_bookings")
          .select("adhoc_game_id")
          .eq("member_id", memberId)
          .eq("booking_status", "confirmed");
        const userGameIds = new Set((userBookings || []).map(b => b.adhoc_game_id));
const userGameIdsArray = [...userGameIds];

        // Run all queries in parallel, filtered by club_id where applicable
  const [memberRes, gamesRes, accountRes, birdiesRes, eaglesRes, ladiesRes, coursesRes, scheduleRes, bookingsRes, cancellationsRes, adhocRes, adhocBookingsRes, perfRecordsRes, pastAdhocRes, dayStatsRes, unofficialRoundsRes] = await Promise.all([
          supabase.from("members").select("member_id, member_name, profile_picture_url, member_handicap_indices(official_handicap_index, remmoho_handicap_index, previous_handicap_index, season)").eq("member_id", memberId).single(),
          myClubId
    ? supabase.from("performance_records").select("record_id, game_date, points, gross_score, current_quarter_position, current_quarter_points, current_year_position, current_year_points, medal_league_position, medal_league_points, medal_game, is_unofficial, courses(course_name)").eq("member_id", memberId).eq("club_id", myClubId).order("game_date", { ascending: false })
    : supabase.from("performance_records").select("record_id, game_date, points, gross_score, current_quarter_position, current_quarter_points, current_year_position, current_year_points, medal_league_position, medal_league_points, medal_game, is_unofficial, courses(course_name)").eq("member_id", memberId).order("game_date", { ascending: false }),
          myClubId
            ? supabase.from("accounts").select("transaction_date, description, debit, credit, balance").eq("member_id", memberId).eq("club_id", myClubId).order("account_id", { ascending: false }).limit(10)
            : supabase.from("accounts").select("transaction_date, description, debit, credit, balance").eq("member_id", memberId).order("account_id", { ascending: false }).limit(10),
          myClubId 
            ? supabase.from("birdies").select("birdie_count, game_date, courses(course_name)").eq("member_id", memberId).eq("club_id", myClubId).order("game_date", { ascending: false })
            : supabase.from("birdies").select("birdie_count, game_date, courses(course_name)").eq("member_id", memberId).order("game_date", { ascending: false }),
          myClubId
            ? supabase.from("eagles").select("eagle_count, game_date, courses(course_name)").eq("member_id", memberId).eq("club_id", myClubId).order("game_date", { ascending: false })
            : supabase.from("eagles").select("eagle_count, game_date, courses(course_name)").eq("member_id", memberId).order("game_date", { ascending: false }),
          myClubId
            ? supabase.from("ladies").select("ladies_count, game_date, courses(course_name)").eq("member_id", memberId).eq("club_id", myClubId).order("game_date", { ascending: false })
            : supabase.from("ladies").select("ladies_count, game_date, courses(course_name)").eq("member_id", memberId).order("game_date", { ascending: false }),
          supabase.from("courses").select("course_id, course_name, course_rating, slope_rating").order("course_name"),
          myClubId ? supabase.from("annual_schedule").select("schedule_id, game_date, day_of_week, activity, format, course_name, event_type").eq("club_id", myClubId).gte("game_date", new Date().toISOString().split("T")[0]).order("game_date", { ascending: true }).limit(3) : supabase.from("annual_schedule").select("schedule_id, game_date, day_of_week, activity, format, course_name, event_type").gte("game_date", new Date().toISOString().split("T")[0]).order("game_date", { ascending: true }).limit(3),
          supabase.from("game_bookings").select("booking_id, schedule_id, member_id, booking_status, guest_name, guest_handicap, members(member_name)").eq("booking_status", "confirmed"),
          supabase.from("annual_game_cancellations").select("schedule_id, member_id, guest_name, cancelled_at, members(member_name)").order("cancelled_at", { ascending: false }),
          (() => {
            // Fetch from 7 days ago onwards so recently completed games (e.g. WWB) always appear.
            const localToday = (() => { const d = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })();
            const NOMADS_CLUB_ID = 999;
            const isNomadUser = myClubId === NOMADS_CLUB_ID;
            
            if (isNomadUser) {
              // Nomads only see games where they have a confirmed booking
              // Use userGameIdsArray which contains all game IDs where user has a confirmed booking
              if (userGameIdsArray.length === 0) {
                return Promise.resolve({ data: [] });
              }
              return supabase.from("adhoc_games").select("adhoc_game_id, organizer_id, club_id, course_id, game_date, tee_off_time, max_players, notes, status, cost_per_player, game_type, deleted_at, wwb_enabled, birdie_pool_fee, tee_start, is_multi_round, total_rounds, round_number, round_schedule, game_visibility, is_official, members!adhoc_games_organizer_id_fkey(member_name), courses(course_name)").in("adhoc_game_id", userGameIdsArray).in("status", ["open", "full", "in_progress", "completed"]).order("game_date", { ascending: true });
            }
            
            // Regular club members see their club's games PLUS public games from any club
            const base = supabase.from("adhoc_games").select("adhoc_game_id, organizer_id, club_id, course_id, game_date, tee_off_time, max_players, notes, status, cost_per_player, game_type, deleted_at, wwb_enabled, birdie_pool_fee, tee_start, is_multi_round, total_rounds, round_number, round_schedule, game_visibility, is_official, members!adhoc_games_organizer_id_fkey(member_name), courses(course_name)").gte("game_date", localToday).in("status", ["open", "full", "in_progress", "completed", "deleted"]).order("game_date", { ascending: true });
            return myClubId ? base.or(`club_id.eq.${myClubId},game_visibility.eq.public`) : base;
          })(),
          // Bookings and pairings are filtered client-side via adhocGameMap (which only contains this club's games)
          // This ensures users only see data for their own club's games
          supabase.from("adhoc_game_bookings").select("adhoc_game_id, member_id, guest_id, booking_status, cancelled_at, members(member_name), guests(guest_name, handicap_index)"),
          myClubId ? supabase.from("performance_records").select("game_date, course_id, member_id, points, gross_score, medal_game, medal_gross, medal_net, medal_points, members(member_name), courses(course_name)").eq("club_id", myClubId).order("game_date", { ascending: false }).limit(2000) : supabase.from("performance_records").select("game_date, course_id, member_id, points, gross_score, medal_game, medal_gross, medal_net, medal_points, members(member_name), courses(course_name)").order("game_date", { ascending: false }).limit(2000),
          // Fetch past completed adhoc_games to get tee_off_time for correct ordering
          myClubId ? supabase.from("adhoc_games").select("adhoc_game_id, game_date, course_id, tee_off_time").eq("club_id", myClubId).eq("status", "completed").order("game_date", { ascending: false }).limit(500) : supabase.from("adhoc_games").select("adhoc_game_id, game_date, course_id, tee_off_time").eq("status", "completed").order("game_date", { ascending: false }).limit(500),
          myClubId ? supabase.from("day_results").select("game_date, course_id, member_id, guest_id, guest_name, points, gross_score, playing_handicap, birdies_count, eagles_count, ladies_count, is_late, is_sub, total_club, medal_gross, medal_net").eq("club_id", myClubId).order("game_date", { ascending: false }).limit(2000) : supabase.from("day_results").select("game_date, course_id, member_id, guest_id, guest_name, points, gross_score, playing_handicap, birdies_count, eagles_count, ladies_count, is_late, is_sub, total_club, medal_gross, medal_net").order("game_date", { ascending: false }).limit(2000),
          // Fetch unofficial rounds (guest games at other clubs)
          supabase.from("unofficial_rounds").select("round_id, game_date, course_id, gross_score, points, playing_handicap, courses(course_name)").eq("member_id", memberId).order("game_date", { ascending: false }).limit(100)
        ]);

        if (!isMounted) return;
        
// Fetch pairings separately with two queries to support cross-club games
        // Query 1: Home club pairings (skip for Nomads - they don't have a real home club)
        const homeClubPairingsPromise = (myClubId && !isNomad)
          ? supabase.from("pairings").select(`
              pairing_id, adhoc_game_id, fourball_number, member_id, guest_id, is_captain, 
              gross_score, points, front9_points, back9_points, result_submitted, playing_handicap, 
              birdies_count, eagles_count, hio_count, ladies_count, is_late, is_no_show, is_sub,
              scores_submitted_at, wwb_ww, wwb_birdie, is_fourball_captain, tee_off_time, starting_hole, 
              members(member_name, club_id, golf_clubs(club_name)), 
              guests(guest_id, guest_name, handicap_index, gender, club_id, golf_clubs(club_name)),
              adhoc_games!inner(club_id, status, game_date, course_id, tee_off_time, game_visibility, is_official, game_type, courses(course_name))
            `).eq("adhoc_games.club_id", myClubId).in("adhoc_games.status", ["open", "full", "in_progress", "completed"])
          : Promise.resolve({ data: [] });
        
        // Query 2: Cross-club pairings from user's bookings
        const userGamePairingsPromise = userGameIdsArray.length > 0
          ? supabase.from("pairings").select(`
              pairing_id, adhoc_game_id, fourball_number, member_id, guest_id, is_captain, 
              gross_score, points, front9_points, back9_points, result_submitted, playing_handicap, 
              birdies_count, eagles_count, hio_count, ladies_count, is_late, is_no_show, is_sub,
              scores_submitted_at, wwb_ww, wwb_birdie, is_fourball_captain, tee_off_time, starting_hole, 
              members(member_name, club_id, golf_clubs(club_name)), 
              guests(guest_id, guest_name, handicap_index, gender, club_id, golf_clubs(club_name)),
              adhoc_games!inner(club_id, status, game_date, course_id, tee_off_time, game_visibility, is_official, game_type, courses(course_name))
            `).in("adhoc_game_id", userGameIdsArray).in("adhoc_games.status", ["open", "full", "in_progress", "completed"])
          : Promise.resolve({ data: [] });
        
        const [homeClubPairingsResult, userGamePairingsResult] = await Promise.all([
          homeClubPairingsPromise,
          userGamePairingsPromise
        ]);
        
        // Merge and deduplicate pairings by pairing_id
        const allPairingsData = [
          ...(homeClubPairingsResult.data || []),
          ...(userGamePairingsResult.data || [])
        ];
        const uniquePairings = Array.from(
          new Map(allPairingsData.map(p => [p.pairing_id, p])).values()
        );
        const pairingsRes = { data: uniquePairings };

if (memberRes.data) setMemberData(memberRes.data as MemberData);
  
  // ============================================================================
  // Records tab + Live "Recent Results" are sourced from PAIRINGS.
  // The pairings table consolidates the hole-by-hole scores (hole_scores) into
  // per-player totals (points, gross_score, birdies/eagles/ladies counts), so we
  // read those consolidated values directly. Guests are included.
  // ============================================================================
  type PairingRow = {
    pairing_id: number;
    adhoc_game_id: number;
    member_id: number | null;
    guest_id: number | null;
    guest_name: string | null;
    gross_score: number | null;
    points: number | null;
    playing_handicap: number | null;
    birdies_count: number | null;
    eagles_count: number | null;
    ladies_count: number | null;
    is_late: boolean | null;
    is_no_show: boolean | null;
    is_sub: boolean | null;
    result_submitted: boolean | null;
    scores_submitted_at: string | null;
    tee_off_time: string | null;
    members: { member_name: string; }[] | null;
    guests: { guest_name: string } | null;
    adhoc_games: {
      game_date: string;
      course_id: number;
      tee_off_time: string | null;
      is_official: boolean | null;
      game_type: string | null;
      courses: { course_name: string } | null;
    } | null;
  };
  const pairingRows = (uniquePairings as unknown as PairingRow[]).filter(p => p.adhoc_games);
  const todayStr = new Date().toISOString().split("T")[0];
  // A pairing counts as a scored result once it has a recorded gross or points total.
  const hasScore = (p: PairingRow) => (Number(p.gross_score) || 0) > 0 || (Number(p.points) || 0) > 0;
  const isMedalGame = (p: PairingRow) => (p.adhoc_games?.game_type || "").toLowerCase() === "medal";
  const displayName = (p: PairingRow) =>
    (!p.member_id && p.guest_id)
      ? `${p.guests?.guest_name || p.guest_name || "Guest"} (G)`
      : (p.members?.[0]?.member_name || "Unknown");

  // --- Records tab: the logged-in member's own games (one row per game) ---
  const myGameRecords: GameRecord[] = pairingRows
    .filter(p => p.member_id === Number(memberId) && hasScore(p) && (p.adhoc_games!.game_date <= todayStr))
    .map(p => ({
      record_id: p.pairing_id,
      game_date: p.adhoc_games!.game_date,
      points: Number(p.points) || 0,
      gross_score: Number(p.gross_score) || 0,
      medal_game: isMedalGame(p),
      current_quarter_position: null,
      current_quarter_points: null,
      current_year_position: null,
      current_year_points: null,
      medal_league_position: null,
      medal_league_points: null,
      courses: { course_name: p.adhoc_games!.courses?.course_name || "Unknown" },
      is_official: p.adhoc_games!.is_official ?? true,
    }))
    .sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime());
  setRecentGames(myGameRecords);

  // --- Live tab: full-field "Recent Results" grouped by game (incl. guests) ---
  const gameGroups: Record<number, RecentGameResult & { tee_off_time: string }> = {};
  pairingRows.forEach(p => {
    const g = p.adhoc_games!;
    if (g.game_date > todayStr) return; // past/today completed games only
    if (!hasScore(p)) return;
    const gid = p.adhoc_game_id;
    if (!gameGroups[gid]) {
      gameGroups[gid] = {
        game_date: g.game_date,
        course_name: g.courses?.course_name || "Unknown",
        is_medal: isMedalGame(p),
        revenue: 0,
        leaderboard: [],
        tee_off_time: g.tee_off_time || p.tee_off_time || "00:00:00",
      };
    }
    const gross = Number(p.gross_score) || 0;
    const hcp = Number(p.playing_handicap) || 0;
    gameGroups[gid].leaderboard.push({
      member_name: displayName(p),
      points: Number(p.points) || 0,
      gross_score: gross,
      playing_handicap: hcp,
      birdies_count: Number(p.birdies_count) || 0,
      eagles_count: Number(p.eagles_count) || 0,
      ladies_count: Number(p.ladies_count) || 0,
      medal_net: isMedalGame(p) ? gross - hcp : undefined,
      is_late: p.is_late || false,
      is_no_show: p.is_no_show || false,
      is_sub: p.is_sub || false,
    });
  });
  const pairingRecentResults = Object.values(gameGroups)
    .map(g => ({
      game_date: g.game_date,
      course_name: g.course_name,
      is_medal: g.is_medal,
      revenue: g.revenue,
      tee_off_time: g.tee_off_time,
      leaderboard: g.is_medal
        ? g.leaderboard.sort((a, b) => {
            const aN = a.medal_net ?? (a.gross_score - (a.playing_handicap || 0));
            const bN = b.medal_net ?? (b.gross_score - (b.playing_handicap || 0));
            if (aN !== bN) return aN - bN;
            return (a.gross_score || 0) - (b.gross_score || 0);
          })
        : g.leaderboard.sort((a, b) => b.points - a.points),
    }))
    .sort((a, b) => {
      const dateDiff = new Date(b.game_date).getTime() - new Date(a.game_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (a.tee_off_time || "00:00:00").localeCompare(b.tee_off_time || "00:00:00");
    })
    .slice(0, 3)
    .map(({ tee_off_time, ...rest }) => rest as RecentGameResult);
  setRecentResults(pairingRecentResults);
  
  if (accountRes.data && accountRes.data.length > 0) {
    setBalance(accountRes.data[0].balance || 0);
    setRecentTransactions(accountRes.data as {transaction_date: string; description: string; debit: number; credit: number; balance: number}[]);
  }
        if (birdiesRes.data) setBirdiesData(birdiesRes.data as unknown as BirdieRecord[]);
        if (eaglesRes.data) setEaglesData(eaglesRes.data as unknown as EagleRecord[]);
        if (ladiesRes.data) setLadiesData(ladiesRes.data as unknown as LadyRecord[]);
        if (coursesRes.data) setCourses(coursesRes.data as Course[]);

        // Process performance_records for recent results leaderboard (includes medal data)
        // Also merge day_results stats (birdies, eagles, ladies, handicap)
        if (perfRecordsRes.data && perfRecordsRes.data.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          
          // Build a lookup map from day_stats for quick access (members only - guests are processed separately)
          const statsMap: Record<string, { playing_handicap: number; birdies_count: number; eagles_count: number; ladies_count: number; is_late: boolean; is_sub: boolean; total_club: number }> = {};
          if (dayStatsRes.data) {
            dayStatsRes.data.forEach((s: { game_date: string; course_id: number; member_id: number | null; guest_id: number | null; guest_name: string | null; points: number | null; gross_score: number | null; playing_handicap: number; birdies_count: number; eagles_count: number; ladies_count: number; is_late: boolean; is_sub: boolean; total_club: number; medal_gross: number | null; medal_net: number | null }) => {
              // Only process members for statsMap (guests are processed separately)
              if (!s.member_id) return;
              const key = `${s.game_date}-${s.course_id}-${s.member_id}`;
              statsMap[key] = {
                playing_handicap: s.playing_handicap || 0,
                birdies_count: s.birdies_count || 0,
                eagles_count: s.eagles_count || 0,
                ladies_count: s.ladies_count || 0,
                is_late: s.is_late || false,
                is_sub: s.is_sub || false,
                total_club: parseFloat(String(s.total_club)) || 0
              };
            });
          }
          
          // Build a tee_off_time lookup from past completed adhoc_games (game_date + course_id → tee_off_time)
          const teeTimeMap: Record<string, string> = {};
          (pastAdhocRes?.data || []).forEach((ag: { adhoc_game_id: number; game_date: string; course_id: number; tee_off_time: string }) => {
            teeTimeMap[`${ag.game_date}-${ag.course_id}`] = ag.tee_off_time || "00:00:00";
          });

          // Group by game_date and course, filter for past games only
          const gameMap: Record<string, RecentGameResult & { memberParticipated: boolean; tee_off_time: string }> = {};
          perfRecordsRes.data.forEach((r: any) => {            if (r.game_date > today) return; // Skip future games (allow today's completed games)
            const key = `${r.game_date}-${r.course_id}`;
            if (!gameMap[key]) {
              gameMap[key] = {
                game_date: r.game_date,
                course_name: r.courses?.course_name || "Unknown",
                is_medal: r.medal_game || false,
                revenue: 0,
                leaderboard: [],
                memberParticipated: false,
                tee_off_time: teeTimeMap[key] || "00:00:00"
              };
            }
            // Update is_medal if any record shows it's a medal game
            if (r.medal_game) gameMap[key].is_medal = true;
            // Check if current member participated
            if (r.member_id === Number(memberId)) {
              gameMap[key].memberParticipated = true;
            }
            // Get stats from day_stats for quick access
            const statsKey = `${r.game_date}-${r.course_id}-${r.member_id}`;
            const stats = statsMap[statsKey] || { playing_handicap: 0, birdies_count: 0, eagles_count: 0, ladies_count: 0, is_late: false, is_sub: false, total_club: 0 };
            // Accumulate revenue
            gameMap[key].revenue += stats.total_club;

            gameMap[key].leaderboard.push({
              member_name: r.members?.member_name || "Unknown",
              points: Number(r.points) || 0,
              gross_score: Number(r.gross_score) || 0,
              playing_handicap: Number(stats.playing_handicap) || 0,
              birdies_count: Number(stats.birdies_count) || 0,
              eagles_count: Number(stats.eagles_count) || 0,
              ladies_count: Number(stats.ladies_count) || 0,
              medal_points: r.medal_points != null ? Number(r.medal_points) : undefined,
              medal_net: r.medal_net != null ? Number(r.medal_net) : undefined,
              is_late: stats.is_late,
              is_no_show: false,
              is_sub: stats.is_sub
            });
          });

          // Add guests from day_results to the leaderboard
          if (dayStatsRes.data) {
            dayStatsRes.data.forEach((s: { game_date: string; course_id: number; member_id: number | null; guest_id: number | null; guest_name: string | null; points: number | null; gross_score: number | null; playing_handicap: number; birdies_count: number; eagles_count: number; ladies_count: number; is_late: boolean; is_sub: boolean; total_club: number; medal_gross: number | null; medal_net: number | null }) => {
              // Only process guests (guest_id set, member_id null)
              if (!s.guest_id || s.member_id) return;
              if (s.game_date > today) return;
              
              const key = `${s.game_date}-${s.course_id}`;
              // Only add to existing games (games that have members)
              if (!gameMap[key]) return;
              
              // Accumulate revenue from guest
              gameMap[key].revenue += parseFloat(String(s.total_club)) || 0;
              
              gameMap[key].leaderboard.push({
                member_name: `${s.guest_name || "Guest"} (G)`,
                points: Number(s.points) || 0,
                gross_score: Number(s.gross_score) || 0,
                playing_handicap: Number(s.playing_handicap) || 0,
                birdies_count: Number(s.birdies_count) || 0,
                eagles_count: Number(s.eagles_count) || 0,
                ladies_count: Number(s.ladies_count) || 0,
                medal_points: undefined,
                medal_net: s.medal_net != null ? Number(s.medal_net) : undefined,
                is_late: s.is_late || false,
                is_no_show: false,
                is_sub: s.is_sub || false
              });
            });
          }

          // Sort all group games by date
          const allGames = Object.values(gameMap);
          const mapToResult = (g: typeof allGames[0]) => ({
            game_date: g.game_date,
            course_name: g.course_name,
            is_medal: g.is_medal,
            revenue: g.revenue,
            leaderboard: g.is_medal
              ? g.leaderboard.sort((a, b) => {
                  const aN = a.medal_net ?? (a.gross_score - (a.playing_handicap || 0));
                  const bN = b.medal_net ?? (b.gross_score - (b.playing_handicap || 0));
                  if (aN !== bN) return aN - bN;
                  return (a.gross_score || 0) - (b.gross_score || 0);
                })
              : g.leaderboard.sort((a, b) => b.points - a.points)
          });
          // Sort: date desc, then tee_off_time asc for same-day games
          // NOTE: recentResults (Live tab) is now sourced from PAIRINGS above.
          // This performance_records block is retained only to build
          // memberRecentResults ("My Recent Results").
          // Member results: only games member participated in (most recent 3)
          const memberResults = allGames
            .filter(g => g.memberParticipated)
            .map(mapToResult)
            .map(r => ({ ...r, is_official: true }));

          // Build unofficial game results (guest games at other clubs) for My Recent Results
          const unofficialGameResults = (unofficialRoundsRes.data || []).map((u: any) => ({
            game_date: u.game_date,
            course_name: u.courses?.course_name || "Unknown Course",
            is_medal: false,
            revenue: 0,
            leaderboard: [{
              member_name: memberData?.member_name || "You",
              points: u.points || 0,
              gross_score: u.gross_score || 0,
              playing_handicap: u.playing_handicap || 0,
              birdies_count: 0,
              eagles_count: 0,
              ladies_count: 0,
              is_late: false,
              is_no_show: false,
              is_sub: false
            }],
            is_official: false
          }));

          // Merge official + unofficial, sort by date desc, limit to 10
          const allMemberResults = [...memberResults, ...unofficialGameResults]
            .sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime())
            .slice(0, 10);
          setMemberRecentResults(allMemberResults as RecentGameResult[]);
        }

        // Set upcoming annual games with booking status, player list, guests, and cancellations
        let nextAnnualGame: { course_name: string; game_date: string; type: string } | null = null;
        if (scheduleRes.data && scheduleRes.data.length > 0) {
          // Build per-schedule booking data
          const allBookings = bookingsRes.data || [];
          const allCancellations = cancellationsRes.data || [];
          
          const gamesWithBookingStatus = scheduleRes.data.map(g => {
            const scheduleBookings = allBookings.filter(b => b.schedule_id === g.schedule_id);
            const players = scheduleBookings
              .filter(b => b.member_id && !b.guest_name)
              .map(b => ({
                member_id: b.member_id as number,
                member_name: (b.members as unknown as { member_name: string })?.member_name || "Unknown",
                booking_id: b.booking_id as number,
              }));
            const guests = scheduleBookings
              .filter(b => b.guest_name)
              .map(b => ({
                guest_name: b.guest_name as string,
                guest_handicap: b.guest_handicap as number | null,
                booking_id: b.booking_id as number,
                booked_by: b.member_id as number,
              }));
            const cancelled = allCancellations
              .filter(c => c.schedule_id === g.schedule_id)
              .map(c => ({
                name: c.guest_name || (c.members as unknown as { member_name: string })?.member_name || "Unknown",
                cancelled_at: c.cancelled_at as string,
              }));
            const isBooked = players.some(p => p.member_id === Number(memberId));
            return {
              ...g,
              isBooked,
              booked_count: players.length + guests.length,
              players,
              guests,
              cancelled,
            };
          });
          setUpcomingGames(gamesWithBookingStatus);
          nextAnnualGame = { course_name: scheduleRes.data[0].course_name || "TBD", game_date: scheduleRes.data[0].game_date, type: "Annual" };
        }

        // Process adhoc games
        let nextAdhocGame: { course_name: string; game_date: string; type: string } | null = null;
        if (adhocRes.data && adhocRes.data.length > 0) {
          const bookingCounts: Record<number, number> = {};
          const userBookedAdhoc = new Set<number>();
          const playersByGame: Record<number, { member_id: number; member_name: string }[]> = {};
          const guestsByGame: Record<number, { guest_id: number; guest_name: string; handicap_index: number | null }[]> = {};
          const cancelledByGame: Record<number, { name: string; cancelled_at: string; isGuest?: boolean }[]> = {};
          
          adhocBookingsRes.data?.forEach(b => {
            const gameId = b.adhoc_game_id;
            const memberInfo = b.members as unknown as { member_name: string } | null;
            const guestInfo = b.guests as unknown as { guest_name: string; handicap_index: number | null } | null;
            
            if (b.booking_status === "confirmed") {
              bookingCounts[gameId] = (bookingCounts[gameId] || 0) + 1;
              if (b.member_id === Number(memberId)) userBookedAdhoc.add(gameId);
              if (b.member_id && memberInfo?.member_name) {
                if (!playersByGame[gameId]) playersByGame[gameId] = [];
                playersByGame[gameId].push({ member_id: b.member_id, member_name: memberInfo.member_name });
              }
              if (b.guest_id && guestInfo?.guest_name) {
                if (!guestsByGame[gameId]) guestsByGame[gameId] = [];
                guestsByGame[gameId].push({ guest_id: b.guest_id, guest_name: guestInfo.guest_name, handicap_index: guestInfo.handicap_index });
              }
            } else if (b.booking_status === "cancelled" && b.cancelled_at) {
              const name = memberInfo?.member_name || guestInfo?.guest_name || "Unknown";
              if (!cancelledByGame[gameId]) cancelledByGame[gameId] = [];
              cancelledByGame[gameId].push({ name, cancelled_at: b.cancelled_at, isGuest: !!b.guest_id });
            }
          });

          const processedAdhoc = adhocRes.data.map(a => ({
            adhoc_game_id: a.adhoc_game_id,
            organizer_id: a.organizer_id,
            club_id: ((a as Record<string, unknown>).club_id as number) ?? null,
            organizer_name: (a.members as unknown as { member_name: string })?.member_name || "Unknown",
            course_id: a.course_id,
            course_name: (a.courses as unknown as { course_name: string })?.course_name || "Unknown",
            game_date: a.game_date,
            tee_off_time: a.tee_off_time,
            max_players: a.max_players,
            notes: a.notes,
            status: a.status,
            booked_count: bookingCounts[a.adhoc_game_id] || 0,
            isBooked: userBookedAdhoc.has(a.adhoc_game_id),
            players: playersByGame[a.adhoc_game_id] || [],
            guests: guestsByGame[a.adhoc_game_id] || [],
            cancelled_players: cancelledByGame[a.adhoc_game_id] || [],
            cost_per_player: Number(a.cost_per_player) || 0,
            game_type: (a.game_type as string) || "IPS",
            deleted_at: (a.deleted_at as string | null) || null,
            wwb_enabled: (a as Record<string, unknown>).wwb_enabled as boolean || false,
            birdie_pool_fee: ((a as Record<string, unknown>).birdie_pool_fee as number | null) ?? null,
            tee_start: ((a as Record<string, unknown>).tee_start as '1' | 'split') ?? '1',
            is_multi_round: ((a as Record<string, unknown>).is_multi_round as boolean) ?? false,
            total_rounds: ((a as Record<string, unknown>).total_rounds as number) ?? 1,
round_number: ((a as Record<string, unknown>).round_number as number) ?? null,
  round_schedule: ((a as Record<string, unknown>).round_schedule as AdhocGame["round_schedule"]) ?? null,
  game_visibility: ((a as Record<string, unknown>).game_visibility as 'club' | 'public') ?? 'club',
  }));
  setAdhocGames(processedAdhoc);
          const firstActiveAdhoc = processedAdhoc.find(g => g.status !== "cancelled" && g.status !== "deleted");
          if (firstActiveAdhoc) {
            nextAdhocGame = { course_name: firstActiveAdhoc.course_name, game_date: firstActiveAdhoc.game_date, type: "Adhoc" };
          }
        }

  // Find the next upcoming game (earliest future date)
  let nextGameToShow: { course_name: string; game_date: string } | null = null;

  // Get today's date in SAST
  const today = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })).toISOString().split("T")[0];

  // Check all adhoc games for the earliest future game.
  // Scope strictly to the member's own club so public games from OTHER clubs
  // (included in adhocRes via the `game_visibility.eq.public` OR clause) never show as the Next Game.
  if (adhocRes.data && adhocRes.data.length > 0) {
    const futureAdhocGames = adhocRes.data
      .filter((g: any) => g.game_date >= today && g.status !== "cancelled" && g.status !== "deleted" && g.status !== "completed" && (myClubId ? (g as { club_id?: number | null }).club_id === myClubId : false))
      .sort((a: any, b: any) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime());
    
    if (futureAdhocGames.length > 0) {
      const earliest = futureAdhocGames[0];
      nextGameToShow = {
        course_name: (Array.isArray(earliest.courses) ? earliest.courses[0]?.course_name : earliest.courses?.course_name) || "Unknown Course",
        game_date: earliest.game_date,
      };
    }
  }

  // Check annual games if no adhoc game found
  if (!nextGameToShow && scheduleRes.data && scheduleRes.data.length > 0) {
    const futureAnnualGames = scheduleRes.data
      .filter((g: { game_date: string }) => g.game_date >= today)
      .sort((a: { game_date: string }, b: { game_date: string }) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime());
    
    if (futureAnnualGames.length > 0) {
      const earliest = futureAnnualGames[0];
      nextGameToShow = {
        course_name: earliest.course_name || "TBD",
        game_date: earliest.game_date,
      };
    }
  }

  setNextGame(nextGameToShow);

        // Process pairings - group by adhoc_game_id and fourball_number
        if (pairingsRes.data && pairingsRes.data.length > 0 && adhocRes.data && coursesRes.data) {
          // Get member names and handicap indices for pairings (using ReMmoho handicap index)
          const memberIds = [...new Set(pairingsRes.data.filter(p => p.member_id).map(p => p.member_id))];
          
          const { data: pairingMembers } = await supabase.from("members").select("member_id, member_name, member_handicap_indices(official_handicap_index, season)").in("member_id", memberIds.length > 0 ? memberIds : [0]);
          
          const memberNameMap: Record<number, string> = {};
          const memberHandicapIndexMap: Record<number, number> = {};
          const currentYear = String(new Date().getFullYear());
          pairingMembers?.forEach(m => { 
            memberNameMap[m.member_id] = m.member_name;
            const hcpData = m.member_handicap_indices as unknown as { official_handicap_index: number; season: string }[] | null;
            if (hcpData && hcpData.length > 0) {
              const currentIdx = hcpData.find(i => i.season === currentYear) || hcpData[0];
              memberHandicapIndexMap[m.member_id] = currentIdx.official_handicap_index;
            }
          });
          // Build guest name/handicap/gender maps from joined guest data on each pairing row
          const guestNameMap: Record<number, string> = {};
          const guestHandicapMap: Record<number, number> = {};
const guestGenderMap: Record<number, string> = {};
  // Build member club map for cross-club players display
  const memberClubMap: Record<number, { club_id: number; club_name: string }> = {};
  pairingsRes.data.forEach(p => {
            const guestData = (p as Record<string, unknown>).guests as { guest_id: number; guest_name: string; handicap_index: number | null; gender?: string } | null;
            if (guestData && guestData.guest_id) {
              guestNameMap[guestData.guest_id] = guestData.guest_name;
              if (guestData.handicap_index != null) guestHandicapMap[guestData.guest_id] = guestData.handicap_index;
  if (guestData.gender) guestGenderMap[guestData.guest_id] = guestData.gender;
  }
  // Build member club info from joined member data
  const memberData = (p as Record<string, unknown>).members as { member_name: string; club_id: number | null; golf_clubs?: { club_name: string } | null } | null;
  if (memberData && p.member_id && memberData.club_id) {
  memberClubMap[p.member_id] = { 
    club_id: memberData.club_id, 
    club_name: memberData.golf_clubs?.club_name || "Unknown Club" 
  };
  }
  });
  
  // Also create a map for late/no_show from pairings
  const lateNoShowMap: Record<string, { is_late: boolean; is_no_show: boolean }> = {};
  pairingsRes.data.forEach((p) => {
    const key = `${p.game_date}-${p.course_id}-${p.member_id}`;
    lateNoShowMap[key] = {
      is_late: p.is_late || false,
      is_no_show: p.is_no_show || false,
    };
  });
  
  // Create course lookup for slope/rating
          const courseMap: Record<number, { course_name: string; slope_rating: number; course_rating: number }> = {};
          coursesRes.data.forEach(c => {
            courseMap[c.course_id] = {
              course_name: c.course_name,
              slope_rating: c.slope_rating || 113,
              course_rating: Number(c.course_rating) || 72
            };
          });
          
          // Create adhoc game lookup for course/date info
          const adhocGameMap: Record<number, { course_id: number; course_name: string; game_date: string; tee_off_time: string; slope_rating: number; course_rating: number; status: string; game_type: string }> = {};
          adhocRes.data.forEach(ag => {
            const courseInfo = courseMap[ag.course_id];
            adhocGameMap[ag.adhoc_game_id] = {
              course_id: ag.course_id,
              course_name: courseInfo?.course_name || (ag.courses as unknown as { course_name: string })?.course_name || "TBD",
              game_date: ag.game_date,
              tee_off_time: ag.tee_off_time,
              slope_rating: courseInfo?.slope_rating || 113,
              course_rating: courseInfo?.course_rating || 72,
              status: ag.status,
              game_type: (ag.game_type as string) ?? "IPS"
            };
          });
          
          // Function to calculate Course Handicap: HCP Index * (Slope / 113) + (Course Rating - 72)
          // Cap at 18 only for ReMmoho (club_id === 1); all other clubs have no cap
          const calcCourseHandicap = (handicapIndex: number, slopeRating: number, courseRating: number) => {
            const calculated = Math.round(handicapIndex * (slopeRating / 113) + (courseRating - 72));
            return myClub?.club_id === 1 ? Math.min(calculated, 18) : calculated;
          };
          
// Group pairings - support cross-club games where user is a participant
  const grouped: Record<string, FourBallPairing> = {};
  pairingsRes.data.forEach(p => {
  const key = `${p.adhoc_game_id}-${p.fourball_number}`;
  // First try adhocGameMap (home club games), then fall back to joined adhoc_games data (cross-club games)
  let gameInfo = adhocGameMap[p.adhoc_game_id];
  const joinedGame = (p as Record<string, unknown>).adhoc_games as { club_id: number; status: string; game_date: string; course_id: number; tee_off_time: string; game_visibility: string; is_official: boolean; courses: { course_name: string } | null } | null;
  
  // If not in adhocGameMap but we have joined data AND user is part of this game, use joined data
  if (!gameInfo && joinedGame && userGameIds.has(p.adhoc_game_id)) {
    const courseData = coursesRes.data?.find((c: Course) => c.course_id === joinedGame.course_id);
    gameInfo = {
      adhoc_game_id: p.adhoc_game_id,
      course_id: joinedGame.course_id,
      course_name: joinedGame.courses?.course_name || courseData?.course_name || "Unknown Course",
      game_date: joinedGame.game_date,
      tee_off_time: joinedGame.tee_off_time,
      course_rating: courseData?.course_rating || 72,
      slope_rating: courseData?.slope_rating || 113,
      status: joinedGame.status,
      game_type: "IPS", // Default, will be overridden if available
      club_id: joinedGame.club_id,
      organizer_id: 0,
      max_players: 0,
      notes: "",
      cost_per_player: 0,
      deleted_at: null,
      wwb_enabled: false,
      birdie_pool_fee: 0,
      tee_start: "first",
      is_multi_round: false,
      total_rounds: 1,
      round_number: 1,
      round_schedule: null,
      organizer_name: "",
      game_visibility: joinedGame.game_visibility as 'club' | 'public' || 'club',
      is_official: joinedGame.is_official ?? true
    };
  }
  
  if (!gameInfo) return;
  // Only skip permanently deleted/cancelled games — keep completed and in_progress
  if (gameInfo.status === "deleted" || gameInfo.status === "cancelled") return;
            
            if (!grouped[key]) {
              grouped[key] = {
                adhoc_game_id: p.adhoc_game_id,
                fourball_number: p.fourball_number,
                course_id: gameInfo.course_id,
                course_name: gameInfo.course_name,
                game_date: gameInfo.game_date,
                tee_off_time: gameInfo.tee_off_time,
                fourball_tee_time: (p.tee_off_time as string | null) ?? undefined,
                starting_hole: (p as Record<string, unknown>).starting_hole as number ?? 1,
                course_rating: gameInfo.course_rating,
                members: [],
                isCaptain: false,
                allResultsSubmitted: true,
                game_type: gameInfo.game_type ?? "IPS"
              };
            }
            
            // Calculate course handicap - for members use remmoho index, for guests use their handicap_index
            const guestJoined = (p as Record<string, unknown>).guests as { guest_id: number; guest_name: string; handicap_index: number | null } | null;
            const pGuestId = guestJoined?.guest_id ?? ((p as Record<string, unknown>).guest_id as number | null);
            const isGuest = !!pGuestId && !p.member_id;
            let courseHandicap: number | null = null;
            if (isGuest && pGuestId) {
              const guestHcpIdx = guestHandicapMap[pGuestId];
              courseHandicap = guestHcpIdx !== undefined 
                ? calcCourseHandicap(guestHcpIdx, gameInfo.slope_rating, gameInfo.course_rating)
                : null;
            } else {
              const memberHcpIndex = memberHandicapIndexMap[p.member_id];
              courseHandicap = memberHcpIndex !== undefined 
                ? calcCourseHandicap(memberHcpIndex, gameInfo.slope_rating, gameInfo.course_rating)
                : null;
            }
            
            const memberJoined = (p as Record<string, unknown>).members as { member_name: string } | null;
            // Show club name for cross-club members (those from different clubs in public games)
            const memberClubInfo = p.member_id ? memberClubMap[p.member_id] : null;
            const isCrossClubMember = memberClubInfo && memberClubInfo.club_id !== myClubId;
            const baseName = isGuest && pGuestId
              ? `${guestNameMap[pGuestId] || guestJoined?.guest_name || "Guest"} (G)`
              : memberNameMap[p.member_id] || memberJoined?.member_name || "Unknown";
            const displayName = isCrossClubMember && !isGuest 
              ? `${baseName} (${memberClubInfo.club_name})`
              : baseName;
            
            const rawHcp = p.playing_handicap != null ? Number(p.playing_handicap) : null;
            // Use stored handicap if it's a real value (including 0 for scratch). Fall back to calculated only if null.
            const storedHcp = rawHcp !== null ? rawHcp : courseHandicap;
            // Get gender for guests from the gender map
            const memberGender = isGuest && pGuestId ? guestGenderMap[pGuestId] : undefined;
            grouped[key].members.push({
              pairing_id: p.pairing_id,
              member_id: p.member_id || -(pGuestId || 0),
              guest_id: isGuest ? (pGuestId ?? undefined) : undefined,
              member_name: displayName,
              is_captain: p.is_captain,
              gross_score: p.gross_score != null ? Number(p.gross_score) : null,
              points: p.points != null ? Number(p.points) : null,
              result_submitted: p.result_submitted,
              playing_handicap: storedHcp,
              birdies_count: p.birdies_count,
              eagles_count: p.eagles_count,
              hio_count: p.hio_count,
              ladies_count: p.ladies_count,
              is_late: p.is_late ?? false,
              is_no_show: p.is_no_show ?? false,
              scores_submitted_at: p.scores_submitted_at ?? null,
              gender: memberGender
            });
            if (p.member_id === Number(memberId) && p.is_captain) {
              grouped[key].isCaptain = true;
            }
            if (!p.result_submitted) {
              grouped[key].allResultsSubmitted = false;
            }
          });
          
          const allPairings = Object.values(grouped);
          
          setAllGamePairings(allPairings);
          // Persist to localStorage — include today's completed/in_progress games so the
          // live leaderboard and WWB tab continue to show data during and after play
          if (typeof window !== "undefined") {
            const localToday = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })).toISOString().split("T")[0];
            // Cache pairings from 14 days ago so the Live tab fallback always finds the most recent game
            const fourteenDaysAgo = (() => { const d = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })); d.setDate(d.getDate() - 14); return d.toISOString().split("T")[0]; })();
            localStorage.setItem(`pairings_${memberId}`, JSON.stringify(allPairings.filter(p => p.game_date >= fourteenDaysAgo)));
          }
          // Seed WWB opt-in state from pairings DB values
          if (WWB_CLUB_IDS.includes(myClubId)) {
            const optInMap: Record<number, { ww: boolean; birdie: boolean }> = {};
            pairingsRes.data.forEach((p: Record<string, unknown>) => {
              if (p.pairing_id) {
                optInMap[p.pairing_id as number] = { ww: !!(p.wwb_ww), birdie: !!(p.wwb_birdie) };
              }
            });
            setWwbOptIns(optInMap);

            // Also load per-game opt-ins from the dedicated table (set at booking time, before pairings exist)
            const supabaseWwbLoad = createClient();
            const { data: gameOptInsData } = await supabaseWwbLoad
              .from("adhoc_game_wwb_optins")
              .select("adhoc_game_id, member_id, guest_id, ww, birdie");
            if (gameOptInsData) {
              const gameOptInMap: Record<number, Record<number, { ww: boolean; birdie: boolean }>> = {};
              gameOptInsData.forEach((row: { adhoc_game_id: number; member_id: number | null; guest_id: number | null; ww: boolean; birdie: boolean }) => {
                if (!gameOptInMap[row.adhoc_game_id]) gameOptInMap[row.adhoc_game_id] = {};
                const key = row.member_id ?? -(row.guest_id ?? 0);
                gameOptInMap[row.adhoc_game_id][key] = { ww: row.ww, birdie: row.birdie };
              });
              setGameWwbOptIns(gameOptInMap);
            }
          }
          
          // Check if current member is a captain in any fourball
          const captainGameIds = new Set(
            allPairings.filter(g => g.members.some(m => m.member_id === Number(memberId) && m.is_captain)).map(g => g.adhoc_game_id)
          );
          
          // For captains: include ALL fourballs for their game(s) with isCaptain=true. For others: only their own.
          const myPairingsList = allPairings
            .filter(g => captainGameIds.has(g.adhoc_game_id) || g.members.some(m => m.member_id === Number(memberId)))
            .map(g => captainGameIds.has(g.adhoc_game_id) ? { ...g, isCaptain: true } : g);
          setMyPairings(myPairingsList);
          
          // Build live scores from allPairings — use SAST date to avoid UTC midnight off-by-one
          if (allPairings.length > 0) {
            const todayStr = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })).toISOString().split("T")[0];
            
            // Find all future games (today or later)
            const futureGames = allPairings.filter(p => p.game_date >= todayStr);
            
            let targetPairings: typeof allPairings = [];
            let liveGameId: number | undefined;
            let sameDayGameIds: number[] = [];
            
            if (futureGames.length > 0) {
              // Sort by date ascending (closest first)
              const sortedByClosestDate = [...futureGames].sort((a, b) => 
                a.game_date.localeCompare(b.game_date)
              );
              
              // Get the closest game date
              const closestGameDate = sortedByClosestDate[0].game_date;
              targetPairings = allPairings.filter(p => p.game_date === closestGameDate);
              
              // Sort same-day games by tee time ascending
              sameDayGameIds = [...new Set(targetPairings.map(p => p.adhoc_game_id))].sort((a, b) => {
                const aTee = targetPairings.find(p => p.adhoc_game_id === a)?.tee_off_time || "00:00:00";
                const bTee = targetPairings.find(p => p.adhoc_game_id === b)?.tee_off_time || "00:00:00";
                return aTee.localeCompare(bTee);
              });
              
              // Primary live game = earliest tee off on closest date
              liveGameId = sameDayGameIds[0];
            } else if (allPairings.length > 0) {
              // No future games, fall back to most recent past game
              const sortedDates = [...new Set(allPairings.map(p => p.game_date))].sort();
              targetPairings = allPairings.filter(p => p.game_date === sortedDates[sortedDates.length - 1]);
              sameDayGameIds = [...new Set(targetPairings.map(p => p.adhoc_game_id))].sort((a, b) => {
                const aTee = targetPairings.find(p => p.adhoc_game_id === a)?.tee_off_time || "00:00:00";
                const bTee = targetPairings.find(p => p.adhoc_game_id === b)?.tee_off_time || "00:00:00";
                return aTee.localeCompare(bTee);
              });
              liveGameId = sameDayGameIds[0];
            }
            
  if (targetPairings.length > 0 && liveGameId) {
  const livePairing = targetPairings.find(p => p.adhoc_game_id === liveGameId);
  if (!livePairing) {
    console.warn(`[v0] Live game ${liveGameId} not found in pairings`);
  } else {
  const liveCourseId = livePairing.course_id;
  const liveGameDate = livePairing.game_date;
  // Look up game_type from adhocGames state
  const liveGame = adhocGames.find(g => g.adhoc_game_id === liveGameId);

              const gameIsMedal = liveGame?.game_type === "Medal";
              // Attach game number to gameInfo for leaderboard title
              const gameInfo = {
                course_name: livePairing.course_name,
                game_date: livePairing.game_date,
                adhoc_game_id: liveGameId,
                course_id: liveCourseId,
                // Medal: if club is a Medal-only club, OR if the game's game_type is "Medal"
                format: MEDAL_CLUB_IDS.includes(myClubId ?? 0) || gameIsMedal ? "Medal" : (livePairing.format || "Stableford"),
                game_number: 1,
                total_games_today: sameDayGameIds.length,
                all_same_day_game_ids: sameDayGameIds,
                tee_off_time: livePairing.tee_off_time,
                game_visibility: (livePairing as { game_visibility?: 'club' | 'public' }).game_visibility,
                club_id: (livePairing as { club_id?: number }).club_id,
              };
  const scores = targetPairings.filter(p => p.adhoc_game_id === liveGameId).flatMap(p => p.members.map(m => ({
  member_name: m.member_name, member_id: m.member_id, points: m.points, gross_score: m.gross_score, fourball_number: p.fourball_number, result_submitted: m.result_submitted
  })));

  setLiveScoreGameInfo(gameInfo);
  setLiveScores(scores);
              // Persist live game state to localStorage
              if (typeof window !== "undefined") {
                localStorage.setItem(`liveGameInfo_${memberId}`, JSON.stringify(gameInfo));
                localStorage.setItem(`liveScores_${memberId}`, JSON.stringify(scores));
              }
              // Initialize scores submitted map
              const submittedMap: Record<number, string> = {};
              targetPairings.forEach(p => p.members.forEach(m => {
                if (m.scores_submitted_at) submittedMap[m.pairing_id] = m.scores_submitted_at;
              }));
              setScoresSubmittedMap(submittedMap);
              
              // Auto-load course holes and hole scores for live leaderboard (members + guests)
              if (liveGameId && liveCourseId) {
                const [{ data: holesData }, { data: scoresData }, { data: guestScoresData }] = await Promise.all([
supabase.from("course_holes").select("hole_number, par, stroke_index, ladies_stroke_index").eq("course_id", liveCourseId).order("hole_number"),
  supabase.from("hole_scores").select("pairing_id, hole_number, strokes").eq("adhoc_game_id", liveGameId),
  supabase.from("guest_hole_scores").select("pairing_id, hole_number, strokes").eq("course_id", liveCourseId).eq("game_date", liveGameDate)
                ]);
                if (holesData && holesData.length > 0) {
                  setCourseHoles(holesData);
                  setCourseHolesFound(true);
                } else {
                  setCourseHoles(Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, stroke_index: i + 1 })));
                  setCourseHolesFound(false);
                }
                const scoreMap: Record<number, Record<number, number | null>> = {};
                // Add member scores
                if (scoresData) {
                  scoresData.forEach(s => {
                    if (!scoreMap[s.pairing_id]) scoreMap[s.pairing_id] = {};
                    scoreMap[s.pairing_id][s.hole_number] = s.strokes;
                  });
                }
                // Add guest scores
                if (guestScoresData) {
                  guestScoresData.forEach(s => {
                    if (!scoreMap[s.pairing_id]) scoreMap[s.pairing_id] = {};
                    scoreMap[s.pairing_id][s.hole_number] = s.strokes;
                  });
                }
                setHoleScoreData(scoreMap);
                // Persist to localStorage
                if (typeof window !== "undefined") {
                  localStorage.setItem(`holeScores_${memberId}`, JSON.stringify(scoreMap));
                }
              }
            }
          }
          } // Close the else block for livePairing check
        }

        // Fetch Golf Clubs and Member Directory (scoped to member's club)
        const [clubsRes, memberDirRes] = await Promise.all([
          myClubId
            ? supabase.from("golf_clubs").select("club_id, club_name, logo_url, number_of_members, primary_contact_name, primary_contact_surname, primary_contact_number, primary_contact_email, secondary_contact_name, secondary_contact_surname, secondary_contact_number, secondary_contact_email").eq("club_id", myClubId)
            : supabase.from("golf_clubs").select("club_id, club_name, logo_url, number_of_members, primary_contact_name, primary_contact_surname, primary_contact_number, primary_contact_email, secondary_contact_name, secondary_contact_surname, secondary_contact_number, secondary_contact_email").order("club_name"),
          myClubId
            ? supabase.from("members").select("member_id, member_name, contact_number, club_id, gender").eq("club_id", myClubId).order("member_name")
            : supabase.from("members").select("member_id, member_name, contact_number, club_id, gender").order("member_name"),
        ]);
if (clubsRes.data) setClubData(clubsRes.data);
  if (memberDirRes.data) setMemberDirectory(memberDirRes.data);
  // Fetch all club names for public games banner
  const { data: allClubsData } = await supabase.from("golf_clubs").select("club_id, club_name");
  if (allClubsData) {
    const clubMap: Record<number, string> = {};
    allClubsData.forEach(c => { clubMap[c.club_id] = c.club_name; });
    setAllClubNames(clubMap);
  }
  // Set my club info
        if (clubsRes.data && myClubId) {
          const club = clubsRes.data.find(c => c.club_id === myClubId);
          if (club) setMyClub({ club_id: club.club_id, club_name: club.club_name, logo_url: club.logo_url });
        }

        // Show dashboard immediately
        setLoading(false);

        // Pairings are now generated manually by the game organizer via the "Generate Pairings" button

        // Load leaders in background (non-blocking), filtered to club members only
        const clubMembersRes = await supabase.from("members").select("member_id, member_name").eq("club_id", myClubId);
        const clubMemberIds = new Set((clubMembersRes.data || []).map(m => m.member_id));
        const clubMemberNames: Record<number, string> = {};
        (clubMembersRes.data || []).forEach(m => { clubMemberNames[m.member_id] = m.member_name; });

        // Quarter: Q2 = Mar-May, best 6 of last 20 games per member
        supabase.from("performance_records").select("member_id, points, game_date").eq("club_id", myClubId).gte("game_date", "2026-03-01").lte("game_date", "2026-05-31").order("game_date", { ascending: false })
          .then(({ data }) => {
            if (!isMounted || !data?.length) return;
            const memberGames: Record<number, number[]> = {};
            data.forEach(r => {
              if (!clubMemberIds.has(r.member_id)) return;
              if (!memberGames[r.member_id]) memberGames[r.member_id] = [];
              memberGames[r.member_id].push(r.points || 0);
            });
            const pts: Record<number, number> = {};
            Object.entries(memberGames).forEach(([mid, games]) => {
              const best6 = [...games.slice(0, 20)].sort((a, b) => b - a).slice(0, 6);
              pts[Number(mid)] = best6.reduce((sum, p) => sum + p, 0);
            });
            const sorted = Object.entries(pts).sort((a, b) => b[1] - a[1]);
            const fullStandings = sorted.map(([mid, tp]) => ({ member_id: Number(mid), member_name: clubMemberNames[Number(mid)] || "Unknown", total_points: tp }));
            if (isMounted) setQuarterStandings(fullStandings);
            const top = sorted[0];
            if (top && isMounted) setQuarterLeader({ member_name: clubMemberNames[Number(top[0])] || "Unknown", total_points: top[1] });
            const pos = sorted.findIndex(([mid]) => Number(mid) === Number(memberId)) + 1;
            const memberEntry = sorted.find(([mid]) => Number(mid) === Number(memberId));
            if (isMounted && pos > 0) { setCalculatedQuarterPosition(pos); setQuarterCalcPoints(memberEntry ? Number(memberEntry[1]) : 0); }
          });

        // Annual: Dec-Nov, best 20 of all games per member
        supabase.from("performance_records").select("member_id, points, game_date").eq("club_id", myClubId).gte("game_date", "2025-12-01").lte("game_date", "2026-11-30").order("game_date", { ascending: false })
          .then(({ data }) => {
            if (!isMounted || !data?.length) return;
            const memberGames: Record<number, number[]> = {};
            data.forEach(r => {
              if (!clubMemberIds.has(r.member_id)) return;
              if (!memberGames[r.member_id]) memberGames[r.member_id] = [];
              memberGames[r.member_id].push(r.points || 0);
            });
            const pts: Record<number, number> = {};
            Object.entries(memberGames).forEach(([mid, games]) => {
              const best20 = [...games].sort((a, b) => b - a).slice(0, 20);
              pts[Number(mid)] = best20.reduce((sum, p) => sum + p, 0);
            });
            const sorted = Object.entries(pts).sort((a, b) => b[1] - a[1]);
            const fullStandings = sorted.map(([mid, tp]) => ({ member_id: Number(mid), member_name: clubMemberNames[Number(mid)] || "Unknown", total_points: tp }));
            if (isMounted) setAnnualStandings(fullStandings);
            const top = sorted[0];
            if (top && isMounted) setAnnualLeader({ member_name: clubMemberNames[Number(top[0])] || "Unknown", total_points: top[1] });
            const pos = sorted.findIndex(([mid]) => Number(mid) === Number(memberId)) + 1;
            const memberEntry = sorted.find(([mid]) => Number(mid) === Number(memberId));
            if (isMounted && pos > 0) { setCalculatedAnnualPosition(pos); setAnnualCalcPoints(memberEntry ? Number(memberEntry[1]) : 0); }
          });

        // Medal: Best 6 medal_points in the year (Dec-Nov)
        supabase.from("performance_records").select("member_id, medal_points, game_date").eq("medal_game", true).eq("club_id", myClubId).gte("game_date", "2025-12-01").lte("game_date", "2026-11-30").order("game_date", { ascending: false })
          .then(({ data }) => {
            if (!isMounted || !data?.length) return;
            const memberGames: Record<number, number[]> = {};
            data.forEach(r => {
              if (!clubMemberIds.has(r.member_id)) return;
              if (!memberGames[r.member_id]) memberGames[r.member_id] = [];
              if (r.medal_points) memberGames[r.member_id].push(r.medal_points);
            });
            const pts: Record<number, number> = {};
            Object.entries(memberGames).forEach(([mid, games]) => {
              const best6 = [...games].sort((a, b) => b - a).slice(0, 6);
              pts[Number(mid)] = best6.reduce((sum, p) => sum + p, 0);
            });
            const sorted = Object.entries(pts).sort((a, b) => b[1] - a[1]);
            const fullStandings = sorted.map(([mid, tp]) => ({ member_id: Number(mid), member_name: clubMemberNames[Number(mid)] || "Unknown", total_points: tp }));
            if (isMounted) setMedalStandings(fullStandings);
            const top = sorted[0];
            if (top && isMounted) setMedalLeader({ member_name: clubMemberNames[Number(top[0])] || "Unknown", total_points: top[1] });
            const pos = sorted.findIndex(([mid]) => Number(mid) === Number(memberId)) + 1;
            const memberEntry = sorted.find(([mid]) => Number(mid) === Number(memberId));
if (isMounted && pos > 0) { setCalculatedMedalPosition(pos); setMedalYearPoints(memberEntry ? Number(memberEntry[1]) : 0); }
  });
  
  // OOM (Order of Merit) Standings - Club 19 (Fairway Finders) only
  // Sum order_of_merit_points from pairings for all club 19 members
  if (myClubId === 19) {
    supabase.from("pairings")
      .select("member_id, order_of_merit_points, adhoc_games!inner(club_id, game_date)")
      .eq("adhoc_games.club_id", 19)
      .gte("adhoc_games.game_date", "2025-12-01")
      .lte("adhoc_games.game_date", "2026-11-30")
      .not("order_of_merit_points", "is", null)
      .then(({ data, error }) => {
        if (!isMounted || error || !data) return;
        const pts: Record<number, number> = {};
        data.forEach((r: { member_id: number | null; order_of_merit_points: number | null }) => {
          if (r.member_id && r.order_of_merit_points) {
            pts[r.member_id] = (pts[r.member_id] || 0) + Number(r.order_of_merit_points);
          }
        });
        const sorted = Object.entries(pts).sort((a, b) => b[1] - a[1]);
        const fullStandings = sorted.map(([mid, tp]) => ({ 
          member_id: Number(mid), 
          member_name: clubMemberNames[Number(mid)] || "Unknown", 
          total_points: tp 
        }));
        if (isMounted) setOomStandings(fullStandings);
        const top = sorted[0];
        if (top && isMounted) setOomLeader({ member_name: clubMemberNames[Number(top[0])] || "Unknown", total_points: top[1] });
        const pos = sorted.findIndex(([mid]) => Number(mid) === Number(memberId)) + 1;
        const memberEntry = sorted.find(([mid]) => Number(mid) === Number(memberId));
        if (isMounted && pos > 0) { setCalculatedOomPosition(pos); setOomYearPoints(memberEntry ? Number(memberEntry[1]) : 0); }
      });
  }

  // OOM (Order of Merit) Standings - Golf & Beyond (Club 26) only
  // Position-based scoring per completed game: 1st=10, 2nd=8, 3rd=6, 4th=5, 5th=4, rest=2
  if (myClubId === 26) {
    supabase.from("adhoc_games")
      .select("adhoc_game_id")
      .eq("club_id", 26)
      .eq("status", "completed")
      .then(({ data: clubGames, error: gamesErr }) => {
        if (!isMounted || gamesErr || !clubGames?.length) return;
        const gameIds = clubGames.map(g => g.adhoc_game_id);

        supabase.from("pairings")
          .select("member_id, adhoc_game_id, points, members(member_name)")
          .in("adhoc_game_id", gameIds)
          .not("member_id", "is", null)
          .then(({ data: pairingsData, error: pairingsErr }) => {
            if (!isMounted || pairingsErr || !pairingsData?.length) return;

            // Group pairings by game to determine finishing positions
            const gamesMap: Record<number, typeof pairingsData> = {};
            pairingsData.forEach(p => {
              if (!gamesMap[p.adhoc_game_id]) gamesMap[p.adhoc_game_id] = [];
              gamesMap[p.adhoc_game_id].push(p);
            });

            const oomPoints: Record<number, number> = {};
            const memberNames: Record<number, string> = {};

            Object.values(gamesMap).forEach(gamePlayers => {
              const sortedPlayers = [...gamePlayers].sort((a, b) => (b.points || 0) - (a.points || 0));
              sortedPlayers.forEach((player, idx) => {
                const position = idx + 1;
                let positionPoints = 2;
                if (position === 1) positionPoints = 10;
                else if (position === 2) positionPoints = 8;
                else if (position === 3) positionPoints = 6;
                else if (position === 4) positionPoints = 5;
                else if (position === 5) positionPoints = 4;
                if (player.member_id) {
                  oomPoints[player.member_id] = (oomPoints[player.member_id] || 0) + positionPoints;
                  if (player.members) {
                    memberNames[player.member_id] = (player.members as unknown as { member_name: string }).member_name;
                  }
                }
              });
            });

            const sorted = Object.entries(oomPoints).sort((a, b) => b[1] - a[1]);
            const fullStandings = sorted.map(([mid, tp]) => ({
              member_id: Number(mid),
              member_name: memberNames[Number(mid)] || clubMemberNames[Number(mid)] || "Unknown",
              total_points: tp
            }));
            if (isMounted) setOomStandings(fullStandings);
            const top = sorted[0];
            if (top && isMounted) setOomLeader({ member_name: memberNames[Number(top[0])] || "Unknown", total_points: top[1] });
            const pos = sorted.findIndex(([mid]) => Number(mid) === Number(memberId)) + 1;
            const memberEntry = sorted.find(([mid]) => Number(mid) === Number(memberId));
            if (isMounted && pos > 0) { setCalculatedOomPosition(pos); setOomYearPoints(memberEntry ? Number(memberEntry[1]) : 0); }
          });
      });
  }
  
  // Fetch pending join requests (as organizer) and my join requests (as requester)
  supabase.from("game_join_requests")
    .select("request_id, adhoc_game_id, requester_id, status, created_at, responded_at, adhoc_games(game_date, course_id, courses(course_name)), members!game_join_requests_requester_id_fkey(member_name)")
    .eq("organizer_id", memberId)
    .eq("status", "pending")
    .then(({ data, error }) => {
      if (!isMounted || error || !data) return;
      const requests = data.map((r: any) => ({
        request_id: r.request_id,
        adhoc_game_id: r.adhoc_game_id,
        requester_id: r.requester_id,
        requester_name: r.members?.member_name || "Unknown",
        game_date: r.adhoc_games?.game_date || "",
        course_name: r.adhoc_games?.courses?.course_name || "Unknown",
        created_at: r.created_at
      }));
      setPendingJoinRequests(requests);
    });
  
  supabase.from("game_join_requests")
    .select("request_id, adhoc_game_id, status, created_at, responded_at, adhoc_games(game_date, course_id, organizer_id, status, courses(course_name), members!adhoc_games_organizer_id_fkey(member_name))")
    .eq("requester_id", memberId)
    .in("status", ["pending", "approved", "denied"])
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .then(({ data, error }) => {
      if (!isMounted || error || !data) return;
      const requests = data.map((r: any) => ({
        request_id: r.request_id,
        adhoc_game_id: r.adhoc_game_id,
        organizer_name: r.adhoc_games?.members?.member_name || "Unknown",
        game_date: r.adhoc_games?.game_date || "",
        course_name: r.adhoc_games?.courses?.course_name || "Unknown",
        status: r.status,
        created_at: r.created_at,
        responded_at: r.responded_at,
        game_status: r.adhoc_games?.status || ""
      }));
      setMyJoinRequests(requests);
    });

  // Load leaderboard positions in background (non-blocking)
        const birdiesQuery = myClubId 
          ? supabase.from("birdies").select("member_id, birdie_count").eq("club_id", myClubId)
          : supabase.from("birdies").select("member_id, birdie_count");
        birdiesQuery.then(({ data }) => {
          if (!isMounted || !data) return;
          const bpts: Record<number, number> = {};
          data.forEach(r => { bpts[r.member_id] = (bpts[r.member_id] || 0) + (r.birdie_count || 0); });
          const sorted = Object.entries(bpts).sort((a, b) => b[1] - a[1]);
          const pos = sorted.findIndex(([mid]) => Number(mid) === Number(memberId)) + 1;
          if (pos > 0) setBirdiesPosition(pos);
        });

        const ladiesQuery = myClubId
          ? supabase.from("ladies").select("member_id, ladies_count").eq("club_id", myClubId)
          : supabase.from("ladies").select("member_id, ladies_count");
        ladiesQuery.then(({ data }) => {
          if (!isMounted || !data) return;
          const lpts: Record<number, number> = {};
          data.forEach(r => { lpts[r.member_id] = (lpts[r.member_id] || 0) + (r.ladies_count || 0); });
          const sorted = Object.entries(lpts).sort((a, b) => b[1] - a[1]);
          const pos = sorted.findIndex(([mid]) => Number(mid) === Number(memberId)) + 1;
          if (pos > 0) setLadiesPosition(pos);
        });

      } catch (error) {
        if (!isMounted) return;
        console.error("Error loading dashboard:", error);
        setLoading(false);
      }
    }

    loadDashboard();
    setLastRefresh(new Date());

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up old cache entries older than 7 days
  useEffect(() => {
    const memberId = memberData?.member_id;
    if (!memberId) return;
    
    const cleanOldCache = () => {
      const cacheKeys = [
        `pairings_${memberId}`,
        `liveGameInfo_${memberId}`,
        `liveScores_${memberId}`,
        `holeScores_${memberId}`,
        `adhocGames_${memberId}`,
        `wwbOptIns_${memberId}`
      ];
      
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      cacheKeys.forEach(key => {
        const cached = localStorage.getItem(key);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            // Check if data has timestamp and is older than 7 days
            if (parsed._timestamp && parsed._timestamp < sevenDaysAgo) {
              localStorage.removeItem(key);
            }
            // Add timestamp to existing cache when reading
            else if (!parsed._timestamp && cached) {
              const withTimestamp = { ...parsed, _timestamp: Date.now() };
              localStorage.setItem(key, JSON.stringify(withTimestamp));
            }
          } catch {
            // Invalid JSON, remove it
            localStorage.removeItem(key);
          }
        }
      });
    };
    
    cleanOldCache();
    
    // Set up interval to clean cache weekly
    const cleanupInterval = setInterval(cleanOldCache, 7 * 24 * 60 * 60 * 1000);
    return () => clearInterval(cleanupInterval);
  }, [memberData?.member_id]);

  // [v0] TEMP DIAGNOSTIC: capture unhandled promise rejections / errors with full
  // stack so we can pinpoint the "Missing closing }" origin (it bypasses the React
  // error boundary because it's an async rejection, not a render error).
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      console.log("[v0] UnhandledRejection:", r instanceof Error ? r.message : String(r), "| stack:", r instanceof Error ? r.stack : "(no stack)");
    };
    const onError = (e: ErrorEvent) => {
      console.log("[v0] WindowError:", e.message, "| at:", e.filename + ":" + e.lineno + ":" + e.colno, "| stack:", e.error?.stack ?? "(no stack)");
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  // Offline detection effect
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Retry pending operations when back online
      pendingOperations.forEach(op => {
        op.operation().catch(console.error);
      });
      setPendingOperations([]);
      handleSilentRefresh();
    };
    
    const handleOffline = () => {
      setIsOffline(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    setIsOffline(!navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOperations]);

  // Single source of truth for auto-opening the scorecard when the live game
  // changes. Resets per-game hole state, then opens the scorecard. The
  // openScorecard ref guard prevents any duplicate fetches.
  useEffect(() => {
    if (!liveScoreGameInfo?.adhoc_game_id || !liveScoreGameInfo?.course_id) return;

    // Reset hole data for the new game
    setHoleScoreData({});
    setLadyHoleData({});
    setCourseHoles([]);
    setScoresSubmittedMap({});

    openScorecard(liveScoreGameInfo.adhoc_game_id, liveScoreGameInfo.course_id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveScoreGameInfo?.adhoc_game_id]);
  
  // Note: Home is always the default landing tab.
  // Users navigate to Live manually via the banner or bottom tab bar.

  useEffect(() => {
    if (!liveScoreGameInfo?.adhoc_game_id) return;
    const interval = setInterval(async () => {
      const supabase = createClient();
      const gameId = liveScoreGameInfo.adhoc_game_id!;
      const courseId = liveScoreGameInfo.course_id;
      // Refresh hole scores
      const { data: scoresData } = await supabase
        .from("hole_scores")
        .select("pairing_id, hole_number, strokes")
        .eq("adhoc_game_id", gameId);
      if (scoresData) {
        // Build the fresh map from DB
        const freshMap: Record<number, Record<number, number | null>> = {};
        scoresData.forEach(s => {
          if (!freshMap[s.pairing_id]) freshMap[s.pairing_id] = {};
          freshMap[s.pairing_id][s.hole_number] = s.strokes;
        });
        // Merge: DB values win for holes already persisted; in-memory values survive
        // for holes the user has entered but not yet submitted, preventing the scorecard
        // from clearing mid-round on every 60-second poll.
        setHoleScoreData(prev => {
          const merged: Record<number, Record<number, number | null>> = { ...freshMap };
          Object.entries(prev).forEach(([pid, holes]) => {
            const id = Number(pid);
            if (!merged[id]) merged[id] = {};
            Object.entries(holes).forEach(([hole, strokes]) => {
              if (merged[id][Number(hole)] === undefined) {
                merged[id][Number(hole)] = strokes;
              }
            });
          });
          return merged;
        });
      }
      // Refresh pairings for updated points/gross/result_submitted
      const { data: pairingsData } = await supabase
        .from("pairings")
        .select("pairing_id, fourball_number, member_id, points, gross_score, playing_handicap, birdies_count, eagles_count, ladies_count, result_submitted, scores_submitted_at, is_no_show, members(member_name)")
        .eq("adhoc_game_id", gameId);
      if (pairingsData) {
        setLiveScores(pairingsData.map((p: Record<string, unknown>) => ({
          member_name: ((p.members as Record<string, unknown>)?.member_name as string) || "Unknown",
          member_id: p.member_id as number,
          points: p.points as number | null,
          gross_score: p.gross_score as number | null,
          fourball_number: p.fourball_number as number,
          result_submitted: p.result_submitted as boolean,
        })));
      }
      // Refresh course holes if needed
      if (courseId) {
        const { data: holesData } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index")
          .eq("course_id", courseId)
          .order("hole_number");
        if (holesData && holesData.length > 0) {
          setCourseHoles(holesData);
        }
      }
      setLastRefresh(new Date());
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveScoreGameInfo?.adhoc_game_id]);

  // Force live leaderboard to re-render when hole scores change
  useEffect(() => {
    if (liveScoreGameInfo?.adhoc_game_id) {
      // Small delay to ensure state is updated
      const timer = setTimeout(() => {
        setLastRefresh(new Date());
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [holeScoreData, liveScoreGameInfo?.adhoc_game_id]);

  // Refresh all game + pairing + WWB data whenever the user opens the WWB tab
  useEffect(() => {
    if (activeTab !== "competitions" || !WWB_CLUB_IDS.includes(myClub?.club_id ?? 0)) return;

    // Immediate refresh on tab open
    handleSilentRefresh();

    // Fetch last 20 completed WWB games + their stored results for the history section
    const fetchWwbHistory = async () => {
      const supabase = createClient();
      const clubId = myClub?.club_id;
      if (!clubId) return;

      // Fetch last 20 completed WWB games for this club
      const { data: games } = await supabase
        .from("adhoc_games")
        .select("adhoc_game_id, game_date, courses(course_name)")
        .eq("club_id", clubId)
        .eq("status", "completed")
        .eq("wwb_enabled", true)
        .order("game_date", { ascending: false })
        .limit(20);

      if (!games || games.length === 0) return;

      const gameIds = games.map((g: Record<string,unknown>) => g.adhoc_game_id as number);

      // Fetch wwb_results for all these games in one query
      const { data: results } = await supabase
        .from("wwb_results")
        .select("adhoc_game_id, ww_front9_winner_id, ww_front9_points, ww_back9_winner_id, ww_back9_points, ww_overall_winner_id, ww_overall_points, birdie_pool_total, birdie_pool_per_birdie, birdie_pool_entrants, birdie_pool_total_birdies")
        .in("adhoc_game_id", gameIds);

      // Fetch birdie payouts for all these games
      const { data: birdiePayouts } = await supabase
        .from("wwb_birdie_payouts")
        .select("adhoc_game_id, member_id, birdies_scored, payout_amount, members(member_name)")
        .in("adhoc_game_id", gameIds);

      // Fetch member names for WW winners
      const winnerIds = new Set<number>();
      (results || []).forEach((r: Record<string,unknown>) => {
        if (r.ww_front9_winner_id) winnerIds.add(r.ww_front9_winner_id as number);
        if (r.ww_back9_winner_id) winnerIds.add(r.ww_back9_winner_id as number);
        if (r.ww_overall_winner_id) winnerIds.add(r.ww_overall_winner_id as number);
      });
      const winnerIdArr = Array.from(winnerIds);
      let memberNameMap: Record<number, string> = {};
      if (winnerIdArr.length > 0) {
        const { data: memberRows } = await supabase
          .from("members")
          .select("member_id, member_name")
          .in("member_id", winnerIdArr);
        (memberRows || []).forEach((m: Record<string,unknown>) => {
          memberNameMap[m.member_id as number] = m.member_name as string;
        });
      }

      const resultsMap: Record<number, Record<string,unknown>> = {};
      (results || []).forEach((r: Record<string,unknown>) => {
        resultsMap[r.adhoc_game_id as number] = r;
      });

      const birdiePayoutsMap: Record<number, { member_id: number; member_name: string; birdies_scored: number; payout_amount: number }[]> = {};
      (birdiePayouts || []).forEach((bp: Record<string,unknown>) => {
        const gid = bp.adhoc_game_id as number;
        if (!birdiePayoutsMap[gid]) birdiePayoutsMap[gid] = [];
        birdiePayoutsMap[gid].push({
          member_id: bp.member_id as number,
          member_name: (bp.members as { member_name: string } | null)?.member_name ?? "Unknown",
          birdies_scored: bp.birdies_scored as number,
          payout_amount: bp.payout_amount as number,
        });
      });

      const history: WwbHistoryGame[] = games.map((g: Record<string,unknown>) => {
        const r = resultsMap[g.adhoc_game_id as number];
        return {
          adhoc_game_id: g.adhoc_game_id as number,
          game_date: g.game_date as string,
          course_name: (g.courses as { course_name: string } | null)?.course_name ?? "Unknown",
          ww_front9_winner_id: r ? (r.ww_front9_winner_id as number | null) : null,
          ww_front9_winner_name: r?.ww_front9_winner_id ? memberNameMap[r.ww_front9_winner_id as number] ?? null : null,
          ww_front9_points: r ? (r.ww_front9_points as number | null) : null,
          ww_back9_winner_id: r ? (r.ww_back9_winner_id as number | null) : null,
          ww_back9_winner_name: r?.ww_back9_winner_id ? memberNameMap[r.ww_back9_winner_id as number] ?? null : null,
          ww_back9_points: r ? (r.ww_back9_points as number | null) : null,
          ww_overall_winner_id: r ? (r.ww_overall_winner_id as number | null) : null,
          ww_overall_winner_name: r?.ww_overall_winner_id ? memberNameMap[r.ww_overall_winner_id as number] ?? null : null,
          ww_overall_points: r ? (r.ww_overall_points as number | null) : null,
          birdie_pool_total: r ? (r.birdie_pool_total as number ?? 0) : 0,
          birdie_pool_per_birdie: r ? (r.birdie_pool_per_birdie as number ?? 0) : 0,
          birdie_pool_entrants: r ? (r.birdie_pool_entrants as number ?? 0) : 0,
          birdie_pool_total_birdies: r ? (r.birdie_pool_total_birdies as number ?? 0) : 0,
          birdie_payouts: birdiePayoutsMap[g.adhoc_game_id as number] ?? [],
        };
      });

      setWwbHistory(history);
    };

    fetchWwbHistory();

    // Continue polling every 30 s while the tab is visible
    const wwbInterval = setInterval(() => {
      handleSilentRefresh();
    }, 30000);

    return () => clearInterval(wwbInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);







  // Memoize active WWB game detection to avoid recalculating on every render
  const activeWwbGameMemo = useMemo(() => {
    return adhocGames
      .filter(g => g.status !== "cancelled" && g.status !== "deleted" && g.status !== "completed")
      .find(g => g.wwb_enabled || Object.keys(gameWwbOptIns[g.adhoc_game_id] || {}).length > 0) || null;
  }, [adhocGames, gameWwbOptIns]);

  // Memoize WWB leaderboard computation - expensive operation
  const wwDataMemo = useMemo(() => {
    if (!activeWwbGameMemo) return null;
    // computeWwbLeaderboard is defined later, so we return null and compute inline where needed
return null;
  }, [activeWwbGameMemo]);
  
  // Restore live game info from localStorage on mount
  useEffect(() => {
    if (!memberData?.member_id) return;
    
    const cachedGameInfo = typeof window !== "undefined" ? localStorage.getItem(`liveGameInfo_${memberData.member_id}`) : null;
    const cachedScores = typeof window !== "undefined" ? localStorage.getItem(`liveScores_${memberData.member_id}`) : null;
    const cachedPairings = typeof window !== "undefined" ? localStorage.getItem(`pairings_${memberData.member_id}`) : null;
    const cachedHoleScores = typeof window !== "undefined" ? localStorage.getItem(`holeScores_${memberData.member_id}`) : null;
    
    if (cachedGameInfo && !liveScoreGameInfo) {
      try {
        const parsed = JSON.parse(cachedGameInfo);
        // Only restore if the game date is today or future (not old completed games)
        const todaySAST = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })).toISOString().split("T")[0];
        if (parsed.game_date >= todaySAST) {
          setLiveScoreGameInfo(parsed);
        }
      } catch (e) { /* ignore parse errors */ }
    }
    
    if (cachedScores && liveScores.length === 0) {
      try { setLiveScores(JSON.parse(cachedScores)); } catch (e) { /* ignore */ }
    }
    
    if (cachedPairings && allGamePairings.length === 0) {
      try { 
        const parsed = JSON.parse(cachedPairings);
        if (Array.isArray(parsed)) setAllGamePairings(parsed);
      } catch (e) { /* ignore */ }
    }
    
    if (cachedHoleScores && Object.keys(holeScoreData).length === 0) {
      try { setHoleScoreData(JSON.parse(cachedHoleScores)); } catch (e) { /* ignore */ }
    }
  }, [memberData?.member_id]); // Only run once on mount when memberData is available
  
  // Persist liveScoreGameInfo to localStorage when it changes
  useEffect(() => {
    if (!memberData?.member_id || typeof window === "undefined") return;
    
    if (liveScoreGameInfo) {
      localStorage.setItem(`liveGameInfo_${memberData.member_id}`, JSON.stringify(liveScoreGameInfo));
    }
    if (liveScores.length > 0) {
      localStorage.setItem(`liveScores_${memberData.member_id}`, JSON.stringify(liveScores));
    }
    if (allGamePairings.length > 0) {
      localStorage.setItem(`pairings_${memberData.member_id}`, JSON.stringify(allGamePairings));
    }
  }, [liveScoreGameInfo, liveScores, allGamePairings, memberData?.member_id]);
  
  // Clear stale liveScoreGameInfo only when game is deleted/cancelled (not completed)
  useEffect(() => {
    if (liveScoreGameInfo?.adhoc_game_id) {
      const game = adhocGames.find(g => g.adhoc_game_id === liveScoreGameInfo.adhoc_game_id);
      // Only clear if game is deleted/cancelled, not if it's completed
      const shouldClear = game && (game.status === "deleted" || game.status === "cancelled");
      if (shouldClear) {
        console.warn(`[v0] Clearing stale liveScoreGameInfo for deleted game ${liveScoreGameInfo.adhoc_game_id}`);
        setLiveScoreGameInfo(null);
        setLiveScores([]);
        if (typeof window !== "undefined") {
          localStorage.removeItem(`liveGameInfo_${memberData?.member_id}`);
        }
      }
    }
  }, [adhocGames, liveScoreGameInfo?.adhoc_game_id, memberData?.member_id]);
  
  // FIXED: Memoize live leaderboard data computation with full scoring logic
  const liveLeaderboardData = useMemo(() => {
  if (!liveScoreGameInfo?.adhoc_game_id) return [];
  // Defensive check: ensure allGamePairings is an array
  if (!Array.isArray(allGamePairings) || allGamePairings.length === 0) return [];
  
  const pairingsForGame = allGamePairings.filter(p => p.adhoc_game_id === liveScoreGameInfo.adhoc_game_id);
  if (pairingsForGame.length === 0) return [];
  
    const allMembers = pairingsForGame.flatMap(p => p.members.map(m => ({ ...m, fourball_number: p.fourball_number })));
    const isMedal = MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0) || liveScoreGameInfo.format === "Medal";
    
    return allMembers.map(m => {
      const scores = holeScoreData[m.pairing_id] || {};
      let gross = 0;
      let totalPoints = 0;
      let birdies = 0;
      let eagles = 0;
      let holesPlayed = 0;
      const hcp = m.playing_handicap ?? 0;
      
      for (const hole of courseHoles) {
        const rawStrokes = scores[hole.hole_number];
        if (rawStrokes == null) continue;
        holesPlayed++;
        
        // Use the helper for handicap strokes
        const hcpStrokes = calculateHcpStrokes(hcp, hole.stroke_index);
        
        // NET score after handicap
        let netScore = rawStrokes - hcpStrokes;
        
        if (!isMedal) {
          // ESC: Max net score is double bogey
          netScore = Math.min(netScore, hole.par + 2);
        }
        
        gross += rawStrokes;
        
        // Points from NET score
        const pts = isMedal ? 0 : Math.max(0, 2 + hole.par - netScore);
        totalPoints += pts;
        
        if (rawStrokes === hole.par - 1) birdies++;
        if (rawStrokes <= hole.par - 2) eagles++;
      }
      
      // Calculate net to par for display
      const parForPlayed = courseHoles.filter(h => scores[h.hole_number] != null).reduce((s, h) => s + h.par, 0);
      const proportionalHcp = holesPlayed > 0 ? Math.round(hcp * holesPlayed / 18) : 0;
      const netToPar = holesPlayed > 0 ? gross - parForPlayed - proportionalHcp : null;
      const net = holesPlayed > 0 ? gross - proportionalHcp : null;
      
      return {
        member_name: m.member_name,
        member_id: m.member_id,
        pairing_id: m.pairing_id,
        fourball_number: m.fourball_number,
        gross,
        points: totalPoints,
        thru: holesPlayed,
        netToPar,
        net,
        playing_handicap: hcp,
        birdies,
        ladies: m.ladies_count ?? 0,
      };
    }).sort((a, b) => {
      if (a.thru === 0 && b.thru === 0) return 0;
      if (a.thru === 0) return 1;
      if (b.thru === 0) return -1;
      if (isMedal) {
        const aN = a.net ?? 999, bN = b.net ?? 999;
        if (aN !== bN) return aN - bN;
        return a.gross - b.gross;
      }
      if (b.points !== a.points) return b.points - a.points;
      return a.gross - b.gross;
    });
  }, [allGamePairings, liveScoreGameInfo?.adhoc_game_id, liveScoreGameInfo?.format, courseHoles, holeScoreData, myClub?.club_id]);

  // Silent background refresh — re-fetches all game/pairing data without showing the loading spinner.
  // Call this after every mutation so changes are immediately visible without requiring a re-login.
  async function handleSilentRefresh() {
    const supabase = createClient();
    const session = localStorage.getItem("member_session");
    if (!session) return;
    const sessionData = JSON.parse(session);
    // Session stores { member_id, club_id, member_name, club_name } from MemberOption
    const memberId: number = sessionData.member_id ?? sessionData.memberId;
    // Read club_id directly from the persisted session — myClub React state may be null
    // if handleSilentRefresh is invoked before the initial data load has completed.
    const freshClubId: number = sessionData.club_id ?? myClub?.club_id ?? 1;
    const isNomadRefresh = freshClubId === 999;

    // Fetch from 7 days ago so recently completed games (including WWB) always appear in the tab.
    const sastYesterday = (() => { const d = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })();
    
    // For Nomads, first get their booked games
    let nomadGameIds: number[] = [];
    if (isNomadRefresh) {
      const { data: nomadBookings } = await supabase
        .from("adhoc_game_bookings")
        .select("adhoc_game_id")
        .eq("member_id", memberId)
        .eq("booking_status", "confirmed");
      nomadGameIds = nomadBookings?.map(b => b.adhoc_game_id) || [];
    }
    
const [adhocRes, bookingsRes] = await Promise.all([
  // For Nomads (club_id 999), only fetch games where they have a confirmed booking
  isNomadRefresh
    ? (nomadGameIds.length > 0 
        ? supabase.from("adhoc_games").select("adhoc_game_id, organizer_id, club_id, course_id, game_date, tee_off_time, max_players, notes, status, cost_per_player, game_type, deleted_at, wwb_enabled, birdie_pool_fee, tee_start, is_multi_round, total_rounds, round_number, round_schedule, game_visibility, is_official, members!adhoc_games_organizer_id_fkey(member_name), courses(course_name)").in("adhoc_game_id", nomadGameIds).in("status", ["open", "full", "in_progress", "completed"]).order("game_date", { ascending: true })
        : Promise.resolve({ data: [] }))
    : supabase.from("adhoc_games").select("adhoc_game_id, organizer_id, club_id, course_id, game_date, tee_off_time, max_players, notes, status, cost_per_player, game_type, deleted_at, wwb_enabled, birdie_pool_fee, tee_start, is_multi_round, total_rounds, round_number, round_schedule, game_visibility, is_official, members!adhoc_games_organizer_id_fkey(member_name), courses(course_name)").or(`club_id.eq.${freshClubId},game_visibility.eq.public`).gte("game_date", sastYesterday).in("status", ["open", "full", "in_progress", "completed"]).is("deleted_at", null).order("game_date", { ascending: true }),
  supabase.from("adhoc_game_bookings").select("adhoc_game_id, member_id, guest_id, booking_status, cancelled_at, members(member_name), guests(guest_name, handicap_index)")
    ]);

    if (adhocRes.data) {
      const bookingCounts: Record<number, number> = {};
      const playersByGame: Record<number, { member_id: number; member_name: string }[]> = {};
      const guestsByGame: Record<number, { guest_id: number; guest_name: string; handicap_index: number | null }[]> = {};
      const cancelledByGame: Record<number, { name: string; cancelled_at: string; isGuest?: boolean }[]> = {};
      const userBookedAdhoc = new Set<number>();
      (bookingsRes.data || []).forEach((b: Record<string, unknown>) => {
        const gameId = b.adhoc_game_id as number;
        const memberInfo = b.members as { member_name: string } | null;
        const guestInfo = b.guests as { guest_name: string; handicap_index: number | null } | null;
        if (b.booking_status === "confirmed") {
          bookingCounts[gameId] = (bookingCounts[gameId] || 0) + 1;
          if (b.member_id && memberInfo?.member_name) { if (!playersByGame[gameId]) playersByGame[gameId] = []; playersByGame[gameId].push({ member_id: b.member_id as number, member_name: memberInfo.member_name }); }
          if (b.guest_id && guestInfo?.guest_name) { if (!guestsByGame[gameId]) guestsByGame[gameId] = []; guestsByGame[gameId].push({ guest_id: b.guest_id as number, guest_name: guestInfo.guest_name, handicap_index: guestInfo.handicap_index }); }
          if (Number(b.member_id) === Number(memberId)) userBookedAdhoc.add(gameId);
        } else if (b.booking_status === "cancelled" && b.cancelled_at) {
          const name = memberInfo?.member_name || guestInfo?.guest_name || "Unknown";
          if (!cancelledByGame[gameId]) cancelledByGame[gameId] = [];
          cancelledByGame[gameId].push({ name, cancelled_at: b.cancelled_at as string, isGuest: !!b.guest_id });
        }
      });
      const processedAdhoc = adhocRes.data.map((a: Record<string, unknown>) => ({
        adhoc_game_id: a.adhoc_game_id, organizer_id: a.organizer_id, course_id: a.course_id,
        course_name: (a.courses as { course_name: string } | null)?.course_name || "Unknown",
        game_date: a.game_date, tee_off_time: a.tee_off_time, max_players: a.max_players,
        notes: a.notes, status: a.status, booked_count: bookingCounts[a.adhoc_game_id as number] || 0,
        isBooked: userBookedAdhoc.has(a.adhoc_game_id as number),
        players: playersByGame[a.adhoc_game_id as number] || [],
        guests: guestsByGame[a.adhoc_game_id as number] || [],
        cancelled_players: cancelledByGame[a.adhoc_game_id as number] || [],
        cost_per_player: Number(a.cost_per_player) || 0,
        game_type: (a.game_type as string) || "IPS",
        deleted_at: (a.deleted_at as string | null) || null,
        // WWB fields — required by the competitions tab to find activeWwbGame
        wwb_enabled: (a.wwb_enabled as boolean) || false,
        birdie_pool_fee: (a.birdie_pool_fee as number | null) ?? null,
        tee_start: ((a as Record<string, unknown>).tee_start as '1' | 'split') ?? '1',
        club_id: (a.club_id as number) ?? null,
        is_multi_round: (a.is_multi_round as boolean) ?? false,
        total_rounds: (a.total_rounds as number) ?? 1,
        round_number: (a.round_number as number) ?? null,
round_schedule: (a.round_schedule as AdhocGame["round_schedule"]) ?? null,
  organizer_name: (a.members as { member_name: string } | null)?.member_name || "Unknown",
  game_visibility: (a.game_visibility as 'club' | 'public') ?? 'club',
  is_official: (a.is_official as boolean) ?? true,
  }));
      setAdhocGames(processedAdhoc);
    }

// Re-fetch pairings — include both home club games AND cross-club games where user is a participant
    // First get game IDs where user has a confirmed booking
    const { data: userBookingsRefresh } = await supabase
      .from("adhoc_game_bookings")
      .select("adhoc_game_id")
      .eq("member_id", memberId)
      .eq("booking_status", "confirmed");
    const userGameIdsRefresh = new Set((userBookingsRefresh || []).map(b => b.adhoc_game_id));
    const userGameIdsRefreshArray = [...userGameIdsRefresh];
    
    // Fetch pairings with two separate queries to avoid .or() filter issues
    // Query 1: Home club pairings (skip for Nomads - they don't have a real home club)
    const homeClubPairingsRefreshPromise = (freshClubId && !isNomadRefresh)
      ? supabase.from("pairings").select(`
          pairing_id, adhoc_game_id, fourball_number, member_id, guest_id, is_captain, 
          gross_score, points, result_submitted, playing_handicap, 
          birdies_count, eagles_count, hio_count, ladies_count, is_late, is_no_show,
          scores_submitted_at, wwb_ww, wwb_birdie, is_fourball_captain, tee_off_time, starting_hole, 
          members(member_name, club_id, golf_clubs(club_name)), 
          guests(guest_id, guest_name, handicap_index, gender, club_id, golf_clubs(club_name)),
          adhoc_games!inner(club_id, status, game_date, course_id, tee_off_time, game_visibility, is_official, courses(course_name))
        `).eq("adhoc_games.club_id", freshClubId).in("adhoc_games.status", ["open", "full", "in_progress", "completed"])
      : Promise.resolve({ data: [] });
    
    // Query 2: Cross-club pairings from user's bookings
    const userGamePairingsRefreshPromise = userGameIdsRefreshArray.length > 0
      ? supabase.from("pairings").select(`
          pairing_id, adhoc_game_id, fourball_number, member_id, guest_id, is_captain, 
          gross_score, points, result_submitted, playing_handicap, 
          birdies_count, eagles_count, hio_count, ladies_count, is_late, is_no_show,
          scores_submitted_at, wwb_ww, wwb_birdie, is_fourball_captain, tee_off_time, starting_hole, 
          members(member_name, club_id, golf_clubs(club_name)), 
          guests(guest_id, guest_name, handicap_index, gender, club_id, golf_clubs(club_name)),
          adhoc_games!inner(club_id, status, game_date, course_id, tee_off_time, game_visibility, is_official, courses(course_name))
        `).in("adhoc_game_id", userGameIdsRefreshArray).in("adhoc_games.status", ["open", "full", "in_progress", "completed"])
      : Promise.resolve({ data: [] });
    
    const [homeClubPairingsRefreshResult, userGamePairingsRefreshResult] = await Promise.all([
      homeClubPairingsRefreshPromise,
      userGamePairingsRefreshPromise
    ]);
    
    // Merge and deduplicate pairings
    const allPairingsRefreshData = [
      ...(homeClubPairingsRefreshResult.data || []),
      ...(userGamePairingsRefreshResult.data || [])
    ];
    const pairingsRefresh = Array.from(
      new Map(allPairingsRefreshData.map(p => [p.pairing_id, p])).values()
    );
    
    if (pairingsRefresh && adhocRes.data) {
      const gameMap: Record<number, { course_id: number; course_name: string; game_date: string; tee_off_time: string; course_rating: number; slope_rating: number; status: string }> = {};
      for (const a of adhocRes.data) {
        gameMap[a.adhoc_game_id as number] = { course_id: (a as Record<string, unknown>).course_id as number, course_name: ((a as Record<string, unknown>).courses as { course_name: string } | null)?.course_name || "Unknown", game_date: a.game_date as string, tee_off_time: a.tee_off_time as string, course_rating: 72, slope_rating: 113, status: (a.status as string) || "open" };
      }
      const courseIds = adhocRes.data.map((a: Record<string, unknown>) => a.course_id as number).filter(Boolean);
      if (courseIds.length > 0) {
        const { data: courseData } = await supabase.from("courses").select("course_id, course_rating, slope_rating").in("course_id", courseIds);
        if (courseData) { const courseMap: Record<number, { course_rating: number; slope_rating: number }> = {}; courseData.forEach((c: { course_id: number; course_rating: number; slope_rating: number }) => { courseMap[c.course_id] = { course_rating: c.course_rating, slope_rating: c.slope_rating }; }); adhocRes.data.forEach((a: Record<string, unknown>) => { const cid = a.course_id as number; if (courseMap[cid] && gameMap[a.adhoc_game_id as number]) { gameMap[a.adhoc_game_id as number].course_rating = courseMap[cid].course_rating; gameMap[a.adhoc_game_id as number].slope_rating = courseMap[cid].slope_rating; } }); }
      }
      const memberIds = [...new Set(pairingsRefresh.filter((p: Record<string, unknown>) => p.member_id).map((p: Record<string, unknown>) => p.member_id as number))];
      const { data: membersData } = await supabase.from("members").select("member_id, member_name, member_handicap_indices(official_handicap_index, season)").in("member_id", memberIds.length > 0 ? memberIds : [0]);
      const memberNameMap: Record<number, string> = {};
      const memberHcpMap: Record<number, number> = {};
      (membersData || []).forEach((m: Record<string, unknown>) => { memberNameMap[m.member_id as number] = m.member_name as string; const indices = m.member_handicap_indices as { official_handicap_index: number; season: string }[] | null; const currentYear = String(new Date().getFullYear()); const currentIdx = indices?.find(i => i.season === currentYear) || indices?.[0]; if (currentIdx) memberHcpMap[m.member_id as number] = currentIdx.official_handicap_index; });
      const guestNameMap: Record<number, string> = {};
      const guestHcpMap: Record<number, number> = {};
      pairingsRefresh.forEach((p: Record<string, unknown>) => { const gd = p.guests as { guest_id: number; guest_name: string; handicap_index: number | null } | null; if (gd?.guest_id) { guestNameMap[gd.guest_id] = gd.guest_name; if (gd.handicap_index != null) guestHcpMap[gd.guest_id] = gd.handicap_index; } });
      const grouped: Record<string, FourBallPairing> = {};
      pairingsRefresh.forEach((p: Record<string, unknown>) => {
        const key = `${p.adhoc_game_id}-${p.fourball_number}`;
        // First try gameMap (home club games), then use joined adhoc_games data (cross-club games)
        let gi = gameMap[p.adhoc_game_id as number];
        const joinedGame = p.adhoc_games as { club_id: number; status: string; game_date: string; course_id: number; tee_off_time: string; game_visibility: string; is_official: boolean; courses: { course_name: string } | null } | null;
        
        // If not in gameMap but user is in this game, build game info from joined data
        if (!gi && joinedGame && userGameIdsRefresh.has(p.adhoc_game_id as number)) {
          gi = {
            course_id: joinedGame.course_id,
            course_name: joinedGame.courses?.course_name || "Unknown Course",
            game_date: joinedGame.game_date,
            tee_off_time: joinedGame.tee_off_time,
            course_rating: 72,
            slope_rating: 113,
            status: joinedGame.status
          };
        }
        
        // If still no info, skip this pairing
        if (!gi) return;
        // Only drop permanently removed games
        if (gi.status === "deleted" || gi.status === "cancelled") return;
        if (!grouped[key]) { grouped[key] = { adhoc_game_id: p.adhoc_game_id as number, fourball_number: p.fourball_number as number, course_id: gi.course_id, course_name: gi.course_name, game_date: gi.game_date, tee_off_time: gi.tee_off_time, fourball_tee_time: (p.tee_off_time as string | null) ?? undefined, starting_hole: (p.starting_hole as number | null) ?? 1, course_rating: gi.course_rating, members: [], isCaptain: false, allResultsSubmitted: true }; }
        const guestJoined = p.guests as { guest_id: number; guest_name: string; handicap_index: number | null } | null;
        const pGuestId = guestJoined?.guest_id ?? (p.guest_id as number | null);
        const isGuest = !!pGuestId && !p.member_id;
        let courseHcp: number | null = null;
        if (isGuest && pGuestId) { const gIdx = guestHcpMap[pGuestId]; const gCalc = gIdx !== undefined ? Math.round(gIdx * (gi.slope_rating / 113) + (gi.course_rating - 72)) : null; courseHcp = gCalc !== null ? (myClub?.club_id === 1 ? Math.min(gCalc, 18) : gCalc) : null; }
        else { const hcpIdx = memberHcpMap[p.member_id as number]; const mCalc = hcpIdx !== undefined ? Math.round(hcpIdx * (gi.slope_rating / 113) + (gi.course_rating - 72)) : null; courseHcp = mCalc !== null ? (myClub?.club_id === 1 ? Math.min(mCalc, 18) : mCalc) : null; }
        const memberJoined = p.members as { member_name: string } | null;
        const displayName = isGuest && pGuestId ? `${guestNameMap[pGuestId] || guestJoined?.guest_name || "Guest"} (G)` : memberNameMap[p.member_id as number] || memberJoined?.member_name || "Unknown";
        const rawHcp = p.playing_handicap != null ? Number(p.playing_handicap) : null;
        const storedHcp = rawHcp !== null ? rawHcp : courseHcp;
        grouped[key].members.push({ pairing_id: p.pairing_id as number, member_id: (p.member_id as number) || -(pGuestId || 0), guest_id: isGuest ? (pGuestId ?? undefined) : undefined, member_name: displayName, is_captain: p.is_captain as boolean, gross_score: p.gross_score != null ? Number(p.gross_score) : null, points: p.points != null ? Number(p.points) : null, result_submitted: p.result_submitted as boolean, playing_handicap: storedHcp, birdies_count: p.birdies_count as number, eagles_count: p.eagles_count as number, hio_count: p.hio_count as number, ladies_count: p.ladies_count as number, is_late: (p.is_late as boolean) ?? false, is_no_show: (p.is_no_show as boolean) ?? false, scores_submitted_at: (p.scores_submitted_at as string) ?? null });
        if (p.member_id === Number(memberId) && p.is_captain) grouped[key].isCaptain = true;
        if (!p.result_submitted) grouped[key].allResultsSubmitted = false;
      });
      const allP = Object.values(grouped);
      // Persist to cache — keep today and future so in_progress / completed games remain visible
      const localTodayCache = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })).toISOString().split("T")[0];
      localStorage.setItem(`pairings_${memberId}`, JSON.stringify(allP.filter(p => p.game_date >= localTodayCache)));
      setAllGamePairings(allP);

      // Rebuild wwbOptIns from fresh pairing data so the WWB tab always has current opt-ins
      const freshWwbOptIns: Record<number, { ww: boolean; birdie: boolean }> = {};
      pairingsRefresh.forEach((p: Record<string, unknown>) => {
        if (p.pairing_id != null) {
          freshWwbOptIns[p.pairing_id as number] = {
            ww: (p.wwb_ww as boolean) ?? false,
            birdie: (p.wwb_birdie as boolean) ?? false,
          };
        }
      });
      setWwbOptIns(prev => ({ ...prev, ...freshWwbOptIns }));

      // Also refresh per-game WWB opt-ins so the competitions tab shows the correct entrant list
      if (WWB_CLUB_IDS.includes(freshClubId)) {
        const { data: freshOptIns } = await supabase
          .from("adhoc_game_wwb_optins")
          .select("adhoc_game_id, member_id, guest_id, ww, birdie");
        if (freshOptIns) {
          const freshGameOptInMap: Record<number, Record<number, { ww: boolean; birdie: boolean }>> = {};
          freshOptIns.forEach((row: { adhoc_game_id: number; member_id: number | null; guest_id: number | null; ww: boolean; birdie: boolean }) => {
            if (!freshGameOptInMap[row.adhoc_game_id]) freshGameOptInMap[row.adhoc_game_id] = {};
            const key = row.member_id ?? -(row.guest_id ?? 0);
            freshGameOptInMap[row.adhoc_game_id][key] = { ww: row.ww, birdie: row.birdie };
          });
          setGameWwbOptIns(freshGameOptInMap);
        }
      }

      const captainGameIds = new Set(allP.filter(g => g.members.some(m => m.member_id === Number(memberId) && m.is_captain)).map(g => g.adhoc_game_id));
      setMyPairings(allP.filter(g => captainGameIds.has(g.adhoc_game_id) || g.members.some(m => m.member_id === Number(memberId))).map(g => captainGameIds.has(g.adhoc_game_id) ? { ...g, isCaptain: true } : g));
    }

    // Refresh birdies/eagles/ladies with club filter
    const [birdiesRes, eaglesRes, ladiesRes] = await Promise.all([
      supabase.from("birdies").select("*").eq("member_id", memberId).eq("club_id", freshClubId),
      supabase.from("eagles").select("*").eq("member_id", memberId).eq("club_id", freshClubId),
      supabase.from("ladies").select("*").eq("member_id", memberId).eq("club_id", freshClubId),
    ]);
    if (birdiesRes.data) setBirdiesData(birdiesRes.data);
    if (eaglesRes.data) setEaglesData(eaglesRes.data);
    if (ladiesRes.data) setLadiesData(ladiesRes.data);
  }

  // Re-fetch only the current member's handicap indices from the DB and update
  // memberData, so the profile card always reflects the latest saved values
  // after an edit (profile Edit form, Manage Playing Handicaps, etc.).
  async function refreshMemberHandicap() {
    const supabase = createClient();
    const session = localStorage.getItem("member_session");
    if (!session) return;
    const sessionData = JSON.parse(session);
    const memberId: number = sessionData.member_id ?? sessionData.memberId;
    if (!memberId) return;
    const { data } = await supabase
      .from("member_handicap_indices")
      .select("official_handicap_index, remmoho_handicap_index, previous_handicap_index, season")
      .eq("member_id", memberId);
    if (data) {
      setMemberData(prev => prev ? { ...prev, member_handicap_indices: data } : prev);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
    const supabase = createClient();
    const session = localStorage.getItem("member_session");
    if (!session) { setLoading(false); return; }
    const sessionData = JSON.parse(session);
    const memberId: number = sessionData.member_id ?? sessionData.memberId;
    
    // Re-fetch member data
    const { data: member } = await supabase.from("members").select("*, member_handicap_indices(*)").eq("member_id", memberId).single();
    if (member) {
      setMemberData(member as MemberData);
    }
    // Derive club_id from the freshly fetched member first, then fall back to the
    // persisted session (which always has club_id), then myClub state, then 1.
    const freshClubId: number = (member as Record<string, unknown>)?.club_id as number || sessionData.club_id || myClub?.club_id || 1;
    const isNomadRefreshFull = freshClubId === 999;
    const refreshDateFrom = (() => { const d = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })();

    // For Nomads, first get their booked games
    let nomadGameIdsFull: number[] = [];
    if (isNomadRefreshFull) {
      const { data: nomadBookingsFull } = await supabase
        .from("adhoc_game_bookings")
        .select("adhoc_game_id")
        .eq("member_id", memberId)
        .eq("booking_status", "confirmed");
      nomadGameIdsFull = nomadBookingsFull?.map(b => b.adhoc_game_id) || [];
    }

    // Re-fetch adhoc games with full booking/player data
    const [adhocRes, bookingsRes] = await Promise.all([
      // For Nomads (club_id 999), only fetch games where they have a confirmed booking
      isNomadRefreshFull
        ? (nomadGameIdsFull.length > 0
            ? supabase.from("adhoc_games").select("adhoc_game_id, organizer_id, club_id, course_id, game_date, tee_off_time, max_players, notes, status, cost_per_player, game_type, deleted_at, wwb_enabled, birdie_pool_fee, tee_start, is_multi_round, total_rounds, round_number, round_schedule, game_visibility, is_official, members!adhoc_games_organizer_id_fkey(member_name), courses(course_name)").in("adhoc_game_id", nomadGameIdsFull).in("status", ["open", "full", "in_progress", "completed"]).order("game_date", { ascending: true })
            : Promise.resolve({ data: [] }))
        : supabase.from("adhoc_games").select("adhoc_game_id, organizer_id, club_id, course_id, game_date, tee_off_time, max_players, notes, status, cost_per_player, game_type, deleted_at, wwb_enabled, birdie_pool_fee, tee_start, is_multi_round, total_rounds, round_number, round_schedule, game_visibility, is_official, members!adhoc_games_organizer_id_fkey(member_name), courses(course_name)").or(`club_id.eq.${freshClubId},game_visibility.eq.public`).gte("game_date", refreshDateFrom).in("status", ["open", "full", "in_progress", "completed", "deleted"]).order("game_date", { ascending: true }),
      supabase.from("adhoc_game_bookings").select("adhoc_game_id, member_id, guest_id, booking_status, cancelled_at, members(member_name), guests(guest_name, handicap_index)")
    ]);
    
    if (adhocRes.data) {
      const bookingCounts: Record<number, number> = {};
      const playersByGame: Record<number, { member_id: number; member_name: string }[]> = {};
      const guestsByGame: Record<number, { guest_id: number; guest_name: string; handicap_index: number | null }[]> = {};
      const cancelledByGame: Record<number, { name: string; cancelled_at: string; isGuest?: boolean }[]> = {};
      const userBookedAdhoc = new Set<number>();
      
      (bookingsRes.data || []).forEach((b: Record<string, unknown>) => {
        const gameId = b.adhoc_game_id as number;
        const memberInfo = b.members as { member_name: string } | null;
        const guestInfo = b.guests as { guest_name: string; handicap_index: number | null } | null;
        
        if (b.booking_status === "confirmed") {
          bookingCounts[gameId] = (bookingCounts[gameId] || 0) + 1;
          if (b.member_id && memberInfo?.member_name) {
            if (!playersByGame[gameId]) playersByGame[gameId] = [];
            playersByGame[gameId].push({ member_id: b.member_id as number, member_name: memberInfo.member_name });
          }
          if (b.guest_id && guestInfo?.guest_name) {
            if (!guestsByGame[gameId]) guestsByGame[gameId] = [];
            guestsByGame[gameId].push({ guest_id: b.guest_id as number, guest_name: guestInfo.guest_name, handicap_index: guestInfo.handicap_index });
          }
          if (Number(b.member_id) === Number(memberId)) userBookedAdhoc.add(gameId);
        } else if (b.booking_status === "cancelled" && b.cancelled_at) {
          const name = memberInfo?.member_name || guestInfo?.guest_name || "Unknown";
          if (!cancelledByGame[gameId]) cancelledByGame[gameId] = [];
          cancelledByGame[gameId].push({ name, cancelled_at: b.cancelled_at as string, isGuest: !!b.guest_id });
        }
      });
      
      const processedAdhoc = adhocRes.data.map((a: Record<string, unknown>) => ({
        adhoc_game_id: a.adhoc_game_id,
        organizer_id: a.organizer_id,
        course_id: a.course_id,
        course_name: (a.courses as { course_name: string } | null)?.course_name || "Unknown",
        game_date: a.game_date,
        tee_off_time: a.tee_off_time,
        max_players: a.max_players,
        notes: a.notes,
        status: a.status,
        booked_count: bookingCounts[a.adhoc_game_id as number] || 0,
        isBooked: userBookedAdhoc.has(a.adhoc_game_id as number),
        players: playersByGame[a.adhoc_game_id as number] || [],
        guests: guestsByGame[a.adhoc_game_id as number] || [],
        cancelled_players: cancelledByGame[a.adhoc_game_id as number] || [],
        cost_per_player: Number(a.cost_per_player) || 0,
        game_type: (a.game_type as string) || "IPS",
        deleted_at: (a.deleted_at as string | null) || null,
        wwb_enabled: (a.wwb_enabled as boolean) || false,
        birdie_pool_fee: (a.birdie_pool_fee as number | null) ?? null,
        tee_start: ((a as Record<string, unknown>).tee_start as '1' | 'split') ?? '1',
        club_id: (a.club_id as number) ?? null,
        organizer_name: (a.members as { member_name: string } | null)?.member_name || "Unknown",
        is_multi_round: (a.is_multi_round as boolean) ?? false,
        total_rounds: (a.total_rounds as number) ?? 1,
        round_number: (a.round_number as number) ?? null,
        round_schedule: (a.round_schedule as AdhocGame["round_schedule"]) ?? null,
      }));
      setAdhocGames(processedAdhoc);
    }
    
    // Re-fetch pairings — scoped to this club only (joined-table column filters are ignored by
    // the Supabase JS client, so we filter client-side after fetch using the gameMap).
    const { data: pairingsRefresh } = await supabase
      .from("pairings")
      .select("pairing_id, adhoc_game_id, fourball_number, member_id, guest_id, is_captain, gross_score, points, result_submitted, playing_handicap, birdies_count, eagles_count, hio_count, ladies_count, is_late, is_no_show, scores_submitted_at, wwb_ww, wwb_birdie, is_fourball_captain, tee_off_time, starting_hole, members(member_name), guests(guest_id, guest_name, handicap_index, gender, club_id, golf_clubs(club_name)), adhoc_games!inner(club_id)")
      .eq("adhoc_games.club_id", freshClubId);
    
    if (pairingsRefresh && adhocRes.data) {
      // Build adhoc game map for course info
      const gameMap: Record<number, { course_id: number; course_name: string; game_date: string; tee_off_time: string; course_rating: number; slope_rating: number; status: string }> = {};
      for (const a of adhocRes.data) {
        gameMap[a.adhoc_game_id as number] = {
          course_id: (a as Record<string, unknown>).course_id as number,
          course_name: ((a as Record<string, unknown>).courses as { course_name: string } | null)?.course_name || "Unknown",
          game_date: a.game_date as string,
          tee_off_time: a.tee_off_time as string,
          course_rating: 72,
          slope_rating: 113,
          status: (a.status as string) || "open"
        };
      }
      // Fetch course info for ratings
      const courseIds = adhocRes.data.map((a: Record<string, unknown>) => a.course_id as number).filter(Boolean);
      if (courseIds.length > 0) {
        const { data: courseData } = await supabase.from("courses").select("course_id, course_rating, slope_rating").in("course_id", courseIds);
        if (courseData) {
          const courseMap: Record<number, { course_rating: number; slope_rating: number }> = {};
          courseData.forEach((c: { course_id: number; course_rating: number; slope_rating: number }) => { courseMap[c.course_id] = { course_rating: c.course_rating, slope_rating: c.slope_rating }; });
          adhocRes.data.forEach((a: Record<string, unknown>) => {
            const cid = a.course_id as number;
            if (courseMap[cid] && gameMap[a.adhoc_game_id as number]) {
              gameMap[a.adhoc_game_id as number].course_rating = courseMap[cid].course_rating;
              gameMap[a.adhoc_game_id as number].slope_rating = courseMap[cid].slope_rating;
            }
          });
        }
      }
      // Fetch member and guest names
      const memberIds = [...new Set(pairingsRefresh.filter(p => p.member_id).map(p => p.member_id))];
      
      const { data: membersData } = await supabase.from("members").select("member_id, member_name, member_handicap_indices(official_handicap_index, season)").in("member_id", memberIds.length > 0 ? memberIds : [0]);
      
      const memberNameMap: Record<number, string> = {};
      const memberHcpMap: Record<number, number> = {};
      (membersData || []).forEach((m: Record<string, unknown>) => {
        memberNameMap[m.member_id as number] = m.member_name as string;
        const indices = m.member_handicap_indices as { official_handicap_index: number; season: string }[] | null;
        // Use current season index, falling back to most recent
        const currentYear = String(new Date().getFullYear());
        const currentIdx = indices?.find(i => i.season === currentYear) || indices?.[0];
        if (currentIdx) memberHcpMap[m.member_id as number] = currentIdx.official_handicap_index;
      });
      // Build guest maps from joined guest data
      const guestNameMap: Record<number, string> = {};
      const guestHcpMap: Record<number, number> = {};
      pairingsRefresh.forEach((p: Record<string, unknown>) => {
        const guestData = p.guests as { guest_id: number; guest_name: string; handicap_index: number | null } | null;
        if (guestData && guestData.guest_id) {
          guestNameMap[guestData.guest_id] = guestData.guest_name;
          if (guestData.handicap_index != null) guestHcpMap[guestData.guest_id] = guestData.handicap_index;
        }
      });
      
      const grouped: Record<string, FourBallPairing> = {};
      pairingsRefresh.forEach(p => {
        const key = `${p.adhoc_game_id}-${p.fourball_number}`;
        const gi = gameMap[p.adhoc_game_id];
        if (!gi) return;
        // Only skip permanently removed games — keep in_progress and completed so
        // the live leaderboard and WWB tab remain populated during and after play
        if (gi.status === "deleted" || gi.status === "cancelled") return;
  if (!grouped[key]) {
    grouped[key] = { adhoc_game_id: p.adhoc_game_id, fourball_number: p.fourball_number, course_id: gi.course_id, course_name: gi.course_name, game_date: gi.game_date, tee_off_time: gi.tee_off_time, fourball_tee_time: (p.tee_off_time as string | null) ?? undefined, course_rating: gi.course_rating, members: [], isCaptain: false, allResultsSubmitted: true };
  }
        const guestJoined = (p as Record<string, unknown>).guests as { guest_id: number; guest_name: string; handicap_index: number | null } | null;
        const pGuestId = guestJoined?.guest_id ?? ((p as Record<string, unknown>).guest_id as number | null);
        const isGuest = !!pGuestId && !p.member_id;
        let courseHcp: number | null = null;
        if (isGuest && pGuestId) {
          const gIdx = guestHcpMap[pGuestId];
          const gCalc = gIdx !== undefined ? Math.round(gIdx * (gi.slope_rating / 113) + (gi.course_rating - 72)) : null;
          courseHcp = gCalc !== null ? (myClub?.club_id === 1 ? Math.min(gCalc, 18) : gCalc) : null;
        } else {
          const hcpIdx = memberHcpMap[p.member_id];
          const mCalc = hcpIdx !== undefined ? Math.round(hcpIdx * (gi.slope_rating / 113) + (gi.course_rating - 72)) : null;
          courseHcp = mCalc !== null ? (myClub?.club_id === 1 ? Math.min(mCalc, 18) : mCalc) : null;
        }
        const memberJoined = (p as Record<string, unknown>).members as { member_name: string } | null;
        const displayName = isGuest && pGuestId
          ? `${guestNameMap[pGuestId] || guestJoined?.guest_name || "Guest"} (G)`
          : memberNameMap[p.member_id] || memberJoined?.member_name || "Unknown";
        const rawHcpR = p.playing_handicap != null ? Number(p.playing_handicap) : null;
        const storedHcpR = rawHcpR !== null ? rawHcpR : courseHcp;
        grouped[key].members.push({ pairing_id: p.pairing_id, member_id: p.member_id || -(pGuestId || 0), guest_id: isGuest ? (pGuestId ?? undefined) : undefined, member_name: displayName, is_captain: p.is_captain, gross_score: p.gross_score != null ? Number(p.gross_score) : null, points: p.points != null ? Number(p.points) : null, result_submitted: p.result_submitted, playing_handicap: storedHcpR, birdies_count: p.birdies_count, eagles_count: p.eagles_count, hio_count: p.hio_count, ladies_count: p.ladies_count, is_late: p.is_late ?? false, is_no_show: p.is_no_show ?? false, scores_submitted_at: p.scores_submitted_at ?? null });
        if (p.member_id === Number(memberId) && p.is_captain) grouped[key].isCaptain = true;
        if (!p.result_submitted) grouped[key].allResultsSubmitted = false;
      });
      
      const allP = Object.values(grouped);
      setAllGamePairings(allP);
      
      // Check if current member is a captain in any fourball
      const captainGameIds = new Set(
        allP.filter(g => g.members.some(m => m.member_id === Number(memberId) && m.is_captain)).map(g => g.adhoc_game_id)
      );
      setMyPairings(
        allP
          .filter(g => captainGameIds.has(g.adhoc_game_id) || g.members.some(m => m.member_id === Number(memberId)))
          .map(g => captainGameIds.has(g.adhoc_game_id) ? { ...g, isCaptain: true } : g)
      );
      
      // Update live scores — use SAST date to avoid UTC midnight off-by-one
      if (allP.length > 0) {
        const sastToday = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })).toISOString().split("T")[0];
        
        // PRIORITY 1: Find games where current member is in pairings (playing in any club's game)
        const memberGamesPolling = allP.filter(p => 
          p.members.some(m => m.member_id === memberData?.member_id) &&
          p.game_date >= sastToday &&
          adhocGames.find(g => g.adhoc_game_id === p.adhoc_game_id)?.status !== "completed"
        );
        
        let targetP: typeof allP = [];
        if (memberGamesPolling.length > 0) {
          // Use member's own games
          const sortedMemberGamesPolling = [...memberGamesPolling].sort((a, b) => {
            const dateCompare = a.game_date.localeCompare(b.game_date);
            if (dateCompare !== 0) return dateCompare;
            return (a.tee_off_time || "00:00:00").localeCompare(b.tee_off_time || "00:00:00");
          });
          const closestMemberGameDatePolling = sortedMemberGamesPolling[0].game_date;
          targetP = allP.filter(p => p.game_date === closestMemberGameDatePolling);
        } else {
          // Fall back to home club games on today or most recent
          targetP = allP.filter(p => p.game_date === sastToday);
          if (targetP.length === 0) {
            const sortedDates = [...new Set(allP.map(p => p.game_date))].sort();
            if (sortedDates.length > 0) targetP = allP.filter(p => p.game_date === sortedDates[sortedDates.length - 1]);
          }
        }
        
        if (targetP.length > 0) {
          const sameDayIds = [...new Set(targetP.map(p => p.adhoc_game_id))].sort((a, b) => {
            const aTee = targetP.find(p => p.adhoc_game_id === a)?.tee_off_time || "00:00:00";
            const bTee = targetP.find(p => p.adhoc_game_id === b)?.tee_off_time || "00:00:00";
            return aTee.localeCompare(bTee);
          });
          const liveGameId = sameDayIds[0];
          const liveP = targetP.find(p => p.adhoc_game_id === liveGameId)!;
          const liveCourseId = liveP.course_id;
          const liveGameDate = liveP.game_date;

          // Only update liveScoreGameInfo if it is not already set to an active game
          // (prevents wiping the user's current game context mid-session)
          setLiveScoreGameInfo(prev => {
            if (prev?.adhoc_game_id && sameDayIds.includes(prev.adhoc_game_id)) {
              // Keep the user's current game choice — only refresh metadata like totals
              return { ...prev, total_games_today: sameDayIds.length, all_same_day_game_ids: sameDayIds };
            }
            const activeGame = adhocGames.find(g => g.adhoc_game_id === liveGameId);
            return { course_name: liveP.course_name, game_date: liveP.game_date, adhoc_game_id: liveGameId, course_id: liveCourseId, format: activeGame?.game_type || "Stableford", game_number: 1, total_games_today: sameDayIds.length, all_same_day_game_ids: sameDayIds, tee_off_time: liveP.tee_off_time || null, organizer_id: activeGame?.organizer_id };
          });

          // Always refresh liveScores for the current active game
          setLiveScores(prev => {
            // Determine which game is currently active
            const activeGameId = liveGameId;
            const freshScores = targetP
              .filter(p => p.adhoc_game_id === activeGameId)
              .flatMap(p => p.members.map(m => ({ member_name: m.member_name, member_id: m.member_id, points: m.points, gross_score: m.gross_score, fourball_number: p.fourball_number, result_submitted: m.result_submitted })));
            // If scores already exist in state and have unsaved data (result_submitted=false),
            // merge DB values for submitted entries only; leave unsubmitted entries untouched
            if (prev.length > 0) {
              return prev.map(ps => {
                const fresh = freshScores.find(f => f.member_id === ps.member_id && f.fourball_number === ps.fourball_number);
                if (!fresh) return ps;
                // If DB now has submitted=true, take DB values; otherwise keep in-memory state
                return fresh.result_submitted ? fresh : { ...ps, result_submitted: fresh.result_submitted };
              });
            }
            return freshScores;
          });

          if (liveGameId && liveCourseId) {
            const [{ data: holesData }, { data: scoresData }, { data: guestScoresData }] = await Promise.all([
              supabase.from("course_holes").select("hole_number, par, stroke_index").eq("course_id", liveCourseId).order("hole_number"),
              supabase.from("hole_scores").select("pairing_id, hole_number, strokes").eq("adhoc_game_id", liveGameId),
              supabase.from("guest_hole_scores").select("pairing_id, hole_number, strokes").eq("course_id", liveCourseId).eq("game_date", liveGameDate)
            ]);
            if (holesData && holesData.length > 0) {
              setCourseHoles(holesData);
              setCourseHolesFound(true);
            } else {
              setCourseHoles(Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, stroke_index: i + 1 })));
              setCourseHolesFound(false);
            }
            const freshScoreMap: Record<number, Record<number, number | null>> = {};
            // Add member scores
            if (scoresData) {
              scoresData.forEach(s => {
                if (!freshScoreMap[s.pairing_id]) freshScoreMap[s.pairing_id] = {};
                freshScoreMap[s.pairing_id][s.hole_number] = s.strokes;
              });
            }
            // Add guest scores
            if (guestScoresData) {
              guestScoresData.forEach(s => {
                if (!freshScoreMap[s.pairing_id]) freshScoreMap[s.pairing_id] = {};
                freshScoreMap[s.pairing_id][s.hole_number] = s.strokes;
              });
            }
            // Merge: keep any in-memory holes that are not yet saved to DB (absent from freshScoreMap)
            setHoleScoreData(prev => {
              const merged: Record<number, Record<number, number | null>> = { ...freshScoreMap };
              Object.entries(prev).forEach(([pid, holes]) => {
                const pairingId = Number(pid);
                if (!merged[pairingId]) merged[pairingId] = {};
                Object.entries(holes).forEach(([hole, strokes]) => {
                  // Only keep in-memory value if DB has no entry for this hole yet
                  if (merged[pairingId][Number(hole)] === undefined) {
                    merged[pairingId][Number(hole)] = strokes;
                  }
                });
              });
              return merged;
            });
          }
        }
      }
    }

    // Reload per-game WWB opt-ins from dedicated table
    if (WWB_CLUB_IDS.includes(freshClubId)) {
      const { data: gameOptInsRefresh } = await supabase
        .from("adhoc_game_wwb_optins")
        .select("adhoc_game_id, member_id, guest_id, ww, birdie");
      if (gameOptInsRefresh) {
        const gameOptInMap: Record<number, Record<number, { ww: boolean; birdie: boolean }>> = {};
        gameOptInsRefresh.forEach((row: { adhoc_game_id: number; member_id: number | null; guest_id: number | null; ww: boolean; birdie: boolean }) => {
          if (!gameOptInMap[row.adhoc_game_id]) gameOptInMap[row.adhoc_game_id] = {};
          const key = row.member_id ?? -(row.guest_id ?? 0);
          gameOptInMap[row.adhoc_game_id][key] = { ww: row.ww, birdie: row.birdie };
        });
        setGameWwbOptIns(gameOptInMap);
      }
    }

    setLastRefresh(new Date());
    setLoading(false);
  }

function handleLogout() {
  localStorage.removeItem("member_session");
  router.push("/login");
  }

  // Force refresh - clears all cache and reloads data from database
  async function handleForceRefresh() {
    if (forceRefreshing) return;
    setForceRefreshing(true);
    
    try {
      // 1. Clear all localStorage cache for current user only
      if (memberData?.member_id) {
        const cacheKeys = [
          `pairings_${memberData.member_id}`,
          `liveGameInfo_${memberData.member_id}`,
          `holeScores_${memberData.member_id}`,
          `adhocGames_${memberData.member_id}`,
          `wwbOptIns_${memberData.member_id}`,
          `liveScores_${memberData.member_id}`,
          `gameWwbOptIns_${memberData.member_id}`,
          `pairings_${memberData.member_id}_cached`
        ];
        cacheKeys.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            // Ignore localStorage errors
          }
        });
      }
      
      // 2. Clear all state variables
      // Game data
      setAllGamePairings([]);
      setMyPairings([]);
      setHoleScoreData({});
      setLadyHoleData({});
      setLiveScores([]);
      setLiveScoreGameInfo(null);
      setAdhocGames([]);
      setUpcomingGames([]);
      
      // WWB data
      setWwbOptIns({});
      setGameWwbOptIns({});
      setWwbHistory([]);
      setWwbResults(null);
      
      // Performance records
      setRecentGames([]);
      setRecentResults([]);
      setMemberRecentResults([]);
      setBirdiesData([]);
      setEaglesData([]);
      setLadiesData([]);
      
      // Standings (for all clubs)
      setQuarterStandings([]);
      setAnnualStandings([]);
      setMedalStandings([]);
      setQuarterLeader(null);
      setAnnualLeader(null);
      setMedalLeader(null);
      
      // Positions and points
      setCalculatedQuarterPosition(null);
      setCalculatedAnnualPosition(null);
      setCalculatedMedalPosition(null);
      setQuarterCalcPoints(0);
      setAnnualCalcPoints(0);
      setMedalYearPoints(0);
      setBirdiesPosition(null);
      setLadiesPosition(null);
      setLateCount(0);
      setNoShowCount(0);
      
      // CoC data (Club 13 only, safe for all)
      setCocTopPoints(0);
      setCocTopPlayer("");
      setCocAllChampions([]);
      setCocLoading(true);
      
      // Financial data
      setBalance(0);
      setRecentTransactions([]);
      
      // Club directory
      setMemberDirectory([]);
      setClubData([]);
      
      // Scorecard data
      setCourseHoles([]);
      setScoresSubmittedMap({});
      
      // 3. Force refresh key to trigger re-renders
      setRefreshKey(prev => prev + 1);
      
      // 4. Silent refresh to fetch latest data from database
      await handleSilentRefresh();
      
      // 5. Update last refresh timestamp
      setLastRefresh(new Date());
      
    } catch (error) {
      console.error("Force refresh error:", error);
    } finally {
      setForceRefreshing(false);
    }
  }
  
  // Quick refresh - simple refresh without cache clearing (for pull-to-refresh etc.)
  async function handleQuickRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    
    try {
      // Simple refresh - no cache clearing
      await handleSilentRefresh();
      setLastRefresh(new Date());
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }
  
  // Session heartbeat: localStorage is the source of truth for this PIN-based auth.
  // We do NOT re-validate against the DB here — a transient Supabase/network error
  // must never log out a user who has a valid local session. We only refresh the
  // timestamp so the session stays "fresh".
  function touchSession(): boolean {
    const session = localStorage.getItem("member_session");
    if (!session) return false;
    try {
      const sessionData = JSON.parse(session);
      const memberId = sessionData.member_id ?? sessionData.memberId;
      if (!memberId) return false;
      sessionData.last_validated = new Date().toISOString();
      localStorage.setItem("member_session", JSON.stringify(sessionData));
      return true;
    } catch {
      return false;
    }
  }

  // Session heartbeat effect: refresh the local session timestamp every 5 minutes.
  // Never forces a logout on failure — only the explicit "Log out" action does that.
  useEffect(() => {
    if (!memberData) return;

    const heartbeat = setInterval(() => {
      touchSession();
    }, 5 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") touchSession();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [memberData]);

  // WWB Mismatch Detection: Check for opt-ins not reflected in pairings
  // This helps organizers identify players who opted in but weren't included in fourballs
  useEffect(() => {
    if (activeTab !== "competitions") return;
    if (!WWB_CLUB_IDS.includes(myClub?.club_id ?? 0)) return;
    
    // Find active WWB game
    const activeWwbGame = adhocGames
      .filter(g => g.status !== "cancelled" && g.status !== "deleted" && g.status !== "completed")
      .find(g => g.wwb_enabled || Object.keys(gameWwbOptIns[g.adhoc_game_id] || {}).length > 0);
    
    if (!activeWwbGame) {
      setWwbOptInMismatches([]);
      return;
    }
    
    // Get opt-in member IDs from dedicated table
    const optInMemberIds = new Set(
      Object.keys(gameWwbOptIns[activeWwbGame.adhoc_game_id] || {}).map(id => String(id))
    );
    
    // Get member IDs from pairings
    const pairingMemberIds = new Set(
      allGamePairings
        .filter(p => p.adhoc_game_id === activeWwbGame.adhoc_game_id)
        .flatMap(p => p.members.map(m => String(m.member_id)))
    );
    
    // Find mismatches: opt-ins not in pairings
    const missingFromPairings = [...optInMemberIds].filter(id => !pairingMemberIds.has(id));
    
    if (missingFromPairings.length > 0) {
      console.warn("WWB opt-in members not in pairings:", missingFromPairings);
    }
    
    setWwbOptInMismatches(missingFromPairings);
  }, [activeTab, adhocGames, gameWwbOptIns, allGamePairings, myClub?.club_id]);

  // Supabase Realtime subscription for instant live updates
  useEffect(() => {
    if (!liveScoreGameInfo?.adhoc_game_id) return;
    
    const gameId = liveScoreGameInfo.adhoc_game_id;
    const supabaseClient = createClient();
    
    const channel = supabaseClient
      .channel(`hole_scores_${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hole_scores',
          filter: `adhoc_game_id=eq.${gameId}`
        },
        () => {
          setIsUpdating(true);
          handleSilentRefresh();
          setTimeout(() => setIsUpdating(false), 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pairings',
          filter: `adhoc_game_id=eq.${gameId}`
        },
        () => {
          setIsUpdating(true);
          handleSilentRefresh();
          setTimeout(() => setIsUpdating(false), 500);
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [liveScoreGameInfo?.adhoc_game_id]);

  async function handleBookGame(scheduleId: number) {
    if (!memberData) return;
    setBookingLoading(scheduleId);
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from("game_bookings")
      .insert({ schedule_id: scheduleId, member_id: memberData.member_id, booking_status: "confirmed" })
      .select("booking_id")
      .single();
    
    if (!error && data) {
      setUpcomingGames(prev => prev.map(g => {
        if (g.schedule_id !== scheduleId) return g;
        return {
          ...g,
          isBooked: true,
          booked_count: g.booked_count + 1,
          players: [...g.players, { member_id: memberData.member_id, member_name: memberData.member_name, booking_id: data.booking_id }],
        };
      }));
    }
    setBookingLoading(null);
  }

  async function handleLeaveGame(scheduleId: number) {
    if (!memberData) return;
    setBookingLoading(scheduleId);
    const supabase = createClient();
    
    // Delete the booking
    const { error } = await supabase
      .from("game_bookings")
      .delete()
      .eq("schedule_id", scheduleId)
      .eq("member_id", memberData.member_id)
      .is("guest_name", null);
    
    if (!error) {
      // Record the cancellation
      await supabase.from("annual_game_cancellations").insert({
        schedule_id: scheduleId,
        member_id: memberData.member_id,
        cancelled_by: memberData.member_id,
      });
      setUpcomingGames(prev => prev.map(g => {
        if (g.schedule_id !== scheduleId) return g;
        return {
          ...g,
          isBooked: false,
          booked_count: Math.max(0, g.booked_count - 1),
          players: g.players.filter(p => p.member_id !== memberData.member_id),
          cancelled: [{ name: memberData.member_name, cancelled_at: new Date().toISOString() }, ...g.cancelled],
        };
      }));
    }
    setBookingLoading(null);
  }

  async function handleAddAnnualGuest(scheduleId: number, gName: string, gHandicap: string) {
    if (!memberData || !gName.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("game_bookings")
      .insert({ schedule_id: scheduleId, member_id: memberData.member_id, booking_status: "confirmed", guest_name: gName.trim(), guest_handicap: gHandicap ? parseFloat(gHandicap) : null })
      .select("booking_id")
      .single();
    if (!error && data) {
      setUpcomingGames(prev => prev.map(g => {
        if (g.schedule_id !== scheduleId) return g;
        return {
          ...g,
          booked_count: g.booked_count + 1,
          guests: [...g.guests, { guest_name: gName.trim(), guest_handicap: gHandicap ? parseFloat(gHandicap) : null, booking_id: data.booking_id, booked_by: memberData.member_id }],
        };
      }));
    }
    setShowAnnualGuest(null);
    setAnnualGuestName("");
    setAnnualGuestHandicap("");
  }

  async function handleRemoveAnnualPlayer(scheduleId: number, bookingId: number, playerName: string, isGuest: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("game_bookings").delete().eq("booking_id", bookingId);
    if (!error) {
      // Track cancellation
      if (memberData) {
        await supabase.from("annual_game_cancellations").insert({
          schedule_id: scheduleId,
          guest_name: isGuest ? playerName : null,
          member_id: isGuest ? null : undefined,
          cancelled_by: memberData.member_id,
        });
      }
      setUpcomingGames(prev => prev.map(g => {
        if (g.schedule_id !== scheduleId) return g;
        return {
          ...g,
          booked_count: Math.max(0, g.booked_count - 1),
          players: isGuest ? g.players : g.players.filter(p => p.booking_id !== bookingId),
          guests: isGuest ? g.guests.filter(gu => gu.booking_id !== bookingId) : g.guests,
          cancelled: [{ name: playerName, cancelled_at: new Date().toISOString() }, ...g.cancelled],
        };
      }));
    }
  }

  const AG_COURSES = [
    "Akasia","Benoni Country Club","Blue Valley","Bryanston","Bushwillow","CCJ Woodmead","Centurion",
    "CMR","Dainfern","Eagle Canyon","Ebotse","Emfuleni","ERPM","Euphoria","Eye of Africa","Firethorn",
    "Glendower","Glenvista","Heron Banks","Houghton","Huddle Park","Jackal Creek","Killarney",
    "Krugersdorp","Kyalami","Magalies","Modderfontein","Observatory","Parkview","Pecanwood",
    "Pretoria Country Club","Pretoria Golf Club","Reading","Royal Oak","Ruimsig","Services",
    "Silverlakes","Southdowns","Soweto Country Club","State Mines","Steyn City","Wanderers",
    "Waterkloof","Wingate"
  ];

  function getDayOfWeek(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-ZA", { weekday: "long" });
  }

  async function handleCreateAnnualGame() {
    if (!agForm.game_date || !agForm.activity) return;
    setAgSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("annual_schedule").insert({
      game_date: agForm.game_date,
      day_of_week: getDayOfWeek(agForm.game_date),
      activity: agForm.activity,
      format: agForm.format,
      course_name: agForm.course_name || null,
      event_type: agForm.event_type,
      club_id: myClub?.club_id || null,
    }).select("schedule_id").single();
    if (!error && data) {
      setUpcomingGames(prev => [...prev, {
        schedule_id: data.schedule_id,
        game_date: agForm.game_date,
        day_of_week: getDayOfWeek(agForm.game_date),
        activity: agForm.activity,
        format: agForm.format,
        course_name: agForm.course_name || null,
        event_type: agForm.event_type,
        isBooked: false,
        booked_count: 0,
        players: [],
        guests: [],
        cancelled: [],
      }].sort((a, b) => a.game_date.localeCompare(b.game_date)));
      setAgForm({ game_date: "", activity: "", format: "Stableford", course_name: "", event_type: "normal" });
      setShowCreateGame(false);
    }
    setAgSaving(false);
  }

  async function handleEditAnnualGame(scheduleId: number) {
    if (!agForm.game_date || !agForm.activity) return;
    setAgSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("annual_schedule").update({
      game_date: agForm.game_date,
      day_of_week: getDayOfWeek(agForm.game_date),
      activity: agForm.activity,
      format: agForm.format,
      course_name: agForm.course_name || null,
      event_type: agForm.event_type,
    }).eq("schedule_id", scheduleId);
    if (!error) {
      setUpcomingGames(prev => prev.map(g => g.schedule_id === scheduleId ? {
        ...g,
        game_date: agForm.game_date,
        day_of_week: getDayOfWeek(agForm.game_date),
        activity: agForm.activity,
        format: agForm.format,
        course_name: agForm.course_name || null,
        event_type: agForm.event_type,
      } : g).sort((a, b) => a.game_date.localeCompare(b.game_date)));
      setEditingGame(null);
      setAgForm({ game_date: "", activity: "", format: "Stableford", course_name: "", event_type: "normal" });
    }
    setAgSaving(false);
  }

  async function handleCancelAnnualGame(scheduleId: number) {
    if (!confirm("Are you sure you want to cancel this game? All bookings will be removed.")) return;
    const supabase = createClient();
    // Delete all bookings first
    await supabase.from("game_bookings").delete().eq("schedule_id", scheduleId);
    // Delete the game
    const { error } = await supabase.from("annual_schedule").delete().eq("schedule_id", scheduleId);
    if (!error) {
      setUpcomingGames(prev => prev.filter(g => g.schedule_id !== scheduleId));
    }
  }

  async function handleFinanceSubmit() {
    if (!finMemberId || !finAmount || !finCategory) return;
    // When "Other" is selected, description is required and becomes the new category
    if (finCategory === "Other" && !finDescription.trim()) return;
    setFinSaving(true);
    setFinSuccess("");
    const supabase = createClient();
    const amount = parseFloat(finAmount);
    if (isNaN(amount) || amount <= 0) { setFinSaving(false); return; }

    // Get current balance for this member
    const { data: lastEntry } = await supabase
      .from("accounts")
      .select("balance")
      .eq("member_id", parseInt(finMemberId))
      .order("account_id", { ascending: false })
      .limit(1)
      .single();

    const currentBalance = lastEntry ? parseFloat(String(lastEntry.balance)) || 0 : 0;
    const debit = finType === "debit" ? amount : 0;
    const credit = finType === "credit" ? amount : 0;
    const newBalance = currentBalance + debit - credit;

    // If "Other", use description as the category name directly
    const isOther = finCategory === "Other";
    const description = isOther
      ? finDescription.trim()
      : finDescription.trim()
        ? `${finCategory} - ${finDescription.trim()}`
        : finCategory;

    const { error } = await supabase.from("accounts").insert({
      member_id: parseInt(finMemberId),
      transaction_date: finDate,
      description,
      debit,
      credit,
      balance: newBalance,
      club_id: myClub?.club_id || null,
    });

    if (!error) {
      const memberName = memberDirectory.find(m => m.member_id === parseInt(finMemberId))?.member_name || "Unknown";
      setFinRecentEntries(prev => [{
        member_name: memberName,
        description,
        debit,
        credit,
        balance: newBalance,
        transaction_date: finDate,
      }, ...prev].slice(0, 10));
      setFinSuccess(`R${amount.toFixed(0)} ${finType} added for ${memberName}. New balance: R${newBalance.toFixed(2)}`);
      // If "Other" was used, add the new description as a category for future use
      if (isOther && finDescription.trim()) {
        const newCat = finDescription.trim();
        setAccountCategories(prev => {
          if (prev.includes(newCat)) return prev;
          // Insert before "Other" so it's always last
          const withoutOther = prev.filter(c => c !== "Other");
          return [...withoutOther, newCat, "Other"];
        });
      }
      setFinAmount("");
      setFinDescription("");
      if (isOther) setFinCategory("");
    }
    setFinSaving(false);
  }

  // --- Generate pairings for a round from confirmed bookings ---
  async function generatePairingsForRound(adhocGameId: number) {
    const supabase = createClient();
    
    // Get all booked players for this round
    const { data: bookings } = await supabase
      .from("adhoc_game_bookings")
      .select("member_id")
      .eq("adhoc_game_id", adhocGameId)
      .eq("booking_status", "confirmed");
    
    if (!bookings || bookings.length === 0) return;
    
    const playerIds = bookings.map(b => b.member_id);
    const playerCount = playerIds.length;
    const playersPerFourball = 4;
    const numFourballs = Math.ceil(playerCount / playersPerFourball);
    
    // Simple pairing logic
    const shuffledPlayers = [...playerIds].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < numFourballs; i++) {
      const fourballPlayers = shuffledPlayers.slice(i * playersPerFourball, (i + 1) * playersPerFourball);
      
      for (let j = 0; j < fourballPlayers.length; j++) {
        await supabase
          .from("pairings")
          .insert({
            adhoc_game_id: adhocGameId,
            fourball_number: i + 1,
            member_id: fourballPlayers[j],
            is_captain: j === 0,
            result_submitted: false
          });
      }
    }
  }

  async function handleCreateAdhocGame() {
    if (!memberData || !newAdhocCourse || !newAdhocDate || !newAdhocTime) return;
    setCreatingAdhoc(true);
    const supabase = createClient();
    
    // SAFETY: Always fetch the member's actual club_id from the database
    const { data: memberClubRow } = await supabase
      .from("members")
      .select("club_id")
      .eq("member_id", memberData.member_id)
      .single();
    const verifiedClubId = memberClubRow?.club_id || null;
    
    if (!verifiedClubId) {
      alert("Unable to verify your club membership. Please try again.");
      setCreatingAdhoc(false);
      return;
    }
    
    // Generate unique group ID for multi-round games
    const multiRoundGroupId = newAdhocIsMultiRound ? `MRG_${Date.now()}_${memberData.member_id}` : null;
    
    // Get course info
    const course = courses.find(c => c.course_id === newAdhocCourse);
    
    // ============================================
    // CREATE ROUND 1
    // ============================================
const { data: firstRound, error: round1Error } = await supabase
  .from("adhoc_games")
  .insert({
  organizer_id: memberData.member_id,
  course_id: newAdhocCourse,
  game_date: newAdhocDate,
  tee_off_time: newAdhocTime,
  max_players: newAdhocMaxPlayers,
  cost_per_player: parseFloat(newAdhocCost) || 0,
  notes: newAdhocNotes || null,
  status: "open",
  game_type: newAdhocGameType,
  tee_start: newAdhocTeeStart,
  club_id: verifiedClubId,
  is_official: newAdhocIsOfficial,
  game_visibility: newAdhocIsPublic ? "public" : "club",
  is_multi_round: newAdhocIsMultiRound,
  total_rounds: newAdhocIsMultiRound ? newAdhocTotalRounds : 1,
  round_number: 1,
  multi_round_group_id: multiRoundGroupId,
  wwb_enabled: newAdhocIsOfficial && WWB_CLUB_IDS.includes(myClub?.club_id ?? 0) ? true : false,
  birdie_pool_fee: WWB_CLUB_IDS.includes(myClub?.club_id ?? 0) ? (WWB_FEES[myClub?.club_id ?? 0]?.birdie ?? 50) : null,
  })
  .select("adhoc_game_id")
  .single();
    
    if (round1Error) {
      console.error("Error creating game:", round1Error);
      alert("Failed to create game");
      setCreatingAdhoc(false);
      return;
    }
    
    const createdRounds = [firstRound.adhoc_game_id];
    
    // Auto-book the organizer for Round 1
    await supabase.from("adhoc_game_bookings").insert({
      adhoc_game_id: firstRound.adhoc_game_id,
      member_id: memberData.member_id,
      booking_status: "confirmed"
    });
    
    // ============================================
    // CREATE SUBSEQUENT ROUNDS (if multi-round)
    // ============================================
    if (newAdhocIsMultiRound && newAdhocRoundDetails.length > 0) {
      for (let i = 0; i < newAdhocRoundDetails.length; i++) {
        const rd = newAdhocRoundDetails[i];
        if (!rd.date || !rd.course_id) continue;
        
        const roundGameType = MEDAL_CLUB_IDS.includes(verifiedClubId ?? 0) ? "Medal" : (rd.game_type || newAdhocGameType);
        
        const { data: roundData, error: roundError } = await supabase
          .from("adhoc_games")
          .insert({
            organizer_id: memberData.member_id,
            course_id: Number(rd.course_id),
            game_date: rd.date,
            tee_off_time: rd.time || newAdhocTime,
            max_players: rd.max_players || newAdhocMaxPlayers,
            cost_per_player: parseFloat(rd.cost) || 0,
            notes: rd.notes || null,
            status: "open",
            game_type: roundGameType,
tee_start: (rd.tee_start || newAdhocTeeStart) as '1' | 'split',
          club_id: verifiedClubId,
is_official: newAdhocIsOfficial,
  game_visibility: newAdhocIsPublic ? "public" : "club",
  is_multi_round: true,
  total_rounds: newAdhocTotalRounds,
  round_number: i + 2,
          multi_round_group_id: multiRoundGroupId,
          wwb_enabled: newAdhocIsOfficial && WWB_CLUB_IDS.includes(verifiedClubId ?? 0),
            birdie_pool_fee: WWB_CLUB_IDS.includes(verifiedClubId ?? 0) ? (WWB_FEES[verifiedClubId ?? 0]?.birdie ?? 50) : null,
          })
          .select("adhoc_game_id")
          .single();
        
        if (roundError) {
          console.error("Error creating round", i + 2, roundError);
          continue;
        }
        
        createdRounds.push(roundData.adhoc_game_id);
        
        // Auto-book the organizer into subsequent rounds
        await supabase.from("adhoc_game_bookings").insert({
          adhoc_game_id: roundData.adhoc_game_id,
          member_id: memberData.member_id,
          booking_status: "confirmed"
        });
      }
    }
    
// Note: Pairings are generated separately by the organizer using the "Generate Pairings" button
    // after all players have been added to the game
    
    // ============================================
    // UPDATE LOCAL STATE
    // ============================================
    const newGame = {
      adhoc_game_id: firstRound.adhoc_game_id,
      organizer_id: memberData.member_id,
      organizer_name: memberData.member_name,
      course_id: newAdhocCourse,
      course_name: course?.course_name || "Unknown",
      game_date: newAdhocDate,
      tee_off_time: newAdhocTime,
      max_players: newAdhocMaxPlayers,
      notes: newAdhocNotes || null,
      status: "open",
      game_type: newAdhocGameType,
      booked_count: 1,
      isBooked: true,
      players: [{ member_id: memberData.member_id, member_name: memberData.member_name }],
      guests: [],
      cancelled_players: [],
      cost_per_player: parseFloat(newAdhocCost) || 0,
      is_multi_round: newAdhocIsMultiRound,
      total_rounds: newAdhocIsMultiRound ? newAdhocTotalRounds : 1,
      round_number: 1,
      multi_round_group_id: multiRoundGroupId
    };
    
setAdhocGames(prev => [newGame, ...prev].sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime()));
  
  // ============================================
// ============================================
  // RESET FORM
  // ============================================
  setShowCreateAdhoc(false);
    setNewAdhocCourse(null);
    setNewAdhocDate("");
    setNewAdhocTime("");
    setNewAdhocNotes("");
    setNewAdhocGameType("IPS");
    setNewAdhocMaxPlayers(4);
    setNewAdhocCost("");
    setNewAdhocIsMultiRound(false);
    setNewAdhocIsOfficial(true);
setNewAdhocIsPublic(false);
  setNewAdhocTotalRounds(2);
  setNewAdhocRoundDetails([]);
  
  setCreatingAdhoc(false);
    
    // Refresh the page data
    await handleSilentRefresh();
    
    alert(`Game created successfully! ${newAdhocIsMultiRound ? `${newAdhocTotalRounds} rounds created.` : ''}`);
  }

  async function handleBookAdhocGame(adhocGameId: number, wwbOpts?: { ww: boolean; birdie: boolean }) {
    if (!memberData) return;
    setAdhocBookingLoading(adhocGameId);
    const supabase = createClient();
    
    // Check if this is a public game from a different club
    const game = adhocGames.find(g => g.adhoc_game_id === adhocGameId);
    const isPublicGameFromOtherClub = game && game.club_id !== myClub?.club_id;
    
    if (isPublicGameFromOtherClub) {
      // Create a join request instead of direct booking
      const { error: requestError } = await supabase
        .from("game_join_requests")
        .insert({
          adhoc_game_id: adhocGameId,
          requester_id: memberData.member_id,
          organizer_id: game.organizer_id,
          status: "pending"
        });
      
      if (requestError) {
        if (requestError.code === "23505") {
          alert("You have already requested to join this game.");
        } else {
          alert("Failed to submit join request.");
        }
        setAdhocBookingLoading(null);
        return;
      }
      
      // Add to local state
      setMyJoinRequests(prev => [...prev, {
        request_id: Date.now(),
        adhoc_game_id: adhocGameId,
        organizer_name: game.organizer_name,
        game_date: game.game_date,
        course_name: game.course_name,
        status: 'pending',
        created_at: new Date().toISOString(),
        responded_at: null
      }]);
      
      alert("Join request sent! The organizer will review your request.");
      setAdhocBookingLoading(null);
      return;
    }
    
    // Check if there's an existing cancelled booking for this member (rejoin case)
    const { data: existingBookings } = await supabase
      .from("adhoc_game_bookings")
      .select("booking_id")
      .eq("adhoc_game_id", adhocGameId)
      .eq("member_id", memberData.member_id)
      .eq("booking_status", "cancelled")
      .limit(1);
    
    const hasCancelledBooking = existingBookings && existingBookings.length > 0;
    
    let error;
    if (hasCancelledBooking) {
      // Rejoin: update existing cancelled booking back to confirmed
      ({ error } = await supabase
        .from("adhoc_game_bookings")
        .update({ booking_status: "confirmed", cancelled_at: null, booked_at: new Date().toISOString() })
        .eq("booking_id", existingBookings[0].booking_id));
    } else {
      // New booking
      ({ error } = await supabase
        .from("adhoc_game_bookings")
        .insert({ adhoc_game_id: adhocGameId, member_id: memberData.member_id, booking_status: "confirmed" }));
    }
    
    if (!error) {
      const game = adhocGames.find(g => g.adhoc_game_id === adhocGameId);
      const newBookedCount = (game?.booked_count || 0) + 1;
      const isFull = game ? newBookedCount >= game.max_players : false;
      
      setAdhocGames(prev => prev.map(g => g.adhoc_game_id === adhocGameId 
        ? { 
            ...g, 
            isBooked: true, 
            booked_count: newBookedCount, 
            status: isFull ? "full" : "open", 
            players: [...(g.players || []), { member_id: memberData.member_id, member_name: memberData.member_name }],
            cancelled_players: (g.cancelled_players || []).filter(cp => cp.name !== memberData.member_name)
          } 
        : g));

      // Always silently refresh so the booking is immediately reflected for all users
      await handleSilentRefresh();

      // Save WWB opt-in to dedicated table immediately — no need to wait for pairings
      const isTuesdayClinique = myClub?.club_id === TUESDAY_CLINIQUE_ID;
      const effectiveOpts = wwbOpts ?? (isTuesdayClinique ? { ww: true, birdie: true } : null);
      if (effectiveOpts && WWB_CLUB_IDS.includes(myClub?.club_id ?? 0)) {
        const supabaseWwb = createClient();
        await supabaseWwb.from("adhoc_game_wwb_optins").upsert(
          { adhoc_game_id: adhocGameId, member_id: memberData.member_id, ww: effectiveOpts.ww, birdie: effectiveOpts.birdie },
          { onConflict: "adhoc_game_id,member_id" }
        );
        setGameWwbOptIns(prev => ({
          ...prev,
          [adhocGameId]: { ...(prev[adhocGameId] || {}), [memberData.member_id]: effectiveOpts }
        }));
        // Also update pairings table if pairing already exists
        const { data: existingPairing } = await supabaseWwb
          .from("pairings").select("pairing_id").eq("adhoc_game_id", adhocGameId).eq("member_id", memberData.member_id).maybeSingle();
        if (existingPairing?.pairing_id) {
          await supabaseWwb.from("pairings").update({ wwb_ww: effectiveOpts.ww, wwb_birdie: effectiveOpts.birdie }).eq("pairing_id", existingPairing.pairing_id);
          setWwbOptIns(prev => ({ ...prev, [existingPairing.pairing_id]: effectiveOpts }));
        }
      }
      setShowWwbJoinPrompt(null);
      setPendingWwbJoin({ ww: true, birdie: true });
    }
    setAdhocBookingLoading(null);
  }
  
  // Handle join request approval/denial
  async function handleJoinRequestResponse(requestId: number, action: 'approve' | 'deny') {
    if (!memberData) return;
    setJoinRequestProcessing(requestId);
    const supabase = createClient();
    
    const request = pendingJoinRequests.find(r => r.request_id === requestId);
    if (!request) {
      setJoinRequestProcessing(null);
      return;
    }
    
    if (action === 'approve') {
      // Add the requester with their member_id so results go to their records
      // Create booking with member_id
      const { error: bookingError } = await supabase
        .from("adhoc_game_bookings")
        .insert({ 
          adhoc_game_id: request.adhoc_game_id, 
          member_id: request.requester_id,
          booking_status: "confirmed" 
        });
      
      if (bookingError) {
        alert("Failed to add player to game.");
        setJoinRequestProcessing(null);
        return;
      }
      
      // Note: Pairings are generated separately by the organizer when ready
      
      // Update request status
      await supabase
        .from("game_join_requests")
        .update({ status: "approved", responded_at: new Date().toISOString() })
        .eq("request_id", requestId);
      
      // Refresh game data
      await handleSilentRefresh();
    } else {
      // Deny request
      await supabase
        .from("game_join_requests")
        .update({ status: "denied", responded_at: new Date().toISOString() })
        .eq("request_id", requestId);
    }
    
    // Remove from pending list
    setPendingJoinRequests(prev => prev.filter(r => r.request_id !== requestId));
    setJoinRequestProcessing(null);
  }

  async function handleCancelAdhocBooking(adhocGameId: number) {
    if (!memberData) return;
    setAdhocBookingLoading(adhocGameId);
    const supabase = createClient();
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from("adhoc_game_bookings")
      .update({ booking_status: "cancelled", cancelled_at: now })
      .eq("adhoc_game_id", adhocGameId)
      .eq("member_id", memberData.member_id);
    
    if (!error) {
      setAdhocGames(prev => prev.map(g => g.adhoc_game_id === adhocGameId 
        ? { 
            ...g, 
            isBooked: false, 
            booked_count: Math.max(0, g.booked_count - 1), 
            status: "open", 
            players: (g.players || []).filter(p => p.member_id !== memberData.member_id),
            cancelled_players: [...(g.cancelled_players || []), { name: memberData.member_name, cancelled_at: now }]
          } 
        : g));
      await handleSilentRefresh();
    }
    setAdhocBookingLoading(null);
  }

  async function handleTransferAndLeave(adhocGameId: number, newOrganizerId: number) {
    if (!memberData) return;
    setTransferringOrganizer(true);
    const supabase = createClient();
    const now = new Date().toISOString();

    // Transfer organizer role
    const { error: transferError } = await supabase
      .from("adhoc_games")
      .update({ organizer_id: newOrganizerId })
      .eq("adhoc_game_id", adhocGameId);

    if (transferError) { setTransferringOrganizer(false); return; }

    // Cancel own booking
    await supabase
      .from("adhoc_game_bookings")
      .update({ booking_status: "cancelled", cancelled_at: now })
      .eq("adhoc_game_id", adhocGameId)
      .eq("member_id", memberData.member_id);

    setAdhocGames(prev => prev.map(g => g.adhoc_game_id === adhocGameId
      ? {
          ...g,
          organizer_id: newOrganizerId,
          isBooked: false,
          booked_count: Math.max(0, g.booked_count - 1),
          players: (g.players || []).filter(p => p.member_id !== memberData.member_id),
          cancelled_players: [...(g.cancelled_players || []), { name: memberData.member_name, cancelled_at: now }]
        }
      : g));

    setNominateOrganizerGameId(null);
    setNominatedMemberId(null);
    setTransferringOrganizer(false);
    await handleSilentRefresh();
  }

  // Convert any URL or local path to a base64 data URI client-side
  async function imgToBase64(urlOrPath: string): Promise<string> {
    try {
      // Resolve local paths against current origin
      const url = urlOrPath.startsWith("/")
        ? `${window.location.origin}${urlOrPath}`
        : urlOrPath;
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) return "";
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { return ""; }
  }

  // Export pairings as text — mobile-friendly (copy to clipboard or share)
  async function handleExportPairingsAsText(game: AdhocGame) {
    const gamePairings = allGamePairings.filter(p => p.adhoc_game_id === game.adhoc_game_id).sort((a, b) => a.fourball_number - b.fourball_number);
    if (!gamePairings.length) return;

    const gameDate = new Date(game.game_date).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const courseName = game.course_name || "Unknown Course";
    const clubName = myClub?.club_name ?? "Golf Club";
    const teeStart = game.tee_start ?? '1';
    const isSplit = teeStart === 'split';

    // Build text representation
    let text = `${clubName.toUpperCase()}\n`;
    text += `Game Pairings\n`;
    text += `${courseName}\n`;
    text += `${gameDate}\n`;
    text += `${isSplit ? 'Split Tee (Holes 1 & 10)' : 'Single Tee (Hole 1)'} | ${gamePairings.length} groups | ${gamePairings.reduce((s, p) => s + p.members.length, 0)} players\n`;
    text += `${'─'.repeat(40)}\n\n`;

    // Group by starting hole if split tee
    const hole1Groups = gamePairings.filter(p => (p.starting_hole ?? 1) === 1);
    const hole10Groups = gamePairings.filter(p => (p.starting_hole ?? 1) === 10);

    const formatFourball = (p: typeof gamePairings[0]) => {
      const startingHole = p.starting_hole ?? 1;
      const teeTime = (p.fourball_tee_time ?? p.tee_off_time ?? "").slice(0, 5);
      let fb = `4BALL ${p.fourball_number} | Hole ${startingHole} | ${teeTime}\n`;
      p.members.forEach(m => {
        const captain = m.is_captain ? ' (C)' : '';
        const hcp = m.playing_handicap ?? '-';
        // Check WWB opt-ins from wwbOptIns state or from member's wwb_ww/wwb_birdie flags
        const isWwb = m.wwb_ww === true || wwbOptIns[m.pairing_id]?.ww === true;
        const isBirdie = m.wwb_birdie === true || wwbOptIns[m.pairing_id]?.birdie === true;
        const wwbTags = [isWwb ? 'WW' : '', isBirdie ? 'B' : ''].filter(Boolean).join(',');
        const wwbStr = wwbTags ? ` {${wwbTags}}` : '';
        fb += `  ${NAME_ALIASES[m.member_name] ?? m.member_name}${captain} [${hcp}]${wwbStr}\n`;
      });
      return fb;
    };

    if (isSplit) {
      if (hole1Groups.length > 0) {
        text += `── TEE: HOLE 1 ──\n\n`;
        hole1Groups.forEach(p => { text += formatFourball(p) + '\n'; });
      }
      if (hole10Groups.length > 0) {
        text += `── TEE: HOLE 10 ──\n\n`;
        hole10Groups.forEach(p => { text += formatFourball(p) + '\n'; });
      }
    } else {
      gamePairings.forEach(p => { text += formatFourball(p) + '\n'; });
    }

    text += `${'─'.repeat(40)}\n`;
    text += `Generated by MyGolf Digital`;

    // Try Web Share API first (works well on mobile), fallback to clipboard
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${clubName} - Game Pairings`,
          text: text,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall through to clipboard
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      alert('Pairings copied to clipboard!');
    } catch {
      // Final fallback: show in a prompt for manual copy
      prompt('Copy the pairings below:', text);
    }
  }

  // Export pairings — opens a print-ready window
  async function handleExportPairings(game: AdhocGame) {
    const gamePairings = allGamePairings.filter(p => p.adhoc_game_id === game.adhoc_game_id).sort((a, b) => a.fourball_number - b.fourball_number);
    if (!gamePairings.length) return;

    const teeStart = game.tee_start ?? '1';
    const gameDate = new Date(game.game_date).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const courseName = game.course_name || "Unknown Course";
    const clubLogoUrl = myClub?.logo_url ?? null;
    const clubName = myClub?.club_name ?? "MyGolf Digital";

    // Fetch both logos as base64 so they work in the popup's blank origin
    const [appLogoB64, clubLogoB64] = await Promise.all([
      imgToBase64("/images/mygolf-digital-logo.png"),
      clubLogoUrl ? imgToBase64(clubLogoUrl) : Promise.resolve(""),
    ]);

    // App logo always top-left
    const appLogoHtml = appLogoB64
      ? `<img src="${appLogoB64}" alt="MyGolf Digital" style="height:80px;max-width:160px;object-fit:contain;"/>`
      : `<div style="height:80px;width:160px;"></div>`;

    // Club logo top-right
    const clubLogoHtml = clubLogoB64
      ? `<img src="${clubLogoB64}" alt="${clubName}" style="height:80px;max-width:160px;object-fit:contain;"/>`
      : `<div style="height:80px;width:160px;"></div>`;

    // Helper: render a single compact fourball card
    function fourballCard(p: typeof gamePairings[0]): string {
      const startingHole = p.starting_hole ?? 1;
      const teeTime = (p.fourball_tee_time ?? p.tee_off_time ?? "").slice(0, 5);
      const playersHtml = p.members.map(m => {
        // Check WWB opt-ins from wwbOptIns state or from member's wwb_ww/wwb_birdie flags
        const isWwb = m.wwb_ww === true || wwbOptIns[m.pairing_id]?.ww === true;
        const isBirdie = m.wwb_birdie === true || wwbOptIns[m.pairing_id]?.birdie === true;
        const wwbBadge = isWwb ? '<span style="background:#dbeafe;color:#1d4ed8;font-size:6px;font-weight:700;padding:1px 3px;border-radius:2px;margin-left:3px;">WW</span>' : '';
        const birdieBadge = isBirdie ? '<span style="background:#fef3c7;color:#d97706;font-size:6px;font-weight:700;padding:1px 3px;border-radius:2px;margin-left:2px;">B</span>' : '';
        return `
        <div style="display:flex;align-items:center;gap:5px;padding:3px 8px;border-bottom:1px solid #f1f5f9;">
          ${m.is_captain ? '<span style="background:#dcfce7;color:#16a34a;font-size:7px;font-weight:700;padding:1px 4px;border-radius:2px;text-transform:uppercase;flex-shrink:0;">C</span>' : '<span style="width:20px;display:inline-block;flex-shrink:0;"></span>'}
          <span style="flex:1;font-size:10.5px;font-weight:600;color:#1e293b;">${NAME_ALIASES[m.member_name] ?? m.member_name}${wwbBadge}${birdieBadge}</span>
          <span style="font-size:9.5px;color:#64748b;white-space:nowrap;">${m.playing_handicap ?? '—'}</span>
        </div>`;
      }).join("");
      return `
        <div style="margin-bottom:5px;border:1px solid #e2e8f0;border-radius:5px;overflow:hidden;">
          <div style="display:flex;align-items:center;justify-content:space-between;background:#f8fafc;padding:3px 8px;border-bottom:1px solid #e2e8f0;">
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="background:#166534;color:#fff;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;">4BALL ${p.fourball_number}</span>
              <span style="background:${startingHole === 10 ? '#dbeafe' : '#dcfce7'};color:${startingHole === 10 ? '#1d4ed8' : '#15803d'};font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;">HOLE ${startingHole}</span>
            </div>
            <span style="font-size:10px;font-weight:700;color:#1e293b;">${teeTime}</span>
          </div>
          ${playersHtml}
        </div>`;
    }

    // For split tee: split into Hole 1 and Hole 10 columns side by side
    const isSplit = teeStart === 'split';
    const hole1Groups = gamePairings.filter(p => (p.starting_hole ?? 1) === 1);
    const hole10Groups = gamePairings.filter(p => (p.starting_hole ?? 1) === 10);

    const bodyGroupsHtml = isSplit
      ? `<div style="display:flex;gap:10px;align-items:flex-start;">
          <div style="flex:1;">
            <div style="background:#dcfce7;color:#15803d;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;padding:3px 8px;border-radius:4px;margin-bottom:6px;text-align:center;">Tee — Hole 1</div>
            ${hole1Groups.map(fourballCard).join("")}
          </div>
          <div style="width:1px;background:#e2e8f0;align-self:stretch;"></div>
          <div style="flex:1;">
            <div style="background:#dbeafe;color:#1d4ed8;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;padding:3px 8px;border-radius:4px;margin-bottom:6px;text-align:center;">Tee — Hole 10</div>
            ${hole10Groups.map(fourballCard).join("")}
          </div>
        </div>`
      : `<div style="columns:2;column-gap:10px;">${gamePairings.map(fourballCard).join("")}</div>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title></title>
  <style>
    @page { margin: 0; size: A4; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 8mm 10mm; color: #1e293b; box-sizing: border-box; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:1.5px solid #e2e8f0;">
    <div style="flex:0 0 160px;display:flex;align-items:center;justify-content:flex-start;">${appLogoHtml}</div>
    <div style="flex:1;text-align:center;padding:0 10px;">
      <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:1px;">${clubName}</div>
      <div style="font-size:15px;font-weight:800;color:#1e293b;margin-bottom:1px;">Game Pairings</div>
      <div style="font-size:11px;font-weight:600;color:#475569;margin-bottom:1px;">${courseName}</div>
      <div style="font-size:10px;color:#64748b;margin-bottom:1px;">${gameDate}</div>
      <div style="font-size:8.5px;color:#94a3b8;">
        ${isSplit ? 'Split Tee — Holes 1 &amp; 10' : 'Single Tee — Hole 1'}
        &nbsp;|&nbsp; ${gamePairings.length} groups
        &nbsp;|&nbsp; ${gamePairings.reduce((s, p) => s + p.members.length, 0)} players
      </div>
    </div>
    <div style="flex:0 0 160px;display:flex;align-items:center;justify-content:flex-end;">${clubLogoHtml}</div>
  </div>
  ${bodyGroupsHtml}
  <div style="margin-top:6px;padding-top:5px;border-top:1px solid #e2e8f0;text-align:center;font-size:7.5px;color:#cbd5e1;">
    Generated by MyGolf Digital
  </div>
</body>
</html>`;

    // Use a Blob URL instead of document.write() (deprecated, blocks bfcache).
    // This preserves the full document (DOCTYPE + html) and lets the new window load it natively.
    const blob = new Blob([html], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, "_blank", "width=900,height=700");
    if (!win) { URL.revokeObjectURL(blobUrl); return; }
    win.onload = () => {
      win.focus();
      win.print();
      URL.revokeObjectURL(blobUrl);
    };
  }

  // Utility function for API calls with retry logic and exponential backoff
  async function fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) break;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
      }
    }
    
    throw lastError || new Error(`Failed after ${maxRetries} attempts`);
  }

  async function handleGeneratePairings(adhocGameId: number, teeStart?: '1' | 'split') {
    setGeneratingPairings(adhocGameId);
    try {
      // Fetch opt-ins from the dedicated table for this game to pass to the API
      const supabase = createClient();
      const { data: optInsData } = await supabase
        .from("adhoc_game_wwb_optins")
        .select("member_id, guest_id, ww, birdie")
        .eq("adhoc_game_id", adhocGameId);
      
      // Build opt-in map to pass to API
      const optInMap: Record<string, { ww: boolean; birdie: boolean }> = {};
      (optInsData || []).forEach(oi => {
        const key = oi.member_id ? `m_${oi.member_id}` : `g_${oi.guest_id}`;
        optInMap[key] = { ww: oi.ww, birdie: oi.birdie };
      });
      
      const data = await fetchWithRetry<GeneratePairingsResponse>("/api/generate-fourballs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adhocGameId, teeStart, optIns: optInMap }),
      });
      
      if (data.pairings) {
        // Find the game metadata we already have in state
        const currentGameForPairings = adhocGames.find(g => g.adhoc_game_id === adhocGameId);
        const course = courses.find(c => c.course_id === currentGameForPairings?.course_id);
        const courseRating = course?.course_rating ?? 72;
        const slopeRating = course?.slope_rating ?? 113;

        // Build FourBallPairing objects grouped by fourball_number
        type RawPairing = {
          pairing_id: number;
          adhoc_game_id: number;
          fourball_number: number;
          member_id: number | null;
          guest_id: number | null;
          is_captain: boolean;
          playing_handicap: number | null;
          tee_off_time: string | null;
          starting_hole: number | null;
          member_name: string | null;
          guest_name: string | null;
          guest_handicap_index: number | null;
          gross_score: null;
          points: null;
          result_submitted: boolean;
          birdies_count: number;
          eagles_count: number;
          hio_count: number;
          ladies_count: number;
          is_late: boolean;
          is_no_show: boolean;
          scores_submitted_at: null;
          wwb_ww: boolean;
          wwb_birdie: boolean;
        };
        const grouped: Record<number, FourBallPairing> = {};
        (data.pairings as RawPairing[]).forEach(p => {
          const fn = p.fourball_number;
          if (!grouped[fn]) {
            grouped[fn] = {
              adhoc_game_id: adhocGameId,
              fourball_number: fn,
              course_id: currentGameForPairings?.course_id ?? 0,
              course_name: currentGameForPairings?.course_name ?? "Unknown",
              game_date: currentGameForPairings?.game_date ?? "",
              tee_off_time: currentGameForPairings?.tee_off_time ?? "",
              fourball_tee_time: p.tee_off_time ?? undefined,
              starting_hole: p.starting_hole ?? 1,
              course_rating: courseRating,
              members: [],
              isCaptain: false,
              allResultsSubmitted: false,
            };
          }
          const isGuest = !!p.guest_id && !p.member_id;
          const displayName = isGuest
            ? `${p.guest_name ?? "Guest"} (G)`
            : (p.member_name ?? "Unknown");
          grouped[fn].members.push({
            pairing_id: p.pairing_id,
            member_id: p.member_id ?? -(p.guest_id ?? 0),
            member_name: displayName,
            is_captain: p.is_captain,
            gross_score: null,
            points: null,
            result_submitted: false,
            playing_handicap: p.playing_handicap,
            birdies_count: 0,
            eagles_count: 0,
            hio_count: 0,
            ladies_count: 0,
            is_late: false,
            is_no_show: false,
            scores_submitted_at: null,
            wwb_ww: p.wwb_ww ?? false,
            wwb_birdie: p.wwb_birdie ?? false,
          });
          if (p.member_id === memberData?.member_id && p.is_captain) {
            grouped[fn].isCaptain = true;
          }
        });

        const newFourballs = Object.values(grouped);

        // Replace pairings for this game in state immediately
        setAllGamePairings(prev => [
          ...prev.filter(p => p.adhoc_game_id !== adhocGameId),
          ...newFourballs,
        ]);

        // Set liveScoreGameInfo if pairings were generated successfully
        if (currentGameForPairings && newFourballs.length > 0) {
          setLiveScoreGameInfo({
            course_name: currentGameForPairings.course_name,
            game_date: currentGameForPairings.game_date,
            adhoc_game_id: currentGameForPairings.adhoc_game_id,
            course_id: currentGameForPairings.course_id,
            format: currentGameForPairings.game_type || "Stableford",
            tee_off_time: currentGameForPairings.tee_off_time,
            game_visibility: (currentGameForPairings as { game_visibility?: 'club' | 'public' }).game_visibility,
            club_id: (currentGameForPairings as { club_id?: number }).club_id
          });
        }

        // Sync wwbOptIns state from the freshly-generated pairing wwb flags
        const freshOptIns: Record<number, { ww: boolean; birdie: boolean }> = {};
        newFourballs.forEach(fb => fb.members.forEach(m => {
          freshOptIns[m.pairing_id] = { ww: m.wwb_ww ?? false, birdie: m.wwb_birdie ?? false };
        }));
        setWwbOptIns(prev => ({ ...prev, ...freshOptIns }));

        // Confirm with a silent refresh in the background to sync all state
        await handleSilentRefresh();
        // Also switch to Live tab to show the pairings immediately
        setActiveTab("live");
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error("Failed to generate pairings:", error);
      alert("Network error. Please check your connection and try again.");
    } finally {
      setGeneratingPairings(null);
    }
  }

  // Add a club member to an adhoc game (organizer only)
  async function handleAddPlayerToAdhoc(adhocGameId: number) {
  if (!memberDirectory.length) {
    console.warn("Member directory not loaded yet");
    return;
  }
  if (!addPlayerMemberIds.length || !memberData) return;
  setAddingPlayer(true);
  const supabase = createClient();

    // Check whether pairings already exist for this game
    const hasPairings = allGamePairings.some(p => p.adhoc_game_id === adhocGameId);

    // Process each selected member
    const addedNames: string[] = [];
    for (const targetMemberId of addPlayerMemberIds) {
      // 1. Upsert the booking record
      const { data: existing } = await supabase
        .from("adhoc_game_bookings")
        .select("booking_id, booking_status")
        .eq("adhoc_game_id", adhocGameId)
        .eq("member_id", targetMemberId)
        .limit(1);

      let bookingError;
      if (existing && existing.length > 0 && existing[0].booking_status === "cancelled") {
        ({ error: bookingError } = await supabase
          .from("adhoc_game_bookings")
          .update({ booking_status: "confirmed", cancelled_at: null, booked_at: new Date().toISOString() })
          .eq("booking_id", existing[0].booking_id));
      } else if (!existing || existing.length === 0) {
        ({ error: bookingError } = await supabase
          .from("adhoc_game_bookings")
          .insert({ adhoc_game_id: adhocGameId, member_id: targetMemberId, booking_status: "confirmed" }));
      }

      if (bookingError) continue;

      const name = memberDirectory.find(m => m.member_id === targetMemberId)?.member_name;
      if (name) addedNames.push(name);

      // 2. If pairings exist, slot this player into the best available group immediately
      if (hasPairings) {
        const res = await fetch("/api/add-player-to-pairing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adhocGameId, memberId: targetMemberId }),
        });

        if (res.ok) {
          const { pairing } = await res.json();
          const game = adhocGames.find(g => g.adhoc_game_id === adhocGameId);
          const course = courses.find(c => c.course_id === game?.course_id);

          setAllGamePairings(prev => {
            const updated = [...prev];
            const groupIdx = updated.findIndex(
              p => p.adhoc_game_id === adhocGameId && p.fourball_number === pairing.fourball_number
            );
            const newMember: PairingMember = {
              pairing_id: pairing.pairing_id,
              member_id: pairing.member_id,
              member_name: pairing.member_name ?? name ?? "Unknown",
              is_captain: false,
              gross_score: null,
              points: null,
              result_submitted: false,
              playing_handicap: pairing.playing_handicap,
              birdies_count: 0,
              eagles_count: 0,
              hio_count: 0,
              ladies_count: 0,
              is_late: false,
              is_no_show: false,
              scores_submitted_at: null,
            };
            if (groupIdx >= 0) {
              // Add to existing group
              updated[groupIdx] = {
                ...updated[groupIdx],
                members: [...updated[groupIdx].members, newMember],
              };
            } else {
              // New group was created
              updated.push({
                adhoc_game_id: adhocGameId,
                fourball_number: pairing.fourball_number,
                course_id: game?.course_id ?? 0,
                course_name: game?.course_name ?? "",
                game_date: game?.game_date ?? "",
                tee_off_time: game?.tee_off_time ?? "",
                fourball_tee_time: pairing.tee_off_time,
                starting_hole: pairing.starting_hole ?? 1,
                course_rating: course?.course_rating ?? 72,
                members: [newMember],
                isCaptain: false,
                allResultsSubmitted: false,
              });
            }
            return updated;
          });
        }
      }
    }

    if (addedNames.length > 0) {
      // Save WWB opt-ins for added members
      if (WWB_CLUB_IDS.includes(myClub?.club_id ?? 0)) {
        const supabaseWwb = createClient();
        const defaultWwbOpts = { ww: true, birdie: true };
        for (const targetMemberId of addPlayerMemberIds) {
          const opts = pendingWwbAdd[targetMemberId] ?? defaultWwbOpts;
          await supabaseWwb.from("adhoc_game_wwb_optins").upsert(
            { adhoc_game_id: adhocGameId, member_id: targetMemberId, ww: opts.ww, birdie: opts.birdie },
            { onConflict: "adhoc_game_id,member_id" }
          );
          setGameWwbOptIns(prev => ({
            ...prev,
            [adhocGameId]: { ...(prev[adhocGameId] || {}), [targetMemberId]: opts }
          }));
          if (hasPairings) {
            const { data: existingPairing } = await supabaseWwb
              .from("pairings").select("pairing_id").eq("adhoc_game_id", adhocGameId).eq("member_id", targetMemberId).maybeSingle();
            if (existingPairing?.pairing_id) {
              await supabaseWwb.from("pairings").update({ wwb_ww: opts.ww, wwb_birdie: opts.birdie }).eq("pairing_id", existingPairing.pairing_id);
              setWwbOptIns(prev => ({ ...prev, [existingPairing.pairing_id]: opts }));
            }
          }
        }
      }
      // Auto-enrol players in subsequent rounds if this is a multi-round game
      const thisGame = adhocGames.find(g => g.adhoc_game_id === adhocGameId);
      if (thisGame?.is_multi_round && (thisGame.round_schedule ?? []).length > 0) {
        const supabaseRounds = createClient();
        for (const rd of thisGame.round_schedule ?? []) {
          if (!rd.date) continue;
          // Find the adhoc_game for this round (same club, same date, linked by round_schedule)
          const roundGame = adhocGames.find(g =>
            g.adhoc_game_id !== adhocGameId &&
            g.game_date === rd.date &&
            (rd.course_id ? g.course_id === rd.course_id : true)
          );
          if (!roundGame) continue;
          for (const targetMemberId of addPlayerMemberIds) {
            const { data: existingRd } = await supabaseRounds
              .from("adhoc_game_bookings")
              .select("booking_id, booking_status")
              .eq("adhoc_game_id", roundGame.adhoc_game_id)
              .eq("member_id", targetMemberId)
              .limit(1);
            if (existingRd && existingRd.length > 0 && existingRd[0].booking_status === "cancelled") {
              await supabaseRounds.from("adhoc_game_bookings")
                .update({ booking_status: "confirmed", cancelled_at: null, booked_at: new Date().toISOString() })
                .eq("booking_id", existingRd[0].booking_id);
            } else if (!existingRd || existingRd.length === 0) {
              await supabaseRounds.from("adhoc_game_bookings")
                .insert({ adhoc_game_id: roundGame.adhoc_game_id, member_id: targetMemberId, booking_status: "confirmed" });
            }
          }
        }
      }

      // Silent refresh to sync any remaining state
      await handleSilentRefresh();
    }

    setAddingPlayer(false);
    setAddPlayerMemberIds([]);
    setAddPlayerSearch("");
    setPendingWwbAdd({});
    setShowAddPlayer(null);
  }

  // Edit member details (name/contact) - for member editors
  async function handleSaveMemberEdit(memberId: number) {
    setSavingMember(true);
    const supabase = createClient();
    const updates: Record<string, string> = {};
    if (editMemberName.trim()) updates.member_name = editMemberName.trim();
    if (editMemberContact.trim()) updates.contact_number = editMemberContact.trim();
    const { error } = await supabase.from("members").update(updates).eq("member_id", memberId);
    if (!error) {
      setMemberDirectory(prev => prev.map(m => m.member_id === memberId
        ? { ...m, member_name: updates.member_name || m.member_name, contact_number: updates.contact_number || m.contact_number }
        : m));
    }
    setSavingMember(false);
    setEditingMember(null);
  }

  async function handleRemoveGuest(adhocGameId: number, guestId: number, guestName: string) {
    if (!confirm(`Remove guest "${guestName}" from this game?`)) return;
    setAdhocBookingLoading(adhocGameId);
    const supabase = createClient();
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from("adhoc_game_bookings")
      .update({ booking_status: "cancelled", cancelled_at: now })
      .eq("adhoc_game_id", adhocGameId)
      .eq("guest_id", guestId);
    
  if (!error) {
  await handleSilentRefresh();
  }
  setAdhocBookingLoading(null);
  }

  async function handleRemoveMember(adhocGameId: number, memberId: number, memberName: string) {
    if (!confirm(`Remove "${memberName}" from this game?`)) return;
    setAdhocBookingLoading(adhocGameId);
    const supabase = createClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("adhoc_game_bookings")
      .update({ booking_status: "cancelled", cancelled_at: now })
      .eq("adhoc_game_id", adhocGameId)
      .eq("member_id", memberId);

    if (!error) {
      // Update local state immediately
      setAdhocGames(prev => prev.map(g => {
        if (g.adhoc_game_id !== adhocGameId) return g;
        return {
          ...g,
          booked_count: Math.max(0, g.booked_count - 1),
          players: (g.players || []).filter(p => p.member_id !== memberId),
          cancelled_players: [
            ...(g.cancelled_players || []),
            { name: memberName, cancelled_at: now, isGuest: false },
          ],
        };
      }));
      await handleSilentRefresh();
    }
    setAdhocBookingLoading(null);
  }
  
  function startEditAdhocGame(game: AdhocGame) {
    setEditingAdhocId(game.adhoc_game_id);
    setEditAdhocCourse(game.course_id);
    setEditAdhocDate(game.game_date);
    setEditAdhocTime(game.tee_off_time);
    setEditAdhocNotes(game.notes || "");
    setEditAdhocMaxPlayers(game.max_players);
    setEditAdhocCost(game.cost_per_player?.toString() || "0");
    setEditAdhocTeeStart((game.tee_start as '1' | 'split') ?? '1');
    setEditAdhocIsOfficial(game.is_official ?? true);
    setEditAdhocIsPublic(game.game_visibility === 'public');
  }

  function cancelEditAdhocGame() {
    setEditingAdhocId(null);
    setEditAdhocCourse(null);
    setEditAdhocDate("");
    setEditAdhocTime("");
    setEditAdhocNotes("");
    setEditAdhocMaxPlayers(4);
    setEditAdhocCost("");
    setEditAdhocTeeStart('1');
    setEditAdhocIsOfficial(true);
    setEditAdhocIsPublic(false);
  }

  async function handleCancelAdhocGame(adhocGameId: number) {
    if (!memberData) return;
    if (!confirm("Are you sure you want to cancel this game? The game will be marked as cancelled.")) return;
    
    setDeletingAdhocId(adhocGameId);
    const supabase = createClient();
    
    // Soft-cancel: update status to 'cancelled' and set deleted_at timestamp
    const { error } = await supabase
      .from("adhoc_games")
      .update({ status: "cancelled", deleted_at: new Date().toISOString() })
      .eq("adhoc_game_id", adhocGameId)
      .eq("organizer_id", memberData.member_id);
    
    if (!error) {
      await handleSilentRefresh();
    }
    setDeletingAdhocId(null);
  }

  async function handleSaveAdhocGame() {
    if (!memberData || !editingAdhocId || !editAdhocCourse || !editAdhocDate || !editAdhocTime) return;
    setSavingAdhoc(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from("adhoc_games")
      .update({
        course_id: editAdhocCourse,
        game_date: editAdhocDate,
        tee_off_time: editAdhocTime,
        max_players: editAdhocMaxPlayers,
        cost_per_player: parseFloat(editAdhocCost) || 0,
        notes: editAdhocNotes || null,
        tee_start: editAdhocTeeStart,
        is_official: editAdhocIsOfficial,
        game_visibility: editAdhocIsPublic ? 'public' : 'club'
      })
      .eq("adhoc_game_id", editingAdhocId)
      .eq("organizer_id", memberData.member_id);
    
    if (!error) {
      const course = courses.find(c => c.course_id === editAdhocCourse);
      const currentGame = adhocGames.find(g => g.adhoc_game_id === editingAdhocId);
      const isFull = currentGame ? currentGame.booked_count >= editAdhocMaxPlayers : false;
      
      setAdhocGames(prev => prev.map(g => g.adhoc_game_id === editingAdhocId 
        ? { 
            ...g, 
            course_id: editAdhocCourse,
            course_name: course?.course_name || "Unknown",
            game_date: editAdhocDate,
            tee_off_time: editAdhocTime,
            max_players: editAdhocMaxPlayers,
            cost_per_player: parseFloat(editAdhocCost) || 0,
            notes: editAdhocNotes || null,
            tee_start: editAdhocTeeStart,
            status: isFull ? "full" : "open",
            is_official: editAdhocIsOfficial,
            game_visibility: editAdhocIsPublic ? 'public' : 'club'
          } 
        : g).sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime()));
      
      // Always refresh after edit so pairings reflect the updated game_date, tee_off_time and course
      cancelEditAdhocGame();
      await handleSilentRefresh();
    }
    setSavingAdhoc(false);
  }

  function openResultsInput(pairing: FourBallPairing) {
    setShowResultsInput(pairing.fourball_number);
    const initialData: Record<number, { gross_score: string; points: string; playing_handicap: string; birdies_count: string; eagles_count: string; hio_count: string; ladies_count: string; is_late: boolean; is_no_show: boolean }> = {};
    
    pairing.members.forEach(m => {
      // Use existing values from the pairing, default to "0" not ""
      initialData[m.pairing_id] = {
        gross_score: m.gross_score?.toString() || "0",
        points: m.points?.toString() || "0",
        playing_handicap: m.playing_handicap?.toString() || "0",
        birdies_count: m.birdies_count?.toString() || "0",
        eagles_count: m.eagles_count?.toString() || "0",
        hio_count: m.hio_count?.toString() || "0",
        ladies_count: m.ladies_count?.toString() || "0",
        is_late: m.is_late || false,
        is_no_show: m.is_no_show || false
      };
    });
    
    setResultsData(initialData);
  }

// --- Hole-by-Hole Scoring Functions ---
  async function openScorecard(adhocGameId: number, courseId: number) {
  // Prevent duplicate calls for the same game. Use the ref (synchronous) so a
  // second call fired in the same render cycle is blocked immediately.
  if (openingScorecardRef.current === adhocGameId) {
    return;
  }

  openingScorecardRef.current = adhocGameId;
  setOpeningScorecard(adhocGameId);
  
  try {
  const supabase = createClient();
  
  // FIXED: Use maybeSingle() instead of single() to avoid errors
  const { data: game, error: gameError } = await supabase
  .from("adhoc_games")
  .select(`
  adhoc_game_id,
  course_id,
  game_date,
  round_number,
  tee_off_time,
  courses (course_name)
  `)
  .eq("adhoc_game_id", adhocGameId)
  .maybeSingle();
  
  if (gameError || !game) {
  console.error(`Game ${adhocGameId} not found:`, gameError);
  // Don't show alert, just return silently
  openingScorecardRef.current = null;
  setOpeningScorecard(null);
  return;
  }
  
  const actualCourseId = game.course_id;
  const courseName = (game.courses as { course_name: string } | null)?.course_name || "Unknown Course";
  
  console.log(`[v0] Loading Round ${game.round_number}: ${courseName} (course_id: ${actualCourseId})`);
  
  // Reset state
      setScorecardGameId(null);
      setShowScorecard(false);
      setCourseHoles([]);
      setHoleScoreData({});
      setLadyHoleData({});
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      setScorecardGameId(adhocGameId);
      setScorecardNine("front");
      setActiveHole(1);
      
      await loadLadiesStrokeIndices(actualCourseId);
      
      const { data: holes, error: holesError } = await supabase
        .from("course_holes")
        .select("hole_number, par, stroke_index, ladies_stroke_index")
        .eq("course_id", actualCourseId)
        .order("hole_number");
      
      if (holesError) {
        console.error("Error loading holes:", holesError);
        setCourseHoles(Array.from({ length: 18 }, (_, i) => ({ 
          hole_number: i + 1, 
          par: 4, 
          stroke_index: i + 1,
          ladies_stroke_index: null
        })));
        setCourseHolesFound(false);
      } else if (holes && holes.length > 0) {
        console.log(`[v0] Loaded ${holes.length} holes for course ${actualCourseId}`);
        setCourseHoles(holes);
        setCourseHolesFound(true);
      } else {
        setCourseHoles(Array.from({ length: 18 }, (_, i) => ({ 
          hole_number: i + 1, 
          par: 4, 
          stroke_index: i + 1,
          ladies_stroke_index: null
        })));
        setCourseHolesFound(false);
      }
      
      setEditCourseId(actualCourseId);
      
      const [{ data: scoresData }, { data: guestScoresData }] = await Promise.all([
        supabase.from("hole_scores").select("pairing_id, hole_number, strokes").eq("adhoc_game_id", adhocGameId),
        supabase.from("guest_hole_scores").select("pairing_id, hole_number, strokes").eq("course_id", actualCourseId).eq("game_date", game.game_date)
      ]);
      
      const scoreMap: Record<number, Record<number, number | null>> = {};
      
      if (scoresData) {
        scoresData.forEach(s => {
          if (!scoreMap[s.pairing_id]) scoreMap[s.pairing_id] = {};
          scoreMap[s.pairing_id][s.hole_number] = s.strokes;
        });
      }
      
      if (guestScoresData) {
        guestScoresData.forEach(s => {
          if (!scoreMap[s.pairing_id]) scoreMap[s.pairing_id] = {};
          scoreMap[s.pairing_id][s.hole_number] = s.strokes;
        });
      }
      
      setHoleScoreData(scoreMap);
      setShowScorecard(true);

      // ALWAYS sync liveScoreGameInfo to the game that was just loaded. The Live tab
      // resolves the scorecard's course_id from liveScoreGameInfo, so its adhoc_game_id
      // and course_id MUST match scorecardGameId or the render gate fails and the loaded
      // scorecard never shows. We spread prev first to preserve the richer fields
      // (round tabs, same-day game ids, format) populated by the main dashboard load.
      setLiveScoreGameInfo(prev => ({
        ...(prev || {}),
        course_name: courseName,
        game_date: game.game_date,
        adhoc_game_id: adhocGameId,
        course_id: actualCourseId,
        tee_off_time: game.tee_off_time ?? null,
      }));

      // CRITICAL: the scorecard JSX lives inside the per-round leaderboard Card, which
      // returns null while liveRoundTab === "summary" (line ~12186). If the user is on
      // the Summary tab when a scorecard opens, that whole Card — and the scorecard with
      // it — is removed from the tree, so the scorecard never renders despite loading.
      // Switch the active round tab to the round we just opened so the Card renders.
      if (game.is_multi_round) {
        setLiveRoundTab(game.round_number ?? 1);
      }

      console.log(`[v0] Scorecard loaded for Round ${game.round_number}: ${courseName}`);
      
} catch (error) {
  console.error("Failed to open scorecard:", error);
  // Don't show alert for missing games - just log and return
  } finally {
  openingScorecardRef.current = null;
  setOpeningScorecard(null);
  }
  }

  // Debounce utility
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Retry utility for database operations
  async function saveWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delayMs = 1000
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          console.error("Save failed after retries:", error);
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
    return null;
  }

  // Pending saves queue for debounced operations
  const pendingSaves = useRef<Record<string, { pairingId: number; adhocGameId: number; memberId: number; holeNumber: number; strokes: number | null; isLady?: boolean }>>({});

  // Debounced save function - updates local state immediately, debounces DB writes
  const debouncedSaveHoleScore = useCallback(
    (pairingId: number, adhocGameId: number, memberId: number, holeNumber: number, strokes: number | null, isLady?: boolean) => {
      const key = `${pairingId}-${holeNumber}`;
      
      // Immediately update local state (optimistic update)
      setHoleScoreData(prev => {
        const updated = { ...prev, [pairingId]: { ...(prev[pairingId] || {}), [holeNumber]: strokes } };
        if (typeof window !== "undefined" && memberData?.member_id) {
          localStorage.setItem(`holeScores_${memberData.member_id}`, JSON.stringify(updated));
        }
        return updated;
      });
      
      if (isLady !== undefined) {
        setLadyHoleData(prev => ({ ...prev, [pairingId]: { ...(prev[pairingId] || {}), [holeNumber]: isLady } }));
      }
      
      // Store pending save data
      pendingSaves.current[key] = { pairingId, adhocGameId, memberId, holeNumber, strokes, isLady };
      
      // Clear existing timer for this key
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }
      
      // Set new debounced timer (2 seconds)
      debounceTimers.current[key] = setTimeout(async () => {
        const saveData = pendingSaves.current[key];
        if (!saveData) return;
        
        delete pendingSaves.current[key];
        delete debounceTimers.current[key];
        
        setSavingHoleScore(true);
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        
        if (saveData.strokes !== null) {
          await saveWithRetry(() => 
            supabase.from("hole_scores").upsert({
              pairing_id: saveData.pairingId,
              adhoc_game_id: saveData.adhocGameId,
              member_id: saveData.memberId,
              hole_number: saveData.holeNumber,
              strokes: saveData.strokes,
              is_lady: saveData.isLady ?? (ladyHoleData[saveData.pairingId]?.[saveData.holeNumber] ?? false),
              updated_at: new Date().toISOString()
            }, { onConflict: "pairing_id,hole_number" })
          );
        } else {
          await saveWithRetry(() =>
            supabase.from("hole_scores").delete().eq("pairing_id", saveData.pairingId).eq("hole_number", saveData.holeNumber)
          );
          setLadyHoleData(prev => {
            const updated = { ...prev, [saveData.pairingId]: { ...(prev[saveData.pairingId] || {}) } };
            delete updated[saveData.pairingId][saveData.holeNumber];
            return updated;
          });
        }
        setSavingHoleScore(false);
      }, 2000);
    },
    [memberData?.member_id, ladyHoleData]
  );

  // Original saveHoleScore - kept for immediate saves when needed
  async function saveHoleScore(pairingId: number, adhocGameId: number, memberId: number, holeNumber: number, strokes: number | null, isLady?: boolean) {
    setSavingHoleScore(true);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // Optimistically update local state and persist to localStorage
    setHoleScoreData(prev => {
      const updated = { ...prev, [pairingId]: { ...(prev[pairingId] || {}), [holeNumber]: strokes } };
      if (typeof window !== "undefined" && memberData?.member_id) {
        localStorage.setItem(`holeScores_${memberData.member_id}`, JSON.stringify(updated));
      }
      return updated;
    });

    if (isLady !== undefined) {
      setLadyHoleData(prev => ({ ...prev, [pairingId]: { ...(prev[pairingId] || {}), [holeNumber]: isLady } }));
    }
    
    if (strokes !== null) {
      await supabase.from("hole_scores").upsert({
        pairing_id: pairingId,
        adhoc_game_id: adhocGameId,
        member_id: memberId,
        hole_number: holeNumber,
        strokes,
        is_lady: isLady ?? (ladyHoleData[pairingId]?.[holeNumber] ?? false),
        updated_at: new Date().toISOString()
      }, { onConflict: "pairing_id,hole_number" });
    } else {
      await supabase.from("hole_scores").delete().eq("pairing_id", pairingId).eq("hole_number", holeNumber);
      setLadyHoleData(prev => {
        const updated = { ...prev, [pairingId]: { ...(prev[pairingId] || {}) } };
        delete updated[pairingId][holeNumber];
        return updated;
      });
    }
    setSavingHoleScore(false);
  }

  async function savePlayingHandicap(pairingId: number, hcp: number) {
    setSavingHcp(true);
    const supabase = createClient();
    await supabase.from("pairings").update({ playing_handicap: hcp }).eq("pairing_id", pairingId);
    const updateMembers = (g: FourBallPairing) => ({
      ...g,
      members: g.members.map(m => m.pairing_id === pairingId ? { ...m, playing_handicap: hcp } : m)
    });
    setAllGamePairings(prev => prev.map(updateMembers));
    setMyPairings(prev => prev.map(updateMembers));
    setEditingHcpPairingId(null);
    setEditingHcpValue("");
    setSavingHcp(false);
  }

  async function saveLadyFlag(pairingId: number, adhocGameId: number, memberId: number, holeNumber: number, isLady: boolean) {
    setLadyHoleData(prev => ({ ...prev, [pairingId]: { ...(prev[pairingId] || {}), [holeNumber]: isLady } }));
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const currentStrokes = holeScoreData[pairingId]?.[holeNumber];
    if (currentStrokes != null) {
      await supabase.from("hole_scores").upsert({
        pairing_id: pairingId,
        adhoc_game_id: adhocGameId,
        member_id: memberId,
        hole_number: holeNumber,
        strokes: currentStrokes,
        is_lady: isLady,
        updated_at: new Date().toISOString()
      }, { onConflict: "pairing_id,hole_number" });
    }
  }

  async function handleProfilePictureUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !memberData) return;
    
    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please upload a JPEG, PNG, or WebP image.');
      return;
    }
    
    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB.');
      return;
    }
    
    setUploadingProfilePic(true);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${memberData.member_id}.${fileExt}`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);
      
      // Update member record with cache-busting timestamp
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('members')
        .update({ profile_picture_url: urlWithTimestamp })
        .eq('member_id', memberData.member_id);
      
      if (updateError) throw updateError;
      
      // Update local state
      setMemberData(prev => prev ? { ...prev, profile_picture_url: urlWithTimestamp } : prev);
    } catch (err) {
      console.error('[v0] Failed to upload profile picture:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingProfilePic(false);
    }
  }

  async function openScoreViewer(pairingId: number, memberName: string, playingHandicap: number, isLiveGame: boolean) {
    setScoreViewerPlayer({ pairing_id: pairingId, member_name: memberName, playing_handicap: playingHandicap });
    // If live, use in-memory holeScoreData
    if (isLiveGame && holeScoreData[pairingId]) {
      setScoreViewerHoles(holeScoreData[pairingId] as Record<number, number | null>);
      return;
    }
    // Otherwise fetch from DB
    setScoreViewerLoading(true);
    setScoreViewerHoles({});
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    // Fetch both member and guest hole scores for this pairing
    const [{ data: memberData }, { data: guestData }] = await Promise.all([
      supabase.from("hole_scores").select("hole_number, strokes").eq("pairing_id", pairingId).order("hole_number"),
      supabase.from("guest_hole_scores").select("hole_number, strokes").eq("pairing_id", pairingId).order("hole_number")
    ]);
    const map: Record<number, number | null> = {};
    if (memberData) {
      memberData.forEach(r => { map[r.hole_number] = r.strokes; });
    }
    if (guestData) {
      guestData.forEach(r => { map[r.hole_number] = r.strokes; });
    }
    setScoreViewerHoles(map);
    setScoreViewerLoading(false);
  }

  async function saveGuestHoleScore(pairingId: number, gameDate: string, courseId: number, guestId: number, holeNumber: number, strokes: number | null) {
    setSavingHoleScore(true);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // Optimistically update local state and persist to localStorage
    setHoleScoreData(prev => {
      const updated = { ...prev, [pairingId]: { ...(prev[pairingId] || {}), [holeNumber]: strokes } };
      if (typeof window !== "undefined" && memberData?.member_id) {
        localStorage.setItem(`holeScores_${memberData.member_id}`, JSON.stringify(updated));
      }
      return updated;
    });
    
    if (strokes !== null) {
      await supabase.from("guest_hole_scores").upsert({
        pairing_id: pairingId,
        game_date: gameDate,
        course_id: courseId,
        guest_id: guestId,
        hole_number: holeNumber,
        strokes,
        updated_at: new Date().toISOString()
      }, { onConflict: "pairing_id,guest_id,hole_number" });
    } else {
      await supabase.from("guest_hole_scores").delete().eq("pairing_id", pairingId).eq("guest_id", guestId).eq("hole_number", holeNumber);
    }
    setSavingHoleScore(false);
  }

  // Calculate winners for 1st 9, 2nd 9, and overall
  function calculateWinners(players: any[], format: string) {
    if (players.length === 0) return { first9: null, second9: null, overall: null, birdies: "" };
    
    // For Stableford: most points win. For Medal: least net wins
    const isStableford = format === "Stableford" || format === "IPS";
    const isNet = format === "Medal";
    
    // Split players by front 9 (holes 1-9) and back 9 (holes 10-18)
    const front9Players = players.map(p => {
      let score = 0, points = 0;
      for (let h = 1; h <= 9; h++) {
        const hScore = p.holeScores[h];
        if (hScore) score += hScore;
      }
      const net = score - (p.playingHandicap * 9 / 18);
      return { ...p, frontScore: score, frontNet: net, frontPoints: p.frontPoints || 0 };
    });
    
    const back9Players = players.map(p => {
      let score = 0;
      for (let h = 10; h <= 18; h++) {
        const hScore = p.holeScores[h];
        if (hScore) score += hScore;
      }
      const net = score - (p.playingHandicap * 9 / 18);
      return { ...p, backScore: score, backNet: net, backPoints: p.backPoints || 0 };
    });
    
    // Find winners
    let first9 = null, second9 = null, overall = null;
    
    if (isStableford) {
      first9 = front9Players.reduce((a, b) => (b.frontPoints || 0) > (a.frontPoints || 0) ? b : a);
      second9 = back9Players.reduce((a, b) => (b.backPoints || 0) > (a.backPoints || 0) ? b : a);
      overall = players.reduce((a, b) => (b.points || 0) > (a.points || 0) ? b : a);
    } else if (isNet) {
      first9 = front9Players.reduce((a, b) => (b.frontNet || 999) < (a.frontNet || 999) ? b : a);
      second9 = back9Players.reduce((a, b) => (b.backNet || 999) < (a.backNet || 999) ? b : a);
      overall = players.reduce((a, b) => (b.net || 999) < (a.net || 999) ? b : a);
    }
    
    // Get birdies list
    const birdieList = players
      .filter(p => p.birdies > 0)
                    .map(p => {
                      const allBirdieNames = liveLeaderboard.map(lb => lb.member_name);
                      return `${p.member_name ? getDisplayName(p.member_name, allBirdieNames) : p.guest_name}(${p.birdies})`;
                    })
      .join(", ");
    
    return { first9, second9, overall, birdies: birdieList };
  }

  function computePlayerTotals(
    pairingId: number, 
    playingHandicap: number | null, 
    isMedal = false,
    gender?: string,
    courseId?: number
  ) {
    const scores = holeScoreData[pairingId] || {};
    const ladies = ladyHoleData[pairingId] || {};
    const hcp = playingHandicap ?? 0;
    let gross = 0;
    let totalPoints = 0;
    let birdies = 0;
    let eagles = 0;
    let ladiesCount = 0;
    let holesPlayed = 0;
    
    for (const hole of courseHoles) {
      const rawStrokes = scores[hole.hole_number];
      if (rawStrokes == null) continue;
      holesPlayed++;

      if (ladies[hole.hole_number]) ladiesCount++;

      // Get ladies stroke index for this hole if available
      const ladiesSI = (courseId && ladiesStrokeMap[courseId]?.[hole.hole_number]) || null;
      
      // Use gender-aware handicap calculation
      const hcpStrokes = calculateHcpStrokes(hcp, hole.stroke_index, gender, ladiesSI ?? undefined);
      
      let netScore = rawStrokes - hcpStrokes;
      
      if (!isMedal) {
        netScore = Math.min(netScore, hole.par + 2);
      }
      
      gross += rawStrokes;
      const points = isMedal ? 0 : Math.max(0, 2 + hole.par - netScore);
      totalPoints += points;
      
      if (rawStrokes === hole.par - 1) birdies++;
      if (rawStrokes <= hole.par - 2) eagles++;
    }
    
    return { gross, totalPoints, birdies, eagles, ladiesCount, holesPlayed };
  }

  // --- Submit ALL 4Ball Scores for Captain Review ---
  async function handleSubmitScoresForReview(members: PairingMember[], isMedalOverride?: boolean) {
    // Medal clubs always use Medal scoring regardless of override
    const isMedal = isMedalOverride ?? MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0);
    setSubmittingScores(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    
    // Update each member's pairing with computed totals
    const updatedMap: Record<number, string> = {};
    try {
      for (const member of members) {
        const totals = computePlayerTotals(member.pairing_id, member.playing_handicap, isMedal);
        const { error } = await supabase
          .from("pairings")
          .update({
            gross_score: totals.holesPlayed > 0 ? totals.gross : null,
            points: totals.holesPlayed > 0 ? totals.totalPoints : null,
            birdies_count: totals.birdies,
            eagles_count: totals.eagles,
            ladies_count: totals.ladiesCount,
            scores_submitted_at: now,
          })
          .eq("pairing_id", member.pairing_id);
        if (error) throw error;
        updatedMap[member.pairing_id] = now;
      }
    } catch (err) {
      console.error("Failed to submit 4Ball scores for review:", err);
      alert("Failed to submit scores: " + (err instanceof Error ? err.message : "Unknown error"));
      setSubmittingScores(false);
      return;
    }

    // Track locally
    setScoresSubmittedMap(prev => ({ ...prev, ...updatedMap }));

    // Update myPairings member data locally so scores_submitted_at is reflected
    // immediately (drives the "submitted for review" UI without a refetch).
    const pairingIds = new Set(members.map(m => m.pairing_id));
    setMyPairings(prev => prev.map(p => ({
      ...p,
      members: p.members.map(m =>
        pairingIds.has(m.pairing_id) ? { ...m, scores_submitted_at: now } : m
      ),
    })));

    setSubmittingScores(false);
  }

  // --- Save Course Hole Data (Admin/Captain) ---
  async function saveCourseHoles() {
    if (!editCourseId || editHoleData.length === 0) return;
    const supabase = createClient();
    
    // Build existing holes map for merging
    const existingHoles = courseHoles.reduce((map, h) => {
      map[h.hole_number] = h;
      return map;
    }, {} as Record<number, typeof courseHoles[0]>);
    
    const rows = editHoleData.map(h => ({ 
      course_id: editCourseId, 
      hole_number: h.hole_number, 
      par: h.par, 
      stroke_index: h.stroke_index,
      ladies_stroke_index: h.ladies_stroke_index
    }));
    
    // Upsert - this will update existing, insert new
    await supabase.from("course_holes").upsert(rows, { onConflict: "course_id,hole_number" });
    
    // Merge with existing for holes not edited
    const mergedHoles = editHoleData.map(h => ({ ...h }));
    for (let i = 1; i <= 18; i++) {
      if (!mergedHoles.find(mh => mh.hole_number === i) && existingHoles[i]) {
        mergedHoles.push(existingHoles[i]);
      }
    }
    
    setCourseHoles(mergedHoles.sort((a, b) => a.hole_number - b.hole_number));
    setCourseHolesFound(true);
    setEditingCourseHoles(false);
    
    // Update courses.par
    const totalPar = mergedHoles.reduce((s, h) => s + h.par, 0);
    await supabase.from("courses").update({ par: totalPar }).eq("course_id", editCourseId);
  }

  // --- Advance to Next Round (multi-round games) ---
  async function handleAdvanceToNextRound(nextRound: { round: number; date: string | null; course_id: number | null; course_name: string | null }) {
    if (advancingToNextRound) return;
    setAdvancingToNextRound(true);
    const supabase = createClient();

    // Find the current game to get its organizer/club/total_rounds context
    const currentGame = liveScoreGameInfo?.adhoc_game_id
      ? adhocGames.find(g => g.adhoc_game_id === liveScoreGameInfo.adhoc_game_id)
      : null;

    // Prefer round_number-based lookup (most reliable). Fall back to date+course matching.
    const nextGame = adhocGames.find(g =>
      g.adhoc_game_id !== liveScoreGameInfo?.adhoc_game_id &&
      g.is_multi_round &&
      (currentGame
        ? g.organizer_id === currentGame.organizer_id &&
          (g.club_id ?? 0) === (currentGame.club_id ?? 0) &&
          g.total_rounds === currentGame.total_rounds &&
          (g.round_number ?? 1) === nextRound.round
        : // fallback: match by date and course
          g.game_date === nextRound.date &&
          (nextRound.course_id ? g.course_id === nextRound.course_id : true))
    );

    if (nextGame) {
      // Ensure all current pairings members are booked into the next game
      const currentPairings = allGamePairings.filter(p => p.adhoc_game_id === liveScoreGameInfo?.adhoc_game_id).sort((a, b) => a.fourball_number - b.fourball_number);
      const memberIds = currentPairings.flatMap(p => p.members.filter(m => !m.guest_id).map(m => m.member_id));

      for (const memberId of memberIds) {
        const { data: existing } = await supabase
          .from("adhoc_game_bookings")
          .select("booking_id, booking_status")
          .eq("adhoc_game_id", nextGame.adhoc_game_id)
          .eq("member_id", memberId)
          .limit(1);
        if (existing && existing.length > 0 && existing[0].booking_status === "cancelled") {
          await supabase.from("adhoc_game_bookings")
            .update({ booking_status: "confirmed", cancelled_at: null, booked_at: new Date().toISOString() })
            .eq("booking_id", existing[0].booking_id);
        } else if (!existing || existing.length === 0) {
          await supabase.from("adhoc_game_bookings")
            .insert({ adhoc_game_id: nextGame.adhoc_game_id, member_id: memberId, booking_status: "confirmed" });
        }
      }

      // Mark current game as completed
      await supabase.from("adhoc_games").update({ status: "completed" }).eq("adhoc_game_id", liveScoreGameInfo?.adhoc_game_id);
      
      // Ensure all guest players have their rounds recorded in unofficial_rounds
      if (liveScoreGameInfo?.adhoc_game_id) {
        await saveGuestResultsForGame(liveScoreGameInfo.adhoc_game_id);
      }
    }

    setAdvancingToNextRound(false);
    await handleSilentRefresh();
  }

  // --- Refresh Live Scores for a specific game ---
  async function refreshLiveScores(adhocGameId: number) {
    const supabase = createClient();
    
    // Get fresh pairings for this game
    const { data: pairingsData, error } = await supabase
      .from("pairings")
      .select(`
        pairing_id,
        fourball_number,
        member_id,
        guest_id,
        is_captain,
        points,
        result_submitted,
        playing_handicap,
        members(member_name),
        guests(guest_name, handicap_index)
      `)
      .eq("adhoc_game_id", adhocGameId);
    
    if (error) {
      console.error("Error loading pairings:", error);
      return;
    }
    
    if (pairingsData) {
      const game = adhocGames.find(g => g.adhoc_game_id === adhocGameId);
      
      const scores = pairingsData.flatMap(p => {
        const isGuest = !!p.guest_id && !p.member_id;
        return {
          member_name: isGuest ? (p.guests as { guest_name: string } | null)?.guest_name || "Guest" : (p.members as { member_name: string } | null)?.member_name || "Unknown",
          member_id: p.member_id || -(p.guest_id || 0),
          pairing_id: p.pairing_id,
          fourball_number: p.fourball_number,
          points: p.points,
          result_submitted: p.result_submitted,
          playing_handicap: p.playing_handicap
        };
      });
      
      setLiveScores(scores);
      
      // Also update allGamePairings for consistency
      setAllGamePairings(prev => {
        if (!Array.isArray(prev)) prev = [];
        const otherGames = prev.filter(p => p.adhoc_game_id !== adhocGameId);
        const gamePairings = pairingsData.map(p => ({
          adhoc_game_id: adhocGameId,
          fourball_number: p.fourball_number,
          course_id: game?.course_id || 0,
          course_name: game?.course_name || "",
          game_date: game?.game_date || "",
          tee_off_time: game?.tee_off_time || "",
          starting_hole: 1,
          course_rating: 72,
          members: [{
            pairing_id: p.pairing_id,
            member_id: p.member_id || -(p.guest_id || 0),
            member_name: (p.members as { member_name: string } | null)?.member_name || (p.guests as { guest_name: string } | null)?.guest_name || "Unknown",
            is_captain: p.is_captain,
            gross_score: null,
            points: p.points,
            result_submitted: p.result_submitted,
            playing_handicap: p.playing_handicap,
            birdies_count: 0,
            eagles_count: 0,
            hio_count: 0,
            ladies_count: 0,
            is_late: false,
            is_no_show: false,
            scores_submitted_at: null,
          }],
          isCaptain: false,
          allResultsSubmitted: false
        }));
        return [...otherGames, ...gamePairings];
      });
    }
  }

  // --- Switch to a different round (multi-round games) ---
  async function switchToRound(roundGameId: number, roundNumber: number) {
    console.log(`[v0] Switching to Round ${roundNumber}`);
    
    // CRITICAL: Clear all scores before loading new round
    setHoleScoreData({});
    setLadyHoleData({});
    setCourseHoles([]);
    setScorecardGameId(null);
    setShowScorecard(false);
    
    // Find the round game
    const roundGame = adhocGames.find(g => g.adhoc_game_id === roundGameId);
    if (!roundGame) return;
    
    // Update live score info
    setLiveScoreGameInfo({
      ...liveScoreGameInfo,
      adhoc_game_id: roundGameId,
      course_id: roundGame.course_id,
      course_name: roundGame.course_name
    });
    
    // Update round tab
    setLiveRoundTab(roundNumber);
    
    // Small delay to ensure state clears
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Load the new round's scorecard
    await openScorecard(roundGameId, roundGame.course_id);
  }

  // --- Complete Round (multi-round games) ---
  // Ensure all guest players in a completed game have their rounds saved to unofficial_rounds.
  // This guarantees guest records exist regardless of which flow finalized the game.
  // Records unofficial rounds for any CROSS-CLUB player (guest or member) in a completed game.
  // Home-club players are skipped here since their results live in performance_records.
  async function saveGuestResultsForGame(adhocGameId: number) {
    try {
      const supabase = createClient();

      // Get game info first (host club, course, date)
      const { data: game, error: gameError } = await supabase
        .from("adhoc_games")
        .select("club_id, course_id, game_date, tee_off_time")
        .eq("adhoc_game_id", adhocGameId)
        .single();

      if (gameError || !game) {
        console.warn(`Game ${adhocGameId} not found for unofficial round save:`, gameError);
        return;
      }

      // Get all submitted pairings for this game with member and guest info
      const { data: pairings, error: pairingsError } = await supabase
        .from("pairings")
        .select(`
          pairing_id,
          adhoc_game_id,
          member_id,
          guest_id,
          gross_score,
          points,
          playing_handicap,
          birdies_count,
          eagles_count,
          ladies_count,
          members!pairings_member_id_fkey ( member_id, member_name, club_id ),
          guests!pairings_guest_id_fkey ( guest_id, guest_name, club_id )
        `)
        .eq("adhoc_game_id", adhocGameId)
        .not("result_submitted", "eq", false); // Only submitted results

      if (pairingsError || !pairings) {
        console.warn(`Failed to fetch pairings for game ${adhocGameId}:`, pairingsError);
        return;
      }

      for (const pairing of pairings) {
        const guestInfo = pairing.guests as unknown as { guest_id: number; guest_name: string; club_id: number | null } | null;
        const memberInfo = pairing.members as unknown as { member_id: number; member_name: string; club_id: number | null } | null;

        let playerClubId: number | null = null;
        let playerName: string | null = null;
        let playerId: number | null = null;
        const isGuest = !!pairing.guest_id;

        if (isGuest && guestInfo) {
          playerClubId = guestInfo.club_id;
          playerName = guestInfo.guest_name;
          playerId = pairing.guest_id;
        } else if (memberInfo) {
          playerClubId = memberInfo.club_id;
          playerName = memberInfo.member_name;
          playerId = pairing.member_id;
        }

        if (!playerId || !playerName) continue;

        // Only record CROSS-CLUB players (their club differs from the host club).
        const isCrossClub = playerClubId !== null && playerClubId !== game.club_id;
        if (!isCrossClub) continue;

        // Skip if a record already exists for this player in this game
        const { data: existing } = await supabase
          .from("unofficial_rounds")
          .select("round_id")
          .eq("adhoc_game_id", adhocGameId)
          .eq("member_id", playerId)
          .maybeSingle();

        if (existing) continue;

        await supabase.from("unofficial_rounds").insert({
          adhoc_game_id: adhocGameId,
          member_id: playerId,
          guest_id: isGuest ? playerId : null,
          guest_name: isGuest ? playerName : null,
          course_id: game.course_id,
          game_date: game.game_date,
          tee_off_time: game.tee_off_time,
          gross_score: pairing.gross_score,
          points: pairing.points,
          playing_handicap: pairing.playing_handicap,
          birdies: pairing.birdies_count || 0,
          eagles: pairing.eagles_count || 0,
          ladies: pairing.ladies_count || 0
        });
      }
    } catch (err) {
      console.warn("Could not save unofficial results for game:", err);
    }
  }

  async function completeRound(adhocGameId: number) {
    try {
      const supabase = createClient();
      
      // Get current game info
      const { data: currentGame, error: gameError } = await supabase
        .from("adhoc_games")
        .select("multi_round_group_id, round_number, total_rounds, course_id, game_date, course_name")
        .eq("adhoc_game_id", adhocGameId)
        .single();
      
      if (gameError) throw gameError;
      
      // Mark current game as completed
      await supabase
        .from("adhoc_games")
        .update({ status: "completed" })
        .eq("adhoc_game_id", adhocGameId);
      
      // Ensure all guest players have their rounds recorded in unofficial_rounds
      await saveGuestResultsForGame(adhocGameId);
      
      // Find and setup next round
      if (currentGame?.multi_round_group_id && currentGame.round_number < currentGame.total_rounds) {
        const { data: nextRound, error: nextError } = await supabase
          .from("adhoc_games")
          .select("adhoc_game_id, course_id, game_date, course_name, tee_off_time")
          .eq("multi_round_group_id", currentGame.multi_round_group_id)
          .eq("round_number", currentGame.round_number + 1)
          .single();
        
        if (nextError) {
          console.error("Next round not found:", nextError);
          alert("Next round not found. Please check multi-round setup.");
          return;
        }
        
        // CRITICAL: Clear ALL state related to current round
        setHoleScoreData({});      // Clear hole scores
        setCourseHoles([]);        // Clear course holes
        setLadyHoleData({});       // Clear lady flags
        setLiveScores([]);         // Clear live scores
        setScorecardGameId(null);  // Reset scorecard
        setShowScorecard(false);   // Close scorecard
        
        // Update live score game info to next round
        const nextGameInfo = {
          course_name: nextRound.course_name,
          game_date: nextRound.game_date,
          adhoc_game_id: nextRound.adhoc_game_id,
          course_id: nextRound.course_id,
          format: "Stableford",
          tee_off_time: nextRound.tee_off_time,
          total_games_today: 1,
          all_same_day_game_ids: [nextRound.adhoc_game_id]
        };
        setLiveScoreGameInfo(nextGameInfo);
        
        // Load the next round's pairings
        await refreshLiveScores(nextRound.adhoc_game_id);
        
        // Small delay then open scorecard for next round
        setTimeout(async () => {
          await openScorecard(nextRound.adhoc_game_id, nextRound.course_id);
        }, 500);
        
        alert(`Round ${currentGame.round_number} completed! Round ${currentGame.round_number + 1} is now open.`);
      } else {
        alert(`Round ${currentGame.round_number} completed! This was the final round.`);
      }
      
      await handleSilentRefresh();
      
    } catch (error) {
      console.error("Error completing round:", error);
      alert("Failed to complete round");
    }
  }

  // --- Carry over pairings from one round to the next (multi-round games) ---
  async function handleCarryOverPairings(fromGameId: number, toGameId: number) {
    setCarryingOverPairings(toGameId);
    try {
      const supabase = createClient();

      // Get source pairings from state
      const sourcePairings = allGamePairings.filter(p => p.adhoc_game_id === fromGameId).sort((a, b) => a.fourball_number - b.fourball_number);
      if (!sourcePairings.length) return;

      // Delete any existing pairings in the target game first
      await supabase.from("pairings").delete().eq("adhoc_game_id", toGameId);

      // Build insert rows — preserve fourball_number and is_captain, reset scores
      const rows: {
        adhoc_game_id: number;
        member_id: number | null;
        guest_id: number | null;
        fourball_number: number;
        is_captain: boolean;
        result_submitted: boolean;
      }[] = [];

      sourcePairings.forEach(fb => {
        fb.members.forEach(m => {
          const isGuest = m.member_id < 0;
          rows.push({
            adhoc_game_id: toGameId,
            member_id: isGuest ? null : m.member_id,
            guest_id: isGuest ? Math.abs(m.member_id) : null,
            fourball_number: fb.fourball_number,
            is_captain: m.is_captain,
            result_submitted: false,
          });
        });
      });

      const { data: inserted, error } = await supabase.from("pairings").insert(rows).select();
      if (error) { console.error("[v0] carryOver pairings insert error:", error); return; }

      // Build new FourBallPairing objects for state
      const toGame = adhocGames.find(g => g.adhoc_game_id === toGameId);
      const grouped: Record<number, FourBallPairing> = {};
      (inserted ?? []).forEach((r: any) => {
        const fn = r.fourball_number as number;
        if (!grouped[fn]) {
          grouped[fn] = {
            adhoc_game_id: toGameId,
            fourball_number: fn,
            course_id: toGame?.course_id ?? 0,
            course_name: toGame?.course_name ?? "Unknown",
            game_date: toGame?.game_date ?? "",
            tee_off_time: toGame?.tee_off_time ?? "",
            starting_hole: 1,
            course_rating: 72,
            members: [],
            isCaptain: false,
            allResultsSubmitted: false,
          };
        }
        const srcMember = sourcePairings
          .flatMap(fb => fb.members)
          .find(m => (r.member_id && m.member_id === r.member_id) || (r.guest_id && m.member_id === -r.guest_id));
        grouped[fn].members.push({
          pairing_id: r.pairing_id,
          member_id: r.member_id ?? -(r.guest_id ?? 0),
          member_name: srcMember?.member_name ?? "Unknown",
          is_captain: r.is_captain,
          gross_score: null,
          points: null,
          result_submitted: false,
          playing_handicap: srcMember?.playing_handicap ?? null,
          birdies_count: 0,
          eagles_count: 0,
          hio_count: 0,
          ladies_count: 0,
          is_late: false,
          is_no_show: false,
          scores_submitted_at: null,
          wwb_ww: false,
          wwb_birdie: false,
        });
        if (r.member_id === memberData?.member_id && r.is_captain) grouped[fn].isCaptain = true;
      });

      const newFourballs = Object.values(grouped);
      setAllGamePairings(prev => [
        ...prev.filter(p => p.adhoc_game_id !== toGameId),
        ...newFourballs,
      ]);
      await handleSilentRefresh();
    } catch (err) {
      console.error("[v0] carryOver pairings failed:", err);
    } finally {
      setCarryingOverPairings(null);
    }
  }

  // --- Add Guest to Game ---
  // --- Search for existing members when adding a guest ---
  async function handleGuestNameSearch(name: string, gameId: number) {
    setGuestName(name);
    if (name.length < 2) {
      setGuestSearchResults([]);
      return;
    }
    setSearchingGuestName(true);
    const supabase = createClient();
    
    // Search members from ALL clubs (to find if person already exists)
    const { data } = await supabase
      .from("members")
      .select("member_id, member_name, club_id, golf_clubs(club_name), member_handicap_indices(official_handicap_index)")
      .ilike("member_name", `%${name}%`)
      .limit(10);
    
    if (data) {
      const results = data.map((m: any) => ({
        member_id: m.member_id,
        member_name: m.member_name,
        club_name: m.golf_clubs?.club_name || "Unknown Club",
        handicap_index: m.member_handicap_indices?.[0]?.official_handicap_index || null
      }));
      setGuestSearchResults(results);
    }
    setSearchingGuestName(false);
  }
  
// --- Search and Add Cross-Club Members (for public social games) ---
  async function handleCrossClubSearch(searchText: string) {
    setCrossClubSearchText(searchText);
    if (searchText.length < 2) {
      setCrossClubSearchResults([]);
      return;
    }
    setSearchingCrossClub(true);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // Search members from ALL clubs except our club
    const { data } = await supabase
      .from("members")
      .select("member_id, member_name, club_id, golf_clubs(club_name), member_handicap_indices(official_handicap_index)")
      .neq("club_id", myClub?.club_id || 0)
      .ilike("member_name", `%${searchText}%`)
      .limit(20);
    
    if (data) {
      const results = data.map((m: any) => ({
        member_id: m.member_id,
        member_name: m.member_name,
        club_name: m.golf_clubs?.club_name || "Unknown Club",
        handicap_index: m.member_handicap_indices?.[0]?.official_handicap_index || null
      }));
      setCrossClubSearchResults(results);
    }
    setSearchingCrossClub(false);
  }
  
  async function handleAddCrossClubMember(adhocGameId: number, member: { member_id: number; member_name: string; club_name: string; handicap_index: number | null }) {
    setAddingCrossClubMember(member.member_id);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // Check if already booked
    const { data: existingBooking } = await supabase
      .from("adhoc_game_bookings")
      .select("booking_id")
      .eq("adhoc_game_id", adhocGameId)
      .eq("member_id", member.member_id)
      .maybeSingle();
    
    if (existingBooking) {
      alert("This member is already in the game.");
      setAddingCrossClubMember(null);
      return;
    }
    
    // Add booking with member_id so results go to their records
    await supabase
      .from("adhoc_game_bookings")
      .insert({ adhoc_game_id: adhocGameId, member_id: member.member_id, booking_status: "confirmed", booked_at: new Date().toISOString() });
    
    // Find fourball with space and add to pairings
    const { data: existingPairings } = await supabase
      .from("pairings")
      .select("fourball_number")
      .eq("adhoc_game_id", adhocGameId);
    
    const fourballCounts: Record<number, number> = {};
    let maxFourball = 0;
    if (existingPairings) {
      existingPairings.forEach(p => {
        fourballCounts[p.fourball_number] = (fourballCounts[p.fourball_number] || 0) + 1;
        if (p.fourball_number > maxFourball) maxFourball = p.fourball_number;
      });
    }
    
    let targetFourball = 0;
    for (let i = 1; i <= maxFourball; i++) {
      if ((fourballCounts[i] || 0) < 4) {
        targetFourball = i;
        break;
      }
    }
    if (targetFourball === 0) targetFourball = maxFourball + 1;
    
    await supabase
      .from("pairings")
      .insert({
        adhoc_game_id: adhocGameId,
        member_id: member.member_id,
        fourball_number: targetFourball,
        is_captain: false
      });
    
    // Update local state
    const game = adhocGames.find(g => g.adhoc_game_id === adhocGameId);
    setAdhocGames(prev => prev.map(g => g.adhoc_game_id === adhocGameId ? {
      ...g,
      booked_count: (g.booked_count || 0) + 1,
      players: [...(g.players || []), { 
        member_id: member.member_id, 
        member_name: `${member.member_name} (${member.club_name})`,
        handicap_index: member.handicap_index 
      }]
    } : g));
    
    setShowCrossClubSearch(null);
    setCrossClubSearchText("");
    setCrossClubSearchResults([]);
    setAddingCrossClubMember(null);
    
    // Refresh data
    await handleSilentRefresh();
  }

  async function handleAddGuest(adhocGameId: number) {
    const safeName = sanitizeInput(guestName);
    const safePhone = sanitizeInput(guestPhone);
    if (!safeName) return;
    setSavingGuest(true);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const memberId = localStorage.getItem("memberId");
    
    // Insert or find guest
    const { data: existingGuest } = await supabase.from("guests").select("guest_id").eq("guest_name", safeName).eq("club_id", myClub?.club_id || 1).maybeSingle();
    let guestId: number;
    if (existingGuest) {
      guestId = existingGuest.guest_id;
      // Update info
      await supabase.from("guests").update({ handicap_index: guestHandicap ? parseFloat(guestHandicap) : null, phone: safePhone || null, gender: guestGender }).eq("guest_id", guestId);
    } else {
      const { data: newGuest } = await supabase.from("guests").insert({ guest_name: safeName, handicap_index: guestHandicap ? parseFloat(guestHandicap) : null, phone: safePhone || null, created_by: memberId ? Number(memberId) : null, club_id: myClub?.club_id || 1, gender: guestGender }).select("guest_id").single();
      if (!newGuest) { setSavingGuest(false); return; }
      guestId = newGuest.guest_id;
    }
    
    // Add to adhoc_game_bookings
    await supabase.from("adhoc_game_bookings").insert({ adhoc_game_id: adhocGameId, guest_id: guestId, booking_status: "confirmed", booked_at: new Date().toISOString() });

    // Update adhocGames local state immediately
    const addedGuestName = safeName;
    const addedHandicap = guestHandicap ? parseFloat(guestHandicap) : null;
    const game = adhocGames.find(g => g.adhoc_game_id === adhocGameId);
    const newBookedCount = (game?.booked_count || 0) + 1;
    const isFull = game ? newBookedCount >= game.max_players : false;

    setAdhocGames(prev => prev.map(g => g.adhoc_game_id === adhocGameId
      ? {
          ...g,
          booked_count: newBookedCount,
          guests: [...(g.guests || []), { guest_id: guestId, guest_name: addedGuestName, handicap_index: addedHandicap }],
          status: isFull ? "full" : g.status
        }
      : g));

    // If pairings already exist, slot the guest into the best available group
    const hasPairings = allGamePairings.some(p => p.adhoc_game_id === adhocGameId);
    if (hasPairings) {
      const pairingRes = await fetch("/api/add-player-to-pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adhocGameId, guestId }),
      });
      if (pairingRes.ok) {
        const { pairing } = await pairingRes.json();
        const course = courses.find(c => c.course_id === game?.course_id);
        const guestDisplayName = `${addedGuestName} (G)`;

        setAllGamePairings(prev => {
          const updated = [...prev];
          const groupIdx = updated.findIndex(
            p => p.adhoc_game_id === adhocGameId && p.fourball_number === pairing.fourball_number
          );
          const newMember: PairingMember = {
            pairing_id: pairing.pairing_id,
            member_id: -(guestId),
            member_name: guestDisplayName,
            is_captain: false,
            gross_score: null,
            points: null,
            result_submitted: false,
            playing_handicap: pairing.playing_handicap,
            birdies_count: 0,
            eagles_count: 0,
            hio_count: 0,
            ladies_count: 0,
            is_late: false,
            is_no_show: false,
            scores_submitted_at: null,
            gender: guestGender,
          };
          if (groupIdx >= 0) {
            updated[groupIdx] = {
              ...updated[groupIdx],
              members: [...updated[groupIdx].members, newMember],
            };
          } else {
            updated.push({
              adhoc_game_id: adhocGameId,
              fourball_number: pairing.fourball_number,
              course_id: game?.course_id ?? 0,
              course_name: game?.course_name ?? "",
              game_date: game?.game_date ?? "",
              tee_off_time: game?.tee_off_time ?? "",
              fourball_tee_time: pairing.tee_off_time,
              starting_hole: pairing.starting_hole ?? 1,
              course_rating: course?.course_rating ?? 72,
              members: [newMember],
              isCaptain: false,
              allResultsSubmitted: false,
            });
          }
          return updated;
        });
      }
    }

    setGuestName("");
    setGuestHandicap("");
    setGuestPhone("");
    setShowAddGuest(null);
    setSavingGuest(false);

    // Silently refresh to confirm state
    await handleSilentRefresh();

    // Save WWB opt-in for guest to dedicated table immediately
    if (WWB_CLUB_IDS.includes(myClub?.club_id ?? 0)) {
      const guestOpts = myClub?.club_id === TUESDAY_CLINIQUE_ID ? { ww: true, birdie: true } : pendingWwbGuest;
      const supabaseWwb = createClient();
      await supabaseWwb.from("adhoc_game_wwb_optins").upsert(
        { adhoc_game_id: adhocGameId, guest_id: guestId, ww: guestOpts.ww, birdie: guestOpts.birdie },
        { onConflict: "adhoc_game_id,guest_id" }
      );
      setGameWwbOptIns(prev => ({
        ...prev,
        [adhocGameId]: { ...(prev[adhocGameId] || {}), [-(guestId)]: guestOpts }
      }));
      // Also update pairing if it already exists
      const { data: existingPairing } = await supabaseWwb
        .from("pairings").select("pairing_id").eq("adhoc_game_id", adhocGameId).eq("guest_id", guestId).maybeSingle();
      if (existingPairing?.pairing_id) {
        await supabaseWwb.from("pairings").update({ wwb_ww: guestOpts.ww, wwb_birdie: guestOpts.birdie }).eq("pairing_id", existingPairing.pairing_id);
        setWwbOptIns(prev => ({ ...prev, [existingPairing.pairing_id]: guestOpts }));
      }
    }
    setPendingWwbGuest({ ww: true, birdie: true });
  }

  async function loadExistingGuests() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("guests").select("guest_id, guest_name, handicap_index, phone").eq("club_id", myClub?.club_id || 1).order("guest_name");
    if (data) setExistingGuests(data);
  }

  async function handleSwapPlayers() {
    if (!swapPlayerA || !swapPlayerB) return;
    setSwapLoading(true);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      // Swap fourball_numbers between the two players only.
      // hole_scores are keyed by pairing_id so they are NOT affected by this swap —
      // each player's scores remain attached to their own pairing record.
      const fbA = swapPlayerA.fourball_number;
      const fbB = swapPlayerB.fourball_number;
      
      const [resA, resB] = await Promise.all([
        supabase.from("pairings").update({ fourball_number: fbB }).eq("pairing_id", swapPlayerA.pairing_id),
        supabase.from("pairings").update({ fourball_number: fbA }).eq("pairing_id", swapPlayerB.pairing_id),
      ]);
      if (resA.error || resB.error) throw new Error(resA.error?.message || resB.error?.message);
      
      // Reset swap state and refresh
      setSwappingGameId(null);
      setSwapPlayerA(null);
      setSwapPlayerB(null);
      await handleSilentRefresh();
    } catch (err) {
      console.error("Swap failed:", err);
    } finally {
      setSwapLoading(false);
    }
  }

  // ── WWB: Sync opt-in to pairings table ──
  async function syncWwbOptInToPairing(
    adhocGameId: number, 
    memberId: number | null, 
    guestId: number | null, 
    opts: { ww: boolean; birdie: boolean }
  ): Promise<void> {
    const supabase = createClient();
    
    let query;
    if (guestId) {
      query = supabase
        .from("pairings")
        .select("pairing_id")
        .eq("adhoc_game_id", adhocGameId)
        .eq("guest_id", guestId);
    } else if (memberId) {
      query = supabase
        .from("pairings")
        .select("pairing_id")
        .eq("adhoc_game_id", adhocGameId)
        .eq("member_id", memberId);
    } else {
      return;
    }
    
    const { data: pairing } = await query.maybeSingle();
    
    if (pairing?.pairing_id) {
      await supabase
        .from("pairings")
        .update({ wwb_ww: opts.ww, wwb_birdie: opts.birdie })
        .eq("pairing_id", pairing.pairing_id);
      
      setWwbOptIns(prev => ({ 
        ...prev, 
        [pairing.pairing_id]: opts 
      }));
    }
  }

  // ── WWB: Toggle a specific member's WW or Birdie opt-in from the game card ──
  async function handleToggleGameWwbOptIn(
    adhocGameId: number,
    optKey: number,
    field: "ww" | "birdie",
    newVal: boolean
  ) {
    const current = gameWwbOptIns[adhocGameId]?.[optKey] ?? { ww: false, birdie: false };
    const updated = { ...current, [field]: newVal };
    const isGuest = optKey < 0;
    const guestId = isGuest ? -optKey : null;
    const memberId = isGuest ? null : optKey;

    // Optimistic update
    setGameWwbOptIns(prev => ({
      ...prev,
      [adhocGameId]: { ...(prev[adhocGameId] || {}), [optKey]: updated },
    }));

    const supabase = createClient();

    try {
      if (isGuest) {
        await supabase.from("adhoc_game_wwb_optins").upsert(
          { adhoc_game_id: adhocGameId, guest_id: guestId, member_id: null, ww: updated.ww, birdie: updated.birdie },
          { onConflict: "adhoc_game_id,guest_id" }
        );
        await syncWwbOptInToPairing(adhocGameId, null, guestId, updated);
      } else {
        await supabase.from("adhoc_game_wwb_optins").upsert(
          { adhoc_game_id: adhocGameId, member_id: memberId, guest_id: null, ww: updated.ww, birdie: updated.birdie },
          { onConflict: "adhoc_game_id,member_id" }
        );
        await syncWwbOptInToPairing(adhocGameId, memberId, null, updated);
      }
    } catch (error) {
      console.error("Failed to save WWB opt-in:", error);
      // Rollback optimistic update on error
      setGameWwbOptIns(prev => ({
        ...prev,
        [adhocGameId]: { ...(prev[adhocGameId] || {}), [optKey]: current },
      }));
    }
  }

  // ── Club 13 WWB: Save a player's WW/Birdie opt-in ──────────────────────────
  async function handleSaveWwbOptIn(pairingId: number, ww: boolean, birdie: boolean) {
    setSavingWwbOptIn(pairingId);
    try {
      const supabase = createClient();
      await supabase.from("pairings").update({ wwb_ww: ww, wwb_birdie: birdie }).eq("pairing_id", pairingId);
      setWwbOptIns(prev => ({ ...prev, [pairingId]: { ww, birdie } }));
    } catch (err) {
      console.error("WWB opt-in save failed:", err);
    } finally {
      setSavingWwbOptIn(null);
    }
  }

  // ── WWB: Get payouts with player names (handles both members and guests) ─────
  async function getWwbPayoutsWithNames(adhocGameId: number) {
    const supabase = createClient();
    
    // Fetch member payouts with member names
    const { data: memberPayouts } = await supabase
      .from("wwb_birdie_payouts")
      .select("*, members!wwb_birdie_payouts_member_id_fkey(member_name)")
      .eq("adhoc_game_id", adhocGameId)
      .not("member_id", "is", null);
    
    // Fetch guest payouts with guest names
    const { data: guestPayouts } = await supabase
      .from("wwb_birdie_payouts")
      .select("*, guests!wwb_birdie_payouts_guest_id_fkey(guest_name)")
      .eq("adhoc_game_id", adhocGameId)
      .not("guest_id", "is", null);
    
    return [
      ...(memberPayouts || []).map(p => ({
        name: (p.members as { member_name: string } | null)?.member_name ?? "Unknown",
        isGuest: false,
        birdies: p.birdies_scored,
        payout: p.payout_amount,
      })),
      ...(guestPayouts || []).map(p => ({
        name: (p.guests as { guest_name: string } | null)?.guest_name ?? "Guest",
        isGuest: true,
        birdies: p.birdies_scored,
        payout: p.payout_amount,
      })),
    ].sort((a, b) => b.payout - a.payout);
  }

  // ── WWB: Compute leaderboard - ONLY opted-in players ─────────────────────────
  function computeWwbLeaderboard(gameId: number) {
    const gameFourballs = allGamePairings.filter(p => p.adhoc_game_id === gameId).sort((a, b) => a.fourball_number - b.fourball_number);
    const allMembers = gameFourballs.flatMap(p => p.members);
    const gameInfo = adhocGames.find(g => g.adhoc_game_id === gameId);
    
    // Detect if game is Medal format (lowest net wins instead of highest points)
    const isMedal = MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0) || gameInfo?.game_type === "Medal";
    
    // Per-club fee structure
    const clubFees = WWB_FEES[myClub?.club_id ?? 0] ?? { front9: 100, back9: 100, overall: 100, birdie: 50 };
    const BIRDIE_FEE = clubFees.birdie;
    
    // Get opt-ins from dedicated table for this game - THIS IS THE SOURCE OF TRUTH
    const gameOptIns = gameWwbOptIns[gameId] || {};
    
    // Create Sets of opted-in players (positive for members, negative for guests)
    const optedInWwIds = new Set<number>();
    const optedInBirdieIds = new Set<number>();
    
    Object.entries(gameOptIns).forEach(([key, opts]) => {
      const id = parseInt(key);
      if (opts.ww) optedInWwIds.add(id);
      if (opts.birdie) optedInBirdieIds.add(id);
    });
    
    // CRITICAL: Filter members to ONLY those who opted in for WW
    // A player is ONLY included if they have an explicit opt-in record in the dedicated table
    const wwEntrants = allMembers.filter(m => {
      // Get the key for this member (positive for members, negative for guests)
      const memberKey = m.member_id > 0 ? m.member_id : (m.guest_id ? -m.guest_id : null);
      if (!memberKey) return false;
      return optedInWwIds.has(memberKey);
    });
    
  // If no opt-ins yet, return empty results
  if (wwEntrants.length === 0) {
    return {
      wwResults: [],
      front9Winner: null,
      back9Winner: null,
      overallWinner: null,
      sortedFront9: [],
      sortedBack9: [],
      sortedOverall: [],
      wwFront9Pool: 0,
      wwBack9Pool: 0,
      wwOverallPool: 0,
      wwTotalPool: 0,
      clubFees,
      birdieEntrants: [],
      birdiePoolTotal: 0,
      totalBirdies: 0,
      perBirdie: 0,
      birdiePoolEntrants: 0,
      isMedal,
    };
  }
    
    // Calculate points AND net scores for opted-in players
    const wwResults = wwEntrants.map(m => {
      const hcp = m.playing_handicap ?? 0;
      const scores = holeScoreData[m.pairing_id] || {};
      let front9Pts = 0, back9Pts = 0, holesPlayedFront = 0, holesPlayedBack = 0;
      let front9Gross = 0, back9Gross = 0;
      let front9HcpStrokes = 0, back9HcpStrokes = 0;
      
      for (const hole of courseHoles) {
        const rawStrokes = scores[hole.hole_number];
        if (rawStrokes == null) continue;
        
        // Calculate handicap strokes using helper
        let hcpStrokes = 0;
        if (hcp > 0) {
          const fullRounds = Math.floor(hcp / 18);
          hcpStrokes = fullRounds;
          const remaining = hcp % 18;
          if (remaining > 0 && hole.stroke_index <= remaining) {
            hcpStrokes++;
          }
        }
        
        // NET score = raw strokes minus handicap strokes
        let netStrokes = rawStrokes - hcpStrokes;
        // ESC: Max net score is double bogey (par + 2) - only for IPS
        if (!isMedal) {
          netStrokes = Math.min(netStrokes, hole.par + 2);
        }
        // Points from NET score (Stableford)
        const pts = Math.max(0, 2 + hole.par - netStrokes);
        
        if (hole.hole_number <= 9) {
          front9Pts += pts;
          front9Gross += rawStrokes;
          front9HcpStrokes += hcpStrokes;
          holesPlayedFront++;
        } else {
          back9Pts += pts;
          back9Gross += rawStrokes;
          back9HcpStrokes += hcpStrokes;
          holesPlayedBack++;
        }
      }
      
      // If no hole-by-hole data, use stored front9_points/back9_points from pairings (completed game)
      const hasAnyHoleData = Object.keys(scores).length > 0;
      if (!hasAnyHoleData) {
        front9Pts = Number(m.front9_points ?? 0);
        back9Pts = Number(m.back9_points ?? 0);
      }
      
      // Calculate net scores (gross - handicap strokes)
      const front9Net = hasAnyHoleData ? front9Gross - front9HcpStrokes : null;
      const back9Net = hasAnyHoleData ? back9Gross - back9HcpStrokes : null;
      const totalNet = (front9Net !== null || back9Net !== null) ? (front9Net ?? 0) + (back9Net ?? 0) : null;
      
      return {
        ...m,
        front9Points: front9Pts,
        back9Points: back9Pts,
        totalPoints: front9Pts + back9Pts,
        front9Net,
        back9Net,
        totalNet,
        holesPlayedFront: hasAnyHoleData ? holesPlayedFront : (front9Pts > 0 ? 9 : 0),
        holesPlayedBack: hasAnyHoleData ? holesPlayedBack : (back9Pts > 0 ? 9 : 0),
      };
    });
    
    // Sort ONLY opted-in players - Medal: lowest net wins, IPS: highest points wins
    const sortedFront9 = [...wwResults]
      .filter(r => r.holesPlayedFront > 0 || r.front9Points > 0)
      .sort((a, b) => {
        if (isMedal) {
          // Medal: lowest net wins
          const aNet = a.front9Net ?? 999;
          const bNet = b.front9Net ?? 999;
          return aNet - bNet;
        }
        // IPS: highest points wins
        return b.front9Points - a.front9Points || b.back9Points - a.back9Points;
      });
      
    const sortedBack9 = [...wwResults]
      .filter(r => r.holesPlayedBack > 0 || r.back9Points > 0)
      .sort((a, b) => {
        if (isMedal) {
          // Medal: lowest net wins
          const aNet = a.back9Net ?? 999;
          const bNet = b.back9Net ?? 999;
          return aNet - bNet;
        }
        // IPS: highest points wins
        return b.back9Points - a.back9Points || b.front9Points - a.front9Points;
      });
      
    const sortedOverall = [...wwResults]
      .filter(r => r.totalPoints > 0 || r.holesPlayedFront > 0 || r.holesPlayedBack > 0)
      .sort((a, b) => {
        if (isMedal) {
          // Medal: lowest net wins
          const aNet = a.totalNet ?? 999;
          const bNet = b.totalNet ?? 999;
          return aNet - bNet;
        }
        // IPS: highest points wins
        return b.totalPoints - a.totalPoints || b.back9Points - a.back9Points;
      });
    
    // Calculate pools based on opt-in count (NOT total players in game)
    const optedInCount = optedInWwIds.size;
    const wwFront9Pool = optedInCount * clubFees.front9;
    const wwBack9Pool = optedInCount * clubFees.back9;
    const wwOverallPool = optedInCount * clubFees.overall;
    const wwTotalPool = wwFront9Pool + wwBack9Pool + wwOverallPool;
    
    // Birdie Pool - ONLY players who opted in for birdies
    // Eagles count as 2 birdie points for payout calculations
    const birdieEntrants = allMembers
      .filter(m => {
        const memberKey = m.member_id > 0 ? m.member_id : (m.guest_id ? -m.guest_id : null);
        return memberKey && optedInBirdieIds.has(memberKey);
      })
      .map(m => {
        const scores = holeScoreData[m.pairing_id] || {};
        let actualBirdies = 0;
        let actualEagles = 0;
        const hasAnyHoleData = Object.keys(scores).length > 0;
        
        if (hasAnyHoleData) {
          for (const hole of courseHoles) {
            const strokes = scores[hole.hole_number];
            if (strokes != null) {
              if (strokes === hole.par - 1) {
                actualBirdies += 1;
              }
              if (strokes <= hole.par - 2) {
                actualEagles += 1;
              }
            }
          }
        } else {
          // Fallback to stored values from database
          actualBirdies = m.birdies_count != null ? Number(m.birdies_count) : 0;
          actualEagles = m.eagles_count != null ? Number(m.eagles_count) : 0;
        }
        
        // Eagles count as 2 birdie points for payouts
        const birdiePoints = actualBirdies + (actualEagles * 2);
        
        return {
          member_id: m.member_id,
          member_name: m.member_name,
          pairing_id: m.pairing_id,
          actualBirdies,
          actualEagles,
          birdiePoints,
          rawBirdies: actualBirdies,  // For display purposes
        };
      });
    
    const totalBirdiePoints = birdieEntrants.reduce((s, e) => s + e.birdiePoints, 0);
    const totalRawBirdies = birdieEntrants.reduce((s, e) => s + e.actualBirdies, 0);
    const totalRawEagles = birdieEntrants.reduce((s, e) => s + e.actualEagles, 0);
    const birdiePoolTotal = optedInBirdieIds.size * BIRDIE_FEE;
    const perBirdie = totalBirdiePoints > 0 ? birdiePoolTotal / totalBirdiePoints : 0;
    
    // WSOE rule: no individual payout may exceed R2000 (WWB pool is exempt)
    const WSOE_PAYOUT_CAP = 2000;
    const isWsoe = myClub?.club_id === CLUB13_ID;
    const capPayout = (amount: number) => isWsoe ? Math.min(amount, WSOE_PAYOUT_CAP) : amount;
    
  // Determine winners with proper tie handling
  const determineWinner = (sortedPlayers: typeof wwResults, pointsField: 'front9Points' | 'back9Points' | 'totalPoints', netField: 'front9Net' | 'back9Net' | 'totalNet') => {
    if (sortedPlayers.length === 0) return null;
    if (sortedPlayers.length === 1) return sortedPlayers[0];
    
    // For Medal: compare by net score (lower is better), for IPS: compare by points (higher is better)
    const topValue = isMedal ? sortedPlayers[0][netField] : sortedPlayers[0][pointsField];
    const tiedPlayers = sortedPlayers.filter(p => (isMedal ? p[netField] : p[pointsField]) === topValue);
    
    if (tiedPlayers.length === 1) return tiedPlayers[0];
    
    // TIE BREAKER: Compare back9 for front9 ties, front9 for back9 ties
    if (pointsField === 'front9Points') {
      // For Front 9 tie, compare Back 9
      const best = tiedPlayers.reduce((best, current) => {
        const bestVal = isMedal ? (best.back9Net ?? 999) : best.back9Points;
        const currVal = isMedal ? (current.back9Net ?? 999) : current.back9Points;
        return isMedal ? (currVal < bestVal ? current : best) : (currVal > bestVal ? current : best);
      }, tiedPlayers[0]);
      const stillTied = tiedPlayers.every(p => (isMedal ? p.back9Net : p.back9Points) === (isMedal ? best.back9Net : best.back9Points));
      return stillTied ? null : best;
    } else if (pointsField === 'back9Points') {
      // For Back 9 tie, compare Front 9
      const best = tiedPlayers.reduce((best, current) => {
        const bestVal = isMedal ? (best.front9Net ?? 999) : best.front9Points;
        const currVal = isMedal ? (current.front9Net ?? 999) : current.front9Points;
        return isMedal ? (currVal < bestVal ? current : best) : (currVal > bestVal ? current : best);
      }, tiedPlayers[0]);
      const stillTied = tiedPlayers.every(p => (isMedal ? p.front9Net : p.front9Points) === (isMedal ? best.front9Net : best.front9Points));
      return stillTied ? null : best;
    } else {
      // For Overall tie, compare Back 9, then Front 9
      const bestBack9 = tiedPlayers.reduce((best, current) => {
        const bestVal = isMedal ? (best.back9Net ?? 999) : best.back9Points;
        const currVal = isMedal ? (current.back9Net ?? 999) : current.back9Points;
        return isMedal ? (currVal < bestVal ? current : best) : (currVal > bestVal ? current : best);
      }, tiedPlayers[0]);
      const stillTiedBack9 = tiedPlayers.every(p => (isMedal ? p.back9Net : p.back9Points) === (isMedal ? bestBack9.back9Net : bestBack9.back9Points));
      if (!stillTiedBack9) return bestBack9;
      
      const bestFront9 = tiedPlayers.reduce((best, current) => {
        const bestVal = isMedal ? (best.front9Net ?? 999) : best.front9Points;
        const currVal = isMedal ? (current.front9Net ?? 999) : current.front9Points;
        return isMedal ? (currVal < bestVal ? current : best) : (currVal > bestVal ? current : best);
      }, tiedPlayers[0]);
      return bestFront9;
    }
  };
  
  const front9WinnerRaw = determineWinner(sortedFront9, 'front9Points', 'front9Net');
  const back9WinnerRaw = determineWinner(sortedBack9, 'back9Points', 'back9Net');
  const overallWinnerRaw = determineWinner(sortedOverall, 'totalPoints', 'totalNet');
    
    // Helper to create winner object with proper member/guest IDs
    const getWinnerObject = (player: typeof wwResults[0] | null, pointsField: 'front9Points' | 'back9Points' | 'totalPoints') => {
      if (!player) return null;
      const isGuest = player.member_id < 0;
      const actualId = isGuest ? Math.abs(player.member_id) : player.member_id;
      return {
        member_id: isGuest ? null : actualId,
        guest_id: isGuest ? actualId : null,
        name: player.member_name,
        points: player[pointsField],
        // Keep original fields for compatibility
        ...player,
      };
    };
    
    const front9Winner = getWinnerObject(front9WinnerRaw, 'front9Points');
    const back9Winner = getWinnerObject(back9WinnerRaw, 'back9Points');
    const overallWinner = getWinnerObject(overallWinnerRaw, 'totalPoints');
    
    // Capped WW pool values for display (excess rolls over when cap is hit)
    const cappedFront9Pool = front9Winner ? capPayout(wwFront9Pool) : wwFront9Pool;
    const cappedBack9Pool = back9Winner ? capPayout(wwBack9Pool) : wwBack9Pool;
    const cappedOverallPool = overallWinner ? capPayout(wwOverallPool) : wwOverallPool;
    
    return {
      // WW
      wwResults: sortedOverall,
      front9Winner,
      back9Winner,
      overallWinner,
      sortedFront9,
      sortedBack9,
      sortedOverall,
      wwFront9Pool: cappedFront9Pool,
      wwBack9Pool: cappedBack9Pool,
      wwOverallPool: cappedOverallPool,
      wwTotalPool: cappedFront9Pool + cappedBack9Pool + cappedOverallPool,
      wwPoolPerSegment: clubFees.front9,
      clubFees,
  // Birdie pool
  birdieEntrants: birdieEntrants.map(e => {
  const isGuest = e.member_id < 0;
  const actualId = isGuest ? Math.abs(e.member_id) : e.member_id;
  return {
  ...e,
  member_id: isGuest ? null : actualId,
  guest_id: isGuest ? actualId : null,
  payout: capPayout(Math.round(e.birdiePoints * perBirdie)),
  };
  }),
  birdiePoolTotal,
  totalBirdies: totalRawBirdies,
  totalEagles: totalRawEagles,
  totalBirdiePoints,
  perBirdie,
  birdiePoolEntrants: optedInBirdieIds.size,
  isMedal,
  };
  }

  // ── Fourball Member Management (Captain) ────────────────────────────────────
  async function handleRemoveFromFourball(pairing: FourBallPairing, pairingId: number, memberId?: number) {
    setRemovingPairingId(pairingId);
    try {
      const supabase = createClient();
      // Remove from pairings table
      await supabase.from("pairings").delete().eq("pairing_id", pairingId);

      // If we know the member_id, mark their booking as removed in adhoc_game_bookings
      if (memberId) {
        const now = new Date().toISOString();
        await supabase
          .from("adhoc_game_bookings")
          .update({ booking_status: "removed", cancelled_at: now })
          .eq("adhoc_game_id", pairing.adhoc_game_id)
          .eq("member_id", memberId)
          .eq("booking_status", "confirmed");

        // Find the removed member's name for local state update
        const removedMember = pairing.members.find(m => m.pairing_id === pairingId);
        const removedName = removedMember?.member_name || "";

        // Update adhocGames local state: move player from players[] to cancelled_players[]
        setAdhocGames(prev => prev.map(g =>
          g.adhoc_game_id === pairing.adhoc_game_id
            ? {
                ...g,
                booked_count: Math.max(0, g.booked_count - 1),
                players: (g.players || []).filter(p => p.member_name !== removedName),
                cancelled_players: [
                  ...(g.cancelled_players || []),
                  { name: `${removedName} (removed)`, cancelled_at: now },
                ],
              }
            : g
        ));
      }

      // Update pairings local state
      const pairingUpdater = (prev: FourBallPairing[]) => prev.map(p =>
        p.adhoc_game_id === pairing.adhoc_game_id && p.fourball_number === pairing.fourball_number
          ? { ...p, members: p.members.filter(m => m.pairing_id !== pairingId) }
          : p
      );
      setAllGamePairings(pairingUpdater);
      setMyPairings(pairingUpdater);
      await handleSilentRefresh();
    } catch (err) {
      console.error("[v0] Remove from fourball failed:", err);
    } finally {
      setRemovingPairingId(null);
    }
  }

  async function handleAddToFourball(pairing: FourBallPairing) {
    if (!fourballAddIds.length) return;
    setAddingToFourball(true);
    try {
      const supabase = createClient();
      const rows = fourballAddIds.map(memberId => ({
        adhoc_game_id: pairing.adhoc_game_id,
        member_id: memberId,
        fourball_number: pairing.fourball_number,
        is_captain: false,
        result_submitted: false,
      }));
      const { data, error } = await supabase.from("pairings").insert(rows).select();
      if (!error && data) {
        const newMembers: PairingMember[] = data.map((r: any) => {
          const info = memberDirectory.find(m => m.member_id === r.member_id);
          return {
            pairing_id: r.pairing_id,
            member_id: r.member_id,
            member_name: info?.member_name || "Unknown",
            is_captain: false,
            result_submitted: false,
            gross_score: null,
            points: null,
            playing_handicap: null,
            birdies_count: 0,
            eagles_count: 0,
            ladies_count: 0,
            is_late: false,
            is_no_show: false,
            hio_count: 0,
          };
        });
        const pairingUpdater = (prev: FourBallPairing[]) => prev.map(p =>
          p.adhoc_game_id === pairing.adhoc_game_id && p.fourball_number === pairing.fourball_number
            ? { ...p, members: [...p.members, ...newMembers] }
            : p
        );
        setAllGamePairings(pairingUpdater);
        setMyPairings(pairingUpdater);

        // Upsert a confirmed booking for each newly added member in adhoc_game_bookings
        const now = new Date().toISOString();
        for (const memberId of fourballAddIds) {
          const info = memberDirectory.find(m => m.member_id === memberId);
          const memberName = info?.member_name || "";

          // Check if a booking row already exists (cancelled or removed)
          const { data: existing } = await supabase
            .from("adhoc_game_bookings")
            .select("booking_id, booking_status")
            .eq("adhoc_game_id", pairing.adhoc_game_id)
            .eq("member_id", memberId)
            .limit(1);

          if (existing && existing.length > 0) {
            // Re-activate existing booking
            await supabase
              .from("adhoc_game_bookings")
              .update({ booking_status: "confirmed", cancelled_at: null, booked_at: now })
              .eq("booking_id", existing[0].booking_id);
          } else {
            // Create new booking
            await supabase
              .from("adhoc_game_bookings")
              .insert({ adhoc_game_id: pairing.adhoc_game_id, member_id: memberId, booking_status: "confirmed", booked_at: now });
          }

          // Update adhocGames local state: add to players[], remove from cancelled_players if present
          setAdhocGames(prev => prev.map(g =>
            g.adhoc_game_id === pairing.adhoc_game_id
              ? {
                  ...g,
                  booked_count: g.booked_count + 1,
                  players: [...(g.players || []).filter(p => p.member_name !== memberName), { member_id: memberId, member_name: memberName }],
                  cancelled_players: (g.cancelled_players || []).filter(
                    cp => cp.name !== memberName && cp.name !== `${memberName} (removed)`
                  ),
                }
              : g
          ));
        }
      }
      await handleSilentRefresh();
      setFourballAddIds([]);
      setFourballAddSearch("");
    } catch (err) {
      console.error("[v0] Add to fourball failed:", err);
    } finally {
      setAddingToFourball(false);
    }
  }

  // ── Undo Results Submission ─────────────────────────────────────────────────
  async function handleUndoResults(pairing: FourBallPairing) {
    if (!memberData) return;
    setUndoingResults(pairing.adhoc_game_id);
    try {
      const supabase = createClient();
      // Reset result_submitted for all members in this fourball
      const pairingIds = pairing.members.map(m => m.pairing_id);
      await supabase
        .from("pairings")
        .update({ result_submitted: false })
        .in("pairing_id", pairingIds);

      // Update local state so UI reflects the change immediately
      setAllGamePairings(prev =>
        prev.map(p => {
          if (p.adhoc_game_id !== pairing.adhoc_game_id || p.fourball_number !== pairing.fourball_number) return p;
          return {
            ...p,
            allResultsSubmitted: false,
            members: p.members.map(m => ({ ...m, result_submitted: false }))
          };
        })
      );
      setMyPairings(prev =>
        prev.map(p => {
          if (p.adhoc_game_id !== pairing.adhoc_game_id || p.fourball_number !== pairing.fourball_number) return p;
          return {
            ...p,
            allResultsSubmitted: false,
            members: p.members.map(m => ({ ...m, result_submitted: false }))
          };
        })
      );
      // Pre-populate resultsData so the fields are ready to edit
      const initData: typeof resultsData = { ...resultsData };
      pairing.members.forEach(m => {
        if (!initData[m.pairing_id]) {
          initData[m.pairing_id] = {
            gross_score: m.gross_score?.toString() || "",
            points: m.points?.toString() || "",
            playing_handicap: m.playing_handicap?.toString() || "",
            birdies_count: m.birdies_count?.toString() || "0",
            eagles_count: m.eagles_count?.toString() || "0",
            hio_count: "0",
            ladies_count: m.ladies_count?.toString() || "0",
            is_late: m.is_late || false,
            is_no_show: m.is_no_show || false
          };
        }
      });
      setResultsData(initData);
      setShowResultsInput(pairing.fourball_number);
      await handleSilentRefresh();
    } catch (err) {
      console.error("[v0] Undo results failed:", err);
    } finally {
      setUndoingResults(null);
    }
  }

  // ── PART 1: Captain "Verify & Finalise Results" flow ──
  // Step 1: validate that every player in the captain's 4Ball has all 18 holes
  // captured (using the same client-side hole data the scorecard renders).
  function startCaptainFinalize(pairing: FourBallPairing) {
    const incomplete = pairing.members
      .map(m => {
        const totals = computePlayerTotals(m.pairing_id, m.playing_handicap);
        return { name: getDisplayName(m.member_name, pairing.members.map(x => x.member_name)), missing: Math.max(0, 18 - totals.holesPlayed) };
      })
      .filter(x => x.missing > 0);
    if (incomplete.length > 0) {
      setFinalizeFlow({ step: "incomplete", pairing, incomplete, gameId: pairing.adhoc_game_id });
    } else {
      setFinalizeFlow({ step: "confirm", pairing, incomplete: [], gameId: pairing.adhoc_game_id });
    }
  }

  // Step 2: actually finalise — compute totals, persist via handleSaveResults,
  // then surface the success dialog (which redirects to the Play tab).
  async function confirmCaptainFinalize() {
    const flow = finalizeFlow;
    if (!flow?.pairing) return;
    setFinalizing(true);
    try {
      const prefilledData: Record<number, { gross_score: string; points: string; playing_handicap: string; birdies_count: string; eagles_count: string; hio_count: string; ladies_count: string; is_late: boolean; is_no_show: boolean }> = {};
      for (const member of flow.pairing.members) {
        const totals = computePlayerTotals(member.pairing_id, member.playing_handicap);
        let birdies = 0, eagles = 0, ladiesCount = 0;
        for (const hole of courseHoles) {
          const strokes = holeScoreData[member.pairing_id]?.[hole.hole_number];
          if (strokes != null) {
            if (strokes === hole.par - 1) birdies++;
            if (strokes <= hole.par - 2) eagles++;
          }
          if (ladyHoleData[member.pairing_id]?.[hole.hole_number]) ladiesCount++;
        }
        // Players with no scores are finalised with 0 points (marked incomplete in the result view).
        prefilledData[member.pairing_id] = {
          gross_score: totals.holesPlayed > 0 ? String(totals.gross) : "0",
          points: totals.holesPlayed > 0 ? String(totals.totalPoints) : "0",
          playing_handicap: String(member.playing_handicap ?? ""),
          birdies_count: String(birdies),
          eagles_count: String(eagles),
          hio_count: "0",
          ladies_count: String(ladiesCount),
          is_late: member.is_late || false,
          is_no_show: totals.holesPlayed === 0,
        };
      }
      await handleSaveResults(flow.pairing, prefilledData);
      // Close the scorecard and move to the Play tab now that results are finalised.
      setShowScorecard(false);
      setActiveTab("play");
      setFinalizeFlow({ step: "success", pairing: flow.pairing, incomplete: flow.incomplete, gameId: flow.pairing.adhoc_game_id });
    } catch (err) {
      console.log("[v0] confirmCaptainFinalize error:", err instanceof Error ? err.message : String(err));
      alert("Could not finalise results. Please try again.");
      setFinalizeFlow(null);
    } finally {
      setFinalizing(false);
    }
  }

  // Simplified handleSaveResults - just update pairings, database handles the rest.
  // dataOverride lets the captain Verify & Finalise flow pass freshly computed
  // results without waiting for resultsData state to flush.
  async function handleSaveResults(
    pairing: FourBallPairing,
    dataOverride?: Record<number, { gross_score: string; points: string; playing_handicap: string; birdies_count: string; eagles_count: string; hio_count: string; ladies_count: string; is_late: boolean; is_no_show: boolean }>
  ) {
    setSavingResults(true);
    
    try {
      const supabase = createClient();
      
      for (const member of pairing.members) {
        const data = dataOverride?.[member.pairing_id] ?? resultsData[member.pairing_id];
        if (data) {
          // Convert empty strings to null/0 properly - handle NaN
          const gross = parseInt(data.gross_score);
          const pts = parseInt(data.points);
          const hcp = parseInt(data.playing_handicap);
          
          // Calculate birdies/eagles/ladies from hole data if available
          let birdies = parseInt(data.birdies_count) || 0;
          let eagles = parseInt(data.eagles_count) || 0;
          let ladies = parseInt(data.ladies_count) || 0;
          
          // If we have hole scores, recalculate from them
          if (courseHoles.length > 0 && holeScoreData[member.pairing_id]) {
            birdies = 0;
            eagles = 0;
            ladies = 0;
            for (const hole of courseHoles) {
              const strokes = holeScoreData[member.pairing_id]?.[hole.hole_number];
              if (strokes !== null && strokes !== undefined) {
                if (strokes === hole.par - 1) birdies++;
                if (strokes <= hole.par - 2) eagles++;
              }
              if (ladyHoleData[member.pairing_id]?.[hole.hole_number]) ladies++;
            }
          }
          
          const now = new Date().toISOString();
          const updateData = {
            gross_score: isNaN(gross) ? null : gross,
            points: isNaN(pts) ? null : pts,
            playing_handicap: isNaN(hcp) ? null : hcp,
            birdies_count: birdies,
            eagles_count: eagles,
            hio_count: parseInt(data.hio_count) || 0,
            ladies_count: ladies,
            is_late: data.is_late || false,
            is_no_show: data.is_no_show || false,
            result_submitted: true,
            scores_submitted_at: now
          };
          
          const { error } = await supabase
            .from("pairings")
            .update(updateData)
            .eq("pairing_id", member.pairing_id);
          
          if (error) throw error;
          
          // Update local state to track submission
          setScoresSubmittedMap(prev => ({
            ...prev,
            [member.pairing_id]: now
          }));
          
          // For guests: Also save to unofficial_rounds so it shows in their club records
          // Check if this is a guest (member_id is negative indicating guest, or guest_id is set)
          const isGuest = member.member_id < 0 || !!member.guest_id;
          if (isGuest && member.guest_id) {
            // Get guest's club_id and name to record this as unofficial for their club
            const { data: guestData } = await supabase
              .from("guests")
              .select("club_id, guest_name")
              .eq("guest_id", member.guest_id)
              .maybeSingle();
            
            if (guestData?.club_id) {
              // Get game info for course_id and game_date
              const gameInfo = adhocGames.find(g => g.adhoc_game_id === pairing.adhoc_game_id);
              if (gameInfo) {
                // Check if record already exists to avoid duplicates
                const { data: existingRecord } = await supabase
                  .from("unofficial_rounds")
                  .select("round_id")
                  .eq("adhoc_game_id", pairing.adhoc_game_id)
                  .eq("guest_id", member.guest_id)
                  .maybeSingle();
                
                if (!existingRecord) {
                  await supabase
                    .from("unofficial_rounds")
                    .insert({
                      adhoc_game_id: pairing.adhoc_game_id,
                      member_id: member.guest_id, // Store guest_id for legacy display compatibility
                      guest_id: member.guest_id,
                      guest_name: guestData.guest_name ?? null,
                      course_id: gameInfo.course_id,
                      game_date: gameInfo.game_date,
                      tee_off_time: gameInfo.tee_off_time,
                      gross_score: isNaN(gross) ? null : gross,
                      points: isNaN(pts) ? null : pts,
                      playing_handicap: isNaN(hcp) ? null : hcp,
                      birdies: birdies,
                      eagles: eagles,
                      ladies: ladies
                    });
                }
              }
            }
          }
        }
      }
      
      // After saving all results, check if every fourball in this game has submitted.
      // If so, ensure ALL guest players have their unofficial rounds recorded.
      const { data: pendingCheck } = await supabase
        .from("pairings")
        .select("pairing_id")
        .eq("adhoc_game_id", pairing.adhoc_game_id)
        .eq("result_submitted", false)
        .limit(1);

      if (!pendingCheck || pendingCheck.length === 0) {
        await saveGuestResultsForGame(pairing.adhoc_game_id);
        // All fourballs submitted → mark the game completed so it moves to results.
        await supabase
          .from("adhoc_games")
          .update({ status: "completed" })
          .eq("adhoc_game_id", pairing.adhoc_game_id);
      }
      
      // Clear UI state immediately - results saved successfully
      setShowResultsInput(null);
      setResultsData({});
      
      // Refresh in background - don't fail if this fails
      try {
        await handleSilentRefresh();
      } catch (refreshError) {
        console.warn("Background refresh failed, data still saved:", refreshError);
      }
      
  } catch (error: unknown) {
  console.error("Failed to save results:", error);
  // Provide more specific error message based on error type
  let errorMessage = "Failed to save results. Please check your connection and try again.";
  if (error instanceof Error) {
    if (error.message.includes("Load failed") || error.message.includes("fetch")) {
      errorMessage = "Network error - please check your internet connection and try again.";
    } else if (error.message.includes("position")) {
      errorMessage = "Database error - please contact support.";
    } else {
      errorMessage = `Error: ${error.message}`;
    }
  }
  alert(errorMessage);
  } finally {
  setSavingResults(false);
  }
  }

  if (loading) {
    return <Loading />; // Use the Loading component
  }

  // Elias is HCP admin everywhere; Tebele (37) on non-Club4; Diale (54) + Sepeke (53) on Club4
  const isHcpAdmin = memberData && (
    ELIAS_IDS.includes(memberData.member_id) ||
    (myClub?.club_id === 4 && [53, 54].includes(memberData.member_id)) ||
    (myClub?.club_id !== 4 && [37].includes(memberData.member_id))
  );
  // Dynamic club admin check using CLUB_ADMINS object
  const isClubAdmin = memberData && myClub?.club_id 
    ? (CLUB_ADMINS[myClub.club_id] || []).includes(memberData.member_id) || ELIAS_IDS.includes(memberData.member_id)
    : false;
  // Legacy checks for backwards compatibility
  const isClub13Admin = memberData && myClub?.club_id === CLUB13_ID && CLUB13_ADMINS.includes(memberData.member_id);
  const isClub19Admin = memberData && myClub?.club_id === 19 && CLUB19_ADMINS.includes(memberData.member_id);
  const isFinanceAdmin = memberData && FINANCE_ADMINS.includes(memberData.member_id);

  async function loadHcpMembers() {
    setHcpLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("members")
      .select("member_id, member_name, member_handicap_indices(remmoho_handicap_index, official_handicap_index, previous_handicap_index)")
      .order("member_name");
    if (myClub?.club_id) query = query.eq("club_id", myClub.club_id);
    const { data } = await query;
    if (data) {
      const mapped = data.map((m: Record<string, unknown>) => {
        const hi = (m.member_handicap_indices as Record<string, unknown>[] | null)?.[0];
        return {
          member_id: m.member_id as number,
          member_name: m.member_name as string,
          remmoho_handicap_index: hi ? (hi.remmoho_handicap_index as number | null) : null,
          official_handicap_index: hi ? (hi.official_handicap_index as number | null) : null,
          previous_handicap_index: hi ? (hi.previous_handicap_index as number | null) : null,
        };
      });
      setHcpAllMembers(mapped);
      const edits: Record<number, { remmoho: string; official: string }> = {};
      mapped.forEach(m => {
        edits[m.member_id] = {
          remmoho: m.remmoho_handicap_index?.toFixed(1) ?? "",
          official: m.official_handicap_index?.toFixed(1) ?? "",
        };
      });
      setHcpEdits(edits);
    }
    setHcpLoading(false);
  }

  async function saveHcpChanges() {
    setHcpSaving(true);
    const supabase = createClient();
    let updated = 0;
    const isAdmin = !!(memberData && (ELIAS_IDS.includes(memberData.member_id) || memberData.member_id === 54)); // Elias (all clubs) + Diale Diale can edit all
    
    for (const member of hcpAllMembers) {
      const edit = hcpEdits[member.member_id];
      if (!edit) continue;
      
      const isOwnRecord = memberData?.member_id === member.member_id;
      const canEditClubIndex = isAdmin;
      const canEditOfficialIndex = isAdmin || isOwnRecord;
      
      const newRemmoho = edit.remmoho ? parseFloat(edit.remmoho) : null;
      const newOfficial = edit.official ? parseFloat(edit.official) : null;
      
      const remmohoChanged = canEditClubIndex && (newRemmoho !== member.remmoho_handicap_index);
      const officialChanged = canEditOfficialIndex && (newOfficial !== member.official_handicap_index);
      
      if (!remmohoChanged && !officialChanged) continue;
      
      const updateData: Record<string, unknown> = {};
      if (remmohoChanged) {
        updateData.previous_handicap_index = member.remmoho_handicap_index;
        updateData.remmoho_handicap_index = newRemmoho;
      }
      if (officialChanged) {
        updateData.official_handicap_index = newOfficial;
      }
      
      if (Object.keys(updateData).length === 0) continue;
      
      const { error } = await supabase
        .from("member_handicap_indices")
        .update(updateData)
        .eq("member_id", member.member_id)
        .select("handicap_index_id");
      if (!error) updated++;
    }
    if (updated > 0) {
      alert(`Updated handicap indices for ${updated} member(s).`);
      await loadHcpMembers();
      // Keep the profile card in sync if the logged-in member was edited
      await refreshMemberHandicap();
    } else {
      alert("No changes detected.");
    }
    setHcpSaving(false);
  }

  // Get current season handicap or fall back to the first available record
  const currentSeason = new Date().getFullYear().toString();
  const handicap =
    memberData?.member_handicap_indices?.find(h => h.season === currentSeason) ||
    memberData?.member_handicap_indices?.[0];
  const playingHandicap = handicap 
    ? Math.min(handicap.official_handicap_index || 54, handicap.remmoho_handicap_index || 54)
    : null;

  const latestGame = recentGames?.[0];
  const quarterPosition = latestGame?.current_quarter_position;
  const yearPosition = latestGame?.current_year_position;
  const medalPosition = latestGame?.medal_league_position;
  const medalPoints = latestGame?.medal_league_points;
  
  // Calculate quarter points: best 6 games of the last 20 games in the quarter
  // Quarters: Q1 = Dec-Feb, Q2 = Mar-May, Q3 = Jun-Aug, Q4 = Sep-Nov
  const quarterDates = getQuarterDates();
  const quarterStartDate = quarterDates.start;
  const quarterEndDate = quarterDates.end;
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed (0=Jan, 11=Dec)
  
  // Annual year runs Dec 1 - Nov 30 (same as Q1-Q4 cycle)
  let yearStartDate: string;
  let yearEndDate: string;
  if (currentMonth >= 11) {
    // December - new year started Dec 1 of current year
    yearStartDate = `${currentYear}-12-01`;
    yearEndDate = `${currentYear + 1}-11-30`;
  } else {
    // Jan-Nov - year started Dec 1 of previous year
    yearStartDate = `${currentYear - 1}-12-01`;
    yearEndDate = `${currentYear}-11-30`;
  }
  
  // Quarter: filter games in current quarter, take last 20, sort by points desc, sum best 6
  const quarterGames = recentGames?.filter(g => g.game_date >= quarterStartDate && g.game_date <= quarterEndDate) || [];
  const last20QuarterGames = quarterGames.slice(0, 20);
  const best6QuarterGames = [...last20QuarterGames].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 6);
  const quarterPoints = best6QuarterGames.reduce((sum, g) => sum + (g.points || 0), 0);
  
  // Annual: filter games in current year (Dec 1 - Nov 30), sort by points desc, sum best 20
  const yearGames = recentGames?.filter(g => g.game_date >= yearStartDate && g.game_date <= yearEndDate) || [];
  const best20YearGames = [...yearGames].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 20);
  const yearPoints = best20YearGames.reduce((sum, g) => sum + (g.points || 0), 0);

  const totalGames = recentGames?.length || 0;
  const avgPoints = recentGames && recentGames.length > 0 
    ? (recentGames.reduce((sum, g) => sum + (g.points || 0), 0) / recentGames.length).toFixed(1)
    : "0";

  const totalBirdies = birdiesData?.reduce((sum, b) => sum + (b.birdie_count || 0), 0) || 0;
  const totalEagles = eaglesData?.reduce((sum, e) => sum + (e.eagle_count || 0), 0) || 0;
  const totalLadies = ladiesData?.reduce((sum, l) => sum + (l.ladies_count || 0), 0) || 0;

  return (
    <ErrorBoundary>
    <div className="min-h-screen" style={{background: "linear-gradient(160deg, #eef4f0 0%, #f5f7f5 50%, #edf3ee 100%)"}}>
      {/* Offline Warning Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 text-center text-sm">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12h.01" />
            </svg>
            <span>You are offline. Scores will be saved locally and synced when you reconnect.</span>
          </div>
        </div>
      )}
      {/* Header */}
      <header className={`border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm sticky z-10 ${isOffline ? 'top-10' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {myClub?.logo_url ? (
              <Image
                src={myClub.logo_url}
                alt={`${myClub.club_name} Logo`}
                width={100}
                height={100}
                className="object-contain"
              />
            ) : (
              <Image
                  src="/images/mygolf-digital-logo.png"
                alt="MyGolf-Digital Logo"
                width={100}
                height={100}
                className="object-contain"
              />
            )}
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {memberData?.member_name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{myClub?.club_name || "MyGolf-Digital"} Member</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
<Button
  variant="outline"
  size="sm"
  className="text-xs h-7 px-2 border-slate-200 dark:border-slate-700 bg-transparent"
  onClick={handleRefresh}
  title={`Last updated: ${lastRefresh.toLocaleTimeString()}`}
  >
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
  </Button>
  <Button 
  variant="outline" 
  size="sm" 
  className="text-xs h-7 px-2 border-blue-200 dark:border-blue-800 bg-transparent text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
  onClick={handleForceRefresh} 
  disabled={forceRefreshing} 
  title="Force refresh - reload all data from server"
>
  {forceRefreshing ? (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )}
</Button>
              {/* Add to Home Screen — triggers native prompt on Android, iOS instructions modal on iOS */}
              {(() => {
                const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
                const isStandalone = typeof window !== "undefined" && (window.navigator as any).standalone === true;
                if (isStandalone) return null; // already installed
                if (installPrompt || isIos) return (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900"
                    onClick={async () => {
                      if (installPrompt) {
                        const prompt = installPrompt as any;
                        prompt.prompt();
                        const { outcome } = await prompt.userChoice;
                        if (outcome === "accepted") setShowInstallBanner(false);
                      } else if (isIos) {
                        setShowIosInstallModal(true);
                      }
                    }}
                    title="Add to Home Screen"
                  >
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </Button>
                );
                return null;
              })()}
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7 px-2 border-slate-200 dark:border-slate-700 bg-transparent" onClick={handleLogout}>Sign Out</Button>
          </div>
        </div>
</header>
  
  {/* DEBUG PANEL - Remove after testing */}
  {process.env.NODE_ENV === 'development' && myClub?.club_id === 13 && (
    <div className="fixed bottom-20 right-4 z-50 bg-black/80 text-white p-3 rounded-lg text-xs max-w-xs">
      <div className="font-bold mb-2">Multi-Round Debug</div>
      <div>Live Game ID: {liveScoreGameInfo?.adhoc_game_id || 'none'}</div>
      <div>Live Course: {liveScoreGameInfo?.course_name || 'none'}</div>
      <div>Scorecard Game ID: {scorecardGameId || 'none'}</div>
      <div>Course Holes: {courseHoles.length}</div>
      <div>Show Scorecard: {showScorecard ? 'yes' : 'no'}</div>
      <div className="mt-1 pt-1 border-t border-gray-600">
        <div className="font-bold">Multi-Round Games:</div>
        {adhocGames.filter(g => g.is_multi_round).map(g => (
          <div key={g.adhoc_game_id}>
            R{g.round_number}: {g.course_name} - {g.status}
          </div>
        ))}
      </div>
      <button 
        onClick={() => {
          console.log('Debug:', { liveScoreGameInfo, scorecardGameId, courseHoles });
          alert('Check console for debug info');
        }}
        className="mt-2 bg-blue-600 px-2 py-0.5 rounded text-[10px]"
      >
        Log to Console
      </button>
    </div>
  )}
  
  {/* PWA Install Banner — shown on Android/Chrome when app is installable */}
      {showInstallBanner && (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-xs">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="flex-1">Install MyGolf as an app for quick access</span>
          <button
            className="font-bold underline underline-offset-2 shrink-0"
            onClick={async () => {
              if (!installPrompt) return;
              const prompt = installPrompt as any;
              prompt.prompt();
              const { outcome } = await prompt.userChoice;
              if (outcome === "accepted") setShowInstallBanner(false);
            }}
          >
            Install
          </button>
          <button
            aria-label="Dismiss"
            className="shrink-0 opacity-70 hover:opacity-100 ml-1"
            onClick={() => setShowInstallBanner(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* iOS Install Instruction Modal */}
      {showIosInstallModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm px-4 pb-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="bg-[#1a3a2a] px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Add to Your Home Screen</h3>
              <button
                aria-label="Close"
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30"
                onClick={() => {
                  localStorage.setItem("pwa_ios_modal_dismissed", "1");
                  setShowIosInstallModal(false);
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Install MyGolf on your iPhone for instant access — no App Store needed. Follow these 3 steps in Safari:
              </p>

              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#e8f0ec] dark:bg-[#1e3028] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#1a3a2a] dark:text-[#c9a84c]">1</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tap the Share button</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">The Share icon is at the bottom of your Safari browser bar</p>
                  <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                    {/* Safari share icon */}
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Share</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#e8f0ec] dark:bg-[#1e3028] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#1a3a2a] dark:text-[#c9a84c]">2</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Scroll down and tap</p>
                  <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Add to Home Screen</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#e8f0ec] dark:bg-[#1e3028] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#1a3a2a] dark:text-[#c9a84c]">3</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tap Add</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">MyGolf will appear on your home screen like a native app</p>
                </div>
              </div>

              {/* Pointer arrow toward bottom bar */}
              <div className="flex flex-col items-center pt-1">
                <p className="text-[9px] text-slate-400 mb-1">The Share button is down here</p>
                <svg className="w-5 h-5 text-indigo-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              <button
                className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
                onClick={() => {
                  localStorage.setItem("pwa_ios_modal_dismissed", "1");
                  setShowIosInstallModal(false);
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      {(() => {
        const isAdmin = isHcpAdmin || isFinanceAdmin || isClubAdmin;
        const tabs = [
          { id: "home", label: "Home", icon: (active: boolean) => (
            <svg className={`w-5 h-5 ${active ? "text-[#1a3a2a] dark:text-[#c9a84c]" : "text-slate-400"}`} fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          )},
          { id: "records", label: "Records", icon: (active: boolean) => (
            <svg className={`w-5 h-5 ${active ? "text-[#1a3a2a] dark:text-[#c9a84c]" : "text-slate-400"}`} fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          )},
          { id: "play", label: "Play", icon: (active: boolean) => (
            <svg className={`w-5 h-5 ${active ? "text-[#1a3a2a] dark:text-[#c9a84c]" : "text-slate-400"}`} fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
            </svg>
          )},
          { id: "live", label: "Live", icon: (active: boolean) => (
            <svg className={`w-5 h-5 ${active ? "text-[#1a3a2a] dark:text-[#c9a84c]" : "text-slate-400"}`} fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072M12 12h.01" />
            </svg>
          )},
          ...(WWB_CLUB_IDS.includes(myClub?.club_id ?? 0) ? [{ id: "competitions", label: "WWB", icon: (active: boolean) => (
            <svg className={`w-5 h-5 ${active ? "text-[#1a3a2a] dark:text-[#c9a84c]" : "text-slate-400"}`} fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )}] : []),
{ id: "shop", label: "Shop", icon: (active: boolean) => (
  <svg className={`w-5 h-5 ${active ? "text-[#1a3a2a] dark:text-[#c9a84c]" : "text-slate-400"}`} fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
  )},
  { id: "travel", label: "Travel", icon: (active: boolean) => (
  <svg className={`w-5 h-5 ${active ? "text-[#1a3a2a] dark:text-[#c9a84c]" : "text-slate-400"}`} fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  )},
  { id: "club", label: "Club", icon: (active: boolean) => (
            <svg className={`w-5 h-5 ${active ? "text-[#1a3a2a] dark:text-[#c9a84c]" : "text-slate-400"}`} fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )},
          ...(isAdmin ? [{ id: "manage", label: "Manage", icon: (active: boolean) => (
            <svg className={`w-5 h-5 ${active ? "text-[#1a3a2a] dark:text-[#c9a84c]" : "text-slate-400"}`} fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}] : []),
        ] as { id: string; label: string; icon: (active: boolean) => React.ReactNode }[];

        // Get public games for the banner (all public games with open slots)
        const publicGamesForBanner = adhocGames.filter(g => 
          g.game_visibility === "public" && 
          g.status === "open" &&
          (g.max_players - (g.booked_count || 0)) > 0
        );

        return (
          <>
          {/* Rolling Banner - Shows Public Games with open slots. Click to open modal. */}
          {publicGamesForBanner.length > 0 && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setPublicGamesModalOpen(true)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPublicGamesModalOpen(true); } }}
              aria-label="View public games"
              className="fixed bottom-[60px] left-0 right-0 z-40 overflow-hidden shadow-lg cursor-pointer"
            >
              <div className="bg-gradient-to-r from-purple-600 to-purple-700">
                <div className="animate-marquee whitespace-nowrap py-3 md:py-4">
                  {publicGamesForBanner.map((game) => {
                    const slotsOpen = game.max_players - (game.booked_count || 0);
                    const clubName = allClubNames[game.club_id || 0] || "Club";
                    return (
                      <span key={game.adhoc_game_id} className="inline-flex items-center mx-8 text-white text-sm md:text-base font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-white/70 mr-2.5 animate-pulse" />
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-bold">{clubName}</span>
                        <span className="mx-2">•</span>
                        <span>{game.course_name}</span>
                        <span className="mx-2">•</span>
                        <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-bold">
                          {slotsOpen} slot{slotsOpen !== 1 ? 's' : ''} open
                        </span>
                        <span className="mx-2">•</span>
                        <span>Join in Play tab</span>
                      </span>
                    );
                  })}
                  {/* Duplicate for seamless loop */}
                  {publicGamesForBanner.map((game) => {
                    const slotsOpen = game.max_players - (game.booked_count || 0);
                    const clubName = allClubNames[game.club_id || 0] || "Club";
                    return (
                      <span key={`dup-${game.adhoc_game_id}`} className="inline-flex items-center mx-8 text-white text-sm md:text-base font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-white/70 mr-2.5 animate-pulse" />
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-bold">{clubName}</span>
                        <span className="mx-2">•</span>
                        <span>{game.course_name}</span>
                        <span className="mx-2">•</span>
                        <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-bold">
                          {slotsOpen} slot{slotsOpen !== 1 ? 's' : ''} open
                        </span>
                        <span className="mx-2">•</span>
                        <span>Join in Play tab</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <PublicGamesModal
            isOpen={publicGamesModalOpen}
            onClose={() => setPublicGamesModalOpen(false)}
            adhocGames={adhocGames}
            allClubNames={allClubNames}
          />
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 dark:bg-[#0a1210] backdrop-blur-md border-t border-slate-700 dark:border-[#1e3028] shadow-[0_-1px_20px_rgba(0,0,0,0.3)]">
            <div className="flex overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`relative flex flex-col items-center justify-center flex-1 min-w-[60px] py-2.5 px-1 gap-1 transition-all duration-200 ${isActive ? "text-[#c9a84c]" : "text-slate-400 hover:text-slate-300"}`}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] w-7 bg-[#c9a84c] rounded-full" />
                    )}
                    {tab.icon(isActive)}
                    <span className={`text-[10px] font-semibold leading-none tracking-wide ${isActive ? "text-[#c9a84c]" : "text-slate-400"}`}>
                      {tab.label}
                    </span>
                    {isActive && <div className="nav-pip" />}
                  </button>
                );
              })}
            </div>
          </nav>
          </>
        );
      })()}

      <main className="max-w-7xl mx-auto px-4 py-4 pb-24">

        {/* ═══════════════════════════════════════════════
            HOME TAB
        ═══════════════════════════════════════════════ */}
        {activeTab === "home" && <div className="space-y-4">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl p-5 text-white" style={{background: "linear-gradient(135deg, #1a3a2a 0%, #0f2318 60%, #1a3a2a 100%)"}}>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10" style={{background: "radial-gradient(circle, #c9a84c 0%, transparent 70%)", transform: "translate(30%, -30%)"}} />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-5" style={{background: "radial-gradient(circle, #c9a84c 0%, transparent 70%)", transform: "translate(-30%, 30%)"}} />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c9a84c] mb-1">Welcome back</p>
            <h2 className="text-xl font-bold tracking-tight mb-1">{memberData?.member_name?.split(" ")[0]}</h2>
            <p className="text-xs text-white/60">Your golf performance summary and standings</p>
          </div>
        </div>

        {/* Profile Picture Upload */}
        <div className="flex flex-col items-center py-3">
          <label className="relative cursor-pointer group">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleProfilePictureUpload}
              disabled={uploadingProfilePic}
            />
            <div className="w-24 h-28 rounded-[50%] overflow-hidden border-4 border-[#c9a84c] shadow-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center transition-all group-hover:border-[#1a3a2a] group-hover:shadow-xl">
              {uploadingProfilePic ? (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  <span className="text-[9px] mt-1">Uploading...</span>
                </div>
              ) : memberData?.profile_picture_url ? (
                <Image
                  src={memberData.profile_picture_url}
                  alt={memberData.member_name || "Profile"}
                  width={96}
                  height={112}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span className="text-[9px] mt-1">Add Photo</span>
                </div>
              )}
            </div>
            {/* Edit overlay on hover */}
            <div className="absolute inset-0 rounded-[50%] bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
          </label>
          <span className="text-[10px] text-slate-400 mt-2">Tap to upload profile picture</span>
          
          {/* Gender Selection */}
          <div className="flex items-center justify-center gap-4 mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="gender"
                value="male"
                checked={memberData?.gender === 'male' || (!memberData?.gender)}
                onChange={async () => {
                  if (!memberData) return;
                  const supabase = createClient();
                  await supabase
                    .from("members")
                    .update({ gender: 'male' })
                    .eq("member_id", memberData.member_id);
                  setMemberData(prev => prev ? { ...prev, gender: 'male' } : prev);
                }}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Male</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="gender"
                value="female"
                checked={memberData?.gender === 'female'}
                onChange={async () => {
                  if (!memberData) return;
                  const supabase = createClient();
                  await supabase
                    .from("members")
                    .update({ gender: 'female' })
                    .eq("member_id", memberData.member_id);
                  setMemberData(prev => prev ? { ...prev, gender: 'female' } : prev);
                }}
                className="w-4 h-4 accent-pink-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Female</span>
            </label>
          </div>
        </div>

        {/* Change PIN */}
        <Card className="border border-indigo-200 dark:border-indigo-800 shadow-sm bg-white dark:bg-slate-800">
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 10h.01" /></svg>
                Change My PIN
              </CardTitle>
              <Button
                size="sm"
                variant={showPinChange ? "secondary" : "outline"}
                className="text-[10px] h-6 px-2"
                onClick={() => {
                  setShowPinChange(!showPinChange);
                  setPinError(null);
                  setPinSuccess(false);
                  setPinNew("");
                  setPinConfirm("");
                }}
              >
                {showPinChange ? "Close" : "Change"}
              </Button>
            </div>
            <CardDescription className="text-[10px]">Update your login PIN</CardDescription>
          </CardHeader>
          {showPinChange && (
            <CardContent className="px-3 pb-3">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPinError(null);
                  setPinSuccess(false);

                  if (pinNew.length < 4 || pinNew.length > 8 || !/^\d+$/.test(pinNew)) {
                    setPinError("PIN must be 4–8 digits (numbers only).");
                    return;
                  }
                  if (pinNew !== pinConfirm) {
                    setPinError("PINs do not match.");
                    return;
                  }

                  setPinSaving(true);
                  const result = await setMemberPin(memberData?.member_id ?? 0, pinNew);
                  setPinSaving(false);

                  if (result.error) {
                    setPinError(result.error);
                  } else {
                    setPinSuccess(true);
                    setPinNew("");
                    setPinConfirm("");
                    setTimeout(() => {
                      setShowPinChange(false);
                      setPinSuccess(false);
                    }, 2000);
                  }
                }}
                className="space-y-2.5"
              >
                <div>
                  <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">New PIN (4–8 digits)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="e.g. 12345"
                    value={pinNew}
                    onChange={e => setPinNew(e.target.value.replace(/\D/g, ""))}
                    required
                    className="w-full px-2 py-1.5 text-sm border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none tracking-widest"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="Repeat your PIN"
                    value={pinConfirm}
                    onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                    required
                    className="w-full px-2 py-1.5 text-sm border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none tracking-widest"
                  />
                </div>

                {pinError && (
                  <div className="p-2 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-[10px] text-red-600 dark:text-red-400">
                    {pinError}
                  </div>
                )}

                {pinSuccess && (
                  <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-[10px] text-emerald-600 dark:text-emerald-400">
                    PIN changed successfully!
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={pinSaving}
                >
                  {pinSaving ? "Saving..." : "Save New PIN"}
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Live Leaderboard Rolling Banner - FIXED version */}
{liveScoreGameInfo && liveLeaderboardData.length > 0 && (() => {
  const activeGameIdBanner = liveScoreGameInfo?.adhoc_game_id;
  if (!activeGameIdBanner) return null;
  
  const activeGameRecord = adhocGames.find(g => g.adhoc_game_id === activeGameIdBanner);
  if (activeGameRecord?.status === "completed") return null;
  
  // Check if there's any live activity
  const activeGamePairings = allGamePairings.filter(p => p.adhoc_game_id === activeGameIdBanner);
  const hasLiveHoleScores = activeGamePairings.some(fb => fb.members.some(m => {
    const hs = holeScoreData[m.pairing_id];
    return hs && Object.keys(hs).length > 0;
  }));
  const hasUnsubmittedPairings = activeGamePairings.length > 0 && !activeGamePairings.every(p => p.allResultsSubmitted);
  const isLiveBanner = hasLiveHoleScores || hasUnsubmittedPairings;
  
  if (!isLiveBanner || liveLeaderboardData.length === 0) return null;
  
  const bannerIsMedal = MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0) || 
    (adhocGames.find(g => g.adhoc_game_id === activeGameIdBanner)?.game_type === "Medal") || 
    liveScoreGameInfo?.format === "Medal";
  
  // Double the items for seamless loop
  const items = [...liveLeaderboardData, ...liveLeaderboardData];
  
  return (
    <div 
      className="relative overflow-hidden rounded-lg text-white py-2.5 px-3 cursor-pointer transition-colors" 
      style={{background: "linear-gradient(135deg, #1C3A2A 0%, #2d5a3d 100%)", border: "1px solid #C9A84C33"}} 
      onClick={() => setActiveTab("live")}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-white/90">Live - {liveScoreGameInfo.course_name}</span>
        {liveScoreGameInfo.game_visibility === "public" && (
          <span className="px-1.5 py-0.5 text-[8px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded ml-2">PUBLIC</span>
        )}
      </div>
      <div className="overflow-hidden">
        <div className="flex gap-5 animate-[scroll_120s_linear_infinite] whitespace-nowrap" style={{ width: "max-content" }}>
          {items.map((p, idx) => {
            const toParStr = p.netToPar === null ? "-" : p.netToPar === 0 ? "E" : p.netToPar > 0 ? `+${p.netToPar}` : `${p.netToPar}`;
            const toParColor = p.netToPar === null ? "" : p.netToPar < 0 ? "text-green-300" : p.netToPar === 0 ? "text-green-200" : "text-red-300";
            return (
              <div key={`${p.pairing_id}-${idx}`} className="flex items-center gap-2 text-sm shrink-0">
                <span className="font-bold text-white/60 text-xs">{(idx % liveLeaderboardData.length) + 1}.</span>
                <span className="font-semibold">{getDisplayName(p.member_name, liveLeaderboardData.map(b => b.member_name))}</span>
                <span className="text-white/50 text-xs">({p.playing_handicap})</span>
                <span className={`font-bold ${toParColor}`}>{toParStr}</span>
                <span className="font-bold text-amber-300">{bannerIsMedal ? `${p.net ?? '-'}net` : `${p.points}pts`}</span>
                <span className="text-white/40 text-xs">thru {p.thru}</span>
                <span className="text-white/20">|</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
})()}


        {/* Primary Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardDescription className="text-[10px] uppercase tracking-wide">
                {myClub?.club_id === 4 ? "Playing Handicap" : `${myClub?.club_name ? myClub.club_name.replace(" Golf Club", "") : "Club"} Handicap Index`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {handicap?.remmoho_handicap_index?.toFixed(1) || "N/A"}
              </div>
              {handicap?.previous_handicap_index != null && (
                <div className="text-[10px] mt-0.5 flex items-center gap-1">
                  <span className="text-slate-400">Previous:</span>
                  <span className="font-medium text-slate-500">{handicap.previous_handicap_index.toFixed(1)}</span>
                  {handicap.remmoho_handicap_index != null && (() => {
                    const diff = handicap.remmoho_handicap_index - handicap.previous_handicap_index;
                    if (Math.abs(diff) < 0.05) return <span className="text-slate-400">(no change)</span>;
                    return diff < 0 
                      ? <span className="text-green-600 font-semibold">({diff.toFixed(1)})</span>
                      : <span className="text-red-500 font-semibold">(+{diff.toFixed(1)})</span>;
                  })()}
                </div>
              )}
              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                {editingOfficialHcp ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setSavingOfficialHcp(true);
                    const { createClient } = await import("@/lib/supabase/client");
                    const supabase = createClient();
                    const newOfficial = Number(newOfficialHcp);
                    const currentReMmoho = handicap?.remmoho_handicap_index ?? newOfficial;
                    // ReMmoho is the lower of the previously stored ReMmoho and the new HNA Official
                    const newReMmoho = Math.round(Math.min(currentReMmoho, newOfficial) * 10) / 10;
                    const season = new Date().getFullYear().toString();

                    // Check if a record already exists for this season
                    const { data: existing } = await supabase
                      .from("member_handicap_indices")
                      .select("handicap_index_id")
                      .eq("member_id", memberData!.member_id)
                      .eq("season", season)
                      .maybeSingle();

                    let error;
                    if (existing) {
                      ({ error } = await supabase
                        .from("member_handicap_indices")
                        .update({
                          official_handicap_index: newOfficial,
                          remmoho_handicap_index: newReMmoho,
                        })
                        .eq("handicap_index_id", existing.handicap_index_id));
                    } else {
                      ({ error } = await supabase
                        .from("member_handicap_indices")
                        .insert({
                          member_id: memberData!.member_id,
                          official_handicap_index: newOfficial,
                          remmoho_handicap_index: newReMmoho,
                          season,
                          effective_date: new Date().toISOString().split("T")[0],
                        }));
                    }

                    if (!error) {
                      setMemberData(prev => prev ? {
                        ...prev,
                        member_handicap_indices: [{
                          official_handicap_index: newOfficial,
                          remmoho_handicap_index: newReMmoho,
                          previous_handicap_index: handicap?.previous_handicap_index ?? null,
                          season,
                        }],
                      } : prev);
                      // Re-read from DB to guarantee the displayed value matches what was saved
                      await refreshMemberHandicap();
                    } else {
                      alert("Failed to update handicap: " + (error?.message || "Unknown error"));
                    }
                    setSavingOfficialHcp(false);
                    setEditingOfficialHcp(false);
                  }} className="flex items-center gap-1">
                    <span className="text-slate-600 dark:text-slate-400">HNA Official:</span>
                    <input
                      type="number"
                      step="0.1"
                      value={newOfficialHcp}
                      onChange={(e) => setNewOfficialHcp(e.target.value)}
                      className="w-14 text-[10px] px-1 py-0.5 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      autoFocus
                    />
                    <button type="submit" disabled={savingOfficialHcp} className="text-[9px] px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                      {savingOfficialHcp ? "..." : "Save"}
                    </button>
                    <button type="button" onClick={() => setEditingOfficialHcp(false)} className="text-[9px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300">
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <span>HNA Official: {handicap?.official_handicap_index?.toFixed(1) || "N/A"}</span>
                    <button
                      onClick={() => {
                        // Default to 18.0 if no handicap exists yet
                        const currentOfficial = handicap?.official_handicap_index ?? 18.0;
                        setNewOfficialHcp(currentOfficial.toFixed(1));
                        setEditingOfficialHcp(true);
                      }}
                      className="ml-1 text-[9px] px-1 py-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                      title="Update official handicap index"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
              <div className="mt-2">

                <select
                  className="w-full text-[10px] p-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  value={selectedCourse?.course_id || ""}
                  onChange={(e) => {
                    const course = courses.find(c => c.course_id === Number(e.target.value));
                    setSelectedCourse(course || null);
                  }}
                >
                  <option value="">Select course...</option>
                  {courses.map(c => (
                    <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                  ))}
                </select>
                {selectedCourse && handicap?.remmoho_handicap_index && (
                  <div className="mt-1 p-1 bg-blue-50 dark:bg-blue-900 rounded text-[10px]">
                    <span className="text-slate-500">Course HCP: </span>
                    <span className="font-bold text-blue-600 dark:text-blue-300">
                      {(() => {
                        const calc = Math.round(handicap.remmoho_handicap_index * (selectedCourse.slope_rating / 113) + (Number(selectedCourse.course_rating) - 72));
                        return myClub?.club_id === 1 ? Math.min(calc, 18) : calc;
                      })()}
                    </span>
                    {myClub?.club_id === 1 && <span className="text-slate-400 ml-1">(max 18)</span>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Balance Card - disabled for all clubs */}
          {false && <Card className={`border shadow-sm ${balance > 0 ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'}`}>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardDescription className="text-[10px] uppercase tracking-wide">Account Balance</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className={`text-sm font-bold ${balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                R {Math.abs(balance).toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {balance > 0 ? "Amount owed" : balance < 0 ? "Credit balance" : "Settled"}
              </div>
              <div className="text-[9px] text-slate-400 mt-1">
                As at {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
              </div>
              {/* Day's Sins - show for submitted pairings today */}
              {(() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const todayPairings = myPairings.filter(p => p.game_date === todayStr && p.allResultsSubmitted);
                if (todayPairings.length === 0) return null;
                
                return todayPairings.map((pairing) => {
                  const me = pairing.members.find(m => m.member_name === memberData?.member_name);
                  if (!me || !me.result_submitted) return null;

                  const pts = me.points || 0;
                  const birdies = me.birdies_count || 0;
                  const eagles = me.eagles_count || 0;
                  const hio = me.hio_count || 0;
                  const ladies = me.ladies_count || 0;
                  // Calculate totals across ENTIRE game field (all fourballs)
                  const allFourballs = allGamePairings.filter(p => p.adhoc_game_id === pairing.adhoc_game_id).sort((a, b) => a.fourball_number - b.fourball_number);
                  let totalBirdies = 0, totalEagles = 0, totalHio = 0;
                  allFourballs.forEach(fb => fb.members.forEach(m => {
                    if (!m.is_no_show) {
                      totalBirdies += m.birdies_count || 0;
                      totalEagles += m.eagles_count || 0;
                      totalHio += m.hio_count || 0;
                    }
                  }));
                  // Fallback to just this fourball if no cross-fourball data
                  if (totalBirdies === 0 && totalEagles === 0 && totalHio === 0) {
                    pairing.members.filter(m => !m.is_no_show).forEach(m => {
                      totalBirdies += m.birdies_count || 0;
                      totalEagles += m.eagles_count || 0;
                      totalHio += m.hio_count || 0;
                    });
                  }

                  let subFee = 0;
                  if (pts < 10) subFee = 150;
                  else if (pts <= 17) subFee = 100;
                  else if (pts <= 25) subFee = 50;
                  else if (pts <= 29) subFee = 20;
                  
                  const birdieCharge = (totalBirdies - birdies) * 20;
                  const eagleCharge = totalEagles * 20;
                  const hioCharge = totalHio * 50;
                  const ladiesFee = ladies > 0 ? 100 : 0;
                  const lateFee = me.is_late ? 110 : 0;
                  
                  const sinLines: { label: string; amount: number }[] = [];
                  if (subFee > 0) sinLines.push({ label: `Sub (${pts}pts)`, amount: subFee });
                  if (birdieCharge > 0) sinLines.push({ label: `Birdies (${totalBirdies - birdies}x R20)`, amount: birdieCharge });
                  if (eagleCharge > 0) sinLines.push({ label: `Eagles (${totalEagles}x R20)`, amount: eagleCharge });
                  if (hioCharge > 0) sinLines.push({ label: `HiO/Alb (${totalHio}x R50)`, amount: hioCharge });
                  if (ladiesFee > 0) sinLines.push({ label: `Ladies (${ladies})`, amount: ladiesFee });
                  if (lateFee > 0) sinLines.push({ label: "Late", amount: lateFee });
                  
                  const totalSins = sinLines.reduce((s, l) => s + l.amount, 0);
                  if (sinLines.length === 0 && !me.is_no_show) return null;
                  
                  return (
                    <div key={pairing.fourball_number} className="mt-3 border-t border-orange-200 dark:border-orange-700 pt-2">
                      <div className="text-[9px] font-semibold text-orange-600 dark:text-orange-400 mb-1.5 uppercase tracking-wide">
                        {"Day's Sins - "}{pairing.course_name}
                      </div>
                      <div className="space-y-1">
                        {sinLines.map((line, i) => (
                          <div key={i} className="flex justify-between text-[9px]">
                            <span className="text-slate-600 dark:text-slate-400">{line.label}</span>
                            <span className={`font-medium ${line.amount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {line.amount > 0 ? `R${line.amount}` : `-R${Math.abs(line.amount)}`}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-[10px] font-bold border-t border-orange-100 dark:border-orange-800 pt-1 mt-1">
                          <span className="text-orange-700 dark:text-orange-300">Total</span>
                          <span className={totalSins > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                            {totalSins > 0 ? `R${totalSins}` : `-R${Math.abs(totalSins)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
              {recentTransactions.length > 0 && (
                <div className="mt-3 border-t border-slate-200 dark:border-slate-600 pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Recent Transactions</div>
                    <div className="text-[8px] text-slate-400">{recentTransactions.length} entries</div>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {recentTransactions.map((txn, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 text-[9px] py-0.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-500 dark:text-slate-400">
                            {new Date(txn.transaction_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                          </div>
                          <div className="text-slate-700 dark:text-slate-300 truncate" title={txn.description}>
                            {txn.description}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-medium whitespace-nowrap ${txn.debit > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {txn.debit > 0 ? `+R${txn.debit.toFixed(0)}` : `-R${txn.credit.toFixed(0)}`}
                          </div>
                          <div className="text-[7px] text-slate-400">Bal: R{txn.balance.toFixed(0)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>}

          <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardDescription className="text-[10px] uppercase tracking-wide">Games Played</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {totalGames}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Avg: {avgPoints} pts/game
              </div>
              {nextGame ? (
                <div className="mt-1 p-1 bg-green-50 dark:bg-green-900 rounded text-[10px]">
                  <div className="text-slate-500">Next Game:</div>
                  <div className="font-medium text-green-700 dark:text-green-300">{nextGame.course_name}</div>
                  <div className="text-[9px] text-slate-500">{new Date(nextGame.game_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
              ) : (
                <div className="mt-1 p-1 bg-slate-50 dark:bg-slate-700 rounded text-[10px] text-slate-400">
                  No upcoming games
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardDescription className="text-[10px] uppercase tracking-wide">Best Score</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {(() => {
                const bestGame = recentGames && recentGames.length > 0
                  ? recentGames.reduce((best, g) => (g.points || 0) > (best.points || 0) ? g : best, recentGames[0])
                  : null;
                if (!bestGame) return <div className="text-lg font-bold text-slate-400">N/A</div>;
                return (
                  <>
                    <div className="flex items-center gap-1">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{bestGame.points}</div>
                      <div className="flex text-amber-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Points (Stableford)</div>
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-0.5">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-slate-400">Course</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{bestGame.courses?.course_name || "Unknown"}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-slate-400">Date</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(bestGame.game_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-slate-400">Gross</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{bestGame.gross_score || "-"}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Join Request Notifications - For Organizers */}
        {pendingJoinRequests.length > 0 && (
          <Card className="border border-orange-200 dark:border-orange-800 shadow-sm bg-orange-50 dark:bg-orange-950/30">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-2 text-orange-700 dark:text-orange-300">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Join Requests ({pendingJoinRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              {pendingJoinRequests.map(req => (
                <div key={req.request_id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg border border-orange-100 dark:border-orange-900">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{req.requester_name}</p>
                    <p className="text-[10px] text-slate-500">{req.course_name} - {new Date(req.game_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</p>
                  </div>
                  <div className="flex gap-1.5 ml-2">
                    <button 
                      onClick={() => handleJoinRequestResponse(req.request_id, 'approve')}
                      disabled={joinRequestProcessing === req.request_id}
                      className="px-2 py-1 text-[10px] font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {joinRequestProcessing === req.request_id ? "..." : "Admit"}
                    </button>
                    <button 
                      onClick={() => handleJoinRequestResponse(req.request_id, 'deny')}
                      disabled={joinRequestProcessing === req.request_id}
                      className="px-2 py-1 text-[10px] font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* My Join Request Status - For Requesters */}
        {myJoinRequests.filter(r => r.status !== 'approved' || Date.now() - new Date(r.responded_at || r.created_at).getTime() < 24 * 60 * 60 * 1000).length > 0 && (
          <Card className="border border-blue-200 dark:border-blue-800 shadow-sm bg-blue-50 dark:bg-blue-950/30">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Your Join Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              {myJoinRequests.filter(r => r.status !== 'approved' || Date.now() - new Date(r.responded_at || r.created_at).getTime() < 24 * 60 * 60 * 1000).map(req => (
                <div key={req.request_id} className={`flex items-center justify-between p-2 rounded-lg border ${
                  req.game_status === 'cancelled' || req.game_status === 'deleted' ? 'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800 opacity-50' :
                  req.status === 'pending' ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' :
                  req.status === 'approved' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' :
                  'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${req.game_status === 'cancelled' || req.game_status === 'deleted' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>{req.course_name}</p>
                    <p className="text-[10px] text-slate-500">{new Date(req.game_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} - Hosted by {req.organizer_name}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                    req.game_status === 'cancelled' || req.game_status === 'deleted' ? 'bg-gray-200 text-gray-800' :
                    req.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                    req.status === 'approved' ? 'bg-green-200 text-green-800' :
                    'bg-red-200 text-red-800'
                  }`}>
                    {req.game_status === 'cancelled' || req.game_status === 'deleted' ? 'Game Cancelled' : req.status === 'pending' ? 'Pending' : req.status === 'approved' ? 'Approved' : 'Denied'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Consolidated Standings Section */}
        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              League Standings
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={`grid gap-2 ${Number(myClub?.club_id) === 10 ? "grid-cols-1" : Number(myClub?.club_id) === 13 ? "grid-cols-2" : Number(myClub?.club_id) === 1 ? "grid-cols-4" : "grid-cols-3"}`}>
              
              {/* For WSOE Club 13 - Show CoC instead of Quarter */}
              {Number(myClub?.club_id) === 13 ? (
                <button 
                  onClick={() => setStandingsModal("coc")} 
                  className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 hover:border-amber-400 hover:shadow-md transition-all active:scale-95 cursor-pointer w-full"
                >
                  <div className="flex justify-center mb-1">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[8px] font-bold">CC</span>
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase mb-1">Champ of Champs</div>
                  <div className="text-lg font-bold text-amber-600">
                    {cocLoading ? "-" : cocTopPoints || 0}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    {cocLoading ? "Loading..." : (cocTopPlayer || "No data")}
                  </div>
                  <div className="mt-1 text-[8px] text-slate-400">{cocAllChampions.length} champions</div>
                  <div className="mt-1 text-[8px] text-slate-400">Tap to view</div>
                </button>
              ) : (
                /* Quarter - Hidden for Club ID 10 and Club 19 */
                Number(myClub?.club_id) !== 10 && Number(myClub?.club_id) !== 19 && (
                  <button onClick={() => setStandingsModal("quarter")} className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 hover:border-amber-400 hover:shadow-md transition-all active:scale-95 cursor-pointer w-full">
                    <div className="flex justify-center mb-1">
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[8px] font-bold">Q2</span>
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase mb-1">Quarter</div>
                    <div className="text-lg font-bold text-amber-600">{calculatedQuarterPosition ? `#${calculatedQuarterPosition}` : "-"}</div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400">{quarterCalcPoints || quarterPoints || 0} pts</div>
                    {quarterLeader && calculatedQuarterPosition && calculatedQuarterPosition > 1 && (
                      <div className="mt-1 text-[8px] text-amber-600">
                        Gap to P1: {quarterLeader.total_points - (quarterCalcPoints || quarterPoints)} pts
                      </div>
                    )}
                    {calculatedQuarterPosition === 1 && <div className="mt-1 text-[8px] text-green-600 font-semibold">Leader</div>}
                    <div className="mt-1 text-[8px] text-slate-400">Tap to view</div>
                  </button>
                )
              )}

              {/* Annual - Always show except Club 10 and Club 19 */}
              {Number(myClub?.club_id) !== 10 && Number(myClub?.club_id) !== 19 && (
                <button onClick={() => setStandingsModal("annual")} className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 hover:border-blue-400 hover:shadow-md transition-all active:scale-95 cursor-pointer w-full">
                  <div className="flex justify-center mb-1">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-bold">A</span>
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase mb-1">Annual</div>
                  <div className="text-lg font-bold text-blue-600">{calculatedAnnualPosition ? `#${calculatedAnnualPosition}` : "-"}</div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">{annualCalcPoints || 0} pts</div>
                  <div className="mt-1 text-[8px] text-slate-400">Tap to view</div>
                </button>
              )}

  {/* Medal - Hidden for Club 13 (WSOE) and Club 19 (Fairway Finders) */}
  {Number(myClub?.club_id) !== 13 && Number(myClub?.club_id) !== 19 && (
    <button onClick={() => setStandingsModal("medal")} className="text-center p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900 hover:border-indigo-400 hover:shadow-md transition-all active:scale-95 cursor-pointer w-full">
      <div className="flex justify-center mb-1">
        <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[8px] font-bold">M</span>
      </div>
      <div className="text-[9px] text-slate-500 uppercase mb-1">Medal</div>
      <div className="text-lg font-bold text-indigo-600">{calculatedMedalPosition ? `#${calculatedMedalPosition}` : "-"}</div>
      <div className="text-[10px] text-slate-600 dark:text-slate-400">{medalYearPoints || 0} pts</div>
      <div className="mt-1 text-[8px] text-slate-400">Tap to view</div>
    </button>
  )}

  {/* Order of Merit - Only Club 19 (Fairway Finders) */}
  {Number(myClub?.club_id) === 19 && (
    <button onClick={() => setStandingsModal("oom")} className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-500 hover:shadow-md transition-all active:scale-95 cursor-pointer w-full">
      <div className="flex justify-center mb-1">
        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[8px] font-bold">OOM</span>
      </div>
      <div className="text-[9px] text-slate-500 uppercase mb-1">Order of Merit</div>
      <div className="text-lg font-bold text-emerald-600">{calculatedOomPosition ? `#${calculatedOomPosition}` : "-"}</div>
      <div className="text-[10px] text-slate-600 dark:text-slate-400">{oomYearPoints || 0} pts</div>
      <div className="mt-1 text-[8px] text-slate-400">Tap to view</div>
    </button>
  )}

              {/* Iron Man - Only Club 1 (ReMmoho) */}
              {Number(myClub?.club_id) === 1 && (
                <button onClick={() => setStandingsModal("ironman")} className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 hover:border-amber-500 hover:shadow-md transition-all active:scale-95 cursor-pointer w-full">
                  <div className="flex justify-center mb-1">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[8px] font-bold">IM</span>
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase mb-1">Iron Man</div>
                  <div className="text-[9px] text-amber-700 font-semibold leading-tight">Mar 15</div>
                  <div className="text-[9px] text-slate-400 leading-tight">2 rounds</div>
                  <div className="mt-1 text-[8px] text-slate-400">Tap to view</div>
                </button>
              )}
            </div>

            {/* Hole-by-Hole Score Viewer Modal */}
            {scoreViewerPlayer && (() => {
              const hcp = scoreViewerPlayer.playing_handicap;
              const holes = courseHoles.length > 0
                ? courseHoles
                : Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, stroke_index: i + 1 }));

              let totalGross = 0, totalNet = 0, totalPoints = 0, totalPar = 0;
              const front9 = holes.filter(h => h.hole_number <= 9);
              const back9 = holes.filter(h => h.hole_number >= 10);

  // Helper to calculate handicap strokes with gender support
  const getHcpStrokes = (handicap: number, strokeIndex: number, gender?: string, ladiesSI?: number): number => {
    if (!handicap || handicap <= 0) return 0;
    
    // Use ladies SI if player is female and ladies SI exists
    const effectiveSI = (gender === 'female' && ladiesSI) ? ladiesSI : strokeIndex;
    
    const handicapInt = Math.floor(handicap);
    let totalStrokes = Math.floor(handicapInt / 18);
    const remaining = handicapInt % 18;
    if (remaining > 0 && effectiveSI <= remaining) {
      totalStrokes++;
    }
    return totalStrokes;
  };

              // Get player gender for ladies SI lookup
              const playerMember = memberDirectory.find(m => m.member_name === scoreViewerPlayer?.member_name);
              const playerGender = playerMember?.gender;
              const game = adhocGames.find(g => g.adhoc_game_id === scorecardGameId);
              const courseId = game?.course_id;

              const scoreRows = holes.map(hole => {
                const strokes = scoreViewerHoles[hole.hole_number] ?? null;
                const ladiesSI = courseId ? ladiesStrokeMap[courseId]?.[hole.hole_number] : undefined;
                const hcpStrokes = strokes !== null ? getHcpStrokes(hcp, hole.stroke_index, playerGender, ladiesSI) : 0;
                const net = strokes !== null ? strokes - hcpStrokes : null;
                const cappedNet = net !== null ? Math.min(net, hole.par + 2) : null;
                const pts = cappedNet !== null ? Math.max(0, 2 + hole.par - cappedNet) : null;
                
                if (strokes !== null) { 
                  totalGross += strokes; 
                  totalPar += hole.par;
                  if (net !== null) totalNet += net;
                  if (pts !== null) totalPoints += pts;
                }
                
                return { ...hole, strokes, net, pts };
              });

              const front9Gross = front9.reduce((s, h) => s + (scoreViewerHoles[h.hole_number] ?? 0), 0);
              const back9Gross = back9.reduce((s, h) => s + (scoreViewerHoles[h.hole_number] ?? 0), 0);
              
              const front9Points = scoreRows.filter(r => r.hole_number <= 9).reduce((s, r) => s + (r.pts ?? 0), 0);
              const back9Points = scoreRows.filter(r => r.hole_number >= 10).reduce((s, r) => s + (r.pts ?? 0), 0);
              
              // Calculate front 9 net total
              let front9NetTotal = 0;
              for (const r of scoreRows.filter(r => r.hole_number <= 9)) {
                if (r.strokes !== null) {
                  const hcpStrokes = getHcpStrokes(hcp, r.stroke_index);
                  front9NetTotal += r.strokes - hcpStrokes;
                }
              }
              
              // Calculate back 9 net total
              let back9NetTotal = 0;
              for (const r of scoreRows.filter(r => r.hole_number >= 10)) {
                if (r.strokes !== null) {
                  const hcpStrokes = getHcpStrokes(hcp, r.stroke_index);
                  back9NetTotal += r.strokes - hcpStrokes;
                }
              }

              const ScoreCell = ({ strokes, net, pts, par }: { strokes: number | null; net: number | null; pts: number | null; par: number }) => {
                if (strokes === null) return <span className="text-[9px] text-slate-300">-</span>;
                const diff = par - strokes;
                const bg = diff >= 2 ? "bg-yellow-300 text-yellow-900"
                  : diff === 1 ? "bg-red-500 text-white rounded-full"
                  : diff === 0 ? ""
                  : diff === -1 ? "border border-slate-400"
                  : "border-2 border-slate-400";
                return (
                  <div className="flex flex-col items-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 text-[10px] font-bold ${bg}`}>
                      {strokes}
                    </span>
                    {net !== null && (
                      <div className="flex items-center justify-center gap-0.5 mt-0.5">
                        <span className="text-[7px] font-medium text-blue-600 dark:text-blue-400">{net}</span>
                        <span className="text-[5px] text-slate-300">|</span>
                        <span className="text-[7px] font-bold text-indigo-600 dark:text-indigo-400">{pts}</span>
                      </div>
                    )}
                  </div>
                );
              };

              const HalfTable = ({ rows, subtotalGross, subtotalNet, subtotalPts, label }: {
                rows: typeof scoreRows; 
                subtotalGross: number; 
                subtotalNet: number;
                subtotalPts: number; 
                label: string;
              }) => (
                <div className="overflow-x-auto">
                  <table className="w-full text-[7px]" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: "28px" }} />
                      {rows.map(h => <col key={h.hole_number} style={{ width: "38px" }} />)}
                      <col style={{ width: "30px" }} />
                    </colgroup>
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                        <td className="py-0.5 font-semibold text-slate-500">{label}</td>
                        {rows.map(h => <td key={h.hole_number} className="text-center py-0.5 font-semibold">{h.hole_number}</td>)}
                        <td className="text-center py-0.5 font-bold text-slate-500">{label === "OUT" ? "OUT" : "IN"}</td>
                      </tr>
                      <tr className="text-slate-400">
                        <td className="py-0.5 text-slate-400">Par</td>
                        {rows.map(h => <td key={h.hole_number} className="text-center py-0.5">{h.par}</td>)}
                        <td className="text-center py-0.5 font-semibold text-slate-500">{rows.reduce((s, h) => s + h.par, 0)}</td>
                      </tr>
                      <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                        <td className="py-0.5 text-slate-400">SI</td>
                        {rows.map(h => {
                          const isFemale = scoreViewerPlayer?.member_name && 
                            memberDirectory.find(m => m.member_name === scoreViewerPlayer.member_name)?.gender === 'female';
                          const ladiesSI = isFemale && courseId && ladiesStrokeMap[courseId]?.[h.hole_number];
                          const displaySI = ladiesSI || h.stroke_index;
                          return (
                            <td key={h.hole_number} className="text-center py-0.5">
                              <span className={ladiesSI ? "text-pink-600 font-semibold" : ""}>
                                {displaySI}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-center py-0.5"></td>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Gross row */}
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <td className="text-[8px] text-slate-600 dark:text-slate-300 font-semibold py-1">Grs</td>
                        {rows.map(r => (
                          <td key={r.hole_number} className="text-center py-1 px-0.5">
                            <span className="text-[10px] font-bold">{r.strokes ?? "-"}</span>
                          </td>
                        ))}
                        <td className="text-center text-[9px] font-bold text-slate-700 dark:text-slate-200">{subtotalGross || "-"}</td>
                      </tr>
                      {/* Net row */}
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <td className="text-[8px] text-blue-600 dark:text-blue-400 font-semibold py-1">Net</td>
                        {rows.map(r => {
                          if (r.strokes === null) {
                            return <td key={r.hole_number} className="text-center py-1 px-0.5"><span className="text-[9px] text-slate-300">-</span></td>;
                          }
                          const hcpStrokes = getHcpStrokes(hcp, r.stroke_index);
                          const netScore = r.strokes - hcpStrokes;
                          return (
                            <td key={r.hole_number} className="text-center py-1 px-0.5">
                              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">{netScore}</span>
                            </td>
                          );
                        })}
                        <td className="text-center text-[9px] font-bold text-blue-600 dark:text-blue-400">{subtotalNet || "-"}</td>
                      </tr>
                      {/* Points row */}
                      <tr>
                        <td className="text-[8px] text-indigo-600 dark:text-indigo-400 font-semibold py-1">Pts</td>
                        {rows.map(r => (
                          <td key={r.hole_number} className="text-center py-1 px-0.5">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{r.pts ?? "-"}</span>
                          </td>
                        ))}
                        <td className="text-center text-[9px] font-bold text-indigo-600 dark:text-indigo-400">{subtotalPts}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );

              return (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setScoreViewerPlayer(null)}>
                  <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="px-4 py-3 bg-indigo-600 flex items-center justify-between shrink-0">
                      <div>
                        <h3 className="text-base font-bold text-white">{formatMemberName(scoreViewerPlayer.member_name)}</h3>
                        <p className="text-[10px] text-indigo-200">HCP {hcp} · Hole by Hole</p>
                      </div>
                      <button onClick={() => setScoreViewerPlayer(null)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>

                    {scoreViewerLoading ? (
                      <div className="flex items-center justify-center py-10 text-sm text-slate-400">Loading scores...</div>
                    ) : (
                      <div className="overflow-y-auto flex-1 px-3 py-3 space-y-4">

                        {/* Legend */}
                        <div className="flex flex-wrap gap-2 text-[8px] text-slate-500">
                          <span className="flex items-center gap-0.5"><span className="inline-flex w-4 h-4 bg-yellow-300 text-yellow-900 items-center justify-center font-bold text-[7px] rounded-sm">2</span>Eagle+</span>
                          <span className="flex items-center gap-0.5"><span className="inline-flex w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center font-bold text-[7px]">3</span>Birdie</span>
                          <span className="flex items-center gap-0.5"><span className="inline-flex w-4 h-4 items-center justify-center font-bold text-[7px] text-slate-600">4</span>Par</span>
                          <span className="flex items-center gap-0.5"><span className="inline-flex w-4 h-4 border border-slate-400 items-center justify-center font-bold text-[7px] text-slate-600">5</span>Bogey</span>
                          <span className="flex items-center gap-0.5"><span className="inline-flex w-4 h-4 border-2 border-slate-400 items-center justify-center font-bold text-[7px] text-slate-600">6</span>Dbl+</span>
                        </div>

                        {/* Front 9 */}
                        <div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">FRONT 9</div>
                          <HalfTable 
                            rows={scoreRows.filter(r => r.hole_number <= 9)} 
                            subtotalGross={front9Gross} 
                            subtotalNet={front9NetTotal}
                            subtotalPts={front9Points} 
                            label="OUT" 
                          />
                        </div>

                        {/* Back 9 */}
                        <div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">BACK 9</div>
                          <HalfTable 
                            rows={scoreRows.filter(r => r.hole_number >= 10)} 
                            subtotalGross={back9Gross} 
                            subtotalNet={back9NetTotal}
                            subtotalPts={back9Points} 
                            label="IN" 
                          />
                        </div>

                        {/* Totals */}
                        <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                          {[
                            { label: "Gross", value: totalGross || "-" },
                            { label: "Net", value: totalNet || "-" },
                            { label: "Points", value: totalPoints },
                            { label: "HCP", value: hcp },
                          ].map(item => (
                            <div key={item.label} className="text-center bg-slate-50 dark:bg-slate-800 rounded py-2">
                              <div className="text-[7px] text-slate-400 uppercase tracking-wide">{item.label}</div>
                              <div className="text-base font-bold text-slate-800 dark:text-slate-100">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Standings Modal */}
            {standingsModal === "ironman" && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setStandingsModal(null)}>
                <div className="bg-white dark:bg-slate-900 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950 border-b border-amber-100 dark:border-amber-900 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Iron Man Championship</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{myClub?.club_name} · 15 Mar 2026 · Benoni Lake &amp; BCC · IPS</p>
                    </div>
                    <button onClick={() => setStandingsModal(null)} className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 shadow flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    <IronManLeaderboard memberData={memberData} />
                  </div>
                </div>
              </div>
            )}

{standingsModal && standingsModal !== "ironman" && standingsModal !== "coc" && (() => {
  const isQuarter = standingsModal === "quarter";
  const isAnnual = standingsModal === "annual";
  const isMedal = standingsModal === "medal";
  const isOom = standingsModal === "oom";
  const standings = isQuarter ? quarterStandings : isAnnual ? annualStandings : isOom ? oomStandings : medalStandings;
  const title = isQuarter ? "Q2 Quarter Standings" : isAnnual ? "Annual Standings" : isOom ? "Order of Merit" : "Medal Standings";
  const subtitle = isQuarter ? "Best 6 scores (Mar–May 2026)" : isAnnual ? "Best 20 scores (Dec–Nov)" : isOom ? "Total OOM points (Dec–Nov)" : "Best 6 medal points (Dec–Nov)";
  const accentColor = isQuarter ? "amber" : isAnnual ? "blue" : isOom ? "emerald" : "indigo";
  const myPoints = isQuarter ? (quarterCalcPoints || quarterPoints || 0) : isAnnual ? (annualCalcPoints || yearPoints || 0) : isOom ? oomYearPoints : medalYearPoints;
  const leader = standings[0];
              const leaderPoints = leader?.total_points || 0;

              return (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setStandingsModal(null)}>
                  <div className="bg-white dark:bg-slate-900 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className={`px-4 py-3 bg-${accentColor}-50 dark:bg-${accentColor}-950 border-b border-${accentColor}-100 dark:border-${accentColor}-900 flex items-center justify-between`}>
                      <div>
                        <h3 className={`text-sm font-bold text-${accentColor}-800 dark:text-${accentColor}-200`}>{title}</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{myClub?.club_name} · {subtitle}</p>
                      </div>
                      <button onClick={() => setStandingsModal(null)} className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 shadow flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>

                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
                      <div className="col-span-2 text-center">Pos</div>
                      <div className="col-span-6 text-center">Member</div>
                      <div className="col-span-2 text-center">Points</div>
                      <div className="col-span-2 text-center">Gap</div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                      {standings.length === 0 ? (
                        <div className="text-center text-xs text-slate-400 py-8">No standings data yet</div>
                      ) : (
                        standings.map((s, idx) => {
                          const isMe = s.member_id === memberData?.member_id;
                          const gap = leaderPoints - s.total_points;
                          const isFirst = idx === 0;
                          const isSecond = idx === 1;
                          const isThird = idx === 2;
                          return (
                            <div key={s.member_id} className={`grid grid-cols-12 gap-1 items-center px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 ${isMe ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}>
                              <div className="col-span-2 text-center">
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
                              <div className="col-span-6 flex items-center justify-center gap-1.5">
                                {isFirst && <svg className="w-3 h-3 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>}
                                <span className={`text-xs truncate ${isMe ? "font-bold text-blue-700 dark:text-blue-300" : isFirst ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                                  {s.member_name.split(" ").slice(0, 2).join(" ")}
                                  {isMe && <span className="ml-1 text-[9px] text-blue-500">(You)</span>}
                                </span>
                              </div>
                              <div className={`col-span-2 text-center text-xs font-bold ${isFirst ? "text-amber-600" : isMe ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"}`}>
                                {s.total_points}
                              </div>
                              <div className="col-span-2 text-center text-[10px] text-slate-400">
                                {isFirst ? <span className="text-green-600 font-semibold text-[9px]">Leader</span> : `-${gap}`}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-[9px] text-slate-400 text-center">
                      {standings.length} members · Your points: {myPoints}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* CoC Modal - Champ of Champions */}
            {standingsModal === "coc" && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setStandingsModal(null)}>
                <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  {/* Header */}
                  <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950 border-b border-amber-100 dark:border-amber-900 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Champ of Champions {new Date().getFullYear()}</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {cocAllChampions.length} tournament winners this season
                      </p>
                    </div>
                    <button onClick={() => setStandingsModal(null)} className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 shadow flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                  
  {/* Champions List */}
  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-700">
    {cocAllChampions.map((champ, idx) => (
      <div key={champ.member_id} className="px-3 py-2">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold w-8 ${idx === 0 ? "text-amber-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-700" : "text-slate-500"}`}>
              {idx + 1}
            </span>
            <div className="text-left">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {champ.member_name}
              </div>
              <div className="text-[9px] text-slate-400">
                {champ.total_wins} win{champ.total_wins !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <div className="text-base font-bold text-amber-600 dark:text-amber-400">
            {champ.total_points} pts
          </div>
        </div>
        {/* Win details with course names */}
        {champ.wins && champ.wins.length > 0 && (
          <div className="mt-1.5 ml-11 space-y-0.5">
            {champ.wins.map((win, winIdx) => (
              <div key={winIdx} className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400">
                <span className="truncate max-w-[180px]">
                  {win.course_name} ({new Date(win.game_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })})
                </span>
                <span className="font-medium text-amber-600 dark:text-amber-400 ml-2">
                  {win.points_earned} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
                  
                  {/* Footer */}
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-[9px] text-slate-400 text-center">
                    {cocAllChampions.length} champions · Season {new Date().getFullYear()}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        </div>}

        {/* ═══════════════════════════════════════════════
            RECORDS TAB
        ═══════════════════════════════════════════════ */}
        {activeTab === "records" && <div className="space-y-4">

        {/* My Recent Results - only games the logged-in member participated in */}
        {memberRecentResults.length > 0 && (
          <Card className="border border-orange-200 dark:border-orange-800 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm font-semibold font-sans flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 11.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/></svg>
                My Recent Results
              </CardTitle>
              <CardDescription className="text-[10px]">Games you participated in</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-3">
              {memberRecentResults.map((game, idx) => (
                <div key={idx} className={`bg-white dark:bg-slate-800 rounded-lg border p-2 ${game.is_medal ? "border-indigo-200 dark:border-indigo-800" : "border-orange-100 dark:border-orange-900"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{game.course_name}</div>
                      {game.is_official === false && (
                        <span className="px-1.5 py-0.5 text-[7px] font-bold bg-gray-500 text-white rounded-full shrink-0">UNOFFICIAL</span>
                      )}
                      {game.is_medal && (
                        <span className="px-1.5 py-0.5 text-[7px] font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">MEDAL</span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {new Date(game.game_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="text-left font-bold font-sans text-slate-400 dark:text-slate-500 pb-1 w-5">#</th>
                          <th className="text-left font-bold font-sans text-slate-500 dark:text-slate-400 pb-1 pr-1">Player</th>
  {(game.is_medal
  ? ["Pts","Grs","Net","MPs","HCP","Eag","Bir","Ldy","Late","N/S","Sub"]
  : ["Pts","Grs","HCP","Eag","Bir","Ldy","Late","N/S","Sub"]
  ).map((label) => (
  <th key={label} className={`text-center font-bold font-sans pb-1 px-0.5 ${label === "Eag" ? "text-blue-500" : label === "Bir" ? "text-green-500" : "text-slate-400 dark:text-slate-500"}`}>{label}</th>
  ))}
                        </tr>
                      </thead>
                      <tbody>
                    {/* Leaderboard rows - show only logged-in member unless expanded */}
                    {/* When >20 players: collapsed = my row only, expanded = top 10, fully expanded = all */}
                    {(() => {
                      const isExpanded = expandedResults.has(idx);
                      const leaderboardKey = `results_${game.game_date}_${game.course_name}`;
                      const isFullView = expandedFullLeaderboards.has(leaderboardKey);
                      const totalPlayers = game.leaderboard.length;
                      const showTop10Toggle = totalPlayers > 20;
                      
                      const myRow = game.leaderboard.find(p => p.member_name === memberData?.member_name);
                      const myRank = game.leaderboard.findIndex(p => p.member_name === memberData?.member_name);
                      
                      // Determine which rows to show:
                      // - Not expanded: show only my row (or top 1 if I'm not in the list)
                      // - Expanded + >20 players + not full view: show top 10
                      // - Expanded + <=20 players OR full view: show all
                      let rowsToShow;
                      if (!isExpanded) {
                        rowsToShow = myRow ? [myRow] : game.leaderboard.slice(0, 1);
                      } else if (showTop10Toggle && !isFullView) {
                        rowsToShow = game.leaderboard.slice(0, 10);
                      } else {
                        rowsToShow = game.leaderboard;
                      }
                      
                      return (
                        <>
                          {rowsToShow.map((player, pIdx) => {
                            const actualIdx = isExpanded ? pIdx : (player.member_name === myRow?.member_name ? myRank : 0);
                            const isCurrentMember = player.member_name === memberData?.member_name;
                            const playerPairingId = myClub?.club_id === CLUB13_ID
                              ? allGamePairings
                                  .flatMap(p => p.members)
                                  .find(m => m.member_name === player.member_name)?.pairing_id
                              : undefined;
                            const isWwb = playerPairingId !== undefined && wwbOptIns[playerPairingId]?.ww;
                            const isBirdie = playerPairingId !== undefined && wwbOptIns[playerPairingId]?.birdie;
                            return (
                              <tr key={pIdx} className={`${actualIdx === 0 ? "bg-yellow-50 dark:bg-yellow-900/30" : ""} ${isCurrentMember && actualIdx !== 0 ? "bg-blue-50 dark:bg-blue-900/30" : ""}`}>
                                <td className={`py-0.5 font-bold w-5 ${actualIdx === 0 ? "text-yellow-600" : actualIdx === 1 ? "text-slate-500" : actualIdx === 2 ? "text-amber-700" : "text-slate-400"}`}>
                                  {actualIdx + 1}
                                </td>
                                <td className={`py-0.5 pr-1 max-w-[70px] ${isCurrentMember ? "font-bold text-blue-700 dark:text-blue-400" : actualIdx === 0 ? "font-semibold text-yellow-700 dark:text-yellow-400" : "text-slate-700 dark:text-slate-300"}`}>
                                  <div className="flex items-center gap-0.5">
                                    <span className="truncate">{getDisplayName(player.member_name, game.leaderboard.map(lb => lb.member_name))}</span>
                                    {isWwb && <span className="shrink-0 text-[6px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-0.5 rounded leading-tight">WW</span>}
                                    {isBirdie && <span className="shrink-0 text-[6px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900 px-0.5 rounded leading-tight">B</span>}
                                  </div>
                                </td>
                                <td className={`py-0.5 text-center font-bold px-0.5 ${actualIdx === 0 ? "text-yellow-600" : "text-slate-600 dark:text-slate-400"}`}>{player.points}</td>
                                <td className="py-0.5 text-center text-slate-500 px-0.5">{player.gross_score}</td>
                                {game.is_medal && (
                                  <>
                                    <td className="py-0.5 text-center text-slate-500 px-0.5">
                                      {player.gross_score && player.playing_handicap 
                                        ? (player.gross_score - player.playing_handicap) 
                                        : (player.medal_net || "-")}
                                    </td>
                                    <td className={`py-0.5 text-center font-bold px-0.5 ${actualIdx === 0 ? "text-indigo-600" : "text-indigo-500"}`}>{player.medal_points || "-"}</td>
                                  </>
                                )}
  <td className="py-0.5 text-center text-slate-500 px-0.5">{player.playing_handicap || "-"}</td>
  <td className="py-0.5 text-center text-blue-600 font-bold px-0.5">{player.eagles_count || "-"}</td>
  <td className="py-0.5 text-center text-green-600 font-bold px-0.5">{player.birdies_count || "-"}</td>
  <td className="py-0.5 text-center text-pink-500 font-medium px-0.5">{player.ladies_count || "-"}</td>
                                <td className="py-0.5 text-center px-0.5">
                                  <input type="checkbox" checked={player.is_late || false} readOnly className="w-3 h-3 rounded border-slate-300 accent-orange-500" />
                                </td>
                                <td className="py-0.5 text-center px-0.5">
                                  <input type="checkbox" checked={player.is_no_show || false} readOnly className="w-3 h-3 rounded border-slate-300 accent-red-500" />
                                </td>
                                <td className="py-0.5 text-center px-0.5">
                                  <input type="checkbox" checked={player.is_sub || false} readOnly className="w-3 h-3 rounded border-slate-300 accent-blue-500" />
                                </td>
                              </tr>
                            );
                          })}
                          {/* Show All / Collapse button */}
                        </>
                      );
                    })()}
                      </tbody>
                    </table>
                  </div>
                  {game.leaderboard.length > 1 && (() => {
                    const leaderboardKey = `results_${game.game_date}_${game.course_name}`;
                    const isExpanded = expandedResults.has(idx);
                    const isFullView = expandedFullLeaderboards.has(leaderboardKey);
                    const totalPlayers = game.leaderboard.length;
                    const showTop10Toggle = totalPlayers > 20;
                    
                    // Button behavior:
                    // - Not expanded: "Show Results" -> expands to top 10 (or all if <=20)
                    // - Expanded + >20 + not full: shows "View All X Players" AND "Collapse"
                    // - Expanded + full view OR <=20: shows "Collapse"
                    
                    if (!isExpanded) {
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-6 text-[8px] mt-1 border-orange-200 text-orange-600 hover:bg-orange-50 bg-transparent"
                          onClick={() => setExpandedResults(prev => new Set(prev).add(idx))}
                        >
                          {showTop10Toggle ? `Show Top 10 (${totalPlayers} players)` : `Show All Results (${totalPlayers} players)`}
                        </Button>
                      );
                    }
                    
                    // Expanded state
                    return (
                      <div className="flex gap-1 mt-1">
                        {showTop10Toggle && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={`flex-1 h-6 text-[8px] ${isFullView ? "border-orange-200 text-orange-600 hover:bg-orange-50" : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"} bg-transparent`}
                            onClick={() => {
                              setExpandedFullLeaderboards(prev => {
                                const next = new Set(prev);
                                if (next.has(leaderboardKey)) {
                                  next.delete(leaderboardKey);
                                } else {
                                  next.add(leaderboardKey);
                                }
                                return next;
                              });
                            }}
                          >
                            {isFullView ? "Top 10 Only" : `View All ${totalPlayers}`}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className={`${showTop10Toggle ? "flex-1" : "w-full"} h-6 text-[8px] border-slate-200 text-slate-600 hover:bg-slate-50 bg-transparent`}
                          onClick={() => {
                            setExpandedResults(prev => {
                              const next = new Set(prev);
                              next.delete(idx);
                              return next;
                            });
                            // Also reset full view when collapsing
                            setExpandedFullLeaderboards(prev => {
                              const next = new Set(prev);
                              next.delete(leaderboardKey);
                              return next;
                            });
                          }}
                        >
                          Collapse
                        </Button>
                      </div>
                    );
                  })()}
                  {game.revenue > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-orange-100 dark:border-orange-800 flex items-center justify-between">
                      <span className="text-[8px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Revenue Generated</span>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">R{game.revenue.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        </div>}

        {/* ═══════════════════════════════════════════════
            PLAY TAB
        ═══════════════════════════════════════════════ */}
        {activeTab === "play" && <div className="space-y-4">

        {/* ── PART 3: When opened with ?gameId, show results (read-only) or a scoring prompt ── */}
        {(() => {
          const gidParam = searchParams.get("gameId");
          const gid = gidParam ? Number(gidParam) : null;
          if (!gid) return null;
          const game = adhocGames.find(g => g.adhoc_game_id === gid);
          if (!game) return null;

          const closeView = () => { router.push("/dashboard"); };

          // Not completed → editable scoring prompt
          if (game.status !== "completed") {
            return (
              <Card className="border border-emerald-200 dark:border-emerald-800 shadow-sm bg-white dark:bg-slate-800">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{game.course_name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">This game is still in progress. Open the scorecard to enter scores.</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={closeView}>Close</Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-[#1a3a2a] hover:bg-[#0f2318] text-white"
                      onClick={() => {
                        setLiveScoreGameInfo({
                          course_name: game.course_name,
                          game_date: game.game_date,
                          adhoc_game_id: game.adhoc_game_id,
                          course_id: game.course_id,
                          format: game.game_type || "Stableford",
                          tee_off_time: game.tee_off_time,
                          game_visibility: game.game_visibility,
                          club_id: game.club_id ?? undefined,
                        });
                        setShowScorecard(true);
                        setActiveTab("live");
                      }}
                    >
                      Open Scorecard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          // Completed → read-only final results leaderboard built from pairings
          const isMedal = (game.game_type || "").toLowerCase().includes("medal");
          const players = allGamePairings
            .filter(p => p.adhoc_game_id === gid)
            .flatMap(p => p.members)
            .map(m => ({
              name: m.member_name,
              points: m.points ?? 0,
              gross: m.gross_score ?? 0,
              hcp: m.playing_handicap ?? 0,
              birdies: m.birdies_count ?? 0,
              eagles: m.eagles_count ?? 0,
              submitted: !!(m.result_submitted || m.scores_submitted_at),
              noShow: m.is_no_show,
              net: (m.gross_score ?? 0) - (m.playing_handicap ?? 0),
            }));
          const allNames = players.map(p => p.name);
          const sorted = [...players].sort((a, b) => isMedal ? a.net - b.net : b.points - a.points);
          const incompleteCount = players.filter(p => !p.submitted || p.noShow).length;

          return (
            <Card className="border border-indigo-200 dark:border-indigo-800 shadow-sm bg-white dark:bg-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-indigo-600 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">Final Results — Read Only</div>
                  <div className="text-[11px] text-indigo-200">{game.course_name} · {new Date(game.game_date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</div>
                </div>
                <button onClick={closeView} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30" aria-label="Close results">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <CardContent className="p-3 space-y-2">
                {incompleteCount > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" /></svg>
                    <span>{incompleteCount} player{incompleteCount === 1 ? "" : "s"} finalised with incomplete scores.</span>
                  </div>
                )}
                {sorted.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-6">No results recorded for this game.</div>
                ) : (
                  <div className="space-y-1">
                    {sorted.map((p, i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg ${(!p.submitted || p.noShow) ? "bg-amber-50 dark:bg-amber-900/20" : "bg-slate-50 dark:bg-slate-900/40"}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{getDisplayName(p.name, allNames)}</span>
                          {(!p.submitted || p.noShow) && (
                            <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" /></svg>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs shrink-0">
                          <span className="text-slate-500">Grs {p.gross || "-"}</span>
                          {isMedal
                            ? <span className="font-bold text-indigo-600 dark:text-indigo-400">Net {p.net}</span>
                            : <span className="font-bold text-indigo-600 dark:text-indigo-400">{p.points} pts</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Create A Game - Member Created */}
        <Card className="border border-[#d4c9a8] dark:border-[#2a4a38] shadow-sm bg-gradient-to-br from-[#f0ece2] to-[#e8f0ec] dark:from-[#0f2318] dark:to-[#162a20]">
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#1a3a2a] dark:text-[#c9a84c]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  Create A Game
                </CardTitle>
                <CardDescription className="text-xs">Member-created games - Join or create your own</CardDescription>
              </div>
              {/* For Club 13, only admins can create games */}
              {(myClub?.club_id !== CLUB13_ID || isClub13Admin) && (
                <Button 
                  size="sm" 
                  className="h-8 text-xs px-3 bg-[#1a3a2a] hover:bg-[#0f2318] text-white font-medium"
                  onClick={() => {
                    if (!showCreateAdhoc && MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0)) {
                      setNewAdhocGameType("Medal");
                    }
                    setShowCreateAdhoc(!showCreateAdhoc);
                  }}
                >
                  {showCreateAdhoc ? "Cancel" : "+ Create"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {/* Create Adhoc Game Form */}
            {showCreateAdhoc && (
              <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-[#d4c9a8] dark:border-[#2a4a38]">
                <div className="text-sm font-semibold text-[#1a3a2a] dark:text-[#c9a84c] mb-3">Create New Adhoc Game</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Course</label>
                    <select
                      className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      value={newAdhocCourse || ""}
                      onChange={(e) => setNewAdhocCourse(Number(e.target.value) || null)}
                    >
                      <option value="">Select course...</option>
                      {courses.map(c => (
                        <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Date</label>
                    <input
                      type="date"
                      className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      value={newAdhocDate}
                      onChange={(e) => setNewAdhocDate(e.target.value)}
                      min="2026-01-21"
                    />
                  </div>
                </div>
                {/* Course Info - shown when a course is selected */}
                {newAdhocCourse && (
                  <div className="mb-3 p-2.5 bg-[#f0ece2] dark:bg-[#1a3028]/40 rounded-lg border border-[#d4c9a8] dark:border-[#2a4a38]">
                    <div className="text-xs font-semibold text-[#1a3a2a] dark:text-[#c9a84c] mb-1">Course Information</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {(() => {
                        const course = courses.find(c => c.course_id === newAdhocCourse);
                        return course ? (
                          <div className="space-y-0.5">
                            <div><span className="font-medium">Course:</span> {course.course_name}</div>
                            <div><span className="font-medium">Rating:</span> {course.course_rating || "N/A"} | <span className="font-medium">Slope:</span> {course.slope_rating || "N/A"}</div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Tee-off Time</label>
                    <input
                      type="time"
                      className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      value={newAdhocTime}
                      onChange={(e) => setNewAdhocTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Game Type</label>
                    {MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0) ? (
                      <div className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Medal (Stroke Play)</span>
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    ) : (
                      <select
                        className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                        value={newAdhocGameType}
                        onChange={(e) => setNewAdhocGameType(e.target.value)}
                      >
                        <option value="IPS">IPS (Stableford)</option>
                        <option value="Medal">Medal (Stroke Play)</option>
                        <option value="Betterball">Betterball</option>
                        <option value="Alliance">Alliance</option>
                        <option value="Scramble">Scramble</option>
                        <option value="Greensomes">Greensomes</option>
                        <option value="Matchplay">Matchplay</option>
                        <option value="Social">Social / Practice</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Tee Start</label>
                    <select
                      className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      value={newAdhocTeeStart}
                      onChange={(e) => setNewAdhocTeeStart(e.target.value as '1' | 'split')}
                    >
                      <option value="1">Single tee — Hole 1</option>
                      <option value="split">Split tee — Holes 1 &amp; 10</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Max Players</label>
                    <select
                      className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      value={newAdhocMaxPlayers}
                      onChange={(e) => setNewAdhocMaxPlayers(Number(e.target.value))}
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 24, 28, 32, 36, 40].map(n => (
                        <option key={n} value={n}>{n} players</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Cost (R)</label>
                    <input
                      type="number"
                      className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      placeholder="0"
                      value={newAdhocCost}
                      onChange={(e) => setNewAdhocCost(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Notes</label>
                    <input
                      type="text"
                      className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      placeholder="Optional"
                      value={newAdhocNotes}
                      onChange={(e) => setNewAdhocNotes(e.target.value)}
                    />
                  </div>
                </div>
                {/* Official vs Social Game Toggle */}
                <div className="mb-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAdhocIsOfficial}
                      onChange={e => setNewAdhocIsOfficial(e.target.checked)}
                      className="accent-green-600 w-4 h-4 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Official Club Game</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Affects club standings, handicap, and WWB</p>
                    </div>
                  </label>
{!newAdhocIsOfficial && (
  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-xs text-blue-700 dark:text-blue-300">
  Social game - No impact on club standings. Handicap can only improve.
  </div>
  )}
  </div>
  {/* Public Game Toggle - allow nomads to see this game */}
  <div className="mb-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
  <label className="flex items-start gap-3 cursor-pointer">
  <input
  type="checkbox"
  checked={newAdhocIsPublic}
  onChange={e => setNewAdhocIsPublic(e.target.checked)}
  className="accent-teal-600 w-4 h-4 mt-0.5 flex-shrink-0"
  />
  <div>
  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Open to All Golfers</span>
  <p className="text-xs text-slate-500 dark:text-slate-400">Visible to Nomad golfers and guests</p>
  </div>
  </label>
  {newAdhocIsPublic && (
  <div className="mt-2 p-2 bg-teal-50 dark:bg-teal-900/30 rounded text-xs text-teal-700 dark:text-teal-300">
  This game will be visible to all MyGolf users
  </div>
  )}
  </div>
  {/* Multi-round checkbox */}
                <div className="mb-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAdhocIsMultiRound}
                      onChange={e => setNewAdhocIsMultiRound(e.target.checked)}
                      className="accent-[#1a3a2a] w-4 h-4 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Multi-round game</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">This game spans multiple rounds played over multiple days</p>
                    </div>
                  </label>
                  {newAdhocIsMultiRound && (
                    <div className="mt-3 space-y-3">
                      {/* Number of rounds selector */}
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Number of Rounds</label>
                        <select
                          className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                          value={newAdhocTotalRounds}
                          onChange={e => {
                            const n = Number(e.target.value);
                            setNewAdhocTotalRounds(n);
                            // Resize round details array (rounds 2..n), preserving existing entries
                            setNewAdhocRoundDetails(prev => {
                              const updated = [...prev];
                              while (updated.length < n - 1) updated.push({
                                date: "", course_id: "",
                                time: newAdhocTime,
                                game_type: newAdhocGameType,
                                tee_start: newAdhocTeeStart,
                                max_players: newAdhocMaxPlayers,
                                cost: newAdhocCost,
                                notes: ""
                              });
                              return updated.slice(0, n - 1);
                            });
                          }}
                        >
                          {[2, 3, 4, 5, 6].map(n => (
                            <option key={n} value={n}>{n} Rounds</option>
                          ))}
                        </select>
                      </div>

                      {/* Round 1 summary (read-only — uses the main form fields above) */}
                      <div className="p-2.5 rounded-lg bg-[#f0ece2] dark:bg-[#1a3028] border border-[#d4c9a8] dark:border-[#2a4a38]">
                        <p className="text-xs font-bold text-[#1a3a2a] dark:text-[#c9a84c] mb-1">Round 1</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {newAdhocDate || "— date not set"} &middot; {courses.find(c => String(c.course_id) === String(newAdhocCourse))?.course_name || "— course not set"}
                        </p>
                      </div>

                      {/* Rounds 2..n — full editable game fields matching Round 1 */}
                      {Array.from({ length: newAdhocTotalRounds - 1 }, (_, i) => {
                        const blank = {
                          date: "", course_id: "",
                          time: newAdhocTime, game_type: newAdhocGameType,
                          tee_start: newAdhocTeeStart, max_players: newAdhocMaxPlayers,
                          cost: newAdhocCost, notes: ""
                        };
                        const rd = newAdhocRoundDetails[i] ?? blank;
                        const updateRd = (field: keyof typeof blank, value: string | number) => {
                          setNewAdhocRoundDetails(prev => {
                            const next = [...prev];
                            while (next.length <= i) next.push({ ...blank });
                            next[i] = { ...next[i], [field]: value };
                            return next;
                          });
                        };
                        return (
                          <div key={i} className="rounded-xl border-2 border-[#c9a84c]/40 dark:border-[#c9a84c]/30 bg-white dark:bg-slate-800 overflow-hidden">
                            {/* Round header */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#f7f4ed] dark:bg-[#1a3028] border-b border-[#d4c9a8] dark:border-[#2a4a38]">
                              <svg className="w-3.5 h-3.5 text-[#c9a84c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <span className="text-xs font-bold text-[#1a3a2a] dark:text-[#c9a84c]">Round {i + 2}</span>
                            </div>
                            <div className="p-3 space-y-3">
                              {/* Course + Date */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Course</label>
                                  <select
                                    className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                    value={rd.course_id}
                                    onChange={e => updateRd("course_id", e.target.value)}
                                  >
                                    <option value="">Select course...</option>
                                    {courses.map(c => (
                                      <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Date</label>
                                  <input
                                    type="date"
                                    className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                    value={rd.date}
                                    onChange={e => updateRd("date", e.target.value)}
                                    min={newAdhocDate || undefined}
                                  />
                                </div>
                              </div>
                              {/* Tee-off Time + Game Type */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Tee-off Time</label>
                                  <input
                                    type="time"
                                    className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                    value={rd.time}
                                    onChange={e => updateRd("time", e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Game Type</label>
                                  {MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0) ? (
                                    <div className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                      <span>Medal (Stroke Play)</span>
                                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                    </div>
                                  ) : (
                                    <select
                                      className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                      value={rd.game_type}
                                      onChange={e => updateRd("game_type", e.target.value)}
                                    >
                                      <option value="IPS">IPS (Stableford)</option>
                                      <option value="Medal">Medal (Stroke Play)</option>
                                      <option value="Betterball">Betterball</option>
                                      <option value="Alliance">Alliance</option>
                                      <option value="Scramble">Scramble</option>
                                      <option value="Greensomes">Greensomes</option>
                                      <option value="Matchplay">Matchplay</option>
                                      <option value="Social">Social / Practice</option>
                                    </select>
                                  )}
                                </div>
                              </div>
                              {/* Tee Start + Max Players + Cost + Notes */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Tee Start</label>
                                  <select
                                    className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                    value={rd.tee_start}
                                    onChange={e => updateRd("tee_start", e.target.value)}
                                  >
                                    <option value="1">Hole 1</option>
                                    <option value="split">Split (1 &amp; 10)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Max Players</label>
                                  <select
                                    className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                    value={rd.max_players}
                                    onChange={e => updateRd("max_players", Number(e.target.value))}
                                  >
                                    {[2,3,4,5,6,7,8,10,12,16,20,24,28,32,36,40].map(n => (
                                      <option key={n} value={n}>{n} players</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Cost (R)</label>
                                  <input
                                    type="number"
                                    className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                    placeholder="0"
                                    value={rd.cost}
                                    onChange={e => updateRd("cost", e.target.value)}
                                    min="0" step="0.01"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">Notes</label>
                                  <input
                                    type="text"
                                    className="w-full text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                    placeholder="Optional"
                                    value={rd.notes}
                                    onChange={e => updateRd("notes", e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* WWB opt-in for the organizer — only for WWB clubs, TC auto-enrolled */}
                {WWB_CLUB_IDS.includes(myClub?.club_id ?? 0) && (
                  <div className="mb-3 p-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">
                      {myClub?.club_id === TUESDAY_CLINIQUE_ID
                        ? "WWB Competition — You are automatically enrolled"
                        : "WWB Competition — Your opt-in"}
                    </div>
                    {myClub?.club_id === TUESDAY_CLINIQUE_ID ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">All Tuesday Clinique participants are auto-enrolled in WW and Birdie Pool.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newAdhocWwbOpts.ww}
                            onChange={e => setNewAdhocWwbOpts(p => ({ ...p, ww: e.target.checked }))}
                            className="accent-amber-500 w-4 h-4 flex-shrink-0"
                          />
                          <div>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">WafaWafa (WW)</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">1st 9, 2nd 9 &amp; Overall prize pools</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newAdhocWwbOpts.birdie}
                            onChange={e => setNewAdhocWwbOpts(p => ({ ...p, birdie: e.target.checked }))}
                            className="accent-amber-500 w-4 h-4 flex-shrink-0"
                          />
                          <div>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Birdie Pool</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Shared pool split by birdies made</p>
                          </div>
                        </label>
</div>
  )}
  </div>
  )}
  
  <Button
  size="default"
  className="w-full h-10 text-sm font-semibold bg-[#1a3a2a] hover:bg-[#0f2318] text-white"
  onClick={handleCreateAdhocGame}
  disabled={creatingAdhoc || !newAdhocCourse || !newAdhocDate || !newAdhocTime}
  >
  {creatingAdhoc ? "Creating..." : "Create Game"}
  </Button>
              </div>
            )}

            {/* Adhoc Games List */}
            {adhocGames.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  // Include completed rounds that are part of an ongoing multi-round group
                  const hasOpenMultiRoundSibling = (game: typeof adhocGames[0]) => {
                    if (!game.is_multi_round) return false;
                    return adhocGames.some(g =>
                      g.is_multi_round &&
                      g.organizer_id === game.organizer_id &&
                      (g.club_id ?? 0) === (game.club_id ?? 0) &&
                      g.total_rounds === game.total_rounds &&
                      g.adhoc_game_id !== game.adhoc_game_id &&
                      g.status !== "cancelled" && g.status !== "deleted" && g.status !== "completed"
                    );
                  };
                  const activeGames = adhocGames.filter(game =>
                    game.status !== "cancelled" &&
                    game.status !== "deleted" &&
                    (game.status !== "completed" || hasOpenMultiRoundSibling(game))
                  );
                  const rendered = new Set<number>();
                  const items: React.ReactNode[] = [];

                  activeGames.forEach(game => {
                    if (rendered.has(game.adhoc_game_id)) return;

                    // Collect siblings: multi-round games share organizer + club + total_rounds
                    const isMulti = game.is_multi_round;
                    const siblings = isMulti
                      ? activeGames.filter(g =>
                          g.is_multi_round &&
                          g.organizer_id === game.organizer_id &&
                          (g.club_id ?? 0) === (game.club_id ?? 0) &&
                          g.total_rounds === game.total_rounds &&
                          !rendered.has(g.adhoc_game_id)
                        ).sort((a, b) => (a.round_number ?? 1) - (b.round_number ?? 1))
                      : [game];

                    siblings.forEach(g => rendered.add(g.adhoc_game_id));
                    const r1 = siblings[0];

                    items.push(
                      <div key={`group-${r1.adhoc_game_id}`} className={isMulti ? "rounded-xl border-2 border-[#c9a84c]/50 dark:border-[#c9a84c]/40 overflow-hidden" : ""}>
                        {/* Multi-round group header — only for multi-round groups */}
                        {isMulti && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-[#f7f4ed] dark:bg-[#1a1e14] border-b border-[#d4c9a8] dark:border-[#c9a84c]/30">
                            <svg className="w-3.5 h-3.5 text-[#c9a84c] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span className="text-[10px] font-bold text-[#1a3a2a] dark:text-[#c9a84c] uppercase tracking-wide">
                              Multi-Round Competition &middot; {siblings.length} of {r1.total_rounds} Rounds
                            </span>
                            <span className="ml-auto text-[9px] text-slate-500 dark:text-slate-400">
                              {new Date(r1.game_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                              {siblings.length > 1 ? ` – ${new Date(siblings[siblings.length - 1].game_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                            </span>
                          </div>
                        )}
                        {/* Inner rounds list — divided for multi, plain for single */}
                        <div className={isMulti ? "divide-y divide-[#e8e0cc] dark:divide-[#2a3020] bg-[#fdfcf8] dark:bg-slate-900" : ""}>
                          {siblings.map((game, roundIdx) => {
                            const gameResultsSubmitted = myPairings.some(p => p.adhoc_game_id === game.adhoc_game_id && p.allResultsSubmitted);
                            // A round is locked when its status is "completed" OR all its pairings have submitted results
                            const roundPairingsAll = allGamePairings.filter(p => p.adhoc_game_id === game.adhoc_game_id).sort((a, b) => a.fourball_number - b.fourball_number);
                            
                            // Only lock pairings if game has actually started
                            const gameDateTime = new Date(`${game.game_date}T${game.tee_off_time || "00:00"}`);
                            const nowSAST = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
                            const gameHasStarted = nowSAST >= gameDateTime;
                            
                            // Never lock if game hasn't started yet
                            const isRoundLocked = gameHasStarted && isMulti && (
                              game.status === "completed" ||
                              (roundPairingsAll.length > 0 && roundPairingsAll.every(p => p.allResultsSubmitted))
                            );
                            const roundNum = game.round_number != null ? game.round_number : roundIdx + 1;
                            return (
                              <div key={game.adhoc_game_id} className={isMulti ? (isRoundLocked ? "opacity-70" : "") : ""}>
                                {/* Round label strip — only inside multi-round group */}
                                {isMulti && (
                                  <div className={`flex items-center gap-2 px-3 py-1.5 ${isRoundLocked ? "bg-slate-100 dark:bg-slate-800/80" : "bg-[#f0ece2] dark:bg-[#1a2518]"}`}>
                                    {/* Lock icon when round is complete */}
                                    {isRoundLocked ? (
                                      <svg className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                    ) : (
                                      <span className="w-3 h-3 flex-shrink-0" />
                                    )}
                                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isRoundLocked ? "text-slate-400 dark:text-slate-500" : "text-[#c9a84c]"}`}>
                                      Round {roundNum}
                                    </span>
                                    <span className="text-[9px] text-slate-500 dark:text-slate-400">
                                      {new Date(game.game_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                                      &nbsp;&middot;&nbsp;{game.course_name}
                                    </span>
                                    {isRoundLocked ? (
                                      <span className="ml-auto flex items-center gap-1 text-[8px] font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Locked
                                      </span>
                                    ) : gameResultsSubmitted ? (
                                      <span className="ml-auto text-[8px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">Complete</span>
                                    ) : null}
                                  </div>
                                )}
                                {/* Game card body — identical for both single and multi-round */}
                                <div className={isMulti
                                  ? `p-2 ${gameResultsSubmitted ? "bg-slate-50 dark:bg-slate-900/50" : "bg-white dark:bg-slate-800"}`
                                  : `p-2 rounded-lg border ${gameResultsSubmitted ? "bg-slate-100 border-slate-200 dark:bg-slate-900 dark:border-slate-700 opacity-60" : "bg-white border-[#e0ddd4] dark:bg-slate-800 dark:border-[#2a4a38]"}`
                                }>
                    {editingAdhocId === game.adhoc_game_id && !gameResultsSubmitted && !isRoundLocked ? (
                      /* Edit Form */
                      <div className="space-y-2">
                        <div className="text-[10px] font-medium text-[#1a3a2a] dark:text-[#c9a84c]">Edit Adhoc Game</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-slate-500 block mb-1">Course</label>
                            <select
                              className="w-full text-[10px] p-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              value={editAdhocCourse || ""}
                              onChange={(e) => setEditAdhocCourse(Number(e.target.value) || null)}
                            >
                              <option value="">Select course...</option>
                              {courses.map(c => (
                                <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-500 block mb-1">Date</label>
                            <input
                              type="date"
                              className="w-full text-[10px] p-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              value={editAdhocDate}
                              onChange={(e) => setEditAdhocDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-slate-500 block mb-1">Tee-off Time</label>
                            <input
                              type="time"
                              className="w-full text-[10px] p-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              value={editAdhocTime}
                              onChange={(e) => setEditAdhocTime(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-500 block mb-1">Tee Start</label>
                            <select
                              className="w-full text-[10px] p-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              value={editAdhocTeeStart}
                              onChange={(e) => setEditAdhocTeeStart(e.target.value as '1' | 'split')}
                            >
                              <option value="1">Single tee — Hole 1</option>
                              <option value="split">Split tee — Holes 1 &amp; 10</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[9px] text-slate-500 block mb-1">Max Players</label>
                            <select
                              className="w-full text-[10px] p-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              value={editAdhocMaxPlayers}
                              onChange={(e) => setEditAdhocMaxPlayers(Number(e.target.value))}
                            >
                              {[2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 24, 28, 32, 36, 40].map(n => (
                                <option key={n} value={n}>{n} players</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-500 block mb-1">Cost (R)</label>
                            <input
                              type="number"
                              className="w-full text-[10px] p-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              value={editAdhocCost}
                              onChange={(e) => setEditAdhocCost(e.target.value)}
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-500 block mb-1">Notes</label>
                            <input
                              type="text"
                              className="w-full text-[10px] p-1.5 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              value={editAdhocNotes}
                              onChange={(e) => setEditAdhocNotes(e.target.value)}
                            />
                          </div>
                        </div>
                        {/* Official vs Social Game Toggle */}
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editAdhocIsOfficial}
                              onChange={e => setEditAdhocIsOfficial(e.target.checked)}
                              className="accent-green-600 w-4 h-4 mt-0.5 flex-shrink-0"
                            />
                            <div>
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Official Club Game</span>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Affects club standings, handicap, and WWB</p>
                            </div>
                          </label>
                          {!editAdhocIsOfficial && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-xs text-blue-700 dark:text-blue-300">
                              Social game - No impact on club standings. Handicap can only improve.
                            </div>
                          )}
                        </div>
                        {/* Public Game Toggle */}
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editAdhocIsPublic}
                              onChange={e => setEditAdhocIsPublic(e.target.checked)}
                              className="accent-teal-600 w-4 h-4 mt-0.5 flex-shrink-0"
                            />
                            <div>
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Open to All Golfers</span>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Visible to Nomad golfers and guests</p>
                            </div>
                          </label>
                          {editAdhocIsPublic && (
                            <div className="mt-2 p-2 bg-teal-50 dark:bg-teal-900/30 rounded text-xs text-teal-700 dark:text-teal-300">
                              This game will be visible to all MyGolf users
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1 h-6 text-[9px] bg-[#1a3a2a] hover:bg-[#0f2318] text-white"
                            onClick={handleSaveAdhocGame}
                            disabled={savingAdhoc}
                          >
                            {savingAdhoc ? "Saving..." : "Save"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-6 text-[9px] px-3 bg-transparent"
                            onClick={cancelEditAdhocGame}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Display Mode */
                      <div className={`w-full space-y-2 ${game.status === "cancelled" || game.status === "deleted" ? "opacity-50" : ""}`}>

                        {/* ── Row 1: Game info + Tee toggle ── */}
                        <div className="flex items-start justify-between gap-2">
                          {/* Left: course / date / organizer */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <div className={`text-[11px] font-semibold truncate ${game.status === "cancelled" || game.status === "deleted" ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-200"}`}>{game.course_name}</div>
                              <span className="px-1 py-0.5 rounded text-[7px] font-medium bg-[#e8f0ec] text-[#1a3a2a] dark:bg-[#1e3028] dark:text-[#c9a84c] shrink-0">ADHOC</span>
                              {game.game_type && (
<span className={`px-1 py-0.5 rounded text-[7px] font-medium shrink-0 ${game.game_type === "Medal" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : game.game_type === "IPS" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"}`}>{game.game_type}</span>
  )}
  {game.game_visibility === "public" && (
  <span className="px-1 py-0.5 rounded text-[7px] font-medium shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">PUBLIC</span>
  )}
  {(game.status === "cancelled" || game.status === "deleted") && (
                                <span className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 shrink-0">CANCELLED</span>
                              )}
                            </div>
                            <div className={`text-[9px] ${game.status === "cancelled" || game.status === "deleted" ? "text-slate-400" : "text-slate-500"}`}>
                              {new Date(game.game_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} at {game.tee_off_time.slice(0, 5)}
                            </div>
                            <div className={`text-[8px] ${game.status === "cancelled" || game.status === "deleted" ? "text-slate-400" : "text-[#1a3a2a] dark:text-[#c9a84c]"}`}>
                              Organizer: {game.organizer_name} | {game.booked_count}/{game.max_players} players
                              {game.cost_per_player > 0 && <span className="ml-1 font-semibold">| R{game.cost_per_player.toFixed(2)}</span>}
                            </div>
{game.notes && (
  <div className={`text-[10px] mt-1 font-bold ${game.status === "cancelled" || game.status === "deleted" ? "text-slate-400" : "text-slate-700 dark:text-slate-300"}`}>
  {game.notes}
  </div>
  )}
                          </div>

                          {/* Right: Tee toggle (organizer only, active game) */}
                          {memberData && (game.organizer_id === memberData.member_id || isClub13Admin) && !gameResultsSubmitted && game.status !== "cancelled" && game.status !== "deleted" && (
                            <div className="shrink-0 flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700" style={{minWidth: 110}}>
                              {(() => {
                                const teeStart = game.tee_start ?? '1';
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (teeStart === '1') return;
                                        const supabaseTee = createClient();
                                        await supabaseTee.from("adhoc_games").update({ tee_start: '1' }).eq("adhoc_game_id", game.adhoc_game_id);
                                        setAdhocGames(prev => prev.map(g => g.adhoc_game_id === game.adhoc_game_id ? { ...g, tee_start: '1' } : g));
                                      }}
                                      className={`flex-1 py-1 px-1.5 text-[8px] font-bold transition-colors leading-tight text-center ${teeStart === '1' ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                      Single
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (teeStart === 'split') return;
                                        const supabaseTee = createClient();
                                        await supabaseTee.from("adhoc_games").update({ tee_start: 'split' }).eq("adhoc_game_id", game.adhoc_game_id);
                                        setAdhocGames(prev => prev.map(g => g.adhoc_game_id === game.adhoc_game_id ? { ...g, tee_start: 'split' } : g));
                                      }}
                                      className={`flex-1 py-1 px-1.5 text-[8px] font-bold transition-colors border-l border-slate-200 dark:border-slate-700 leading-tight text-center ${teeStart === 'split' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                      Split
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        {/* ── Row 2: Edit + Add Member + Add Guest (organizer only) ── */}
                        {!isRoundLocked && memberData && (game.organizer_id === memberData.member_id || isClub13Admin) && !gameResultsSubmitted && game.status !== "cancelled" && game.status !== "deleted" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[9px] px-2 flex-1 border-[#2a5a3c] text-[#1a3a2a] hover:bg-[#e8f0ec] bg-transparent dark:border-[#c9a84c] dark:text-[#c9a84c] dark:hover:bg-[#1e3028]"
                              onClick={() => startEditAdhocGame(game)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[9px] px-2 flex-1 border-blue-300 text-blue-600 hover:bg-blue-50 bg-transparent"
                              onClick={() => {
                                if (showAddPlayer === game.adhoc_game_id) { setShowAddPlayer(null); setAddPlayerMemberIds([]); setAddPlayerSearch(""); }
                                else { setShowAddPlayer(game.adhoc_game_id); setShowAddGuest(null); setAddPlayerMemberIds([]); setAddPlayerSearch(""); }
                              }}
                            >
                              {showAddPlayer === game.adhoc_game_id ? "Close" : "+ Member"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[9px] px-2 flex-1 border-teal-300 text-teal-600 hover:bg-teal-50 bg-transparent"
onClick={() => {
                              if (showAddGuest === game.adhoc_game_id) { setShowAddGuest(null); setGuestSearchResults([]); }
                              else { setShowAddGuest(game.adhoc_game_id); setShowAddPlayer(null); loadExistingGuests(); setGuestSearchResults([]); }
                            }}
                            >
{showAddGuest === game.adhoc_game_id ? "Close" : "+ Guest"}
                            </Button>
                          </div>
                        )}

                        {/* ── Participants with WWB opt-in toggles ── */}
                        {(() => {
                          const isWwbGame = !!(game.wwb_enabled && WWB_CLUB_IDS.includes(myClub?.club_id ?? 0));
                          const isTc = myClub?.club_id === TUESDAY_CLINIQUE_ID;
                          const isActive = game.status !== "cancelled" && game.status !== "deleted" && game.status !== "completed";
                          const isOrganizer = !!(memberData && (game.organizer_id === memberData.member_id || isClub13Admin));
                          const hasPlayers = game.players && game.players.length > 0;
                          const hasGuests = game.guests && game.guests.length > 0;
                          if (!hasPlayers && !hasGuests) return null;
                          // Show toggle table for WWB games that are still open/full
                          if (isWwbGame && !isTc && isActive) {
                            // Build unified rows: members + guests (guests use negative guest_id as key)
                            type WwbRow = { key: number; displayName: string; isGuest: boolean; guestId?: number; memberId?: number; isMe: boolean };
                            const allWwbNames = [
                              ...game.players.map(p => p.member_name),
                              ...(game.guests || []).map(g => g.guest_name),
                            ];
                            const allRows: WwbRow[] = [
                              ...game.players.map(p => ({
                                key: p.member_id,
                                displayName: getDisplayName(p.member_name, allWwbNames),
                                isGuest: false,
                                memberId: p.member_id,
                                isMe: p.member_id === memberData?.member_id,
                              })),
                              ...(game.guests || []).map(g => ({
                                key: -g.guest_id,
                                displayName: getDisplayName(g.guest_name, allWwbNames),
                                isGuest: true,
                                guestId: g.guest_id,
                                isMe: false,
                              })),
                            ];

                            // Organizer/admin sees all rows; regular member sees only their own row
                            const visibleRows = isOrganizer ? allRows : allRows.filter(r => r.isMe);

                            if (visibleRows.length === 0) return null;

                            // Check if tee time has passed (WWB time lock)
                            const gameDateTime = new Date(`${game.game_date}T${game.tee_off_time || "00:00:00"}`);
                            const nowSast = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
                            const teeTimePassed = nowSast >= gameDateTime;

                            return (
                              <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
                                {/* Table header */}
                                <div className={`grid items-center px-2 py-1 bg-amber-50 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 ${isOrganizer ? "grid-cols-[1fr_40px_40px_16px]" : "grid-cols-[1fr_40px_40px]"}`}>
                                  <span className="text-[8px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                                    {isOrganizer ? "Player" : "My WWB Opt-In"}
                                    {teeTimePassed && <span className="ml-1 text-red-500">(Locked)</span>}
                                  </span>
                                  <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 text-center uppercase tracking-wide">WW</span>
                                  <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 text-center uppercase tracking-wide">Bir</span>
                                  {isOrganizer && <span />}
                                </div>
                                {/* Rows */}
                                {visibleRows.map(row => {
                                  // Guests use negative key; members use positive member_id
                                  const optKey = row.isGuest ? -(row.guestId!) : row.memberId!;
                                  const opts = gameWwbOptIns[game.adhoc_game_id]?.[optKey] ?? { ww: false, birdie: false };
                                  // canToggle is false if tee time has passed (WWB time lock)
                                  const canToggle = !teeTimePassed && (isOrganizer || row.isMe);
                                  return (
                                    <div key={row.key} className={`grid items-center px-2 py-1.5 border-b last:border-b-0 border-amber-100 dark:border-amber-900/50 bg-white dark:bg-slate-800 ${isOrganizer ? "grid-cols-[1fr_40px_40px_16px]" : "grid-cols-[1fr_40px_40px]"}`}>
                                      {/* Name + guest badge */}
                                      <span className={`text-[9px] font-medium truncate flex items-center gap-1 ${row.isMe ? "text-blue-700 dark:text-blue-400 font-semibold" : row.isGuest ? "text-teal-700 dark:text-teal-400" : "text-slate-700 dark:text-slate-200"}`}>
                                        <span className="truncate">{row.displayName}</span>
                                        {row.isGuest && (
                                          <span className="shrink-0 text-[7px] font-bold bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 px-0.5 rounded leading-tight border border-teal-300 dark:border-teal-700">G</span>
                                        )}
                                      </span>
                                      {/* WW toggle */}
                                      <div className="flex justify-center">
                                        <button
                                          disabled={!canToggle}
                                          onClick={() => handleToggleGameWwbOptIn(game.adhoc_game_id, optKey, "ww", !opts.ww)}
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${opts.ww ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"} ${canToggle ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-40"}`}
                                          title={canToggle ? (opts.ww ? "Opt out of WW" : "Opt in to WW") : ""}
                                        >
                                          {opts.ww ? "✓" : "–"}
                                        </button>
                                      </div>
                                      {/* Birdie toggle */}
                                      <div className="flex justify-center">
                                        <button
                                          disabled={!canToggle}
                                          onClick={() => handleToggleGameWwbOptIn(game.adhoc_game_id, optKey, "birdie", !opts.birdie)}
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${opts.birdie ? "bg-amber-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"} ${canToggle ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-40"}`}
                                          title={canToggle ? (opts.birdie ? "Opt out of Birdie Pool" : "Opt in to Birdie Pool") : ""}
                                        >
                                          {opts.birdie ? "✓" : "–"}
                                        </button>
                                      </div>
                                      {/* Remove player button — organizer only */}
                                      {isOrganizer && (
                                        <div className="flex justify-center">
                                          <button
                                            onClick={() => {
                                              if (row.isGuest) {
                                                handleRemoveGuest(game.adhoc_game_id, row.guestId!, row.displayName);
                                              } else {
                                                handleRemoveMember(game.adhoc_game_id, row.memberId!, row.displayName);
                                              }
                                            }}
                                            className="text-red-400 hover:text-red-600 font-bold text-[9px] leading-none"
                                            title={`Remove ${row.displayName}`}
                                            disabled={adhocBookingLoading === game.adhoc_game_id}
                                          >
                                            ×
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          // Non-WWB or Tuesday Clinique: plain name list
                          return (
                            <div className="space-y-0.5">
                              {hasPlayers && (
                                <div className={`text-[8px] ${game.status === "cancelled" || game.status === "deleted" ? "text-slate-400" : "text-slate-600 dark:text-slate-400"}`}>
                                  <span>Members: </span>
                                  {game.players.map((p, idx) => (
                                    <span key={p.member_id} className="inline-flex items-center">
                                      {idx > 0 && ", "}
                                      {p.member_name}
                                      {memberData && game.organizer_id === memberData.member_id && game.status !== "cancelled" && game.status !== "deleted" && (
                                        <button
                                          onClick={() => handleRemoveMember(game.adhoc_game_id, p.member_id, p.member_name)}
                                          className="ml-0.5 text-red-400 hover:text-red-600 font-bold text-[9px] leading-none"
                                          title={`Remove ${p.member_name}`}
                                          disabled={adhocBookingLoading === game.adhoc_game_id}
                                        >
                                          ×
                                        </button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {hasGuests && (
                                <div className={`text-[8px] ${game.status === "cancelled" || game.status === "deleted" ? "text-slate-400" : "text-teal-600 dark:text-teal-400"}`}>
                                  <span>Guests: </span>
                                  {game.guests.map((gu, idx) => (
                                    <span key={gu.guest_id} className="inline-flex items-center">
                                      {idx > 0 && ", "}
                                      {gu.guest_name}
                                      {gu.handicap_index != null && <span className="text-slate-400 ml-0.5">(HCP: {gu.handicap_index})</span>}
                                      {memberData && game.organizer_id === memberData.member_id && game.status !== "cancelled" && game.status !== "deleted" && (
                                        <button
                                          onClick={() => handleRemoveGuest(game.adhoc_game_id, gu.guest_id, gu.guest_name)}
                                          className="ml-0.5 text-red-400 hover:text-red-600 font-bold text-[9px] leading-none"
                                          title={`Remove ${gu.guest_name}`}
                                          disabled={adhocBookingLoading === game.adhoc_game_id}
                                        >
                                          x
                                        </button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {(game.status === "cancelled" || game.status === "deleted") && game.deleted_at && (
                          <div className="text-[7px] text-red-400">
                            Cancelled on {new Date(game.deleted_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        )}
                        {game.cancelled_players && game.cancelled_players.length > 0 && (
                          <div className="pt-1 border-t border-dashed border-slate-200 dark:border-slate-600">
                            <div className="text-[7px] font-medium text-red-400 uppercase tracking-wider mb-0.5">Left / Removed</div>
                            {game.cancelled_players.map((cp, idx) => (
                              <div key={idx} className="text-[7px] text-slate-400 flex items-center gap-1">
                                <span className="line-through">{cp.name}</span>
                                {cp.isGuest && <span className="text-teal-400">(Guest)</span>}
                                <span>- {new Date(cp.cancelled_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} {new Date(cp.cancelled_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── Locked round banner (replaces all action buttons) ── */}
                        {isRoundLocked && isMulti && (
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                            <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500">Round {roundNum} is locked — all scores submitted. View results in the Live tab.</span>
                          </div>
                        )}

                        {/* ── Bottom row: Generate Pairings + Export + Cancel Game ── */}
                        {!isRoundLocked && memberData && (game.organizer_id === memberData.member_id || isClub13Admin) && !gameResultsSubmitted && game.status !== "cancelled" && game.status !== "deleted" && (() => {
                          const hasPairings = allGamePairings.some(p => p.adhoc_game_id === game.adhoc_game_id);
                          const playerCount = (game.booked_count || 0) + (game.guests?.length || 0);
                          const teeStart = game.tee_start ?? '1';

                          // Carry-over: find the previous round's game (lower round_number in same multi-round group)
                          const prevRoundGame = game.is_multi_round && (game.round_number ?? 1) > 1
                            ? adhocGames.find(g =>
                                g.is_multi_round &&
                                g.organizer_id === game.organizer_id &&
                                (g.club_id ?? 0) === (game.club_id ?? 0) &&
                                g.total_rounds === game.total_rounds &&
                                (g.round_number == null || g.round_number === (game.round_number ?? 2) - 1)
                              )
                            : null;
                          const prevHasPairings = prevRoundGame
                            ? allGamePairings.some(p => p.adhoc_game_id === prevRoundGame.adhoc_game_id)
                            : false;

                          return (
                            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-700">
                              {/* Carry-over button — only for subsequent rounds when previous round has pairings */}
                              {prevRoundGame && prevHasPairings && !hasPairings && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[9px] px-2 w-full border-[#c9a84c] text-[#8a6e28] dark:text-[#c9a84c] hover:bg-[#fdf8ec] dark:hover:bg-[#1e2a10] bg-transparent font-semibold flex items-center justify-center gap-1.5"
                                  onClick={() => handleCarryOverPairings(prevRoundGame.adhoc_game_id, game.adhoc_game_id)}
                                  disabled={carryingOverPairings === game.adhoc_game_id}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                  {carryingOverPairings === game.adhoc_game_id
                                    ? "Carrying over..."
                                    : `Carry Over Pairings from Round ${(game.round_number ?? 2) - 1}`}
                                </Button>
                              )}
                              {playerCount >= 2 && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`h-6 text-[9px] px-2 flex-1 ${hasPairings ? "border-[#c9a84c] text-[#8a6e28] hover:bg-[#fdf8ec] dark:border-[#c9a84c] dark:text-[#c9a84c] dark:hover:bg-[#1e2a10]" : "border-[#1a3a2a] text-[#1a3a2a] hover:bg-[#e8f0ec] dark:border-[#c9a84c] dark:text-[#c9a84c] dark:hover:bg-[#1e3028]"} bg-transparent font-semibold`}
                                    onClick={() => handleGeneratePairings(game.adhoc_game_id, teeStart as '1' | 'split')}
                                    disabled={generatingPairings === game.adhoc_game_id}
                                  >
                                    {generatingPairings === game.adhoc_game_id ? "Generating..." : hasPairings ? "Regenerate Pairings" : "Generate Pairings"}
                                  </Button>
                                  {hasPairings && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[9px] px-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50 bg-transparent font-semibold flex items-center gap-1"
                                        onClick={() => handleExportPairingsAsText(game)}
                                      >
                                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                        Share
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[9px] px-2 border-slate-300 text-slate-600 hover:bg-slate-50 bg-transparent font-semibold flex items-center gap-1"
                                        onClick={() => handleExportPairings(game)}
                                      >
                                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                        Print
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[9px] px-2 w-full border-red-300 text-red-600 hover:bg-red-50 bg-transparent"
                                onClick={() => handleCancelAdhocGame(game.adhoc_game_id)}
                                disabled={deletingAdhocId === game.adhoc_game_id}
                              >
                                {deletingAdhocId === game.adhoc_game_id ? "..." : "Cancel Game"}
                              </Button>
                              {/* Complete Round Button - appears for multi-round games when all scores are submitted */}
                              {game.is_multi_round && (() => {
                                const gamePairings = Array.isArray(allGamePairings) ? allGamePairings.filter(p => p.adhoc_game_id === game.adhoc_game_id) : [];
                                const allSubmitted = gamePairings.length > 0 && gamePairings.every(p => p.allResultsSubmitted);
                                
                                if (!allSubmitted && game.status !== "completed") return null;
                                if (game.status === "completed") return null;
                                
                                const isLastRound = game.round_number === game.total_rounds;
                                
                                return (
                                  <Button
                                    size="sm"
                                    className="w-full mt-1 h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => completeRound(game.adhoc_game_id)}
                                  >
                                    {isLastRound ? "Complete Tournament" : `Complete Round ${game.round_number}`}
                                  </Button>
                                );
                              })()}
                            </div>
                          );
                        })()}

                        {/* ── Status labels / member join-leave ── */}
                        <div className="flex items-center justify-center gap-1">
                          {game.status === "cancelled" || game.status === "deleted" ? (
                            <span className="text-[9px] text-red-400 font-medium italic">Cancelled</span>
                          ) : gameResultsSubmitted ? (
                            <span className="text-[9px] text-slate-400 font-medium italic">Results Submitted</span>
                          ) : (
                            <>
                              {game.isBooked ? (
                                memberData && game.organizer_id === memberData.member_id ? (
                                  /* Organizer leave flow — must nominate replacement */
                                  nominateOrganizerGameId === game.adhoc_game_id ? (
                                    <div className="w-full mt-1 p-2.5 rounded-lg border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 space-y-2">
                                      <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300">Nominate a new organizer before leaving</p>
                                      <select
                                        className="w-full text-xs p-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                        value={nominatedMemberId ?? ""}
                                        onChange={e => setNominatedMemberId(Number(e.target.value) || null)}
                                      >
                                        <option value="">Select new organizer...</option>
                                        {(game.players || [])
                                          .filter(p => p.member_id !== memberData.member_id)
                                          .map(p => (
                                            <option key={p.member_id} value={p.member_id}>{p.member_name}</option>
                                          ))}
                                      </select>
                                      <div className="flex gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 h-6 text-[9px] border-slate-300 text-slate-600 bg-transparent"
                                          onClick={() => { setNominateOrganizerGameId(null); setNominatedMemberId(null); }}
                                          disabled={transferringOrganizer}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="flex-1 h-6 text-[9px] bg-orange-600 hover:bg-orange-700 text-white"
                                          onClick={() => nominatedMemberId && handleTransferAndLeave(game.adhoc_game_id, nominatedMemberId)}
                                          disabled={!nominatedMemberId || transferringOrganizer}
                                        >
                                          {transferringOrganizer ? "..." : "Confirm & Leave"}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[9px] px-2 border-red-300 text-red-600 hover:bg-red-50 bg-transparent"
                                      onClick={() => { setNominateOrganizerGameId(game.adhoc_game_id); setNominatedMemberId(null); }}
                                    >
                                      Leave
                                    </Button>
                                  )
                                ) : (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-6 text-[9px] px-2 border-red-300 text-red-600 hover:bg-red-50 bg-transparent"
                                  onClick={() => handleCancelAdhocBooking(game.adhoc_game_id)}
                                  disabled={adhocBookingLoading === game.adhoc_game_id}
                                >
                                  {adhocBookingLoading === game.adhoc_game_id ? "..." : "Leave"}
                                </Button>
                                )
                              ) : (() => {
                                const totalPlayers = (game.booked_count || 0) + (game.guests?.length || 0);
                                const gameFull = totalPlayers >= game.max_players;
                                const wasInGame = memberData && (game.cancelled_players || []).some(cp => cp.name === memberData.member_name);
                                const isWwbGame = WWB_CLUB_IDS.includes(myClub?.club_id ?? 0);
                                const showingPrompt = isWwbGame && showWwbJoinPrompt === game.adhoc_game_id;

                                if (gameFull) return <span className="text-[9px] text-slate-400 font-medium">Full</span>;

                                // Check if there's a pending join request for this game
                                const pendingRequest = myJoinRequests.find(r => r.adhoc_game_id === game.adhoc_game_id && r.status === 'pending');
                                if (pendingRequest) return <span className="text-[9px] text-yellow-600 font-medium">Request Pending</span>;

                                if (showingPrompt) return (
                                  // WWB opt-in prompt — rendered as stable block
                                  <div className="w-full mt-2 p-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30">
                                    <div className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2">WWB Competition — Opt in or out</div>
                                    <div className="flex flex-col gap-2 mb-3">
                                      <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={pendingWwbJoin.ww}
                                          onChange={e => setPendingWwbJoin(p => ({ ...p, ww: e.target.checked }))}
                                          className="accent-amber-500 w-4 h-4 flex-shrink-0"
                                        />
                                        <div>
                                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">WafaWafa (WW)</span>
                                          <p className="text-xs text-slate-500 dark:text-slate-400">1st 9, 2nd 9 &amp; Overall prize pools</p>
                                        </div>
                                      </label>
                                      <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={pendingWwbJoin.birdie}
                                          onChange={e => setPendingWwbJoin(p => ({ ...p, birdie: e.target.checked }))}
                                          className="accent-amber-500 w-4 h-4 flex-shrink-0"
                                        />
                                        <div>
                                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Birdie Pool</span>
                                          <p className="text-xs text-slate-500 dark:text-slate-400">Shared pool split by birdies made</p>
                                        </div>
                                      </label>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-9 text-xs border-slate-300 text-slate-600 bg-white dark:bg-transparent"
                                        onClick={(e) => { e.stopPropagation(); setShowWwbJoinPrompt(null); }}
                                      >
                                        Back
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="flex-1 h-9 text-xs font-semibold bg-[#1a3a2a] hover:bg-[#0f2318] text-white"
                                        disabled={adhocBookingLoading === game.adhoc_game_id}
                                        onClick={(e) => { e.stopPropagation(); handleBookAdhocGame(game.adhoc_game_id, pendingWwbJoin); }}
                                      >
                                        {adhocBookingLoading === game.adhoc_game_id ? "Joining..." : "Confirm & Join"}
                                      </Button>
                                    </div>
                                  </div>
                                );

                                return (
                                  <Button
                                    size="sm"
                                    className={`h-6 text-[9px] px-2 text-white ${wasInGame ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700"}`}
                                    disabled={adhocBookingLoading === game.adhoc_game_id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isWwbGame && myClub?.club_id !== TUESDAY_CLINIQUE_ID) {
                                        setPendingWwbJoin({ ww: true, birdie: true });
                                        setShowWwbJoinPrompt(game.adhoc_game_id);
                                      } else if (isWwbGame && myClub?.club_id === TUESDAY_CLINIQUE_ID) {
                                        handleBookAdhocGame(game.adhoc_game_id, { ww: true, birdie: true });
                                      } else {
handleBookAdhocGame(game.adhoc_game_id);
  }
  }}
  >
  {adhocBookingLoading === game.adhoc_game_id ? "..." : wasInGame ? "Rejoin" : (game.club_id !== myClub?.club_id ? "Request" : "Join")}
  </Button>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Add Member to Game Form — multi-select */}
                    {showAddPlayer === game.adhoc_game_id && game.status !== "deleted" && game.status !== "cancelled" && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                        <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 mb-2">Add Members to Game</div>

                        {/* Search input */}
                        <input
                          type="text"
                          placeholder="Search members..."
                          value={addPlayerSearch}
                          onChange={e => setAddPlayerSearch(e.target.value)}
                          className="w-full text-[10px] p-1.5 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 mb-1.5"
                        />

                        {/* Scrollable checkbox list */}
                        <div className="max-h-44 overflow-y-auto rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-800 mb-2 divide-y divide-blue-50 dark:divide-blue-900">
                          {memberDirectory
                            .filter(m =>
                              !(game.players || []).some(p => p.member_id === m.member_id) &&
                              m.member_name.toLowerCase().includes(addPlayerSearch.toLowerCase())
                            )
                            .sort((a, b) => a.member_name.localeCompare(b.member_name))
                            .map(m => {
                              const checked = addPlayerMemberIds.includes(m.member_id);
                              return (
                                <label
                                  key={m.member_id}
                                  className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${checked ? "bg-blue-50 dark:bg-blue-900/40" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setAddPlayerMemberIds(prev =>
                                      checked ? prev.filter(id => id !== m.member_id) : [...prev, m.member_id]
                                    )}
                                    className="accent-blue-600 w-3 h-3 flex-shrink-0"
                                  />
                                  <span className="text-[10px] text-slate-700 dark:text-slate-200">{formatMemberName(m.member_name)}</span>
                                </label>
                              );
                            })}
                        </div>

                        {/* WWB opt-in per selected member — shown for all WWB club games except Tuesday Clinique (TC auto-enrolled) */}
                        {WWB_CLUB_IDS.includes(myClub?.club_id ?? 0) && myClub?.club_id !== TUESDAY_CLINIQUE_ID && addPlayerMemberIds.length > 0 && (
                          <div className="mb-3 p-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                            <div className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2">WWB Competition — Opt in or out per player</div>
                            <div className="flex flex-col divide-y divide-amber-100 dark:divide-amber-800">
                              {addPlayerMemberIds.map(mid => {
                                const name = memberDirectory.find(m => m.member_id === mid)?.member_name || `#${mid}`;
                                const defaultOpts = myClub?.club_id === TUESDAY_CLINIQUE_ID ? { ww: true, birdie: true } : { ww: false, birdie: false };
                                const opts = pendingWwbAdd[mid] ?? defaultOpts;
                                return (
                                  <div key={mid} className="flex items-center justify-between py-2">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex-1 mr-3">{name}</span>
                                    <div className="flex gap-3 flex-shrink-0">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={opts.ww}
                                          onChange={e => setPendingWwbAdd(p => ({ ...p, [mid]: { ...opts, ww: e.target.checked } }))}
                                          className="accent-amber-500 w-4 h-4"
                                        />
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">WW</span>
                                      </label>
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={opts.birdie}
                                          onChange={e => setPendingWwbAdd(p => ({ ...p, [mid]: { ...opts, birdie: e.target.checked } }))}
                                          className="accent-amber-500 w-4 h-4"
                                        />
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Birdie</span>
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Selected count + actions */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">
                            {addPlayerMemberIds.length > 0 ? `${addPlayerMemberIds.length} selected` : "None selected"}
                          </span>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[9px] px-2 border-slate-300 text-slate-500 bg-transparent"
                              onClick={() => setAddPlayerMemberIds([])}
                              disabled={addPlayerMemberIds.length === 0}
                            >
                              Clear
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 text-[9px] px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                              onClick={() => handleAddPlayerToAdhoc(game.adhoc_game_id)}
                              disabled={addPlayerMemberIds.length === 0 || addingPlayer}
                            >
                              {addingPlayer ? "Adding..." : `Add ${addPlayerMemberIds.length || ""} Player${addPlayerMemberIds.length !== 1 ? "s" : ""}`}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Add Guest Form */}
                    {showAddGuest === game.adhoc_game_id && game.status !== "deleted" && game.status !== "cancelled" && (
                      <div className="mt-2 p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-700">
                        <div className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 mb-2">Add Guest Player</div>
                        
                        {/* Select existing guest */}
                        {existingGuests.length > 0 && (
                          <div className="mb-2">
                            <label className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block mb-1">Select Existing Guest</label>
                            <select
                              onChange={(e) => {
                                const gid = Number(e.target.value);
                                const g = existingGuests.find(g => g.guest_id === gid);
                                if (g) {
                                  setGuestName(g.guest_name);
                                  setGuestHandicap(g.handicap_index != null ? String(g.handicap_index) : "");
                                  setGuestPhone(g.phone || "");
                                }
                              }}
                              className="w-full text-[10px] p-1.5 border border-teal-300 dark:border-teal-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              <option value="">-- Or enter new guest below --</option>
                              {existingGuests.map(g => (
                                <option key={g.guest_id} value={g.guest_id}>{g.guest_name} (HCP: {g.handicap_index ?? "N/A"})</option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        <div className="space-y-1.5">
                          <div>
                            <label className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">Guest Name *</label>
                            <input
                              type="text"
                              value={guestName}
                              onChange={(e) => handleGuestNameSearch(e.target.value, game.adhoc_game_id)}
                              placeholder="Search or enter new guest name..."
                              className="w-full text-[10px] p-1.5 border border-teal-300 dark:border-teal-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                            />
                            {/* Show matching members from other clubs */}
                            {searchingGuestName && <p className="text-[9px] text-teal-500 mt-1">Searching...</p>}
                            {guestSearchResults.length > 0 && (
                              <div className="mt-1 max-h-28 overflow-y-auto bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-700 rounded shadow-sm">
                                <p className="text-[8px] text-purple-600 dark:text-purple-400 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 font-medium">Found existing members - click to add:</p>
                                {guestSearchResults.map(member => (
                                  <button
                                    key={member.member_id}
                                    type="button"
                                    onClick={async () => {
                                      // Add as cross-club member with their member_id (booking only, pairings generated separately)
                                      const supabase = createClient();
                                      // Check if already in game
                                      const { data: existing } = await supabase
                                        .from("adhoc_game_bookings")
                                        .select("booking_id")
                                        .eq("adhoc_game_id", game.adhoc_game_id)
                                        .eq("member_id", member.member_id)
                                        .maybeSingle();
                                      if (existing) {
                                        alert("This player is already in the game.");
                                        return;
                                      }
                                      setSavingGuest(true);
                                      await supabase.from("adhoc_game_bookings").insert({ 
                                        adhoc_game_id: game.adhoc_game_id, 
                                        member_id: member.member_id, 
                                        booking_status: "confirmed" 
                                      });
                                      // Note: Pairings are generated separately by the organizer when ready
                                      setGuestName("");
                                      setGuestSearchResults([]);
                                      setShowAddGuest(null);
                                      setSavingGuest(false);
                                      await handleSilentRefresh();
                                    }}
                                    className="w-full text-left px-2 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/30 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                                  >
                                    <p className="text-[10px] font-medium text-slate-800 dark:text-slate-200">{member.member_name}</p>
                                    <p className="text-[8px] text-purple-600 dark:text-purple-400">{member.club_name} {member.handicap_index !== null ? `| HCP: ${member.handicap_index}` : ""}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">Handicap Index</label>
                              <input
                                type="number"
                                step="0.1"
                                value={guestHandicap}
                                onChange={(e) => setGuestHandicap(e.target.value)}
                                placeholder="e.g. 18.5"
                                className="w-full text-[10px] p-1.5 border border-teal-300 dark:border-teal-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">Phone</label>
                              <input
                                type="tel"
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                                placeholder="e.g. 082..."
                                className="w-full text-[10px] p-1.5 border border-teal-300 dark:border-teal-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              />
                            </div>
                          </div>
                          {/* Guest Gender Selection */}
                          <div className="flex gap-3 mb-2 mt-2">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="guestGender"
                                checked={guestGender === 'male'}
                                onChange={() => setGuestGender('male')}
                                className="accent-blue-500 w-3.5 h-3.5"
                              />
                              <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300">Male</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="guestGender"
                                checked={guestGender === 'female'}
                                onChange={() => setGuestGender('female')}
                                className="accent-pink-500 w-3.5 h-3.5"
                              />
                              <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300">Female</span>
                            </label>
                          </div>
                        </div>
                        {/* WWB opt-in for guest — shown for all WWB club games except Tuesday Clinique (TC auto-enrolled) */}
                        {WWB_CLUB_IDS.includes(myClub?.club_id ?? 0) && myClub?.club_id !== TUESDAY_CLINIQUE_ID && (
                          <div className="mt-3 p-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                            <div className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2">WWB Competition — Opt in or out</div>
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={pendingWwbGuest.ww}
                                  onChange={e => setPendingWwbGuest(p => ({ ...p, ww: e.target.checked }))}
                                  className="accent-amber-500 w-4 h-4 flex-shrink-0"
                                />
                                <div>
                                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">WafaWafa (WW)</span>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">1st 9, 2nd 9 &amp; Overall prize pools</p>
                                </div>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={pendingWwbGuest.birdie}
                                  onChange={e => setPendingWwbGuest(p => ({ ...p, birdie: e.target.checked }))}
                                  className="accent-amber-500 w-4 h-4 flex-shrink-0"
                                />
                                <div>
                                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Birdie Pool</span>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Shared pool split by birdies made</p>
                                </div>
                              </label>
                            </div>
                          </div>
                        )}
                        <Button
                          size="sm"
                          className="w-full h-7 text-[9px] mt-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                          onClick={() => handleAddGuest(game.adhoc_game_id)}
                          disabled={!guestName.trim() || savingGuest}
                        >
                          {savingGuest ? "Adding..." : "Add Guest to Game"}
                        </Button>
                      </div>
                    )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });

                  return items;
                })()}
              </div>
            ) : (
              <div className="text-center py-4 text-[10px] text-slate-500">No adhoc games available. Create one above!</div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Game Pairings */}
        {myPairings.length > 0 && (
          <Card className="border border-green-200 dark:border-green-800 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm font-semibold font-sans flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Upcoming Game Pairings
              </CardTitle>
              <CardDescription className="text-[10px]">Your assigned groups for upcoming games</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-2">
  {myPairings.filter(p => {
    const game = adhocGames.find(g => g.adhoc_game_id === p.adhoc_game_id);
    if (!game || game.status === "deleted") return false;
    
    // Hide pairings where all results have been submitted (game is fully scored)
    // Exception: if the user is captain/organizer, they may still need to finalize
    const isUserCaptainOrOrganizer = p.isCaptain || (memberData && game.organizer_id === memberData.member_id);
    if (p.allResultsSubmitted && !isUserCaptainOrOrganizer) return false;
    
    // For completed games: keep them visible if they are part of a multi-round group
    // that still has open/in-progress rounds — captain still needs to review/finalize
    if (game.status === "completed") {
      const hasOpenSibling = game.is_multi_round && adhocGames.some(g =>
        g.is_multi_round &&
        g.organizer_id === game.organizer_id &&
        (g.club_id ?? 0) === (game.club_id ?? 0) &&
        g.total_rounds === game.total_rounds &&
        g.adhoc_game_id !== game.adhoc_game_id &&
        g.status !== "cancelled" && g.status !== "deleted" && g.status !== "completed"
      );
      // If all results are submitted and no open siblings, hide completely
      if (!hasOpenSibling && p.allResultsSubmitted) return false;
      // If not all results submitted but game is completed, still show (score entry needed)
      if (!hasOpenSibling && !p.allResultsSubmitted) return true;
      if (!hasOpenSibling) return false;
    }
    // Only show games from up to 2 days ago onwards
    const twoDaysAgo = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }));
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];
    return p.game_date >= twoDaysAgoStr;
  }).map((pairing) => (
  <div key={`${pairing.adhoc_game_id}-${pairing.fourball_number}`} className="p-2 rounded-lg border bg-white border-green-100 dark:bg-slate-800 dark:border-green-800">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{pairing.course_name}</div>
                          <span className="px-1 py-0.5 rounded text-[7px] font-medium bg-green-100 text-green-700">4BALL {pairing.fourball_number}</span>
                          {(() => {
                            const startingHole = pairing.starting_hole ?? 1;
                            return (
                              <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${startingHole === 10 ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                                TEE {startingHole}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {new Date(pairing.game_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} at {(pairing.fourball_tee_time ?? pairing.tee_off_time)?.slice(0, 5)}
                        </div>
                        {(() => {
                          const gameForCost = adhocGames.find(g => g.adhoc_game_id === pairing.adhoc_game_id);
                          if (!gameForCost || !gameForCost.cost_per_player) return null;
                          return (
                            <div className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                              R{gameForCost.cost_per_player.toLocaleString()}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {(() => {
                          const gameForPairing = adhocGames.find(g => g.adhoc_game_id === pairing.adhoc_game_id);
                          const isOrganizer = !!(memberData && gameForPairing && gameForPairing.organizer_id === memberData.member_id);
                          const isCaptainOrAdmin = pairing.isCaptain || isClub13Admin || isOrganizer;
                          // All members have submitted hole scores but captain hasn't finalised yet
                          const allScoresSubmitted = pairing.members.length > 0 && pairing.members.every(m => !!(scoresSubmittedMap[m.pairing_id] || m.scores_submitted_at));
                          const pendingReview = isCaptainOrAdmin && allScoresSubmitted && !pairing.allResultsSubmitted;
                          return { isCaptainOrAdmin, allScoresSubmitted, pendingReview };
                        })().pendingReview && (
                          <div className="flex flex-col items-end gap-1 w-full">
                            {/* Amber pending-review banner */}
                            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1 w-full">
                              <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400">Submitted — Pending Captain Review & Approval</span>
                            </div>
                            <Button
                              size="sm"
                              className="h-7 text-[9px] px-3 w-full bg-[#1a3a2a] hover:bg-[#0f2318] text-white font-bold"
                              onClick={() => openResultsInput(pairing)}
                            >
                              Review &amp; Finalise Round Results
                            </Button>
                            {/* Next round direction — available even before captain finalises */}
                            {(() => {
                              const gameForPairing = adhocGames.find(g => g.adhoc_game_id === pairing.adhoc_game_id);
                              if (!gameForPairing?.is_multi_round) return null;
                              const nextRoundGame = adhocGames.find(g =>
                                g.is_multi_round &&
                                g.organizer_id === gameForPairing.organizer_id &&
                                (g.club_id ?? 0) === (gameForPairing.club_id ?? 0) &&
                                g.total_rounds === gameForPairing.total_rounds &&
                                (g.round_number ?? 1) === (gameForPairing.round_number ?? 1) + 1
                              );
                              if (!nextRoundGame) return null;
                              return (
                                <button
                                  className="flex items-center justify-center gap-1.5 bg-[#c9a84c] hover:bg-[#b8973b] text-white rounded-lg px-2 py-1.5 w-full transition-colors"
                                  onClick={() => setActiveTab("play")}
                                >
                                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                  <span className="text-[9px] font-bold">Move to Round {nextRoundGame.round_number} in Play Tab</span>
                                </button>
                              );
                            })()}
                          </div>
                        )}
                        {(() => {
                          const gameForPairing = adhocGames.find(g => g.adhoc_game_id === pairing.adhoc_game_id);
                          const isOrganizer = !!(memberData && gameForPairing && gameForPairing.organizer_id === memberData.member_id);
                          const allScoresSubmitted = pairing.members.length > 0 && pairing.members.every(m => !!(scoresSubmittedMap[m.pairing_id] || m.scores_submitted_at));
                          return (pairing.isCaptain || isClub13Admin || isOrganizer) && !pairing.allResultsSubmitted && !allScoresSubmitted;
                        })() && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className={`h-6 text-[9px] px-2 bg-transparent ${managingFourball?.gameId === pairing.adhoc_game_id && managingFourball?.fourball === pairing.fourball_number ? "border-violet-400 text-violet-700 bg-violet-50" : "border-violet-300 text-violet-600 hover:bg-violet-50"}`}
                              onClick={() => {
                                const isOpen = managingFourball?.gameId === pairing.adhoc_game_id && managingFourball?.fourball === pairing.fourball_number;
                                setManagingFourball(isOpen ? null : { gameId: pairing.adhoc_game_id, fourball: pairing.fourball_number });
                                setFourballAddIds([]);
                                setFourballAddSearch("");
                              }}
                            >
                              {managingFourball?.gameId === pairing.adhoc_game_id && managingFourball?.fourball === pairing.fourball_number ? "Close" : "Manage"}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-6 text-[9px] px-2 border-amber-300 text-amber-700 hover:bg-amber-50 bg-transparent"
                              onClick={() => {
                                if (swappingGameId === pairing.adhoc_game_id) {
                                  setSwappingGameId(null);
                                  setSwapPlayerA(null);
                                  setSwapPlayerB(null);
                                } else {
                                  setSwappingGameId(pairing.adhoc_game_id);
                                  setSwapPlayerA(null);
                                  setSwapPlayerB(null);
                                }
                              }}
                            >
                              {swappingGameId === pairing.adhoc_game_id ? "Cancel Swap" : "Swap"}
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-6 text-[9px] px-2 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => openResultsInput(pairing)}
                            >
                              Enter Results
                            </Button>
                          </>
                        )}
                        {pairing.allResultsSubmitted && (
                          <div className="flex flex-col items-end gap-1.5 w-full">
                            {/* Next round direction for multi-round games */}
                            {(() => {
                              const gameForPairing = adhocGames.find(g => g.adhoc_game_id === pairing.adhoc_game_id);
                              if (!gameForPairing?.is_multi_round) return null;
                              const nextRoundGame = adhocGames.find(g =>
                                g.is_multi_round &&
                                g.organizer_id === gameForPairing.organizer_id &&
                                (g.club_id ?? 0) === (gameForPairing.club_id ?? 0) &&
                                g.total_rounds === gameForPairing.total_rounds &&
                                (g.round_number ?? 1) === (gameForPairing.round_number ?? 1) + 1
                              );
                              if (!nextRoundGame) return null;
                              return (
                                <div className="flex items-center gap-1.5 bg-[#f0ece2] dark:bg-[#1a2518] border border-[#c9a84c]/40 rounded-lg px-2 py-1.5 w-full">
                                  <svg className="w-3 h-3 text-[#c9a84c] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                  <span className="text-[9px] text-[#1a3a2a] dark:text-[#c9a84c] font-semibold">
                                    Round {gameForPairing.round_number ?? 1} locked — proceed to Round {nextRoundGame.round_number} in the Play tab
                                  </span>
                                </div>
                              );
                            })()}
                            <div className="flex items-center gap-2">
                            <span className="text-[8px] text-green-600 dark:text-green-400 font-medium">Results Submitted</span>
                            {(pairing.isCaptain || isClub13Admin || (memberData && ANNUAL_SUPER_ADMINS.includes(memberData.member_id))) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5 text-[8px] px-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 bg-transparent"
                                disabled={undoingResults === pairing.adhoc_game_id}
                                onClick={() => handleUndoResults(pairing)}
                              >
                                {undoingResults === pairing.adhoc_game_id ? "Undoing..." : "Undo"}
                              </Button>
                            )}
                          </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Manage Fourball Members Panel — captain / admin only */}
                    {managingFourball?.gameId === pairing.adhoc_game_id && managingFourball?.fourball === pairing.fourball_number && !pairing.allResultsSubmitted && (
                      <div className="mb-2 p-3 bg-violet-50 dark:bg-violet-900/20 rounded border border-violet-200 dark:border-violet-700 space-y-3">
                        <div className="text-sm font-bold text-violet-700 dark:text-violet-300">Manage 4Ball {pairing.fourball_number} Members</div>

                        {/* Current members — removable */}
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1.5 uppercase tracking-wide">Current Players</div>
                          <div className="space-y-1.5">
                            {pairing.members.map(m => (
                              <div key={m.pairing_id} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 border border-violet-100 dark:border-violet-800">
                                <span className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                  {m.is_captain && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">CPT</span>}
                                  {m.member_name}
                                </span>
                                {!m.is_captain && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-2.5 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 bg-transparent font-semibold"
                                    disabled={removingPairingId === m.pairing_id}
                                    onClick={() => handleRemoveFromFourball(pairing, m.pairing_id, m.member_id)}
                                  >
                                    {removingPairingId === m.pairing_id ? "..." : "Remove"}
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Add players from booked/all members */}
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1.5 uppercase tracking-wide">Add Players</div>
                          <input
                            type="text"
                            placeholder="Search members..."
                            value={fourballAddSearch}
                            onChange={e => setFourballAddSearch(e.target.value)}
                            className="w-full text-sm p-2 border border-violet-300 dark:border-violet-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 mb-1.5"
                          />
                          <div className="max-h-40 overflow-y-auto rounded border border-violet-200 dark:border-violet-700 bg-white dark:bg-slate-800 divide-y divide-violet-50 dark:divide-violet-900">
                            {(() => {
                              const inFourball = new Set(pairing.members.map(m => m.member_id));
                              return memberDirectory
                                .filter(m =>
                                  !inFourball.has(m.member_id) &&
                                  m.member_name.toLowerCase().includes(fourballAddSearch.toLowerCase())
                                )
                                .sort((a, b) => a.member_name.localeCompare(b.member_name))
                                .map(m => {
                                  const checked = fourballAddIds.includes(m.member_id);
                                  return (
                                    <label
                                      key={m.member_id}
                                      className={`flex items-center gap-2.5 px-2.5 py-2 cursor-pointer transition-colors ${checked ? "bg-violet-50 dark:bg-violet-900/40" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => setFourballAddIds(prev =>
                                          checked ? prev.filter(id => id !== m.member_id) : [...prev, m.member_id]
                                        )}
                                        className="accent-violet-600 w-4 h-4 flex-shrink-0"
                                      />
                                      <span className="text-sm text-slate-700 dark:text-slate-200">{m.member_name}</span>
                                    </label>
                                  );
                                });
                            })()}
                          </div>
                          {fourballAddIds.length > 0 && (
                            <div className="flex items-center justify-between mt-2.5">
                              <span className="text-xs text-violet-600 font-semibold">{fourballAddIds.length} selected</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-3 border-slate-300 text-slate-500 bg-transparent"
                                  onClick={() => setFourballAddIds([])}
                                >
                                  Clear
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                                  onClick={() => handleAddToFourball(pairing)}
                                  disabled={addingToFourball}
                                >
                                  {addingToFourball ? "Adding..." : `Add ${fourballAddIds.length} Player${fourballAddIds.length !== 1 ? "s" : ""}`}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Swap Players Panel */}
                    {swappingGameId === pairing.adhoc_game_id && (pairing.isCaptain || isClub13Admin) && (
                      <div className="mb-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-700">
                        <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300 mb-2">Swap Players Between Fourballs</div>
                        
                        {/* Player A - from this fourball */}
                        <div className="mb-2">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block mb-1">Select player from this group (4Ball {pairing.fourball_number})</label>
                          <select
                            value={swapPlayerA?.pairing_id || ""}
                            onChange={(e) => {
                              const pid = Number(e.target.value);
                              const m = pairing.members.find(m => m.pairing_id === pid);
                              if (m) setSwapPlayerA({ pairing_id: pid, member_name: m.member_name, fourball_number: pairing.fourball_number });
                              else setSwapPlayerA(null);
                            }}
                            className="w-full text-sm p-2 h-9 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium"
                          >
                            <option value="">-- Select Player --</option>
                            {pairing.members.map(m => (
                              <option key={m.pairing_id} value={m.pairing_id}>{m.member_name} (HCP: {m.playing_handicap ?? "-"})</option>
                            ))}
                          </select>
                        </div>

                        {/* Player B - from other fourballs */}
                        <div className="mb-2">
                          <label className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block mb-1">Swap with player from another group</label>
                          <select
                            value={swapPlayerB?.pairing_id || ""}
                            onChange={(e) => {
                              const pid = Number(e.target.value);
                              const otherFourballs = allGamePairings.filter(p => p.adhoc_game_id === pairing.adhoc_game_id && p.fourball_number !== pairing.fourball_number);
                              for (const fb of otherFourballs) {
                                const m = fb.members.find(m => m.pairing_id === pid);
                                if (m) {
                                  setSwapPlayerB({ pairing_id: pid, member_name: m.member_name, fourball_number: fb.fourball_number });
                                  break;
                                }
                              }
                              if (!pid) setSwapPlayerB(null);
                            }}
                            className="w-full text-sm p-2 h-9 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium"
                          >
                            <option value="">-- Select Player --</option>
                            {allGamePairings
                              .filter(p => p.adhoc_game_id === pairing.adhoc_game_id && p.fourball_number !== pairing.fourball_number)
                              .map(fb => (
                                <optgroup key={fb.fourball_number} label={`4Ball ${fb.fourball_number}`}>
                                  {fb.members.map(m => (
                                    <option key={m.pairing_id} value={m.pairing_id}>{m.member_name} (HCP: {m.playing_handicap ?? "-"})</option>
                                  ))}
                                </optgroup>
                              ))}
                          </select>
                        </div>

                        {/* Swap preview */}
                        {swapPlayerA && swapPlayerB && (
                          <div className="text-[9px] text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/30 rounded p-2 mb-2 space-y-1">
                            <div>
                              <span className="font-semibold">{formatMemberName(swapPlayerA.member_name)}</span>
                              <span className="text-amber-500 mx-1">(4Ball {swapPlayerA.fourball_number})</span>
                              <span className="mx-1">{"<->"}</span>
                              <span className="font-semibold">{formatMemberName(swapPlayerB.member_name)}</span>
                              <span className="text-amber-500 mx-1">(4Ball {swapPlayerB.fourball_number})</span>
                            </div>
                            <div className="text-[8px] text-green-700 dark:text-green-400 font-medium">
                              Any scores already captured for these players will be preserved.
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-7 text-[9px] bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                            onClick={handleSwapPlayers}
                            disabled={!swapPlayerA || !swapPlayerB || swapLoading}
                          >
                            {swapLoading ? "Swapping..." : "Confirm Swap"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[9px] px-3 bg-transparent"
                            onClick={() => { setSwappingGameId(null); setSwapPlayerA(null); setSwapPlayerB(null); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Results Input Form - Only for Captain */}
                    {showResultsInput === pairing.fourball_number && pairing.isCaptain && (
                      <div className="mb-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-700">
                        <div className="text-[10px] font-medium text-green-700 dark:text-green-300 mb-3">Enter Results for 4Ball {pairing.fourball_number}</div>
                        
                        {/* Category Dropdown */}
                        <div className="mb-3">
                          <select
                            value={resultCategory}
                            onChange={(e) => setResultCategory(e.target.value)}
                            className="w-full text-sm p-2 h-10 border border-green-300 dark:border-green-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          >
                            <option value="gross_score">Gross Score</option>
                            <option value="birdies_count">Birdies</option>
                            <option value="eagles_count">Eagles</option>
                            <option value="hio_count">Hole-in-One / Albatross</option>
                            <option value="ladies_count">Ladies</option>
                            <option value="is_late">Late</option>
                            <option value="is_no_show">No Show</option>
                          </select>
                        </div>

                        {/* Player inputs for selected category */}
                        <div className="space-y-2">
                          {pairing.members.map((member) => {
                            const isCurrentMember = member.member_name === memberData?.member_name;
                            const isCheckbox = resultCategory === "is_late" || resultCategory === "is_no_show";
                            const memberPoints = resultsData[member.pairing_id]?.points;
                            return (
                              <div key={member.pairing_id} className={`flex items-center gap-3 p-2 rounded-lg ${isCurrentMember ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600"}`}>
                                <div className={`flex-1 min-w-0 ${isCurrentMember ? "font-bold text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>
                                  <div className="text-sm truncate">
                                    {getDisplayName(member.member_name, pairing.members.map(m => m.member_name))}
                                    {member.is_captain && <span className="text-green-600 ml-1 text-[10px]">C</span>}
                                  </div>
<div className="text-[10px] text-slate-400 flex items-center gap-1">
  {editingHcpPairingId === member.pairing_id ? (
  <div className="flex items-center gap-2">
  <input
  type="number"
  step="0.1"
  className="w-20 text-sm border border-blue-400 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  value={editingHcpValue}
  autoFocus
  onChange={e => setEditingHcpValue(e.target.value)}
  onKeyDown={e => {
  if (e.key === "Enter" && editingHcpValue !== "") savePlayingHandicap(member.pairing_id, Number(editingHcpValue));
  if (e.key === "Escape") { setEditingHcpPairingId(null); setEditingHcpValue(""); }
  }}
  />
  <button 
  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 transition-colors disabled:opacity-50"
  disabled={savingHcp || !editingHcpValue}
  onClick={() => editingHcpValue !== "" && savePlayingHandicap(member.pairing_id, Number(editingHcpValue))}
  >
  {savingHcp ? (
  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
  ) : (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
  )}
  Save
  </button>
  <button 
  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors"
  onClick={() => { setEditingHcpPairingId(null); setEditingHcpValue(""); }}
  >
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
  Cancel
  </button>
  </div>
  ) : (
  <>
  HCP: {member.playing_handicap ?? "-"}
  {pairing.isCaptain && (
  <button className="text-[9px] text-blue-500 underline ml-1" onClick={() => { setEditingHcpPairingId(member.pairing_id); setEditingHcpValue(String(member.playing_handicap ?? "")); }}>edit</button>
  )}
  </>
  )}
  </div>
                                  {resultCategory === "gross_score" && memberPoints && (
                                    <div className="text-[10px] font-semibold text-green-600 dark:text-green-400">Pts: {memberPoints}</div>
                                  )}
                                </div>
                                {isCheckbox ? (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 accent-green-600"
                                      checked={(resultsData[member.pairing_id] as Record<string, unknown>)?.[resultCategory] as boolean || false}
                                      onChange={(e) => setResultsData(prev => ({
                                        ...prev,
                                        [member.pairing_id]: { ...prev[member.pairing_id], [resultCategory]: e.target.checked }
                                      }))}
                                    />
                                    <span className="text-xs text-slate-500">{resultCategory === "is_late" ? "Late" : "No Show"}</span>
                                  </label>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    className="w-20 text-base p-2 h-10 text-center border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    value={(resultsData[member.pairing_id] as Record<string, unknown>)?.[resultCategory] as string || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setResultsData(prev => {
                                        const updated = { ...prev, [member.pairing_id]: { ...prev[member.pairing_id], [resultCategory]: val } };
                                        // Auto-calculate points when gross score is entered
                                        if (resultCategory === "gross_score" && val && member.playing_handicap !== null) {
                                          const gross = Number(val);
                                          const hcp = member.playing_handicap;
                                          const cr = pairing.course_rating;
                                          const pts = Math.round(((cr + hcp) - gross) + 36);
                                          updated[member.pairing_id] = { ...updated[member.pairing_id], points: String(pts) };
                                        }
                                        return updated;
                                      });
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Summary of entered data */}
                        <div className="mt-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                          <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Summary</div>
                          <div className="space-y-1">
                            {pairing.members.map((member) => {
                              const d = resultsData[member.pairing_id];
                              const pairingMemberNames = pairing.members.map(m => m.member_name);
                              if (!d) return null;
                              const parts: string[] = [];
                              if (d.gross_score) parts.push(`Grs:${d.gross_score}`);
                              if (d.points) parts.push(`Pts:${d.points}`);
                              if (d.birdies_count && d.birdies_count !== "0") parts.push(`Bir:${d.birdies_count}`);
                              if (d.eagles_count && d.eagles_count !== "0") parts.push(`Eag:${d.eagles_count}`);
                              if (d.hio_count && d.hio_count !== "0") parts.push(`HiO:${d.hio_count}`);
                              if (d.ladies_count && d.ladies_count !== "0") parts.push(`Ldy:${d.ladies_count}`);
                              if (d.is_late) parts.push("Late");
                              if (d.is_no_show) parts.push("NS");
                              return (
                                <div key={member.pairing_id} className="flex items-center gap-2 text-[10px]">
                                  <span className="font-medium text-slate-600 dark:text-slate-300 w-16 truncate">{getDisplayName(member.member_name, pairingMemberNames)}</span>
                                  <span className="text-slate-500 dark:text-slate-400">{parts.length > 0 ? parts.join(" | ") : "---"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <Button 
                            size="sm" 
                            className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold"
                            onClick={() => handleSaveResults(pairing)}
                            disabled={savingResults}
                          >
                            {savingResults ? "Saving..." : "Save Results"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-xs px-4 bg-transparent"
                            onClick={() => setShowResultsInput(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Members List */}
                    {(() => {
                      const isClub13 = WWB_CLUB_IDS.includes(myClub?.club_id ?? 0);
                      // Lock WWB opt-ins once the 4-ball tee-off time has passed
                      const gameStarted = (() => {
                        if (!pairing.tee_off_time || !pairing.game_date) return false;
                        const [h, m] = pairing.tee_off_time.split(":").map(Number);
                        const startDt = new Date(`${pairing.game_date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`);
                        return Date.now() >= startDt.getTime();
                      })();
                      // Organizer of this specific game
                      const wwbGameForPairing = adhocGames.find(g => g.adhoc_game_id === pairing.adhoc_game_id);
                      const isOrganizerForWwb = !!(memberData && wwbGameForPairing && wwbGameForPairing.organizer_id === memberData.member_id);
                      // Captain of this fourball (pairing.isCaptain is true when the logged-in user is captain)
                      const isFourballCaptain = pairing.isCaptain;
                      return (
                        <div className={`grid gap-1 ${isClub13 ? "grid-cols-1" : "grid-cols-2"}`}>
                          {isClub13 && gameStarted && (
                            <div className="col-span-1 text-[8px] text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-900/20 rounded px-2 py-1 border border-red-200 dark:border-red-700 mb-1">
                              WWB competition is locked — tee-off time has passed.
                            </div>
                          )}
                          {pairing.members.map((member) => {
                            const isCurrentMember = member.member_name === memberData?.member_name;
                            const optIn = wwbOptIns[member.pairing_id] || { ww: false, birdie: false };
                            // Organizer, captain of the fourball, and admin can mark any player; the player themselves can always mark their own
                            const canEditOptIn = (isCurrentMember || isClub13Admin || isOrganizerForWwb || isFourballCaptain) && !gameStarted;
                            return (
                              <div key={member.pairing_id} className={`text-[9px] px-2 py-1 rounded ${isCurrentMember ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold" : member.is_captain ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-medium" : "bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                  <span>
{member.member_name}
  {editingHcpPairingId === member.pairing_id ? (
  <span className="ml-1 inline-flex items-center gap-1">
  <input
  type="number"
  step="0.1"
  className="w-16 text-xs border border-blue-400 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500"
  value={editingHcpValue}
  autoFocus
  onChange={e => setEditingHcpValue(e.target.value)}
  onKeyDown={e => {
  if (e.key === "Enter" && editingHcpValue !== "") savePlayingHandicap(member.pairing_id, Number(editingHcpValue));
  if (e.key === "Escape") { setEditingHcpPairingId(null); setEditingHcpValue(""); }
  }}
  />
  <button 
  className="p-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
  disabled={savingHcp || !editingHcpValue} 
  onClick={() => editingHcpValue !== "" && savePlayingHandicap(member.pairing_id, Number(editingHcpValue))}
  >
  {savingHcp ? (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
  ) : (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
  )}
  </button>
  <button 
  className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
  onClick={() => { setEditingHcpPairingId(null); setEditingHcpValue(""); }}
  >
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
  </button>
  </span>
  ) : (
  <span className="text-slate-400 ml-0.5 font-normal">
  ({member.playing_handicap ?? "-"})
  {pairing.isCaptain && (
  <button className="text-[8px] text-blue-400 underline ml-1" onClick={() => { setEditingHcpPairingId(member.pairing_id); setEditingHcpValue(String(member.playing_handicap ?? "")); }}>edit</button>
  )}
  </span>
  )}
                                    {member.is_captain && <span className="ml-1">(Captain)</span>}
                                    {member.result_submitted && member.points !== null && (
                                      <span className="ml-1 text-slate-500">- {member.points}pts</span>
                                    )}
                                  </span>
                                  {isClub13 && (
                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-0.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          className="w-2.5 h-2.5 accent-blue-600"
                                          checked={optIn.ww}
                                          disabled={!canEditOptIn || savingWwbOptIn === member.pairing_id}
                                          onChange={(e) => handleSaveWwbOptIn(member.pairing_id, e.target.checked, optIn.birdie)}
                                        />
                                        <span className="text-[8px] font-semibold text-blue-600 dark:text-blue-400">WW</span>
                                      </label>
                                      <label className="flex items-center gap-0.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          className="w-2.5 h-2.5 accent-amber-600"
                                          checked={optIn.birdie}
                                          disabled={!canEditOptIn || savingWwbOptIn === member.pairing_id}
                                          onChange={(e) => handleSaveWwbOptIn(member.pairing_id, optIn.ww, e.target.checked)}
                                        />
                                        <span className="text-[8px] font-semibold text-amber-600 dark:text-amber-400">B</span>
                                      </label>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        </div>}

{/* ═══════════════════════════════════════════════
  LIVE SCORING TAB
  ═══════════════════════════════════════════════ */}
{activeTab === "live" && <div className="space-y-4">
  
  {/* Live tab content - club members see all their club's games, cross-club guests see games they're in */}
  
  {/* Upcoming Game Display - When game exists but hasn't started */}
        {(() => {
          // Check if there are pairings but no scores yet
          const hasPairings = allGamePairings.some(p => p.adhoc_game_id === liveScoreGameInfo?.adhoc_game_id);
          const hasAnyScores = liveScores.some(s => s.points !== null || s.gross_score !== null);
          
          // Check if tee-off time has passed
          const teeTimePassed = (() => {
            if (!liveScoreGameInfo?.tee_off_time || !liveScoreGameInfo?.game_date) return false;
            const now = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }));
            const [hours, minutes] = liveScoreGameInfo.tee_off_time.split(":").map(Number);
            // Parse date correctly in local timezone by appending T00:00:00
            const [year, month, day] = liveScoreGameInfo.game_date.split('-').map(Number);
            const gameDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

            return now >= gameDateTime;
          })();
          

          
          // Only show upcoming game if tee time hasn't passed AND no scores yet
          if (liveScoreGameInfo && hasPairings && !hasAnyScores && !teeTimePassed) {
            // Get pairings for this game
            const upcomingPairings = allGamePairings.filter(p => p.adhoc_game_id === liveScoreGameInfo.adhoc_game_id);
            const totalPlayers = upcomingPairings.reduce((sum, p) => sum + p.members.length, 0);
            
            return (
              <Card className="border border-blue-200 dark:border-blue-800 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold font-sans flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Upcoming Game
                    </CardTitle>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[8px] font-bold rounded-full">
                      {new Date(liveScoreGameInfo.game_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  </div>
                  
                  {/* Course Name */}
                  <CardDescription className="text-[11px] font-semibold mt-1 flex items-center gap-1.5">
                    {liveScoreGameInfo.course_name}
                    {liveScoreGameInfo.game_visibility === "public" && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded">PUBLIC</span>
                    )}
                  </CardDescription>
                  
                  {/* LARGE COUNTDOWN TIMER */}
                  {(() => {
                    const getCountdownText = () => {
                      if (!liveScoreGameInfo?.tee_off_time || !liveScoreGameInfo?.game_date) return "TBD";
                      
                      const now = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }));
                      const [hours, minutes] = liveScoreGameInfo.tee_off_time.split(":").map(Number);
                      // Parse date correctly in local timezone
                      const [year, month, day] = liveScoreGameInfo.game_date.split('-').map(Number);
                      const gameDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
                      
                      const diffMs = gameDateTime.getTime() - now.getTime();
                      if (diffMs <= 0) return "LIVE NOW!";
                      
                      const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
                      const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      const secsLeft = Math.floor((diffMs % (1000 * 60)) / 1000);
                      
                      if (hoursLeft > 0) return `${hoursLeft}h ${minsLeft}m`;
                      if (minsLeft > 0) return `${minsLeft}m ${secsLeft}s`;
                      return `${secsLeft}s`;
                    };
                    
                    const getCountdownColor = () => {
                      if (!liveScoreGameInfo?.tee_off_time || !liveScoreGameInfo?.game_date) return "text-slate-400";
                      
                      const now = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }));
                      const [hours, minutes] = liveScoreGameInfo.tee_off_time.split(":").map(Number);
                      const gameDateTime = new Date(liveScoreGameInfo.game_date);
                      gameDateTime.setHours(hours, minutes, 0, 0);
                      
                      const diffMs = gameDateTime.getTime() - now.getTime();
                      const diffMinutes = Math.floor(diffMs / (1000 * 60));
                      
                      if (diffMs <= 0) return "text-red-600 dark:text-red-400 animate-pulse";
                      if (diffMinutes <= 30) return "text-orange-600 dark:text-orange-400";
                      if (diffMinutes <= 60) return "text-yellow-600 dark:text-yellow-400";
                      return "text-green-600 dark:text-green-400";
                    };
                    
                    const countdownText = getCountdownText();
                    const countdownColor = getCountdownColor();
                    
                    return (
                      <div className="mt-2 mb-1 text-center">
                        <div className={`text-3xl font-bold font-mono ${countdownColor}`}>
                          {countdownText}
                        </div>
                        <div className="text-[8px] text-slate-400 mt-0.5">
                          until tee off
                        </div>
                      </div>
                    );
                  })()}
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {/* Pairings Preview */}
                  <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-2">
                    <span>Game Pairings ({totalPlayers} players)</span>
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {upcomingPairings.map((pairing, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-blue-800 p-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                              4BALL {pairing.fourball_number}
                            </span>
                            <span className="text-[8px] text-slate-400">
                              Tee {pairing.starting_hole}
                            </span>
                          </div>
                          <span className="text-[8px] text-slate-400">
                            {pairing.members.length}/4 players
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {pairing.members.map((member, mIdx) => (
                            <div key={mIdx} className="flex items-center gap-0.5 bg-slate-50 dark:bg-slate-700 rounded px-1.5 py-0.5">
                              <span className="text-[9px] font-medium">{member.member_name.split(' ')[0]}</span>
                              {member.is_captain && (
                                <span className="text-[7px] text-green-600 font-bold">(C)</span>
                              )}
                              <span className="text-[7px] text-slate-400">[{member.playing_handicap ?? '-'}]</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Quick Actions */}
                  {/* Game not started notice */}
                  <div className="mt-3 text-center text-[8px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded p-1.5">
                    Live scoring will begin automatically at tee-off time
                  </div>
                </CardContent>
              </Card>
            );
          }
          return null;
        })()}

        {/* ── Multi-Round Tab Bar ── shown when the active live game belongs to a multi-round group */}
        {(() => {
          const currentGame = liveScoreGameInfo?.adhoc_game_id
            ? adhocGames.find(g => g.adhoc_game_id === liveScoreGameInfo.adhoc_game_id)
            : null;
          if (!currentGame?.is_multi_round) return null;

          // Collect all rounds in this multi-round group, sorted by round_number
          const roundGames = adhocGames
            .filter(g =>
              g.is_multi_round &&
              g.organizer_id === currentGame.organizer_id &&
              (g.club_id ?? 0) === (currentGame.club_id ?? 0) &&
              g.total_rounds === currentGame.total_rounds
            )
            .sort((a, b) => (a.round_number ?? 1) - (b.round_number ?? 1));

          if (roundGames.length < 2) return null;

          // Determine which round is active (the one we're scoring)
          const activeRoundNumber = currentGame.round_number ?? 1;

          // Check if all holes are complete for a given game.
          // A round is "complete" if:
          //   1. The adhoc_game row has status="completed", OR
          //   2. All pairings have allResultsSubmitted, OR
          //   3. Every member in every pairing has result_submitted or scores_submitted_at set
          const isRoundComplete = (gameId: number) => {
            // Fastest check: game-level status (set by finalize-game API)
            const game = adhocGames.find(g => g.adhoc_game_id === gameId);
            if (game?.status === "completed") return true;
            const gamePairings = allGamePairings.filter(p => p.adhoc_game_id === gameId);
            if (!gamePairings.length) return false;
            if (gamePairings.every(p => p.allResultsSubmitted)) return true;
            // Also treat as complete if every member has submitted hole scores (pending captain review)
            return gamePairings.every(p =>
              p.members.length > 0 && p.members.every(m => !!m.scores_submitted_at || m.result_submitted)
            );
          };

          // Build summary leaderboard across all rounds — includes in-progress scores dynamically
          const allIsMedal = MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0);

          const buildSummary = () => {
            const totalsMap: Record<number, {
              member_name: string; member_id: number;
              totalPoints: number; totalNetToPar: number; totalGross: number;
              roundsStarted: number; roundsComplete: number;
              // per-round breakdown: net is now "net to par" (e.g., -3, +2)
              rounds: { roundNum: number; points: number; gross: number; netToPar: number; complete: boolean }[];
            }> = {};

            // Build a map of course_id -> course_par for each round
            // We'll use 72 as default if course data isn't available
            const courseParMap: Record<number, number> = {};
            roundGames.forEach(rg => {
              // Attempt to derive par from course_rating or default to 72
              // In most golf, course par is typically 72 but course_rating is different
              // For proper net-to-par we need actual course par which isn't stored directly
              // We'll use 72 as standard par; the real fix would be to store course_par
              courseParMap[rg.adhoc_game_id] = 72;
            });

            roundGames.forEach((rg, rgIdx) => {
              const rgPairings = allGamePairings.filter(p => p.adhoc_game_id === rg.adhoc_game_id);
              const rgIsMedal = allIsMedal || rg.game_type === "Medal";
              const rNum = rg.round_number ?? rgIdx + 1;
              const coursePar = courseParMap[rg.adhoc_game_id] || 72;

              rgPairings.forEach(fb => {
                fb.members.forEach(m => {
                  // Detect if this member has hole score data (in memory or submitted)
                  const holesInMemory = holeScoreData[m.pairing_id] && Object.keys(holeScoreData[m.pairing_id]).length > 0;
                  const hasAnyScoreData = m.result_submitted || holesInMemory || !!m.scores_submitted_at || m.points != null;
                  if (!hasAnyScoreData) return;

                  if (!totalsMap[m.member_id]) {
                    totalsMap[m.member_id] = {
                      member_name: m.member_name, member_id: m.member_id,
                      totalPoints: 0, totalNetToPar: 0, totalGross: 0,
                      roundsStarted: 0, roundsComplete: 0, rounds: [],
                    };
                  }

                // Prefer DB totals (captain finalised). Fall back to 0 if not available.
                const pts = m.points ?? 0;
                const gross = m.gross_score ?? 0;
                  // Net to par = gross - handicap - course_par
                  // e.g., gross 85, hcp 12, par 72 => net = 85 - 12 = 73, netToPar = 73 - 72 = +1
                  const netScore = gross - (m.playing_handicap ?? 0);
                  const netToPar = netScore - coursePar;
                  const complete = m.result_submitted;

                  // Only add this round once per member (avoid double-counting from multiple fourballs)
                  const alreadyAdded = totalsMap[m.member_id].rounds.some(r => r.roundNum === rNum);
                  if (!alreadyAdded) {
                    totalsMap[m.member_id].totalPoints += pts;
                    totalsMap[m.member_id].totalGross += gross;
                    totalsMap[m.member_id].totalNetToPar += netToPar;
                    totalsMap[m.member_id].roundsStarted += 1;
                    if (complete) totalsMap[m.member_id].roundsComplete += 1;
                    totalsMap[m.member_id].rounds.push({ roundNum: rNum, points: pts, gross, netToPar, complete });
                  }
                });
              });
            });

            return Object.values(totalsMap)
              .filter(p => p.roundsStarted > 0)
              .sort((a, b) => allIsMedal ? a.totalNetToPar - b.totalNetToPar : b.totalPoints - a.totalPoints);
          };

          const summaryRows = liveRoundTab === "summary" ? buildSummary() : [];
          const memberNames = summaryRows.map(r => r.member_name);
          const anyRoundLive = roundGames.some(rg =>
            rg.adhoc_game_id === liveScoreGameInfo?.adhoc_game_id ||
            allGamePairings.filter(p => p.adhoc_game_id === rg.adhoc_game_id).some(p => !p.allResultsSubmitted && p.members.some(m => (m.points ?? 0) > 0 || (m.gross_score ?? 0) > 0))
          );

          return (
            <div className="space-y-3">
              {/* Tab bar */}
              <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-[#c9a84c]/40 bg-[#f7f4ed] dark:bg-[#1a1e14]">
{roundGames.map((rg, idx) => {
  const rNum = rg.round_number ?? idx + 1;
  const complete = isRoundComplete(rg.adhoc_game_id);
  const isActive = rg.adhoc_game_id === liveScoreGameInfo?.adhoc_game_id;
  const isSelected = liveRoundTab === rNum;
  return (
  <button
  key={rg.adhoc_game_id}
  onClick={async () => {
    // Clear scores first
    setHoleScoreData({});
    setLadyHoleData({});
    // Then switch
    setLiveRoundTab(rNum);
    await openScorecard(rg.adhoc_game_id, rg.course_id);
  }}
  className={`flex-1 py-2 px-1 text-[10px] font-bold transition-colors flex flex-col items-center gap-0.5 border-r border-[#c9a84c]/20 last:border-r-0
  ${isSelected
  ? "bg-[#1a3a2a] text-white"
  : "text-[#1a3a2a] dark:text-[#c9a84c] hover:bg-[#e8f0ec] dark:hover:bg-[#1e3028]"
  }`}
  >
  <span>R{rNum}</span>
  {complete
  ? <span className={`text-[7px] font-normal ${isSelected ? "text-green-300" : "text-green-600 dark:text-green-400"}`}>Complete</span>
  : isActive
  ? <span className={`text-[7px] font-normal flex items-center gap-0.5 ${isSelected ? "text-green-200" : "text-green-600 dark:text-green-400"}`}>
  <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"/></span>
  Live
  </span>
  : <span className={`text-[7px] font-normal ${isSelected ? "text-slate-300" : "text-slate-400"}`}>{rg.game_date ? new Date(rg.game_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "TBC"}</span>
  }
  </button>
  );
  })}
                <button
                  onClick={() => setLiveRoundTab("summary")}
                  className={`flex-1 py-2 px-1 text-[10px] font-bold transition-colors flex flex-col items-center gap-0.5
                    ${liveRoundTab === "summary"
                      ? "bg-[#c9a84c] text-white"
                      : "text-[#1a3a2a] dark:text-[#c9a84c] hover:bg-[#e8f0ec] dark:hover:bg-[#1e3028]"
                    }`}
                >
                  <span>Summary</span>
                  <span className={`text-[7px] font-normal ${liveRoundTab === "summary" ? "text-yellow-100" : "text-slate-400"}`}>All Rounds</span>
                </button>
              </div>

              {/* Summary tab content */}
              {liveRoundTab === "summary" && (
                <div className="rounded-xl border border-[#c9a84c]/50 bg-white dark:bg-slate-800 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-[#f7f4ed] dark:bg-[#1a1e14] border-b border-[#d4c9a8] dark:border-[#c9a84c]/30">
                    <svg className="w-3.5 h-3.5 text-[#c9a84c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-xs font-bold text-[#1a3a2a] dark:text-[#c9a84c]">Cumulative Leaderboard</span>
                    {anyRoundLive && (
                      <span className="flex items-center gap-1 text-[9px] text-green-600 dark:text-green-400 font-semibold">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"/>
                        </span>
                        Live
                      </span>
                    )}
                    <span className="ml-auto text-[9px] text-slate-500">{roundGames.length} rounds · {allIsMedal ? "Medal" : "Stableford"}</span>
                  </div>

                  {summaryRows.length === 0 ? (
                    <div className="px-3 py-8 text-center space-y-1">
                      <svg className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="text-[10px] font-semibold text-slate-400">No scores yet</p>
                      <p className="text-[9px] text-slate-300 dark:text-slate-600">Scores will appear here as players enter them</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[9px]">
                        <thead>
                          {/* Sub-header: round labels spanning Gross+Net */}
                          <tr className="bg-[#f7f4ed] dark:bg-[#1a1e14] border-b border-[#d4c9a8] dark:border-[#c9a84c]/20">
                            <th className="px-2 py-1 text-left font-semibold text-slate-400 uppercase tracking-wide w-5">#</th>
                            <th className="px-2 py-1 text-left font-semibold text-slate-400 uppercase tracking-wide">Player</th>
                            {roundGames.map((rg, idx) => {
                              const rNum = rg.round_number ?? idx + 1;
                              return (
                                <th key={rg.adhoc_game_id} colSpan={2} className="px-1 py-1 text-center font-bold text-[#1a3a2a] dark:text-[#c9a84c] tracking-wide border-l border-[#d4c9a8] dark:border-[#c9a84c]/20">
                                  R{rNum}
                                </th>
                              );
                            })}
                            <th colSpan={allIsMedal ? 1 : 2} className="px-1 py-1 text-center font-bold text-[#1a3a2a] dark:text-[#c9a84c] tracking-wide border-l border-[#c9a84c]/40">
                              Overall
                            </th>
                          </tr>
                          {/* Sub-header: Gross / Net labels per round */}
                          <tr className="bg-[#f0ece0] dark:bg-[#151a10] border-b border-[#d4c9a8] dark:border-[#c9a84c]/20">
                            <th className="px-2 py-0.5" />
                            <th className="px-2 py-0.5" />
                            {roundGames.map((rg) => (
                              <React.Fragment key={rg.adhoc_game_id}>
                                <th className="px-1 py-0.5 text-center text-[7px] font-semibold text-slate-400 border-l border-[#d4c9a8] dark:border-[#c9a84c]/20 w-10">Gross</th>
                                <th className="px-1 py-0.5 text-center text-[7px] font-semibold text-slate-400 w-10">Net</th>
                              </React.Fragment>
                            ))}
                            <th className="px-1 py-0.5 text-center text-[7px] font-semibold text-slate-400 border-l border-[#c9a84c]/40 w-12">Net</th>
                            {!allIsMedal && <th className="px-1 py-0.5 text-center text-[7px] font-semibold text-[#c9a84c] w-12">Pts</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {summaryRows.map((row, i) => {
                            const isMe = row.member_id === memberData?.member_id;
                            const posLabels = ["1st", "2nd", "3rd"];
                            const isTopRow = i === 0;
                            return (
                              <tr key={row.member_id}
                                className={`transition-colors text-[10px]
                                  ${isMe ? "bg-[#f0f7ff] dark:bg-blue-900/20" : i % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-[#fafaf9] dark:bg-slate-800/60"}
                                  ${isTopRow ? "font-bold" : ""}
                                `}
                              >
                                {/* Position */}
                                <td className={`px-2 py-2 text-[8px] font-bold w-5 ${isTopRow ? "text-[#c9a84c]" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-slate-400"}`}>
                                  {i < 3 ? posLabels[i] : `${i + 1}`}
                                </td>
                                {/* Name */}
                                <td className="px-2 py-2 max-w-[90px]">
                                  <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                                    <span className="truncate">{getDisplayName(row.member_name, memberNames)}</span>
                                    {isMe && <span className="text-[7px] text-blue-500 font-bold flex-shrink-0">YOU</span>}
                                  </div>
                                </td>
                                {/* Per-round Gross + Net-to-Par */}
                                {roundGames.map((rg, idx) => {
                                  const rNum = rg.round_number ?? idx + 1;
                                  const rData = row.rounds.find(r => r.roundNum === rNum);
                                  const liveColor = rData && !rData.complete ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-300";
                                  // Format net-to-par: -3, E, +2
                                  const formatNetToPar = (n: number) => n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`;
                                  const netColor = (n: number) => n < 0 ? "text-green-600 dark:text-green-400" : n === 0 ? "text-slate-600 dark:text-slate-300" : "text-red-600 dark:text-red-400";
                                  return (
                                    <React.Fragment key={rg.adhoc_game_id}>
                                      <td className={`px-1 py-2 text-center border-l border-[#d4c9a8] dark:border-[#c9a84c]/20 font-mono ${liveColor}`}>
                                        {rData ? (
                                          <>
                                            {rData.gross > 0 ? rData.gross : "—"}
                                            {rData && !rData.complete && <span className="text-[7px] opacity-60">*</span>}
                                          </>
                                        ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                      </td>
                                      <td className={`px-1 py-2 text-center font-mono font-semibold ${rData ? netColor(rData.netToPar) : liveColor}`}>
                                        {rData ? (
                                          <>
                                            {formatNetToPar(rData.netToPar)}
                                            {!rData.complete && <span className="text-[7px] opacity-60">*</span>}
                                          </>
                                        ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                                {/* Overall Net-to-Par (cumulative) */}
                                <td className={`px-1 py-2 text-center font-bold border-l border-[#c9a84c]/40 font-mono ${row.totalNetToPar < 0 ? "text-green-600 dark:text-green-400" : row.totalNetToPar === 0 ? (isTopRow ? "text-[#c9a84c]" : "text-slate-700 dark:text-slate-200") : "text-red-600 dark:text-red-400"}`}>
                                  {row.totalNetToPar === 0 ? "E" : row.totalNetToPar > 0 ? `+${row.totalNetToPar}` : row.totalNetToPar}
                                </td>
                                {/* Overall Pts (Stableford only) */}
                                {!allIsMedal && (
                                  <td className={`px-1 py-2 text-center font-bold font-mono ${isTopRow ? "text-[#c9a84c]" : "text-slate-700 dark:text-slate-200"}`}>
                                    {row.totalPoints > 0 ? row.totalPoints : "—"}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {/* Live legend */}
                      {anyRoundLive && (
                        <div className="px-3 py-1.5 text-[8px] text-slate-400 dark:text-slate-500 bg-[#fafaf9] dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-700">
                          * score in progress · updates as holes are entered
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Live Leaderboard */}
        <div id="live-leaderboard" />
        {/* Fallback: build a leaderboard from allGamePairings if performance_records aren't available yet */}
        {(() => {
          if (liveScores.length > 0 && liveScoreGameInfo) return null; // live game handles this
          if (recentResults.length > 0) return null; // perf records handle this
          // Use the most recent game from allGamePairings (covers past games not in adhocGames state)
          const gameIds = [...new Set(allGamePairings.map(p => p.adhoc_game_id))];
          if (gameIds.length === 0) return null;
          // Pick the most recent by game_date from allGamePairings
          // Sort by adhoc_game_id descending — highest ID is always the most recent game
          const byDate = gameIds.sort((a, b) => b - a);
          const gameId = byDate[0];
          if (!gameId && gameId !== 0) return null;
          const gamePairings = allGamePairings.filter(p => p.adhoc_game_id === gameId);
          if (gamePairings.length === 0) return null;
          const mostRecentGame = adhocGames.find(g => g.adhoc_game_id === gameId) ?? { course_name: gamePairings[0]?.course_name ?? "", game_date: gamePairings[0]?.game_date ?? "" };
          const gameIsMedal = gamePairings[0]?.game_type === "Medal";
          const members = gamePairings.flatMap(p => p.members.map(m => ({ ...m, fourball_number: p.fourball_number })));
          const sorted = [...members].sort((a, b) => gameIsMedal
            ? ((a.gross_score ?? 99) - (a.playing_handicap ?? 0)) - ((b.gross_score ?? 99) - (b.playing_handicap ?? 0))
            : (b.points ?? 0) - (a.points ?? 0)
          );
          const names = members.map(m => m.member_name);
          return (
            <Card className="border border-indigo-200 dark:border-indigo-800 shadow-sm bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-semibold font-sans flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Most Recent Game
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500">
                  {mostRecentGame.course_name} · {new Date(mostRecentGame.game_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} · {gameIsMedal ? "Medal" : "Stableford"} · {members.length} players
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="grid grid-cols-12 gap-1 text-[8px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide pb-1 border-b border-indigo-100 dark:border-indigo-800 mb-1">
                  <div className="col-span-1">#</div>
                  <div className="col-span-5">Player</div>
                  <div className="col-span-2 text-center">4Ball</div>
                  <div className="col-span-2 text-center">Gross</div>
                  <div className="col-span-2 text-center">{gameIsMedal ? "Net" : "Pts"}</div>
                </div>
                {sorted.map((m, i) => {
                  const isMe = m.member_id === memberData?.member_id;
                  const net = gameIsMedal ? ((m.gross_score ?? 0) - (m.playing_handicap ?? 0)) : null;
                  return (
                    <div key={m.pairing_id} className={`grid grid-cols-12 gap-1 items-center py-1 text-[9px] ${isMe ? "bg-blue-50 dark:bg-blue-900/30 rounded -mx-1 px-1 font-bold" : ""} ${i === 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-slate-300"}`}>
<div className="col-span-1 font-bold">{i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}`}</div>
  <div className="col-span-5 truncate flex items-center gap-0.5">
  <span className="truncate">{getDisplayName(m.member_name.replace(/ \(G\)$| \([^)]+\)$/, ''), names)}</span>
  {(m.guest_id || m.member_id < 0) && <span className="shrink-0 text-[7px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-0.5 rounded">G</span>}
  {isMe && <span className="text-blue-500 ml-0.5 text-[7px] shrink-0">YOU</span>}
  </div>
                      <div className="col-span-2 text-center">{m.fourball_number}</div>
                      <div className="col-span-2 text-center">{m.gross_score ?? "-"}</div>
                      <div className="col-span-2 text-center font-bold">{gameIsMedal ? (net ?? "-") : (m.points ?? "-")}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })()}

        {((liveScores.length > 0 && liveScoreGameInfo) || recentResults.length > 0 || (liveScoreGameInfo && allGamePairings.some(p => p.adhoc_game_id === liveScoreGameInfo.adhoc_game_id))) && (() => {
          // Only show leaderboard from 1 hour before tee time onwards.
          // For completed/past games (recentResults fallback) always show.
          if (liveScoreGameInfo) {
            const teeTimeStr = liveScoreGameInfo.tee_off_time;
            if (teeTimeStr && liveScoreGameInfo.game_date) {
              const sastNow = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }));
              // Parse tee time properly in local timezone
              const [hours, minutes] = teeTimeStr.split(":").map(Number);
              const [year, month, day] = liveScoreGameInfo.game_date.split('-').map(Number);
              const teeDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
              const oneHourBefore = new Date(teeDateTime.getTime() - 60 * 60 * 1000);

              if (sastNow < oneHourBefore) return null;
            }
          }
          return true;
        })() && (
          (() => {
            // Use live pairings if available, otherwise fall back to most recent game from recentResults
                    // Check if the game is actually still live (not completed)
                    const liveGameStatus = liveScoreGameInfo?.adhoc_game_id
                      ? adhocGames.find(g => g.adhoc_game_id === liveScoreGameInfo.adhoc_game_id)?.status
                      : null;
                    
                    // Check if game has pairings and if tee time has passed
                    const liveHasPairings = liveScoreGameInfo ? allGamePairings.some(p => p.adhoc_game_id === liveScoreGameInfo.adhoc_game_id) : false;
                    const liveHasAnyScores = liveScores.some(s => s.points !== null || s.gross_score !== null);
                    const liveTeeTimePassed = (() => {
                      if (!liveScoreGameInfo?.tee_off_time || !liveScoreGameInfo?.game_date) return false;
                      const now = new Date(new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }));
                      const [hours, minutes] = liveScoreGameInfo.tee_off_time.split(":").map(Number);
                      const [year, month, day] = liveScoreGameInfo.game_date.split('-').map(Number);
                      const gameDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
                      return now >= gameDateTime;
                    })();
                    
                    // useLive: show live leaderboard if we have pairings AND tee time has passed (even without scores yet)
                    const useLive = liveScoreGameInfo && liveGameStatus !== "completed" && 
                      (liveScores.length > 0 || (liveHasPairings && liveTeeTimePassed));
                    


            // Collect all same-day games sorted by tee_off_time
            const sameDayGameIds: number[] = useLive
              ? (liveScoreGameInfo!.all_same_day_game_ids || [liveScoreGameInfo!.adhoc_game_id])
              : [];
            const totalGamesToday = sameDayGameIds.length;

            // Filter recent results to only show OFFICIAL games when no live game
            // Match by date and course to find the corresponding adhoc_game
            const officialRecentResults = recentResults.filter(r => {
              const matchingGame = adhocGames.find(g => 
                g.game_date === r.game_date && 
                g.course_name === r.course_name
              );
              // If no matching adhoc_game found (old performance_record), show it; otherwise check is_official
              return !matchingGame || matchingGame.is_official !== false;
            });
            const latestGame = !useLive && officialRecentResults.length > 0 ? officialRecentResults[0] : null;
            const gameLabel = useLive ? liveScoreGameInfo!.course_name : latestGame?.course_name || "";
            const gameDate = useLive ? liveScoreGameInfo!.game_date : latestGame?.game_date || "";

  // Helper: build leaderboard for a given adhoc_game_id
  const buildLeaderboard = (gameId: number | null) => {
    const pairingsForGame = gameId ? allGamePairings.filter(p => p.adhoc_game_id === gameId).sort((a, b) => a.fourball_number - b.fourball_number) : [];
    const activePairingLb = pairingsForGame.find(p => !p.allResultsSubmitted) ?? pairingsForGame[0] ?? null;
    const allGameMembersLb = pairingsForGame.flatMap(p => p.members.map(m => ({ ...m, fourball_number: p.fourball_number })));
    // Check actual game_type from adhocGames, or fallback to club/pairing/liveScoreGameInfo format
    const gameInfo = gameId ? adhocGames.find(g => g.adhoc_game_id === gameId) : null;
    const lbGameFormat = MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0)
      ? "Medal"
      : (gameInfo?.game_type === "Medal" ? "Medal" : ((activePairingLb?.format) || liveScoreGameInfo?.format || "Stableford"));
    const lbIsMedal = lbGameFormat === "Medal";
    return { allGameMembersLb, activePairingLb, lbIsMedal, lbGameFormat };
  };

                  // For multi-round games, resolve the selected round's game ID from liveRoundTab
                  const liveGame = useLive && liveScoreGameInfo ? adhocGames.find(g => g.adhoc_game_id === liveScoreGameInfo.adhoc_game_id) : null;
                  const isMultiRoundLive = liveGame?.is_multi_round ?? false;
                  
                  let primaryGameId: number | null | undefined = useLive && liveScoreGameInfo ? liveScoreGameInfo.adhoc_game_id : null;
            if (isMultiRoundLive && liveRoundTab !== "summary" && liveGame) {
              // Find the game matching the selected round tab number
              const selectedRoundGame = adhocGames.find(g =>
                g.is_multi_round &&
                g.organizer_id === liveGame.organizer_id &&
                (g.club_id ?? 0) === (liveGame.club_id ?? 0) &&
                g.total_rounds === liveGame.total_rounds &&
                (g.round_number === liveRoundTab || (liveRoundTab === 1 && g.round_number == null))
              );
              primaryGameId = selectedRoundGame?.adhoc_game_id ?? liveScoreGameInfo?.adhoc_game_id;
            }
            // When summary tab is active, hide the regular leaderboard (summary tab renders its own)
            if (isMultiRoundLive && liveRoundTab === "summary") return null;

            const { allGameMembersLb, activePairingLb, lbIsMedal, lbGameFormat } = buildLeaderboard(primaryGameId ?? null);
            const activeGameIdLb = activePairingLb?.adhoc_game_id ?? null;


            // Resolve display label and date for the selected round
            const selectedRoundGame = isMultiRoundLive && liveRoundTab !== "summary"
              ? adhocGames.find(g => g.adhoc_game_id === primaryGameId)
              : null;
            const coursePar = courseHoles.reduce((s, h) => s + h.par, 0) || 72;
            const liveLeaderboard = allGameMembersLb.map(m => {
              // Calculate live scores from holeScoreData (same logic as scorecard)
              const scores = holeScoreData[m.pairing_id] || {};
              const hcp = m.playing_handicap ?? 0;
              let gross = 0;
              let totalPoints = 0;
              let birdies = 0;
              let eagles = 0;
              let holesPlayed = 0;
              
              for (const hole of courseHoles) {
                const rawStrokes = scores[hole.hole_number];
                if (rawStrokes == null) continue;
                holesPlayed++;
                
                // Use the helper for handicap strokes (same as scorecard)
                const hcpStrokes = calculateHcpStrokes(hcp, hole.stroke_index);
                
                // NET score after handicap
                let netScore = rawStrokes - hcpStrokes;
                
                if (!lbIsMedal) {
                  // ESC: Max net score is double bogey
                  netScore = Math.min(netScore, hole.par + 2);
                }
                
                gross += rawStrokes;
                
                // Points from NET score (Stableford formula)
                const pts = lbIsMedal ? 0 : Math.max(0, 2 + hole.par - netScore);
                totalPoints += pts;
                
                if (rawStrokes === hole.par - 1) birdies++;
                if (rawStrokes <= hole.par - 2) eagles++;
              }
              
              // If no hole scores yet, fall back to DB values
              const finalGross = holesPlayed > 0 ? gross : (m.gross_score ?? 0);
              const finalPoints = holesPlayed > 0 ? totalPoints : (m.points ?? 0);
              
              const parForPlayed = courseHoles.filter(h => scores[h.hole_number] != null).reduce((s, h) => s + h.par, 0);
              const proportionalHcp = holesPlayed > 0 ? Math.round(hcp * holesPlayed / 18) : 0;
              const netToPar = holesPlayed > 0 ? finalGross - parForPlayed - proportionalHcp : null;
              const net = holesPlayed > 0 ? finalGross - proportionalHcp : null;
  return {
  member_name: m.member_name,
  member_id: m.member_id,
  pairing_id: m.pairing_id,
  fourball_number: m.fourball_number,
  gross: finalGross,
  points: finalPoints,
  thru: holesPlayed,
  netToPar,
  net,
  playing_handicap: m.playing_handicap,
  eagles: holesPlayed > 0 ? eagles : (m.eagles_count ?? 0),
  birdies: holesPlayed > 0 ? birdies : (m.birdies_count ?? 0),
  ladies: m.ladies_count ?? 0,
  };
            }).sort((a, b) => {
              // Players with no holes played go to the bottom
              if (a.thru === 0 && b.thru === 0) return 0;
              if (a.thru === 0) return 1;
              if (b.thru === 0) return -1;
              if (lbIsMedal) {
                // Medal: least net wins; if tied, least gross wins
                const aN = a.net ?? 999, bN = b.net ?? 999;
                if (aN !== bN) return aN - bN;
                return a.gross - b.gross;
              }
              // IPS/Stableford: most points wins; if tied, least gross wins
              if (b.points !== a.points) return b.points - a.points;
              return a.gross - b.gross;
            });
                    const isLive = useLive && liveGameStatus !== "completed" && liveScores.some(s => !s.result_submitted);
            
            return (
              <>
              <Card className="border shadow-sm" style={{background: "linear-gradient(135deg, #f0f7f2 0%, #eaf4ec 100%)", borderColor: "#b8d4bf"}}>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-semibold font-sans flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    {isLive
                      ? isMultiRoundLive
                        ? `Round ${liveRoundTab} Leaderboard`
                        : totalGamesToday > 1
                          ? `Game 1 - ${gameLabel} Leaderboard`
                : "Live Leaderboard"
                : `Recent ${myClub?.club_name ? myClub.club_name.replace(" Golf Club", "") : "Club"} Game Results`}
                {isLive && primaryGameId === liveScoreGameInfo?.adhoc_game_id && (
                <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                )}
                {isUpdating && (
                <span className="text-[9px] text-green-500 animate-pulse ml-2">Updating...</span>
                )}
                  </CardTitle>
                  <CardDescription className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                    {isMultiRoundLive && selectedRoundGame
                      ? <>{myClub?.club_name ? `${myClub.club_name.replace(" Golf Club", "")} @ ` : ""}{selectedRoundGame.course_name}</>
                      : totalGamesToday > 1
                        ? <span className="text-[10px] text-indigo-500 font-normal">{totalGamesToday} games today</span>
                        : <>{myClub?.club_name ? `${myClub.club_name.replace(" Golf Club", "")} @ ` : ""}{gameLabel}</>
                    }
                    <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                      {(isMultiRoundLive && selectedRoundGame?.game_date ? selectedRoundGame.game_date : gameDate)
                        ? new Date(isMultiRoundLive && selectedRoundGame?.game_date ? selectedRoundGame.game_date : gameDate).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })
                        : ""}
                    </span>
                  </CardDescription>
  {/* Winners strip - always visible while game is in progress or complete */}
  {liveLeaderboard.length > 0 && (() => {
  // Check actual game_type from adhocGames for proper Medal detection
  const podiumGameInfo = liveScoreGameInfo?.adhoc_game_id ? adhocGames.find(g => g.adhoc_game_id === liveScoreGameInfo.adhoc_game_id) : null;
  const gameFormat = MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0) 
    ? "Medal" 
    : (podiumGameInfo?.game_type === "Medal" ? "Medal" : (liveScoreGameInfo?.format || "Stableford"));
  const isStableford = gameFormat !== "Medal";

                    // Calculate per-player front9 and back9 points/net from holeScoreData
                    const playerNine = liveLeaderboard.map(p => {
                      const scores = holeScoreData[p.pairing_id] || {};
                      const hcp = p.playing_handicap ?? 0;
                      let front9Pts = 0, back9Pts = 0;
                      let front9Net = 0, back9Net = 0;
                      let front9Holes = 0, back9Holes = 0;

                      courseHoles.forEach(hole => {
                        const rawStrokes = scores[hole.hole_number];
                        if (rawStrokes == null) return;
                        const holePar = hole.par;
                        const strokeIndex = hole.stroke_index || hole.hole_number;
                        let hcpStrokes = strokeIndex <= hcp ? 1 : 0;
                        if (hcp > 18) hcpStrokes += strokeIndex <= (hcp - 18) ? 1 : 0;
                        // Apply ESC cap for Stableford (no cap for Medal)
                        const strokes = isStableford ? Math.min(rawStrokes, holePar + 2 + hcpStrokes) : rawStrokes;
                        const netStrokes = strokes - hcpStrokes;
                        const diff = holePar - netStrokes;
                        const stablefordPts = isStableford ? Math.max(0, diff + 2) : 0;
                        if (hole.hole_number <= 9) {
                          front9Pts += stablefordPts;
                          front9Net += netStrokes;
                          front9Holes++;
                        } else {
                          back9Pts += stablefordPts;
                          back9Net += netStrokes;
                          back9Holes++;
                        }
                      });

                      return { ...p, front9Pts, back9Pts, front9Net, back9Net, front9Holes, back9Holes };
                    });

                    // Only include players who have played at least 1 hole in that nine
                    const front9Active = playerNine.filter(p => p.front9Holes > 0);
                    const back9Active = playerNine.filter(p => p.back9Holes > 0);
                    const overallActive = playerNine.filter(p => p.thru > 0);

                    const front9Leader = front9Active.length > 0
                      ? isStableford
                        ? front9Active.reduce((a, b) => b.front9Pts > a.front9Pts ? b : a)
                        : front9Active.reduce((a, b) => b.front9Net < a.front9Net ? b : a)
                      : null;

                    const back9Leader = back9Active.length > 0
                      ? isStableford
                        ? back9Active.reduce((a, b) => b.back9Pts > a.back9Pts ? b : a)
                        : back9Active.reduce((a, b) => b.back9Net < a.back9Net ? b : a)
                      : null;

                    const overallLeader = overallActive.length > 0
                      ? isStableford
                        ? overallActive.reduce((a, b) => b.points > a.points ? b : a)
                        : overallActive.reduce((a, b) => (b.net ?? 999) < (a.net ?? 999) ? b : a)
                      : null;

                    // Eagles list (shown above birdies)
                    const eagleList = overallActive
                      .filter(p => p.eagles > 0)
                      .sort((a, b) => b.eagles - a.eagles)
                      .map(p => `${getDisplayName(p.member_name, liveLeaderboard.map(lb => lb.member_name))}(${p.eagles})`);
                    
                    // Birdies list
                    const birdieList = overallActive
                      .filter(p => p.birdies > 0)
                      .sort((a, b) => b.birdies - a.birdies)
                      .map(p => `${getDisplayName(p.member_name, liveLeaderboard.map(lb => lb.member_name))}(${p.birdies})`);

                    const isMedal = gameFormat === "Medal";

                    // ── Position 1, 2, 3 calculation (sorted by overall score) ──
                    const sortedOverall = [...overallActive].sort((a, b) =>
                      isStableford ? b.points - a.points : (a.net ?? 999) - (b.net ?? 999)
                    );
                    const p1 = sortedOverall[0] ?? null;
                    const p2 = sortedOverall[1] ?? null;
                    const p3 = sortedOverall[2] ?? null;

                    // ── WSOE (Club 13) Prize Pool Calculation ──
                    // R100 participation fee per player
  // <=30 players: 60-40 split (P1, P2)
  // >30 players: 50-30-20 split (P1, P2, P3)
  // Apply R2000 cap for WSOE school competition
  const isWsoe = myClub?.club_id === CLUB13_ID;
  const MAX_WSOE_PAYOUT = 2000;
  const playerCount = liveLeaderboard.length;
  const wsoeFeePerPlayer = 100;
  const wsoeTotalPool = playerCount * wsoeFeePerPlayer;
  const wsoeIs3Way = playerCount > 30;
  let wsoeP1Prize = wsoeIs3Way ? Math.round(wsoeTotalPool * 0.5) : Math.round(wsoeTotalPool * 0.6);
  let wsoeP2Prize = wsoeIs3Way ? Math.round(wsoeTotalPool * 0.3) : Math.round(wsoeTotalPool * 0.4);
  let wsoeP3Prize = wsoeIs3Way ? wsoeTotalPool - wsoeP1Prize - wsoeP2Prize : 0;
  // Apply R2000 cap
  if (isWsoe) {
    wsoeP1Prize = Math.min(wsoeP1Prize, MAX_WSOE_PAYOUT);
    wsoeP2Prize = Math.min(wsoeP2Prize, MAX_WSOE_PAYOUT);
    wsoeP3Prize = Math.min(wsoeP3Prize, MAX_WSOE_PAYOUT);
  }

                    const WinnerChip = ({ label, name, score }: { label: string; name: string | null; score: number | null }) => (
                      <div className="flex flex-col items-center justify-center py-1.5 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-indigo-100 dark:border-indigo-800 min-w-0 overflow-hidden">
                        <span className="text-[7px] font-bold uppercase tracking-wide text-indigo-500 dark:text-indigo-400 leading-tight text-center block w-full truncate">{label}</span>
                        <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 block w-full text-center truncate mt-0.5 leading-tight">
                          {name ? getDisplayName(name, liveLeaderboard.map(lp => lp.member_name)) : <span className="text-slate-400 font-normal">--</span>}
                        </span>
                        {name && score !== null && (
                          <span className="text-[8px] font-bold block w-full text-center truncate leading-tight text-indigo-600 dark:text-indigo-400">
                            {isMedal ? `${score}net` : `${score}pts`}
                          </span>
                        )}
                      </div>
                    );

                    // Position chip with prize money
                    const PositionChip = ({ pos, player, prize }: { pos: number; player: typeof p1; prize: number }) => {
                      const colors = pos === 1
                        ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700"
                        : pos === 2
                        ? "bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
  const textColor = pos === 1 ? "text-yellow-700 dark:text-yellow-400" : pos === 2 ? "text-slate-600 dark:text-slate-300" : "text-amber-700 dark:text-amber-400";
  const scoreVal = player ? (isMedal ? Math.round(player.net ?? 0) : player.points) : null;
  return (
                        <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${colors}`}>
                          <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-sm ${pos === 1 ? "bg-yellow-400 text-yellow-900" : pos === 2 ? "bg-slate-400 text-white" : "bg-amber-400 text-amber-900"}`}>
                            {pos}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[11px] font-bold break-words leading-tight ${player ? "text-slate-800 dark:text-slate-100" : "text-slate-400 italic"}`}>
                              {player?.member_name ?? "TBD"}
                            </div>
                            {player && scoreVal !== null && (
                              <div className={`text-[9px] font-semibold ${textColor}`}>
                                {isMedal ? `${scoreVal} net` : `${scoreVal} pts`}
                              </div>
                            )}
                          </div>
                          {isWsoe && prize > 0 && (
                            <div className="shrink-0 text-right">
                              <div className="text-[8px] text-slate-400 uppercase font-medium">Prize</div>
                              <div className={`text-[11px] font-black ${textColor}`}>R{prize}</div>
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div className="w-full mt-1 space-y-1.5 pb-1">
                        {/* Position 1, 2, 3 */}
                        <div className="space-y-1">
                          <PositionChip pos={1} player={p1} prize={wsoeP1Prize} />
                          <PositionChip pos={2} player={p2} prize={wsoeP2Prize} />
                          {(wsoeIs3Way || p3) && <PositionChip pos={3} player={p3} prize={wsoeP3Prize} />}
                        </div>

                        {/* WSOE Prize Pool Summary */}
                        {isWsoe && playerCount > 0 && (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
                            <div className="text-[9px] text-emerald-700 dark:text-emerald-400">
                              <span className="font-bold">{playerCount} players</span> × R{wsoeFeePerPlayer} = <span className="font-black">R{wsoeTotalPool}</span> pool
                            </div>
                            <div className="text-[8px] text-emerald-600 dark:text-emerald-500 font-medium">
                              {wsoeIs3Way ? "50-30-20 split" : "60-40 split"}
                            </div>
                          </div>
                        )}

                        {/* 1st 9, 2nd 9, Overall chips — shown in WWB tab only */}
  {/* Achievements Section - Eagles first, then Birdies */}
  {(eagleList.length > 0 || birdieList.length > 0) && (
  <div className="w-full rounded-lg bg-white/70 dark:bg-slate-800/70 border border-green-100 dark:border-green-900 px-2 py-1.5 space-y-1">
    {/* Eagles line - shown above birdies */}
    {eagleList.length > 0 && (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">Eagles:</span>
        <span className="text-[9px] font-semibold text-slate-700 dark:text-slate-200 break-words">
          {eagleList.join(", ")}
        </span>
      </div>
    )}
    {/* Birdies line */}
    {birdieList.length > 0 && (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[9px] font-bold text-green-600 dark:text-green-400">Birdies:</span>
        <span className="text-[9px] font-semibold text-slate-700 dark:text-slate-200 break-words">
          {birdieList.join(", ")}
        </span>
      </div>
    )}
  </div>
  )}
                      </div>
                    );
                  })()}
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {useLive && liveLeaderboard.length > 0 ? (
                    <>
                      {(() => {
                        const activePlayers = liveLeaderboard.filter(p => p.thru > 0).length;
                        const totalPlayers = liveLeaderboard.length;
                        const waitingPlayers = totalPlayers - activePlayers;
                        
                        if (activePlayers === 0) {
                          // No one has started playing yet - show "Waiting for scores"
                          return (
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mb-2">
                              {totalPlayers} players paired | Waiting for first scores...
                            </div>
                          );
                        }
                        
                        return (
                          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mb-2">
                            {activePlayers} of {totalPlayers} players active{waitingPlayers > 0 && ` (${waitingPlayers} waiting)`} | Par {coursePar}
                          </div>
                        );
                      })()}
                      {/* Top 10 / All toggle buttons */}
                      {liveLeaderboard.length > 10 && (
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setShowLiveTopOnly(true)}
                              className={`px-2 py-0.5 text-[8px] font-semibold rounded ${
                                showLiveTopOnly 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                              }`}
                            >
                              Top 10
                            </button>
                            <button
                              onClick={() => setShowLiveTopOnly(false)}
                              className={`px-2 py-0.5 text-[8px] font-semibold rounded ${
                                !showLiveTopOnly 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                              }`}
                            >
                              All {liveLeaderboard.length}
                            </button>
                          </div>
                          {showLiveTopOnly && (
                            <button
                              onClick={() => setLiveFullView(!liveFullView)}
                              className="text-[8px] text-indigo-500 underline"
                            >
                              {liveFullView ? 'Show Less' : `View All ${liveLeaderboard.length}`}
                            </button>
                          )}
                        </div>
                      )}
  <div className="grid gap-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide pb-1.5 border-b border-indigo-100 dark:border-indigo-800 mb-1.5" style={{ gridTemplateColumns: "1.5fr 4fr 2fr 1.5fr 2fr 1.5fr 1.2fr 1.2fr 1.5fr 1.5fr" }}>
  <div className="text-center">Pos</div>
  <div>Player</div>
  <div className="text-center">Net</div>
  <div className="text-center">Thru</div>
  <div className="text-center">{lbIsMedal ? "Tot" : "Pts"}</div>
  <div className="text-center">Grs</div>
  <div className="text-center text-blue-500">Egl</div>
  <div className="text-center text-green-500">Brd</div>
  <div className="text-center">Ldy</div>
  <div className="text-center">Hcp</div>
  </div>
                      {(showLiveTopOnly ? (liveFullView ? liveLeaderboard : liveLeaderboard.slice(0, 10)) : liveLeaderboard).map((p, idx) => {
                        const isMe = p.member_id === memberData?.member_id;
                        // Compute position with ties (format-aware)
                        let pos = idx + 1;
                        if (idx > 0 && p.thru > 0) {
                          const isTied = lbIsMedal
                            ? liveLeaderboard[idx - 1].net === p.net && liveLeaderboard[idx - 1].gross === p.gross
                            : liveLeaderboard[idx - 1].points === p.points && liveLeaderboard[idx - 1].gross === p.gross;
                          if (isTied) {
                            let tieIdx = idx - 1;
                            while (tieIdx > 0) {
                              const prev = liveLeaderboard[tieIdx - 1];
                              const stillTied = lbIsMedal ? prev.net === p.net && prev.gross === p.gross : prev.points === p.points && prev.gross === p.gross;
                              if (!stillTied) break;
                              tieIdx--;
                            }
                            pos = tieIdx + 1;
                          }
                        }
                        const netToParStr = p.netToPar === null ? "-" : p.netToPar === 0 ? "E" : p.netToPar > 0 ? `+${p.netToPar}` : `${p.netToPar}`;
                        const scoreColor = p.netToPar === null ? "text-slate-400" : p.netToPar < 0 ? "text-red-600 dark:text-red-400" : p.netToPar === 0 ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-300";
                        
                        return (
                          <div key={p.pairing_id} className={`grid gap-0.5 items-center py-1.5 text-[11px] ${isMe ? "bg-blue-50 dark:bg-blue-900/30 rounded -mx-1 px-1 font-bold" : ""} ${p.thru === 0 ? "opacity-40" : ""} ${idx === 0 && p.thru > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : idx === 1 && p.thru > 0 ? "text-slate-600 dark:text-slate-300 font-semibold" : idx === 2 && p.thru > 0 ? "text-amber-700 dark:text-amber-600 font-semibold" : "text-slate-600 dark:text-slate-300"}`} style={{ gridTemplateColumns: "1.5fr 4fr 2fr 1.5fr 2fr 1.5fr 1.2fr 1.2fr 1.5fr 1.5fr" }}>
                            <div className="text-center font-bold">{p.thru > 0 ? pos : "-"}</div>
                            <button
                              className="truncate text-left underline decoration-dotted underline-offset-2 hover:opacity-70 active:opacity-50 transition-opacity"
                              onClick={() => openScoreViewer(p.pairing_id, p.member_name, p.playing_handicap, true)}
                            >
                              {getDisplayName(p.member_name, liveLeaderboard.map(lb => lb.member_name))}
                              <span className="text-[7px] text-slate-400 ml-0.5">({p.playing_handicap})</span>
                              {isMe && <span className="text-blue-500 ml-0.5 text-[7px]">YOU</span>}
                              {p.thru === 0 && <span className="text-[7px] text-amber-500 ml-1 font-normal">waiting</span>}
                            </button>
  <div className={`text-center font-bold ${scoreColor}`}>{netToParStr}</div>
  <div className="text-center text-[11px]">{p.thru > 0 ? p.thru : "-"}</div>
  <div className="text-center font-bold">{p.thru > 0 ? (lbIsMedal ? p.net ?? "-" : p.points) : "-"}</div>
  <div className="text-center text-[11px]">{p.thru > 0 ? p.gross : "-"}</div>
  <div className="text-center text-[11px] text-blue-600 dark:text-blue-400">{p.thru > 0 && p.eagles > 0 ? p.eagles : "-"}</div>
  <div className="text-center text-[11px] text-green-600 dark:text-green-400">{p.thru > 0 && p.birdies > 0 ? p.birdies : "-"}</div>
  <div className="text-center text-[11px] text-pink-500">{p.ladies > 0 ? p.ladies : "-"}</div>
  <div className="text-center text-[11px] text-slate-400">{p.playing_handicap}</div>
  </div>
                        );
                      })}
                    </>
                  ) : useLive ? (
                    <>
                      <div className="text-[9px] text-slate-500 font-medium mb-2">
                        {liveScores.filter(s => s.result_submitted).length} of {liveScores.length} results submitted
                      </div>
  <div className="grid grid-cols-12 gap-0.5 text-[7px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide pb-1 border-b border-indigo-100 dark:border-indigo-800 mb-1">
  <div className="col-span-1 text-center">Pos</div>
  <div className="col-span-5">Player</div>
  <div className="col-span-2 text-center">4B</div>
  <div className="col-span-2 text-center">Gross</div>
  <div className="col-span-2 text-center">{lbIsMedal ? "Net" : "Pts"}</div>
  </div>
  {liveScores.filter(s => s.result_submitted).sort((a, b) => {
  // Check if this is a Medal game (lowest net wins)
  const gameInfo = liveScoreGameInfo?.adhoc_game_id ? adhocGames.find(g => g.adhoc_game_id === liveScoreGameInfo.adhoc_game_id) : null;
  const isMedalGame = MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0) || gameInfo?.game_type === "Medal" || liveScoreGameInfo?.format === "Medal";
                        if (isMedalGame) {
                          // Medal: lowest net wins
                          const aNet = (a.gross_score ?? 0) - (liveLeaderboard.find(l => l.member_id === a.member_id)?.playing_handicap ?? 0);
                          const bNet = (b.gross_score ?? 0) - (liveLeaderboard.find(l => l.member_id === b.member_id)?.playing_handicap ?? 0);
                          return aNet - bNet;
                        }
                        // IPS: highest points wins
                        return (b.points || 0) - (a.points || 0);
                      }).map((s, idx) => {
                        const isMe = s.member_name === memberData?.member_name;
                        const liveScoreNames = liveScores.map(ls => ls.member_name);
                        return (
  <div key={s.member_id} className={`grid grid-cols-12 gap-0.5 items-center py-1 text-[9px] ${isMe ? "bg-blue-50 dark:bg-blue-900/30 rounded -mx-1 px-1 font-bold" : ""} ${idx === 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-slate-300"}`}>
  <div className="col-span-1 text-center font-bold">{idx + 1}</div>
  <div className="col-span-5 truncate flex items-center gap-0.5">
  <span className="truncate">{getDisplayName(s.member_name.replace(/ \(G\)$| \([^)]+\)$/, ''), liveScoreNames)}</span>
  {(s.member_id < 0) && <span className="shrink-0 text-[7px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-0.5 rounded">G</span>}
  {isMe && <span className="text-blue-500 ml-0.5 text-[7px] shrink-0">YOU</span>}
  </div>
  <div className="col-span-2 text-center">{s.fourball_number}</div>
  <div className="col-span-2 text-center">{s.gross_score ?? "-"}</div>
  <div className="col-span-2 text-center font-bold">{lbIsMedal ? ((s.gross_score ?? 0) - (liveLeaderboard.find(l => l.member_id === s.member_id)?.playing_handicap ?? 0)) : (s.points ?? "-")}</div>
  </div>
  );
  })}
  </>
  ) : latestGame ? (
                    <>
                      {(() => {
                        const leaderboardKey = `${latestGame.game_date}_${latestGame.course_name}`;
                        const totalPlayers = latestGame.leaderboard.length;
                        const showToggle = totalPlayers > 20;
                        const isFullView = expandedFullLeaderboards.has(leaderboardKey);
                        const playersToShow = showToggle && !isFullView 
                          ? latestGame.leaderboard.slice(0, 10) 
                          : latestGame.leaderboard;
                        
                        return (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-medium">
                                {showToggle && !isFullView ? `Top 10 of ${totalPlayers}` : `${totalPlayers} players`}
                              </div>
                              {showToggle && (
                                <button
                                  onClick={() => {
                                    setExpandedFullLeaderboards(prev => {
                                      const next = new Set(prev);
                                      if (next.has(leaderboardKey)) {
                                        next.delete(leaderboardKey);
                                      } else {
                                        next.add(leaderboardKey);
                                      }
                                      return next;
                                    });
                                  }}
                                  className="text-[8px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline underline-offset-2"
                                >
                                  {isFullView ? "Show Top 10" : "View All"}
                                </button>
                              )}
  </div>
  <div className="grid grid-cols-12 gap-1 text-[8px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide pb-1 border-b border-indigo-100 dark:border-indigo-800 mb-1">
  <div className="col-span-1">#</div>
  <div className="col-span-5">Player</div>
  <div className="col-span-2 text-center">HCP</div>
  <div className="col-span-2 text-center">Gross</div>
  <div className="col-span-2 text-center">{latestGame.is_medal ? "Net" : "Pts"}</div>
  </div>
  {playersToShow.map((p, idx) => {
  const isMe = p.member_name === memberData?.member_name;
  const leaderboardNames = latestGame.leaderboard.map(lb => lb.member_name);
  const playerPairingId = myClub?.club_id === CLUB13_ID
  ? allGamePairings.flatMap(pb => pb.members).find(m => m.member_name === p.member_name)?.pairing_id
  : undefined;
  const isWwb = playerPairingId !== undefined && wwbOptIns[playerPairingId]?.ww;
  const isBirdie = playerPairingId !== undefined && wwbOptIns[playerPairingId]?.birdie;
  const netScore = latestGame.is_medal ? (p.gross_score ?? 0) - (p.playing_handicap ?? 0) : null;
  return (
  <div key={idx} className={`grid grid-cols-12 gap-1 items-center py-1 text-[9px] ${isMe ? "bg-blue-50 dark:bg-blue-900/30 rounded -mx-1 px-1 font-bold" : ""} ${idx === 0 ? "text-amber-600 dark:text-amber-400 font-bold" : idx === 1 ? "text-slate-500 dark:text-slate-400 font-semibold" : idx === 2 ? "text-amber-700 dark:text-amber-600 font-semibold" : "text-slate-600 dark:text-slate-300"}`}>
  <div className="col-span-1 font-bold">{idx === 0 ? "1st" : idx === 1 ? "2nd" : idx === 2 ? "3rd" : `${idx + 1}`}</div>
  <button
  className="col-span-5 flex items-center gap-0.5 truncate text-left underline decoration-dotted underline-offset-2 hover:opacity-70 active:opacity-50 transition-opacity"
  onClick={() => openScoreViewer(p.pairing_id, p.member_name, p.playing_handicap || 0, false)}
  >
  <span className="truncate">{getDisplayName(p.member_name, leaderboardNames)}{isMe && <span className="text-blue-500 ml-0.5 text-[7px]">YOU</span>}</span>
  {isWwb && <span className="shrink-0 text-[6px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-400 px-0.5 rounded leading-tight no-underline">WW</span>}
  {isBirdie && <span className="shrink-0 text-[6px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900 dark:text-amber-400 px-0.5 rounded leading-tight no-underline">B</span>}
  </button>
  <div className="col-span-2 text-center">{p.playing_handicap || "-"}</div>
  <div className="col-span-2 text-center">{p.gross_score ?? "-"}</div>
  <div className="col-span-2 text-center font-bold">{latestGame.is_medal ? netScore : (p.points ?? "-")}</div>
  </div>
                              );
                            })}
                            {showToggle && (
                              <button
                                onClick={() => {
                                  setExpandedFullLeaderboards(prev => {
                                    const next = new Set(prev);
                                    if (next.has(leaderboardKey)) {
                                      next.delete(leaderboardKey);
                                    } else {
                                      next.add(leaderboardKey);
                                    }
                                    return next;
                                  });
                                }}
                                className="w-full mt-2 py-1.5 text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                              >
                                {isFullView ? "Show Top 10" : `View All ${totalPlayers} Players`}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : null}

                  {/* Revenue Generated */}
                  {!isLive && latestGame && latestGame.revenue > 0 && (
                    <div className="mt-3 pt-2 border-t border-indigo-200 dark:border-indigo-700 flex items-center justify-between">
                      <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Revenue Generated</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">R{latestGame.revenue.toLocaleString()}</span>
                    </div>
                  )}

                  {/* Hole-by-Hole Scorecard Section */}
                  {(() => {
                    // Find the game's adhoc_game_id and course_id from myPairings or allGamePairings
                    const activePairing = myPairings.find(p => !p.allResultsSubmitted);
                    // activeGameId MUST match the game that openScorecard opened, which is
                    // driven by liveScoreGameInfo (the currently-selected round). In multi-round
                    // games activePairing may point at a DIFFERENT round than the one on screen,
                    // which would break `scorecardGameId === activeGameId` and hide the scorecard.
                    // So prioritise the displayed live game, then fall back to the active pairing.
                    const activeGameId = useLive
                      ? (liveScoreGameInfo?.adhoc_game_id ?? activePairing?.adhoc_game_id ?? null)
                      : null;
                    // The scorecard's data (courseHoles, holeScoreData) is loaded by openScorecard,
                    // which reliably sets scorecardGameId. activeGameId can be null (e.g. useLive is
                    // false, or the member has no active pairing), which previously broke the
                    // `scorecardGameId === activeGameId` render gate even though the scorecard WAS
                    // loaded. effectiveGameId falls back to scorecardGameId so rendering and all
                    // downstream derivations key off the game that was actually opened.
                    // When a scorecard has actually been loaded (openScorecard sets
                    // scorecardGameId + courseHoles + showScorecard), that loaded game is the
                    // single source of truth — everything must key off scorecardGameId so the
                    // render gate and the loaded data always agree.
                    const scorecardLoaded = showScorecard && scorecardGameId != null;
                    const effectiveGameId = scorecardLoaded ? scorecardGameId : (activeGameId ?? scorecardGameId);

                    // activeGame is normally looked up from the adhocGames state array, but
                    // openScorecard loads the scorecard directly from the DB and may open a
                    // game that isn't present in adhocGames (member not in a pairing, game
                    // filtered out, etc.). Resolve a course_id from any available source and
                    // synthesize the game object so the render gate below passes.
                    const activeGameFromList = effectiveGameId ? adhocGames.find(g => g.adhoc_game_id === effectiveGameId) : null;
                    const resolvedCourseId =
                      activeGameFromList?.course_id ??
                      (liveScoreGameInfo?.adhoc_game_id === effectiveGameId ? liveScoreGameInfo?.course_id : undefined) ??
                      (courseHoles[0] as { course_id?: number } | undefined)?.course_id ??
                      null;
                    const activeGame = activeGameFromList ?? (
                      effectiveGameId && resolvedCourseId != null
                        ? {
                            adhoc_game_id: effectiveGameId,
                            course_id: resolvedCourseId,
                            course_name: liveScoreGameInfo?.course_name,
                            format: liveScoreGameInfo?.format ?? "Stableford",
                            game_type: liveScoreGameInfo?.format ?? "Stableford",
                          } as typeof activeGameFromList
                        : null
                    );

                    // Once a game is marked completed, scorecard + score entry are locked.
                    const gameIsCompleted = adhocGames.find(g => g.adhoc_game_id === effectiveGameId)?.status === "completed";
                    const myFourball = effectiveGameId ? allGamePairings.filter(p => p.adhoc_game_id === effectiveGameId && p.members.some(m => m.member_id === memberData?.member_id)) : [];
                    const fourballMembers = myFourball.length > 0 ? myFourball[0].members : [];
                    const isCaptain = myFourball.length > 0 && myFourball[0].isCaptain;
                    
                    // All players in active game (across all fourballs) for leaderboard
                    const allGameFourballs = effectiveGameId ? allGamePairings.filter(p => p.adhoc_game_id === effectiveGameId) : [];
                    const allGameMembers = allGameFourballs.flatMap(p => p.members.map(m => ({ ...m, fourball_number: p.fourball_number })));
                    
                    // Compute live leaderboard from holeScoreData
                    const coursePar = courseHoles.reduce((s, h) => s + h.par, 0) || 72;
                    const innerGameFormat = activeGame?.format || "Stableford";
                    const innerIsMedal = innerGameFormat === "Medal";
                    const liveLeaderboard = allGameMembers.map(m => {
                      // Calculate holes played from hole score data
                      const scores = holeScoreData[m.pairing_id] || {};
                      const holesPlayed = Object.keys(scores).filter(h => scores[Number(h)] !== null).length;
                      const points = m.points ?? 0;
                      const gross = m.gross_score ?? 0;
                      
                      const parForPlayed = courseHoles.filter(h => {
                        const sc = holeScoreData[m.pairing_id] || {};
                        return sc[h.hole_number] != null;
                      }).reduce((s, h) => s + h.par, 0);
                      const hcp = m.playing_handicap ?? 0;
                      const proportionalHcp = holesPlayed > 0 ? Math.round(hcp * holesPlayed / 18) : 0;
                      const netToPar = holesPlayed > 0 ? gross - parForPlayed - proportionalHcp : null;
                      const net = holesPlayed > 0 ? gross - proportionalHcp : null;
                      return {
                        member_name: m.member_name,
                        member_id: m.member_id,
                        pairing_id: m.pairing_id,
                        fourball_number: m.fourball_number,
                        gross,
  points,
  thru: holesPlayed,
  netToPar,
  net,
  playing_handicap: m.playing_handicap,
  eagles: m.eagles_count ?? 0,
  birdies: m.birdies_count ?? 0,
  ladies: m.ladies_count ?? 0,
  };
  }).sort((a, b) => {
  if (a.thru === 0 && b.thru === 0) return 0;
  if (a.thru === 0) return 1;
                      if (b.thru === 0) return -1;
                      if (innerIsMedal) {
                        const aN = a.net ?? 999, bN = b.net ?? 999;
                        if (aN !== bN) return aN - bN;
                        return a.gross - b.gross;
                      }
                      if (b.points !== a.points) return b.points - a.points;
                      return a.gross - b.gross;
                    });
                    
                    // Non-playing members: show the full live leaderboard so they can watch
                    if (!effectiveGameId || !activeGame) {
                      if (!useLive) return null;
                      // Find any live game to watch from allGamePairings
                      const watchGameId = liveScoreGameInfo?.adhoc_game_id ?? null;
                      const watchGame = watchGameId ? adhocGames.find(g => g.adhoc_game_id === watchGameId) : null;
                      if (!watchGameId || !watchGame) return null;
                      const watchFourballs = allGamePairings.filter(p => p.adhoc_game_id === watchGameId);
                      const watchMembers = watchFourballs.flatMap(p => p.members.map(m => ({ ...m, fourball_number: p.fourball_number })));
                      const watchIsMedal = watchGame.game_type === "Medal" || MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0);
  const watchLeaderboard = watchMembers.map(m => {
    // Calculate holes played from hole score data
    const scores = holeScoreData[m.pairing_id] || {};
    const holesPlayed = Object.keys(scores).filter(h => scores[Number(h)] !== null).length;
    const points = m.points ?? 0;
    const gross = m.gross_score ?? 0;
    return { ...m, thru: holesPlayed, points, gross, net: gross - (m.playing_handicap ?? 0) };
  }).sort((a, b) => {
                        if (a.thru === 0 && b.thru === 0) return 0;
                        if (a.thru === 0) return 1;
                        if (b.thru === 0) return -1;
                        return watchIsMedal ? a.net - b.net : b.points - a.points;
                      });
                      const watchNames = watchLeaderboard.map(m => m.member_name);
                      return (
                        <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-800 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"/></span>
                            <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Live Leaderboard</span>
                            <span className="text-[8px] text-slate-400 ml-1">{watchGame.course_name}</span>
                          </div>
                          {/* Column header */}
                          <div className="grid grid-cols-12 gap-1 px-1 text-[8px] font-semibold text-slate-400 uppercase tracking-wide">
                            <div className="col-span-1">#</div>
                            <div className="col-span-5">Player</div>
                            <div className="col-span-2 text-center">Thru</div>
                            <div className="col-span-2 text-center">Gross</div>
                            <div className="col-span-2 text-center font-bold">{watchIsMedal ? "Net" : "Pts"}</div>
                          </div>
                          {watchLeaderboard.length === 0 ? (
                            <div className="text-[9px] text-slate-400 text-center py-3">Waiting for scores...</div>
                          ) : watchLeaderboard.map((p, i) => (
                            <div key={p.member_id} className={`grid grid-cols-12 gap-1 items-center px-1 py-1 text-[10px] rounded
                              ${i === 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-slate-300"}
                            `}>
                              <div className="col-span-1 font-bold text-[9px]">{i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}`}</div>
                              <div className="col-span-5 truncate">{getDisplayName(p.member_name, watchNames)}</div>
                              <div className="col-span-2 text-center text-slate-400">{p.thru > 0 ? p.thru : "—"}</div>
                              <div className="col-span-2 text-center">{p.gross > 0 ? p.gross : "—"}</div>
                              <div className="col-span-2 text-center font-bold">{watchIsMedal ? (p.net !== 0 ? p.net : "—") : (p.points > 0 ? p.points : "—")}</div>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    return (
                      <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-800">
                        {gameIsCompleted ? (
                          <div className="w-full flex items-center justify-center gap-1.5 h-7 text-[9px] rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-semibold mb-2">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Game completed — scoring locked
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-[9px] border-indigo-300 text-indigo-600 hover:bg-indigo-50 bg-transparent font-semibold mb-2"
                            onClick={() => {
                              if (showScorecard && scorecardGameId === effectiveGameId) {
                                setShowScorecard(false);
                              } else {
                                openScorecard(effectiveGameId, activeGame.course_id);
                              }
                            }}
                          >
                            {showScorecard && scorecardGameId === effectiveGameId ? "Hide Score Card" : "Score Card"}
                          </Button>
                        )}
                        
                        {/* Edit Par/SI Warning - Compact */}
                        {showEditParWarning && (
                          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3" onClick={() => setShowEditParWarning(false)}>
                            <div className="bg-white dark:bg-slate-800 rounded-lg max-w-xs w-full" onClick={e => e.stopPropagation()}>
                              <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-sm text-red-600 dark:text-red-400">Edit Par/SI?</h3>
                                    <p className="text-[10px] text-slate-500">Affects ALL future games</p>
                                  </div>
                                </div>
                                
                                <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded mb-3">
                                  <p className="text-[10px] text-red-700 dark:text-red-300 text-center">
                                    Changing Par or Stroke Index will affect scoring for ALL players on this course
                                  </p>
                                </div>
                                
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setShowEditParWarning(false);
                                      // Open edit mode with current holes
                                      const currentHoles = courseHoles.length > 0 
                                        ? courseHoles 
                                        : Array.from({ length: 18 }, (_, i) => ({ 
                                            hole_number: i + 1, 
                                            par: 4, 
                                            stroke_index: i + 1,
                                            ladies_stroke_index: null
                                          }));
                                      setEditHoleData(currentHoles.map(h => ({ 
                                        hole_number: h.hole_number, 
                                        par: h.par, 
                                        stroke_index: h.stroke_index,
                                        ladies_stroke_index: (h as any).ladies_stroke_index ?? null
                                      })));
                                      setEditingCourseHoles(true);
                                    }}
                                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded"
                                  >
                                    Yes, Continue
                                  </button>
                                  <button
                                    onClick={() => setShowEditParWarning(false)}
                                    className="flex-1 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold rounded hover:bg-slate-50 dark:hover:bg-slate-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Loading state while course data loads */}
                        {showScorecard && scorecardGameId === effectiveGameId && Object.keys(ladiesStrokeMap).length === 0 && courseHoles.length === 0 && (
                          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto mb-2"></div>
                            <div className="text-[10px]">Loading course data...</div>
                          </div>
                        )}

                        {showScorecard && scorecardGameId === effectiveGameId && !courseHolesFound && !editingCourseHoles && courseHoles.length === 0 && Object.keys(ladiesStrokeMap).length > 0 && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
                            <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 mb-1">Course Scorecard Not Set Up</div>
                            <div className="text-[9px] text-amber-600 dark:text-amber-400 mb-2">Par and Stroke Index data for this course has not been entered yet. Set it up to enable accurate Stableford scoring.</div>
                            <Button
                              size="sm"
                              className="w-full h-7 text-[9px] bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                              onClick={() => {
                                setEditHoleData(Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, stroke_index: i + 1, ladies_stroke_index: null })));
                                setEditingCourseHoles(true);
                              }}
                            >
                              Set Up Course Scorecard
                            </Button>
                          </div>
                        )}

                        {showScorecard && scorecardGameId === effectiveGameId && editingCourseHoles && (
                          <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700 space-y-2">
                            <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">Enter Par & Stroke Index for Each Hole</div>
                            <div className="overflow-x-auto -mx-3 px-3">
                              <table className="w-full text-[8px] border-collapse min-w-[340px]">
                                <thead>
                                  <tr className="bg-amber-100 dark:bg-amber-900/30">
                                    <th className="text-left py-1 px-1 font-semibold text-amber-700 dark:text-amber-300 w-10">Hole</th>
                                    {Array.from({ length: 9 }, (_, i) => (
                                      <th key={i} className="text-center py-1 px-0.5 font-bold text-amber-700 dark:text-amber-300 w-[28px]">{i + 1}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="py-1 px-1 font-medium text-slate-600 dark:text-slate-400">Par</td>
                                    {editHoleData.slice(0, 9).map((h, i) => (
                                      <td key={i} className="text-center py-0.5 px-0">
                                        <select value={h.par} onChange={(e) => { const d = [...editHoleData]; d[i] = { ...d[i], par: Number(e.target.value) }; setEditHoleData(d); }} className="w-[28px] h-[22px] text-center text-[9px] font-bold border border-amber-200 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" style={{ appearance: "none" } as React.CSSProperties}>
                                          <option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
                                        </select>
                                      </td>
                                    ))}
                                  </tr>
                                  <tr>
                                    <td className="py-1 px-1 font-medium text-slate-600 dark:text-slate-400">SI</td>
                                    {editHoleData.slice(0, 9).map((h, i) => (
                                      <td key={i} className="text-center py-0.5 px-0">
                                        <select value={h.stroke_index} onChange={(e) => { const d = [...editHoleData]; d[i] = { ...d[i], stroke_index: Number(e.target.value) }; setEditHoleData(d); }} className="w-[28px] h-[22px] text-center text-[9px] font-bold border border-amber-200 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" style={{ appearance: "none" } as React.CSSProperties}>
                                          {Array.from({ length: 18 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}</option>)}
                                        </select>
                                      </td>
                                    ))}
                                  </tr>
                                  <tr>
                                    <td className="py-1 px-1 font-medium text-pink-600 dark:text-pink-400">Ladies</td>
                                    {editHoleData.slice(0, 9).map((h, i) => (
                                      <td key={i} className="text-center py-0.5 px-0">
                                        <select 
                                          value={h.ladies_stroke_index || ''} 
                                          onChange={(e) => {
                                            const newData = [...editHoleData];
                                            newData[i] = { 
                                              ...newData[i], 
                                              ladies_stroke_index: e.target.value ? Number(e.target.value) : null 
                                            };
                                            setEditHoleData(newData);
                                          }}
                                          className="w-[28px] h-[22px] text-center text-[9px] font-bold border border-pink-200 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" 
                                          style={{ appearance: "none" } as React.CSSProperties}
                                        >
                                          <option value="">--</option>
                                          {Array.from({ length: 18 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}</option>)}
                                        </select>
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                              {/* Back 9 */}
                              <table className="w-full text-[8px] border-collapse min-w-[340px] mt-2">
                                <thead>
                                  <tr className="bg-amber-100 dark:bg-amber-900/30">
                                    <th className="text-left py-1 px-1 font-semibold text-amber-700 dark:text-amber-300 w-10">Hole</th>
                                    {Array.from({ length: 9 }, (_, i) => (
                                      <th key={i} className="text-center py-1 px-0.5 font-bold text-amber-700 dark:text-amber-300 w-[28px]">{i + 10}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="py-1 px-1 font-medium text-slate-600 dark:text-slate-400">Par</td>
                                    {editHoleData.slice(9, 18).map((h, i) => (
                                      <td key={i} className="text-center py-0.5 px-0">
                                        <select value={h.par} onChange={(e) => { const d = [...editHoleData]; d[i + 9] = { ...d[i + 9], par: Number(e.target.value) }; setEditHoleData(d); }} className="w-[28px] h-[22px] text-center text-[9px] font-bold border border-amber-200 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" style={{ appearance: "none" } as React.CSSProperties}>
                                          <option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
                                        </select>
                                      </td>
                                    ))}
                                  </tr>
                                  <tr>
                                    <td className="py-1 px-1 font-medium text-slate-600 dark:text-slate-400">SI</td>
                                    {editHoleData.slice(9, 18).map((h, i) => (
                                      <td key={i} className="text-center py-0.5 px-0">
                                        <select value={h.stroke_index} onChange={(e) => { const d = [...editHoleData]; d[i + 9] = { ...d[i + 9], stroke_index: Number(e.target.value) }; setEditHoleData(d); }} className="w-[28px] h-[22px] text-center text-[9px] font-bold border border-amber-200 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" style={{ appearance: "none" } as React.CSSProperties}>
                                          {Array.from({ length: 18 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}</option>)}
                                        </select>
                                      </td>
                                    ))}
                                  </tr>
                                  <tr>
                                    <td className="py-1 px-1 font-medium text-pink-600 dark:text-pink-400">Ladies</td>
                                    {editHoleData.slice(9, 18).map((h, i) => (
                                      <td key={i} className="text-center py-0.5 px-0">
                                        <select 
                                          value={h.ladies_stroke_index || ''} 
                                          onChange={(e) => {
                                            const newData = [...editHoleData];
                                            newData[i + 9] = { 
                                              ...newData[i + 9], 
                                              ladies_stroke_index: e.target.value ? Number(e.target.value) : null 
                                            };
                                            setEditHoleData(newData);
                                          }}
                                          className="w-[28px] h-[22px] text-center text-[9px] font-bold border border-pink-200 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" 
                                          style={{ appearance: "none" } as React.CSSProperties}
                                        >
                                          <option value="">--</option>
                                          {Array.from({ length: 18 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}</option>)}
                                        </select>
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <div className="text-[9px] text-slate-500 dark:text-slate-400 text-center">
                              Total Par: {editHoleData.reduce((s, h) => s + h.par, 0)} ({editHoleData.slice(0, 9).reduce((s, h) => s + h.par, 0)}/{editHoleData.slice(9).reduce((s, h) => s + h.par, 0)})
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-[9px] bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                                onClick={saveCourseHoles}
                              >
                                Save Course Scorecard
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[9px] px-3 bg-transparent"
                                onClick={() => setEditingCourseHoles(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {showScorecard && scorecardGameId === effectiveGameId && courseHoles.length > 0 && courseHolesFound && (
                          <div className="space-y-2">
                            {/* Previous-round gate for multi-round games */}
                            {(() => {
                              const scoringGame = adhocGames.find(g => g.adhoc_game_id === effectiveGameId);
                              if (!scoringGame?.is_multi_round || (scoringGame.round_number ?? 1) <= 1) return null;
                              // Find the previous round game
                              const prevGame = adhocGames.find(g =>
                                g.is_multi_round &&
                                g.organizer_id === scoringGame.organizer_id &&
                                (g.club_id ?? 0) === (scoringGame.club_id ?? 0) &&
                                g.total_rounds === scoringGame.total_rounds &&
                                (g.round_number === (scoringGame.round_number ?? 2) - 1 || g.round_number == null)
                              );
                              if (!prevGame) return null;
                              const prevPairings = allGamePairings.filter(p => p.adhoc_game_id === prevGame.adhoc_game_id);
                              // Locked until previous round has pairings AND all are fully submitted
                              const prevComplete = prevPairings.length > 0 && prevPairings.every(p => p.allResultsSubmitted);
                              if (prevComplete) return null;
                              // Previous round not complete — block entry
                              return (
                                <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 flex flex-col items-center gap-3 text-center">
                                  <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  <div>
                                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Round {(scoringGame.round_number ?? 2)} Locked</p>
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                                      Round {(scoringGame.round_number ?? 2) - 1} scores must be submitted before you can enter Round {scoringGame.round_number ?? 2} scores.
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                            {/* Hole Navigator */}
                            {(() => {
                              // Check gate again to skip hole navigator if locked
                              const scoringGame = adhocGames.find(g => g.adhoc_game_id === effectiveGameId);
                              if (scoringGame?.is_multi_round && (scoringGame.round_number ?? 1) > 1) {
                                const prevGame = adhocGames.find(g =>
                                  g.is_multi_round &&
                                  g.organizer_id === scoringGame.organizer_id &&
                                  (g.club_id ?? 0) === (scoringGame.club_id ?? 0) &&
                                  g.total_rounds === scoringGame.total_rounds &&
                                  (g.round_number === (scoringGame.round_number ?? 2) - 1 || g.round_number == null)
                                );
                                const prevComplete = prevGame
                                  ? allGamePairings.filter(p => p.adhoc_game_id === prevGame.adhoc_game_id).every(p => p.allResultsSubmitted)
                                  : true;
                                if (!prevComplete) return null; // locked — skip hole navigator
                              }
                              const currentHole = courseHoles.find(h => h.hole_number === activeHole) || courseHoles[0];
                              return (
                                <>
                                  {/* Hole Dial Navigator */}
                                  <div className="flex flex-col items-center gap-2">
                                    {/* Dial row */}
                                    <div className="w-full flex items-center gap-3">
                                      {/* Prev button */}
                                      <button
                                        onClick={() => setActiveHole(Math.max(1, activeHole - 1))}
                                        disabled={activeHole === 1}
                                        className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border-2 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 text-xl font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm"
                                      >
                                        ‹
                                      </button>

                                      {/* Centre dial display */}
                                      <div className="flex-1 flex flex-col items-center justify-center bg-indigo-600 dark:bg-indigo-700 rounded-2xl py-3 px-4 shadow-md">
                                        <span className="text-[11px] font-semibold text-indigo-200 uppercase tracking-widest">HOLE</span>
                                        <span className="text-4xl font-bold text-white leading-none mt-0.5">{activeHole}</span>
                                        <div className="flex items-center gap-3 mt-1">
                                          <span className="text-[13px] font-semibold text-indigo-200">Par {currentHole.par}</span>
                                          <span className="w-1 h-1 rounded-full bg-indigo-400" />
                                          <span className="text-[13px] font-semibold text-indigo-200">SI {currentHole.stroke_index}</span>
                                        </div>
                                        {/* Live distance to green + map button */}
                                        <button
                                          className="mt-2 flex items-center gap-1.5 bg-indigo-500/60 hover:bg-indigo-500/90 active:scale-95 transition-all rounded-xl px-3 py-1.5"
                                          onClick={() => {}}
                                          style={{ display: "none" }}
                                        >
                                        </button>
                                      </div>

                                      {/* Next button */}
                                      <button
                                        onClick={() => setActiveHole(Math.min(courseHoles.length, activeHole + 1))}
                                        disabled={activeHole === courseHoles.length}
                                        className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border-2 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 text-xl font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm"
                                      >
                                        ›
                                      </button>
                                    </div>

                                    {/* Progress dot strip */}
                                    <div className="flex gap-1 flex-wrap justify-center">
                                      {courseHoles.map(h => {
                                        const allScored = fourballMembers.every(m => (holeScoreData[m.pairing_id] || {})[h.hole_number] != null);
                                        const someScored = fourballMembers.some(m => (holeScoreData[m.pairing_id] || {})[h.hole_number] != null);
                                        return (
                                          <button
                                            key={h.hole_number}
                                            onClick={() => setActiveHole(h.hole_number)}
                                            title={`Hole ${h.hole_number}`}
                                            className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                                              h.hole_number === activeHole
                                                ? "bg-indigo-600 text-white ring-2 ring-indigo-300 ring-offset-1 scale-110"
                                                : allScored
                                                  ? "bg-green-500 text-white"
                                                  : someScored
                                                    ? "bg-amber-400 text-white"
                                                    : "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                                            }`}
                                          >
                                            {h.hole_number}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Active Hole Info */}
                                  <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3">
                                    {/* Edit Par/SI - Danger button */}
                                    <div className="flex justify-center mt-2">
                                      <button
                                        onClick={() => setShowEditParWarning(true)}
                                        className="px-3 py-1.5 text-[10px] font-bold rounded-lg border-2 border-red-400 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-600 dark:text-red-400 flex items-center gap-1"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        EDIT PAR/SI
                                      </button>
                                    </div>

                                    {/* Score entry for each player */}
                                    <div className="space-y-2">
                                      {fourballMembers.map(member => {
                                        const scores = holeScoreData[member.pairing_id] || {};
                                        const val = scores[activeHole];
                                        const diff = val != null ? val - currentHole.par : null;
                                        const isMe = member.member_id === memberData?.member_id;
                                        let scoreBg = "";
                                        let scoreLabel = "";
                                        if (diff !== null) {
                                          if (diff <= -2) { scoreBg = "bg-blue-500 text-white"; scoreLabel = "Eagle+"; }
                                          else if (diff === -1) { scoreBg = "bg-green-500 text-white"; scoreLabel = "Birdie"; }
                                          else if (diff === 0) { scoreBg = "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200"; scoreLabel = "Par"; }
                                          else if (diff === 1) { scoreBg = "bg-orange-400 text-white"; scoreLabel = "Bogey"; }
                                          else { scoreBg = "bg-red-500 text-white"; scoreLabel = `+${diff}`; }
                                        }

                                        return (
                                          <div key={member.pairing_id} className={`flex items-center gap-2 p-2 rounded-lg ${isMe ? "bg-blue-100/60 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700" : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"}`}>
                                            <div className="flex-1 min-w-0">
                                              <div className={`text-base font-bold truncate ${isMe ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>
                                                {getDisplayName(member.member_name, fourballMembers.map(m => m.member_name))}
                                                {isMe && <span className="text-blue-500 ml-1 text-[9px] font-semibold">YOU</span>}
                                              </div>
                                              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">HCP {member.playing_handicap ?? "-"}</div>
                                            </div>
                                            {/* Score dropdown */}
                                            {(() => {
                                              // Check Medal from pairing group game_type (most reliable source), OR liveScoreGameInfo.format, OR MEDAL_CLUB_IDS
                                              const isHoleMedal = adhocGames.find(g => g.adhoc_game_id === effectiveGameId)?.game_type === "Medal" || liveScoreGameInfo?.format === "Medal" || MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0);
                                              const hcp = member.playing_handicap ?? 0;
                                              let hcpStrokes = 0;
                                              if (hcp > 0) {
              hcpStrokes = calculateHcpStrokes(hcp, currentHole.stroke_index);
                                              }
                                              // ESC cap: Stableford max = par + 2 + hcpStrokes; Medal = no cap (allow up to 15)
                                              const escMax = isHoleMedal ? 15 : currentHole.par + 2 + hcpStrokes;
                                              const options = Array.from({ length: escMax }, (_, i) => i + 1);
                                              return (
                                                <div className="flex items-center gap-2">
                                                  <div className="flex flex-col items-center">
                                                    <select
                                                      value={val ?? ""}
                                                      disabled={gameIsCompleted}
                                                      onChange={(e) => {
                                                        if (gameIsCompleted) return;
                                                        const v = e.target.value === "" ? null : parseInt(e.target.value);
                                                        // Check if this is a guest (has guest_id or member_id is negative)
                                                        const isGuestPlayer = !!member.guest_id || member.member_id < 0;
                                                        if (isGuestPlayer) {
const guestId = member.guest_id || (member.member_id < 0 ? -member.member_id : 0);
  const gameDate = liveScoreGameInfo?.game_date || "";
  const courseId = liveScoreGameInfo?.course_id || 0;
  saveGuestHoleScore(member.pairing_id, gameDate, courseId, guestId, activeHole, v);
  } else {
                                debouncedSaveHoleScore(member.pairing_id, effectiveGameId, member.member_id, activeHole, v);
  }
  }}
                                                      className={`h-8 w-16 rounded-lg text-center text-[12px] font-bold border-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                                        val == null
                                                          ? "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-400"
                                                          : diff !== null && diff <= -2
                                                            ? "border-blue-400 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                                                            : diff === -1
                                                              ? "border-green-400 bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                                                              : diff === 0
                                                                ? "border-slate-300 bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
                                                                : diff === 1
                                                                  ? "border-orange-400 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                                                                  : "border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                                      }`}
                                                    >
                                                      <option value="">-</option>
                                                      {options.map(n => (
                                                        <option key={n} value={n}>{n}</option>
                                                      ))}
                                                    </select>
                                                    {!isHoleMedal && (
                                                      <span className="text-[7px] text-slate-400 mt-0.5">max {escMax}</span>
                                                    )}
                                                  </div>
                                                  {scoreLabel && (
                                                    <div className={`px-2 py-1 rounded-lg text-[8px] font-bold ${scoreBg} min-w-[40px] text-center`}>
                                                      {scoreLabel}
                                                    </div>
                                                  )}
                                                  {/* Lady checkbox — only shown when a score is entered */}
                                                  {val != null && (
                                                    <label className="flex flex-col items-center gap-0.5 cursor-pointer select-none">
                                                      <input
                                                        type="checkbox"
                                                        disabled={gameIsCompleted}
                                                        checked={ladyHoleData[member.pairing_id]?.[activeHole] ?? false}
                                                        onChange={(e) => { if (gameIsCompleted) return; saveLadyFlag(member.pairing_id, effectiveGameId, member.member_id, activeHole, e.target.checked); }}
                                                        className="w-4 h-4 rounded accent-pink-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                      />
                                                      <span className="text-[7px] font-semibold text-pink-500">Lady</span>
                                                    </label>
                                                  )}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Next hole button */}
                                    {activeHole < 18 && fourballMembers.every(m => (holeScoreData[m.pairing_id] || {})[activeHole] != null) && (
                                      <Button
                                        size="sm"
                                        className="w-full h-8 text-[10px] mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                                        onClick={() => setActiveHole(activeHole + 1)}
                                      >
                                        {'Next: Hole ' + (activeHole + 1) + ' →'}
                                      </Button>
                                    )}
                                  </div>

                                  {/* Compact Running Totals */}
                                  <div className="bg-indigo-50/80 dark:bg-indigo-900/20 rounded-lg p-2 space-y-0.5">
                                    <div className="grid grid-cols-12 gap-0.5 text-[7px] font-medium text-slate-500 dark:text-slate-400 pb-0.5 border-b border-indigo-100 dark:border-indigo-800">
                                      <div className="col-span-3">Player</div>
                                      <div className="col-span-2 text-center">Thru</div>
                                      <div className="col-span-2 text-center">Gross</div>
                                      <div className="col-span-2 text-center">Net</div>
                                      <div className="col-span-3 text-center">Pts</div>
                                    </div>
                                    {fourballMembers.map(member => {
                                      const totals = computePlayerTotals(member.pairing_id, member.playing_handicap);
                                      const parForPlayed = courseHoles.filter(h => {
                                        const sc = holeScoreData[member.pairing_id] || {};
                                        return sc[h.hole_number] != null;
                                      }).reduce((s, h) => s + h.par, 0);
                                      const hcp = member.playing_handicap ?? 0;
                                      const proportionalHcp = totals.holesPlayed > 0 ? Math.round(hcp * totals.holesPlayed / 18) : 0;
                                      const stp = totals.holesPlayed > 0 ? totals.gross - parForPlayed - proportionalHcp : null;
                                      const stpStr = stp === null ? "-" : stp === 0 ? "E" : stp > 0 ? `+${stp}` : `${stp}`;
                                      const isMe = member.member_id === memberData?.member_id;
                                      return (
                                        <div key={member.pairing_id} className={`grid grid-cols-12 gap-0.5 text-[9px] py-0.5 ${isMe ? "font-bold text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>
                                          <div className="col-span-3 truncate">{getDisplayName(member.member_name, fourballMembers.map(m => m.member_name))}</div>
                                          <div className="col-span-2 text-center text-slate-500">{totals.holesPlayed}</div>
                                          <div className="col-span-2 text-center font-semibold">{totals.holesPlayed > 0 ? totals.gross : "-"}</div>
                                          <div className={`col-span-2 text-center font-bold ${stp !== null && stp < 0 ? "text-red-600" : stp === 0 ? "text-green-600" : "text-slate-600"}`}>{stpStr}</div>
                                          <div className="col-span-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{totals.holesPlayed > 0 ? totals.totalPoints : "-"}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              );
                            })()}

                            {/* Submit 4Ball Scores Button - any member can submit for entire group */}
                            {memberData && fourballMembers.length > 0 && !myFourball[0]?.allResultsSubmitted && (() => {
                              const allAlreadySubmitted = fourballMembers.every(m => !!(scoresSubmittedMap[m.pairing_id] || m.scores_submitted_at));
                              const fourballIsMedal = liveScoreGameInfo?.format === "Medal";
                              const anyScores = fourballMembers.some(m => computePlayerTotals(m.pairing_id, m.playing_handicap, fourballIsMedal).holesPlayed > 0);
                              const totalHoles = courseHoles.length || 18;
                              const allHolesComplete = fourballMembers.every(m => computePlayerTotals(m.pairing_id, m.playing_handicap, fourballIsMedal).holesPlayed >= totalHoles);
                              const missingHoles = fourballMembers.map(m => {
                                const played = computePlayerTotals(m.pairing_id, m.playing_handicap, fourballIsMedal).holesPlayed;
                                return { name: getDisplayName(m.member_name, fourballMembers.map(fb => fb.member_name)), missing: totalHoles - played };
                              }).filter(x => x.missing > 0);
                              
                              return (
                                <div className={`rounded-lg p-2 border space-y-1.5 ${allAlreadySubmitted ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700" : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"}`}>
                                  {allAlreadySubmitted ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-green-500" />
                                      <div className="text-[9px] font-semibold text-green-700 dark:text-green-300">
                                        4Ball scores submitted for captain review
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="text-[9px] font-medium text-blue-700 dark:text-blue-300 mb-1">
                                        Submit all 4Ball scores to the Captain for verification.
                                      </div>
                                      {/* Summary of all members */}
                                      <div className="space-y-0.5 mb-1.5">
                                        {fourballMembers.map(member => {
                                          const totals = computePlayerTotals(member.pairing_id, member.playing_handicap);
                                          const isMe = member.member_id === memberData?.member_id;
                                          const memberMissing = totalHoles - totals.holesPlayed;
                                          return (
                                            <div key={member.pairing_id} className={`flex items-center justify-between text-[9px] px-2 py-1 rounded ${memberMissing > 0 ? "bg-amber-100/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700" : "bg-blue-100/60 dark:bg-blue-800/20"} ${isMe ? "ring-1 ring-blue-300" : ""}`}>
                                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                                {getDisplayName(member.member_name, fourballMembers.map(m => m.member_name))}
                                                {isMe && <span className="text-blue-500 ml-0.5 text-[7px]">YOU</span>}
                                                {memberMissing > 0 && <span className="ml-1 text-amber-600 dark:text-amber-400 font-semibold text-[8px]">({memberMissing} holes missing)</span>}
                                              </span>
                                              <div className="flex items-center gap-2 text-[8px]">
                                                <span className="text-slate-500">{totals.holesPlayed}h</span>
                                                <span className="text-slate-600 dark:text-slate-400">Grs: {totals.holesPlayed > 0 ? totals.gross : "-"}</span>
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">Pts: {totals.holesPlayed > 0 ? totals.totalPoints : "-"}</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Incomplete warning + Submit Anyway */}
                                      {!allHolesComplete && submitIncompleteWarning && (
                                        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 p-2 space-y-1.5">
                                          <div className="text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                                            Not all holes are scored:
                                          </div>
                                          <div className="text-[8px] text-amber-600 dark:text-amber-400 space-y-0.5">
                                            {missingHoles.map(x => (
                                              <div key={x.name}>{x.name}: {x.missing} hole{x.missing !== 1 ? "s" : ""} missing</div>
                                            ))}
                                          </div>
                                          <div className="text-[8px] text-amber-700 dark:text-amber-300">Submit anyway?</div>
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              className="flex-1 h-7 text-[9px] bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                                              onClick={() => { setSubmitIncompleteWarning(false); handleSubmitScoresForReview(fourballMembers, liveScoreGameInfo?.format === "Medal"); }}
                                              disabled={submittingScores}
                                            >
                                              Submit Anyway
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="flex-1 h-7 text-[9px] border-amber-300 text-amber-700 bg-transparent"
                                              onClick={() => setSubmitIncompleteWarning(false)}
                                            >
                                              Go Back
                                            </Button>
                                          </div>
                                        </div>
                                      )}

                                      {!submitIncompleteWarning && (
                                        <Button
                                          size="sm"
                                          className="w-full h-8 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                                          onClick={() => {
                                            if (!allHolesComplete) {
                                              setSubmitIncompleteWarning(true);
                                            } else {
                                              handleSubmitScoresForReview(fourballMembers, liveScoreGameInfo?.format === "Medal");
                                            }
                                          }}
                                          disabled={!anyScores || submittingScores}
                                        >
                                          {submittingScores ? "Submitting all scores..." : "Submit 4Ball Scores for Captain Review"}
                                        </Button>
                                      )}


                                    </>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Captain: Verify & Finalize Section - own 4Ball only */}
                            {isCaptain && fourballMembers.length > 0 && (
                              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-700 space-y-2">
                                <div className="text-[9px] font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">Captain: Verify & Finalize 4Ball Results</div>
                                <div className="text-[8px] text-green-600 dark:text-green-400">
                                  Review your 4Ball scores below. Once all players have submitted, verify and finalize.
                                </div>
                                
                                {/* Own fourball player status */}
                                <div className="space-y-0.5">
                                  {fourballMembers.map(member => {
                                    const totals = computePlayerTotals(member.pairing_id, member.playing_handicap);
                                    const submitted = !!(scoresSubmittedMap[member.pairing_id] || member.scores_submitted_at);
                                    const isMe = member.member_id === memberData?.member_id;
                                    return (
                                      <div key={member.pairing_id} className={`flex items-center justify-between text-[9px] px-2 py-1.5 rounded ${submitted ? "bg-green-100 dark:bg-green-800/30" : "bg-amber-50 dark:bg-amber-900/20"} ${isMe ? "ring-1 ring-blue-300 dark:ring-blue-600" : ""}`}>
                                        <div className="flex items-center gap-1.5">
                                          <div className={`w-2 h-2 rounded-full ${submitted ? "bg-green-500" : "bg-amber-400 animate-pulse"}`} />
                                          <span className="font-medium text-slate-700 dark:text-slate-300">
                                            {getDisplayName(member.member_name, fourballMembers.map(m => m.member_name))}
                                            {isMe && <span className="text-blue-500 ml-0.5 text-[7px]">YOU</span>}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {submitted ? (
                                            <>
                                              <span className="text-green-600 dark:text-green-400 text-[8px]">Submitted</span>
                                              <span className="text-slate-500">{totals.holesPlayed}h</span>
                                              <span className="text-slate-500">Grs: {totals.gross}</span>
                                              <span className="font-bold text-indigo-600 dark:text-indigo-400">Pts: {totals.totalPoints}</span>
                                            </>
                                          ) : (
                                            <span className="text-amber-600 dark:text-amber-400 text-[8px] italic">Awaiting ({totals.holesPlayed} holes entered)</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {(() => {
                                  const allSubmitted = fourballMembers.every(m => !!(scoresSubmittedMap[m.pairing_id] || m.scores_submitted_at));
                                  
                                  // Also check if captain has entered scores for everyone (even if not "submitted")
                                  const captainEnteredAllScores = fourballMembers.every(m => {
                                    const data = resultsData[m.pairing_id];
                                    return data && data.gross_score && parseInt(data.gross_score) > 0;
                                  });
                                  
                                  const canFinalize = allSubmitted || captainEnteredAllScores;
                                  const pendingCount = fourballMembers.filter(m => !(scoresSubmittedMap[m.pairing_id] || m.scores_submitted_at) && !captainEnteredAllScores).length;
                                  
                                  return (
                                    <Button
                                      size="sm"
                                      className={`w-full h-8 text-[10px] font-semibold text-white ${canFinalize ? "bg-green-600 hover:bg-green-700" : "bg-green-400 cursor-not-allowed"}`}
                                      disabled={!canFinalize}
                                      onClick={() => {
                                        if (myFourball.length > 0) startCaptainFinalize(myFourball[0]);
                                      }}
                                    >
                                      {canFinalize
                                        ? `Verify & Finalize 4Ball Results (${fourballMembers.length} players)`
                                        : `Waiting for ${pendingCount} player(s) to submit`}
                                    </Button>
                                  );
                                })()}
                              </div>
                            )}

                            {/* ── Next Round Ready notice ── auto-appears once ALL pairings in this round are submitted */}
                            {(() => {
                              const currentGame = adhocGames.find(g => g.adhoc_game_id === liveScoreGameInfo?.adhoc_game_id);
                              if (!currentGame?.is_multi_round) return null;

                              // Only show when every pairing in this round has submitted results
                              const roundPairings = allGamePairings.filter(p => p.adhoc_game_id === currentGame.adhoc_game_id);
                              if (!roundPairings.length) return null;
                              const allSubmitted = roundPairings.every(p => p.allResultsSubmitted);
                              if (!allSubmitted) return null;

                              // Find the next round game in the same multi-round group
                              const nextRoundGame = adhocGames.find(g =>
                                g.is_multi_round &&
                                g.organizer_id === currentGame.organizer_id &&
                                (g.club_id ?? 0) === (currentGame.club_id ?? 0) &&
                                g.total_rounds === currentGame.total_rounds &&
                                (g.round_number ?? 1) === (currentGame.round_number ?? 1) + 1
                              );
                              if (!nextRoundGame) return null;

                              return (
                                <div className="rounded-xl border-2 border-[#c9a84c] bg-[#fffbf0] dark:bg-[#221c00] dark:border-[#c9a84c]/60 p-3 space-y-1.5 mt-1">
                                  <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-[#c9a84c] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    <span className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-wide">
                                      Round {currentGame.round_number ?? 1} Complete — Round {nextRoundGame.round_number} Now Open
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-slate-700 dark:text-slate-300 leading-relaxed">
                                    All scores for Round {currentGame.round_number ?? 1} have been submitted.{" "}
                                    <strong>Round {nextRoundGame.round_number}</strong>
                                    {nextRoundGame.course_name ? ` at ${nextRoundGame.course_name}` : ""}
                                    {nextRoundGame.game_date ? ` on ${new Date(nextRoundGame.game_date).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}` : ""} is now accessible for scoring.
                                  </p>
                                </div>
                              );
                            })()}

                            {savingHoleScore && (
                              <div className="text-[8px] text-indigo-500 text-center animate-pulse">Saving...</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </CardContent>
              </Card>

              {/* Additional leaderboards for Game 2, 3... on same day */}
              {useLive && sameDayGameIds.slice(1).map((extraGameId, idx) => {
                const extraPairings = allGamePairings.filter(p => p.adhoc_game_id === extraGameId);
                const extraGameInfo = adhocGames.find(g => g.adhoc_game_id === extraGameId);
                const extraCourseName = extraPairings[0]?.course_name || extraGameInfo?.course_name || "Unknown Course";
                const extraFormat = extraPairings[0]?.format || "Stableford";
                // Check actual game_type from adhocGames for Medal detection
                const extraIsMedal = MEDAL_CLUB_IDS.includes(myClub?.club_id ?? 0) || extraGameInfo?.game_type === "Medal" || extraFormat === "Medal";
                const extraMembers = extraPairings.flatMap(p => p.members.map(m => ({ ...m, fourball_number: p.fourball_number })));
                const extraLb = extraMembers.map(m => {
                  const pts = m.points ?? 0;
                  const gross = m.gross_score ?? 0;
                  const hcp = m.playing_handicap ?? 0;
                  const net = gross - hcp;
                  return { member_name: m.member_name, member_id: m.member_id, fourball_number: m.fourball_number, points: pts, gross_score: gross, net_score: net, result_submitted: m.result_submitted };
                }).sort((a, b) => extraIsMedal ? a.net_score - b.net_score : b.points - a.points);
                const gameNum = idx + 2;
                const extraIsLive = extraMembers.some(m => !m.result_submitted);

                return (
                  <Card key={extraGameId} className="border border-indigo-200 dark:border-indigo-800 shadow-sm bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950">
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-sm font-semibold font-sans flex items-center gap-2">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        {`Game ${gameNum} - ${extraCourseName} Leaderboard`}
                        {extraIsLive && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="text-[10px] text-slate-500">
                        {gameDate ? new Date(gameDate).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" }) : ""} · {extraFormat} · {extraMembers.length} players
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="grid grid-cols-12 gap-1 text-[8px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide pb-1 border-b border-indigo-100 dark:border-indigo-800 mb-1">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Player</div>
                        <div className="col-span-2 text-center">4Ball</div>
                        <div className="col-span-2 text-center">Gross</div>
                        <div className="col-span-2 text-center">{extraIsMedal ? "Net" : "Pts"}</div>
                      </div>
                      {extraLb.map((s, i) => {
                        const isMe = s.member_id === memberData?.member_id;
                        return (
  <div key={s.member_id} className={`grid grid-cols-12 gap-0.5 items-center py-1 text-[9px] ${isMe ? "bg-blue-50 dark:bg-blue-900/30 rounded -mx-1 px-1 font-bold" : ""} ${i === 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-slate-300"}`}>
  <div className="col-span-1 text-center font-bold">{i + 1}</div>
  <div className="col-span-5 truncate flex items-center gap-0.5">
  <span className="truncate">{getDisplayName(s.member_name.replace(/ \(G\)$| \([^)]+\)$/, ''), extraLb.map(e => e.member_name))}</span>
  {(s.member_id < 0) && <span className="shrink-0 text-[7px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-0.5 rounded">G</span>}
  {isMe && <span className="text-blue-500 ml-0.5 text-[7px] shrink-0">YOU</span>}
  </div>
  <div className="col-span-2 text-center">{s.fourball_number}</div>
  <div className="col-span-2 text-center">{s.gross_score || "-"}</div>
  <div className="col-span-2 text-center font-bold">{extraIsMedal ? s.net_score : (s.points ?? "-")}</div>
  </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
              </>
            );
          })()
        )}



        </div>}

        {/* Achievements injected into Records tab — rendered when Records is active */}
        {activeTab === "records" && <div className="space-y-4">

        {/* Consolidated Achievements - Birdies, Eagles, Ladies, Late, No Shows */}
        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-semibold font-sans flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              Achievements & Records
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-5 gap-2">
              {/* Birdies */}
              <div className="text-center p-2 rounded-lg bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900">
                <div className="flex justify-center mb-1">
                  <svg className="w-5 h-5 text-rose-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 2C9.46 2 7 4.46 7 7.5c0 1.1.35 2.15.95 3.03l-2.12 2.12a1 1 0 101.41 1.41l2.12-2.12c.88.6 1.93.95 3.03.95a5.5 5.5 0 100-11h.11zm0 9c-1.93 0-3.5-1.57-3.5-3.5S10.57 4 12.5 4 16 5.57 16 7.5 14.43 11 12.5 11z"/><path d="M8 14l-4 4v2h2l4-4-2-2z"/></svg>
                </div>
                <div className="text-lg font-bold text-rose-600">{totalBirdies}</div>
                <div className="text-[8px] text-slate-500 uppercase">Birdies</div>
                {birdiesPosition && <div className="text-[8px] text-rose-500 font-medium">#{birdiesPosition}</div>}
              </div>
              
              {/* Eagles */}
              <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900">
                <div className="flex justify-center mb-1">
                  <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1-3-7z"/></svg>
                </div>
                <div className="text-lg font-bold text-amber-600">{totalEagles}</div>
                <div className="text-[8px] text-slate-500 uppercase">Eagles</div>
              </div>
              
              {/* Ladies */}
              <div className="text-center p-2 rounded-lg bg-pink-50 dark:bg-pink-950 border border-pink-100 dark:border-pink-900">
                <div className="flex justify-center mb-1">
                  <svg className="w-5 h-5 text-pink-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                </div>
                <div className="text-lg font-bold text-pink-600">{totalLadies}</div>
                <div className="text-[8px] text-slate-500 uppercase">Ladies</div>
                {ladiesPosition && <div className="text-[8px] text-pink-500 font-medium">#{ladiesPosition}</div>}
              </div>
              
              {/* Late */}
              <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-900">
                <div className="flex justify-center mb-1">
                  <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                </div>
                <div className="text-lg font-bold text-orange-600">{lateCount}</div>
                <div className="text-[8px] text-slate-500 uppercase">Late</div>
              </div>
              
              {/* No Shows */}
              <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900">
                <div className="flex justify-center mb-1">
                  <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
                </div>
                <div className="text-lg font-bold text-red-600">{noShowCount}</div>
                <div className="text-[8px] text-slate-500 uppercase">No Shows</div>
              </div>
            </div>
          </CardContent>
</Card>
  
  </div>}
  
  {/* ═══════════════════════════════════════════════
  SIDE COMPETITIONS TAB (Club 13 only)
        ═══════════════════════════════════════════════ */}
        {activeTab === "competitions" && <div className="space-y-4">

        {/* WWB Competition Leaderboard - Club 13 & Tuesday Clinique */}
        {WWB_CLUB_IDS.includes(myClub?.club_id ?? 0) && (() => {
          // Find the most recent LIVE/OPEN game (not completed) that has WWB enabled OR per-player opt-ins
          const activeWwbGame = adhocGames
            .filter(g => g.status !== "cancelled" && g.status !== "deleted" && g.status !== "completed")
            .find(g => {
              // Game-level WWB enabled flag
              if (g.wwb_enabled) return true;
              // Or any member opted in (check both DB fields and local state)
              const members = allGamePairings
                .filter(p => p.adhoc_game_id === g.adhoc_game_id)
                .flatMap(p => p.members);
              return members.some(m =>
                m.wwb_ww === true || m.wwb_birdie === true ||
                wwbOptIns[m.pairing_id]?.ww || wwbOptIns[m.pairing_id]?.birdie
              );
            });

          // Find the most recent COMPLETED WWB game — shown in full when no live game exists
          const recentCompletedWwbGame = adhocGames
            .filter(g => g.status === "completed" && g.wwb_enabled)
            .sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime())[0];

          if (!activeWwbGame && !recentCompletedWwbGame) return null;

          // Compute recent winners data (if a completed game exists)
          const recentWinnersData = recentCompletedWwbGame ? computeWwbLeaderboard(recentCompletedWwbGame.adhoc_game_id) : null;

          // If no live game — show the most recent completed WWB game results in full
          if (!activeWwbGame) {
            if (!recentCompletedWwbGame || !recentWinnersData) return null;
            // Reuse the active-game display path with the completed game as the subject
            // by falling through with recentCompletedWwbGame treated as the display game.
            // We render the full leaderboard + winners for it below.
            const displayGame = recentCompletedWwbGame;
            const displayData = recentWinnersData;
            const clubFees = WWB_FEES[myClub?.club_id ?? 0] ?? { front9: 100, back9: 100, overall: 100, birdie: 50 };

            return (
              <Card className="border border-green-200 dark:border-green-800 shadow-sm">
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      WWB Results
                    </CardTitle>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(displayGame.game_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <CardDescription className="text-[10px] mt-0.5">{displayGame.course_name} — Most recent completed game</CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-3">
                  {/* Winners strip */}
                  <RecentWinnersSection game={displayGame} data={displayData} />

                  {/* Pool totals */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-center">
                      <div className="text-[7px] font-bold text-blue-500 uppercase tracking-wide mb-0.5">WW Pool</div>
                      <div className="text-[11px] font-black text-blue-700 dark:text-blue-300">
                        R{displayData.wwTotalPool ?? displayData.wwFront9Pool ?? 0}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 text-center">
                      <div className="text-[7px] font-bold text-amber-500 uppercase tracking-wide mb-0.5">Birdie Pool</div>
                      <div className="text-[11px] font-black text-amber-700 dark:text-amber-300">
                        R{displayData.birdiePoolTotal ?? 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }

          // Determine if we are in booking phase (no results submitted yet)
          const gameMembers = allGamePairings
            .filter(p => p.adhoc_game_id === activeWwbGame.adhoc_game_id)
            .flatMap(p => p.members);
          const anyResultsIn = gameMembers.some(m => m.result_submitted || m.gross_score !== null);
          // Also treat as live if any hole score exists in holeScoreData for this game's pairings
          const anyHoleScoresIn = gameMembers.some(m => {
            const scores = holeScoreData[m.pairing_id];
            return scores && Object.keys(scores).length > 0;
          });
          const isBookingPhase = !anyResultsIn && !anyHoleScoresIn && (activeWwbGame.status === "open" || activeWwbGame.status === "full");

const wwData = computeWwbLeaderboard(activeWwbGame.adhoc_game_id);
  
  // Check for mismatches between opt-ins and pairings (show warning to organizer)
  const hasMismatches = wwbOptInMismatches.length > 0 && (memberData?.member_id === activeWwbGame.organizer_id || CLUB13_ADMINS.includes(memberData?.member_id ?? 0));
  
  // Build entrant lists from the dedicated opt-ins table (populated at booking time)
          // so the list is accurate even before pairings are generated.
          const gameOptInsForGame = gameWwbOptIns[activeWwbGame.adhoc_game_id] || {};

          // All confirmed players (members + guests) for this game
          // players now carries { member_id, member_name } so no name lookup needed
          const allConfirmedPlayers: { id: number; name: string; isGuest: boolean }[] = [
            ...((activeWwbGame.players || []).map((p: { member_id: number; member_name: string }) => ({
              id: p.member_id,
              name: p.member_name,
              isGuest: false,
            }))),
            ...((activeWwbGame.guests || []).map((g: { guest_id: number; guest_name: string }) => ({
              id: -(g.guest_id), name: g.guest_name, isGuest: true,
            }))),
          ];

          // Merge: prefer dedicated table, fall back to pairings wwb_ww/wwb_birdie for players who joined before the table existed
          const getOptIn = (playerId: number, pairingId?: number) => {
            if (gameOptInsForGame[playerId] !== undefined) return gameOptInsForGame[playerId];
            if (pairingId && wwbOptIns[pairingId]) return wwbOptIns[pairingId];
            // Tuesday Clinique: default all in
            if (myClub?.club_id === TUESDAY_CLINIQUE_ID) return { ww: true, birdie: true };
            return null;
          };

          const wwEntrantsFull = allConfirmedPlayers.filter(p => {
            const pairingMember = gameMembers.find(m => m.member_id === (p.isGuest ? undefined : p.id));
            const opts = getOptIn(p.id, pairingMember?.pairing_id);
            return opts?.ww === true || pairingMember?.wwb_ww === true;
          });

          const birdieEntrantsFull = allConfirmedPlayers.filter(p => {
            const pairingMember = gameMembers.find(m => m.member_id === (p.isGuest ? undefined : p.id));
            const opts = getOptIn(p.id, pairingMember?.pairing_id);
            return opts?.birdie === true || pairingMember?.wwb_birdie === true;
          });

          // Use full entrant lists for booking phase display
          const wwEntrants = isBookingPhase ? wwEntrantsFull : gameMembers.filter(m => m.wwb_ww === true || wwbOptIns[m.pairing_id]?.ww === true);
          const birdieEntrants = isBookingPhase ? birdieEntrantsFull : gameMembers.filter(m => m.wwb_birdie === true || wwbOptIns[m.pairing_id]?.birdie === true);

          const clubFees = WWB_FEES[myClub?.club_id ?? 0] ?? { front9: 100, back9: 100, overall: 100, birdie: 50 };
          const wwPoolTotal = wwEntrantsFull.length * (clubFees.front9 + clubFees.back9 + clubFees.overall);
          const birdiePoolTotal = birdieEntrantsFull.length * (activeWwbGame.birdie_pool_fee ?? clubFees.birdie);

          // Helper component for recent winners (used in multiple places)
          function RecentWinnersSection({ game, data }: { game: typeof recentCompletedWwbGame; data: typeof recentWinnersData }) {
            if (!game || !data) return null;
            return (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Recent Winners</div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">{game.course_name} — {new Date(game.game_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
  {/* WW Winners */}
  {[
  { label: "1st 9 Winner", winner: data.front9Winner, pts: data.front9Winner?.front9Points, net: data.front9Winner?.front9Net, color: "blue" },
  { label: "2nd 9 Winner", winner: data.back9Winner, pts: data.back9Winner?.back9Points, net: data.back9Winner?.back9Net, color: "blue" },
  { label: "Overall Winner", winner: data.overallWinner, pts: data.overallWinner?.totalPoints, net: data.overallWinner?.totalNet, color: "indigo" },
  ].map(({ label, winner, pts, net, color }) => (
  <div key={label} className="flex items-center gap-2 px-3 py-2">
  <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${color === "indigo" ? "bg-indigo-100 dark:bg-indigo-900" : "bg-blue-50 dark:bg-blue-900"}`}>
  <svg className={`w-3 h-3 ${color === "indigo" ? "text-indigo-500" : "text-blue-500"}`} fill="currentColor" viewBox="0 0 24 24">
  <path d="M5 3h14v2c0 3.314-2.686 6-6 6h-2C7.686 11 5 8.314 5 5V3zM3 5h2v.5A7.003 7.003 0 007.1 11H3V5zm18 0v6h-4.1A7.003 7.003 0 0019 5.5V5h2zm-8 8a7.014 7.014 0 01-1-.072V17h1.5A2.5 2.5 0 0116 19.5V21H8v-1.5A2.5 2.5 0 0110.5 17H12v-4.072c-.331.046-.664.072-1 .072z"/>
  </svg>
  </div>
  <div className="flex-1 min-w-0">
  <div className="text-[8px] text-slate-400 uppercase tracking-wide">{label}</div>
  <div className={`text-[11px] font-bold ${winner ? (color === "indigo" ? "text-indigo-700 dark:text-indigo-300" : "text-blue-700 dark:text-blue-300") : "text-slate-400 italic"}`}>
  {winner ? winner.member_name : "Half — No Winner"}
  </div>
  </div>
  {winner && (data.isMedal ? net != null : pts != null) && (
  <span className="text-[10px] font-semibold text-slate-500">{data.isMedal ? `Net ${net}` : `${pts} pts`}</span>
  )}
  </div>
  ))}
  {/* Birdie Pool — show all players who made birdies or eagles */}
  {data.birdieEntrants.filter(e => e.birdiePoints > 0).length > 0 && (
  <div className="px-3 py-2 space-y-1">
  {/* Summary line */}
  <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700">
    <div className="flex items-center gap-2">
      {data.totalEagles > 0 && (
        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
          <span>🦅</span> {data.totalEagles}
        </span>
      )}
      {data.totalBirdies > 0 && (
        <span className="text-[9px] font-bold text-green-600 dark:text-green-400 flex items-center gap-0.5">
          <span>🐦</span> {data.totalBirdies}
        </span>
      )}
      <span className="text-[9px] text-slate-400">= {data.totalBirdiePoints} pts</span>
    </div>
    <span className="text-[9px] text-slate-400">·</span>
    <span className="text-[9px] font-bold text-emerald-600">R{Math.round(data.perBirdie)}/pt</span>
    <span className="text-[9px] text-slate-400 ml-auto">Pool: R{data.birdiePoolTotal.toFixed(0)}</span>
  </div>
  {/* Details - show eagles and birdies separately */}
  {[...data.birdieEntrants].filter(e => e.birdiePoints > 0).sort((a, b) => b.birdiePoints - a.birdiePoints).map(e => (
  <div key={e.pairing_id} className="flex items-center gap-1.5 min-w-0">
  <span className="flex-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 break-words min-w-0">{formatMemberName(e.member_name)}</span>
  <div className="flex items-center gap-1 shrink-0">
    {e.actualEagles > 0 && (
      <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">{e.actualEagles}E</span>
    )}
    {e.actualBirdies > 0 && (
      <span className="text-[9px] font-bold text-green-600 dark:text-green-400">{e.actualBirdies}B</span>
    )}
    <span className="text-[9px] text-slate-400">= {e.birdiePoints}pts</span>
  </div>
  <span className="text-[10px] font-black text-emerald-600 shrink-0 whitespace-nowrap">R{e.payout}</span>
  </div>
  ))}
  </div>
  )}
                </div>
              </div>
            );
          }

          return (
            <Card className="border border-green-200 dark:border-green-800 shadow-sm bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950 dark:to-teal-950">
              <CardHeader className="pb-2 pt-3 px-3">
                {/* Title row */}
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    WWB Competition
                  </CardTitle>
                  {!isBookingPhase && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[8px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wide">Live</span>
                    </span>
                  )}
                </div>
                {/* Course & date row */}
                <CardDescription className="text-[10px] mt-0.5">
                  {activeWwbGame.course_name} — {new Date(activeWwbGame.game_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                </CardDescription>
  {/* Segment leader chips — own row, only when live */}
  {!isBookingPhase && (
  <div className="flex gap-1.5 mt-2">
  {[
  { label: "1st 9",   winner: wwData.front9Winner,  pts: wwData.front9Winner?.front9Points,  net: wwData.front9Winner?.front9Net,  pool: wwData.wwFront9Pool  },
  { label: "2nd 9",   winner: wwData.back9Winner,   pts: wwData.back9Winner?.back9Points,    net: wwData.back9Winner?.back9Net,    pool: wwData.wwBack9Pool   },
  { label: "Overall", winner: wwData.overallWinner, pts: wwData.overallWinner?.totalPoints,  net: wwData.overallWinner?.totalNet,  pool: wwData.wwOverallPool },
  ].map(({ label, winner, pts, net, pool }) => (
  <div key={label} className={`flex-1 p-2 rounded-lg border text-center min-w-0 ${label === "Overall" ? "bg-blue-600 dark:bg-blue-700 border-blue-500" : "bg-white dark:bg-slate-800 border-blue-100 dark:border-blue-800"}`}>
  <div className={`text-[8px] font-bold uppercase tracking-wide leading-none ${label === "Overall" ? "text-blue-200" : "text-blue-500 dark:text-blue-400"}`}>{label}</div>
  <div className={`text-[10px] font-black leading-tight break-words mt-1 ${label === "Overall" ? "text-white" : "text-blue-700 dark:text-blue-200"}`}>
  {winner ? getDisplayName(winner.member_name, [wwData.front9Winner, wwData.back9Winner, wwData.overallWinner].filter(Boolean).map(w => w!.member_name)) : <span className={`italic font-normal text-[9px] ${label === "Overall" ? "text-blue-300" : "text-slate-400"}`}>Half</span>}
  </div>
  {winner && (wwData.isMedal ? net != null : pts != null) && (
  <div className={`text-[8px] tabular-nums mt-0.5 ${label === "Overall" ? "text-blue-200" : "text-slate-500 dark:text-slate-400"}`}>{wwData.isMedal ? `Net ${net}` : `${pts} pts`}</div>
  )}
  <div className={`text-[9px] font-bold mt-1 ${label === "Overall" ? "text-yellow-300" : "text-emerald-600 dark:text-emerald-400"}`}>R{pool}</div>
  </div>
  ))}
  </div>
  )}
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-3">

                {/* WWB Competition Leaderboard - Top 3 for each segment (only when live) */}
                {!isBookingPhase && (
                <div className="space-y-4 mb-4">
  
                  {/* FRONT 9 - Top 3 */}
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden bg-white dark:bg-slate-800">
                    <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900/50 border-b border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                            FRONT 9
                          </span>
                          <span className="text-[8px] text-slate-400">(Holes 1-9)</span>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Pool: R{wwData.wwFront9Pool}
                          </div>
                          <div className="text-[7px] text-slate-400">
                            {wwData.sortedFront9.length} players
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3">
                      {wwData.sortedFront9.length === 0 ? (
                        <div className="text-center py-6 text-[10px] text-slate-400">
                          No scores recorded yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* 1st Place */}
                          {wwData.sortedFront9[0] && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                              <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shadow-md">
                                <span className="text-sm font-black text-yellow-900">1</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                  {formatMemberName(wwData.sortedFront9[0].member_name)}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  HCP {wwData.sortedFront9[0].playing_handicap}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                                  {wwData.isMedal ? wwData.sortedFront9[0].front9Net ?? "-" : wwData.sortedFront9[0].front9Points}
                                </div>
                                <div className="text-[8px] text-slate-400">{wwData.isMedal ? "net" : "points"}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* 2nd Place */}
                          {wwData.sortedFront9[1] && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center">
                                <span className="text-sm font-black text-white">2</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {formatMemberName(wwData.sortedFront9[1].member_name)}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  HCP {wwData.sortedFront9[1].playing_handicap}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                                  {wwData.isMedal ? wwData.sortedFront9[1].front9Net ?? "-" : wwData.sortedFront9[1].front9Points}
                                </div>
                                <div className="text-[8px] text-slate-400">{wwData.isMedal ? "net" : "points"}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* 3rd Place */}
                          {wwData.sortedFront9[2] && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                              <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center">
                                <span className="text-sm font-black text-white">3</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {formatMemberName(wwData.sortedFront9[2].member_name)}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  HCP {wwData.sortedFront9[2].playing_handicap}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                                  {wwData.isMedal ? wwData.sortedFront9[2].front9Net ?? "-" : wwData.sortedFront9[2].front9Points}
                                </div>
                                <div className="text-[8px] text-slate-400">{wwData.isMedal ? "net" : "points"}</div>
                              </div>
                            </div>
                          )}
                          
                          {wwData.sortedFront9.length > 3 && (
                            <div className="text-center pt-1">
                              <span className="text-[8px] text-slate-400">
                                +{wwData.sortedFront9.length - 3} more players
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BACK 9 - Top 3 */}
                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-hidden bg-white dark:bg-slate-800">
                    <div className="px-3 py-2 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900/50 border-b border-indigo-200 dark:border-indigo-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                            BACK 9
                          </span>
                          <span className="text-[8px] text-slate-400">(Holes 10-18)</span>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Pool: R{wwData.wwBack9Pool}
                          </div>
                          <div className="text-[7px] text-slate-400">
                            {wwData.sortedBack9.length} players
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3">
                      {wwData.sortedBack9.length === 0 ? (
                        <div className="text-center py-6 text-[10px] text-slate-400">
                          No scores recorded yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* 1st Place */}
                          {wwData.sortedBack9[0] && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                              <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shadow-md">
                                <span className="text-sm font-black text-yellow-900">1</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                  {formatMemberName(wwData.sortedBack9[0].member_name)}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  HCP {wwData.sortedBack9[0].playing_handicap}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                  {wwData.isMedal ? wwData.sortedBack9[0].back9Net ?? "-" : wwData.sortedBack9[0].back9Points}
                                </div>
                                <div className="text-[8px] text-slate-400">{wwData.isMedal ? "net" : "points"}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* 2nd Place */}
                          {wwData.sortedBack9[1] && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center">
                                <span className="text-sm font-black text-white">2</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {formatMemberName(wwData.sortedBack9[1].member_name)}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  HCP {wwData.sortedBack9[1].playing_handicap}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                                  {wwData.isMedal ? wwData.sortedBack9[1].back9Net ?? "-" : wwData.sortedBack9[1].back9Points}
                                </div>
                                <div className="text-[8px] text-slate-400">{wwData.isMedal ? "net" : "points"}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* 3rd Place */}
                          {wwData.sortedBack9[2] && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                              <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center">
                                <span className="text-sm font-black text-white">3</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {formatMemberName(wwData.sortedBack9[2].member_name)}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  HCP {wwData.sortedBack9[2].playing_handicap}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                                  {wwData.isMedal ? wwData.sortedBack9[2].back9Net ?? "-" : wwData.sortedBack9[2].back9Points}
                                </div>
                                <div className="text-[8px] text-slate-400">{wwData.isMedal ? "net" : "points"}</div>
                              </div>
                            </div>
                          )}
                          
                          {wwData.sortedBack9.length > 3 && (
                            <div className="text-center pt-1">
                              <span className="text-[8px] text-slate-400">
                                +{wwData.sortedBack9.length - 3} more players
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* OVERALL - Top 3 */}
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden bg-white dark:bg-slate-800">
                    <div className="px-3 py-2 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900/50 border-b border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                            OVERALL
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Pool: R{wwData.wwOverallPool}
                          </div>
                          <div className="text-[7px] text-slate-400">
                            {wwData.sortedOverall.length} players
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3">
                      {wwData.sortedOverall.length === 0 ? (
                        <div className="text-center py-6 text-[10px] text-slate-400">
                          No scores recorded yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* 1st Place */}
                          {wwData.sortedOverall[0] && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-md">
                                <span className="text-base font-black text-yellow-900">1</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                                  {formatMemberName(wwData.sortedOverall[0].member_name)}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  HCP {wwData.sortedOverall[0].playing_handicap}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                  {wwData.isMedal ? wwData.sortedOverall[0].totalNet ?? "-" : wwData.sortedOverall[0].totalPoints}
                                </div>
                                <div className="text-[8px] text-slate-400">{wwData.isMedal ? "total net" : "total points"}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* 2nd Place */}
                          {wwData.sortedOverall[1] && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                              <div className="w-9 h-9 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center">
                                <span className="text-sm font-black text-white">2</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {formatMemberName(wwData.sortedOverall[1].member_name)}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  HCP {wwData.sortedOverall[1].playing_handicap}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                                  {wwData.isMedal ? wwData.sortedOverall[1].totalNet ?? "-" : wwData.sortedOverall[1].totalPoints}
                                </div>
                                <div className="text-[8px] text-slate-400">{wwData.isMedal ? "total net" : "total points"}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* 3rd Place */}
                          {wwData.sortedOverall[2] && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                              <div className="w-9 h-9 rounded-full bg-amber-600 flex items-center justify-center">
                                <span className="text-sm font-black text-white">3</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {formatMemberName(wwData.sortedOverall[2].member_name)}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  HCP {wwData.sortedOverall[2].playing_handicap}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                                  {wwData.isMedal ? wwData.sortedOverall[2].totalNet ?? "-" : wwData.sortedOverall[2].totalPoints}
                                </div>
                                <div className="text-[8px] text-slate-400">{wwData.isMedal ? "total net" : "total points"}</div>
                              </div>
                            </div>
                          )}
                          
                          {wwData.sortedOverall.length > 3 && (
                            <div className="text-center pt-1">
                              <span className="text-[8px] text-slate-400">
                                +{wwData.sortedOverall.length - 3} more players
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {/* ── WW PARTICIPANTS ── */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide flex items-center gap-1">
                      <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-[9px]">WW</span>
                      WW Participants
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-slate-500">{wwEntrantsFull.length} entered</div>
                      <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Pool R{wwPoolTotal}</div>
                    </div>
                  </div>
{wwEntrantsFull.length === 0 ? (
  <div className="text-[9px] text-slate-400 italic px-1">No WW entrants yet — players opt in on their pairing card</div>
  ) : (
  <>
  <div className="rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 divide-y divide-blue-50 dark:divide-blue-900/50 overflow-hidden">
  {(showFullWwEntrants ? wwEntrantsFull : wwEntrantsFull.slice(0, 3)).map((m, i) => {
  const liveResult = !isBookingPhase
  ? wwData.wwResults.find(r => r.member_id === m.id)
  : null;
  return (
  <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 min-w-0">
  <span className="text-[9px] text-slate-400 w-4 text-center shrink-0">{i + 1}</span>
  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex-1 break-words min-w-0">{m.name}</span>
  {liveResult ? (
  <span className="text-[9px] text-blue-500 font-medium tabular-nums shrink-0 whitespace-nowrap">{wwData.isMedal ? `Net ${liveResult.totalNet ?? '-'}` : `${liveResult.totalPoints} pts`}</span>
  ) : (
  <span className="text-[9px] text-blue-500 font-medium shrink-0 whitespace-nowrap">R{clubFees.front9 + clubFees.back9 + clubFees.overall}</span>
  )}
  </div>
  );
  })}
  </div>
  {wwEntrantsFull.length > 3 && (
  <button
  onClick={() => setShowFullWwEntrants(!showFullWwEntrants)}
  className="w-full py-1.5 text-[9px] text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
  >
  {showFullWwEntrants ? "Show less" : `Show all ${wwEntrantsFull.length} players`}
  </button>
  )}
  </>
  )}
                </div>

  {/* ── BIRDIE & EAGLE POOL ENTRANTS ── */}
  <div>
  <div className="flex items-center justify-between mb-1.5">
  <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1">
  <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 rounded text-[9px]">B</span>
  Birdie & Eagle Pool
  </div>
  <div className="text-right">
  <div className="text-[9px] text-slate-500">{birdieEntrantsFull.length} entered</div>
  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Pool R{birdiePoolTotal}</div>
  </div>
  </div>
  {!isBookingPhase && (wwData.totalBirdies > 0 || wwData.totalEagles > 0) && (
  <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700">
  {wwData.totalEagles > 0 && (
    <>
      <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold">{wwData.totalEagles} eagle{wwData.totalEagles !== 1 ? "s" : ""}</span>
      <span className="text-[9px] text-slate-400">·</span>
    </>
  )}
  {wwData.totalBirdies > 0 && (
    <span className="text-[9px] text-amber-700 dark:text-amber-300 font-semibold">{wwData.totalBirdies} birdie{wwData.totalBirdies !== 1 ? "s" : ""}</span>
  )}
  <span className="text-[9px] text-slate-400">·</span>
  <span className="text-[9px] font-bold text-emerald-600">R{Math.round(wwData.perBirdie)}/pt</span>
  </div>
  )}
{birdieEntrantsFull.length === 0 ? (
  <div className="text-[9px] text-slate-400 italic px-1">No birdie pool entrants yet</div>
  ) : (
  <>
  <div className="rounded-lg bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-800 divide-y divide-amber-50 dark:divide-amber-900/50 overflow-hidden">
  {(showFullBirdieEntrants ? birdieEntrantsFull : birdieEntrantsFull.slice(0, 3)).map((m, i) => {
  const liveData = !isBookingPhase
  ? wwData.birdieEntrants.find(e => e.member_id === m.id)
  : null;
  const livePayout  = liveData?.payout  ?? 0;
  const liveBirdies = liveData?.actualBirdies ?? 0;
  const liveEagles = liveData?.actualEagles ?? 0;
  return (
  <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 min-w-0">
  <span className="text-[9px] text-slate-400 w-4 text-center shrink-0">{i + 1}</span>
  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex-1 break-words min-w-0">{m.name}</span>
  {!isBookingPhase ? (
  <span className="shrink-0 flex items-center gap-1">
  {liveEagles > 0 && (
  <span className="text-[8px] text-blue-600 dark:text-blue-400 font-medium">{liveEagles}E</span>
  )}
  {liveBirdies > 0 && (
  <span className="text-[8px] text-amber-600 dark:text-amber-400 font-medium">{liveBirdies}B</span>
  )}
  <span className={`text-[9px] font-bold tabular-nums whitespace-nowrap ${livePayout > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
  R{livePayout}
  </span>
  </span>
  ) : (
  <span className="text-[9px] text-amber-600 font-medium shrink-0 whitespace-nowrap">R{activeWwbGame.birdie_pool_fee ?? clubFees.birdie}</span>
  )}
  </div>
  );
  })}
  </div>
  {birdieEntrantsFull.length > 3 && (
  <button
  onClick={() => setShowFullBirdieEntrants(!showFullBirdieEntrants)}
  className="w-full py-1.5 text-[9px] text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-medium"
  >
  {showFullBirdieEntrants ? "Show less" : `Show all ${birdieEntrantsFull.length} players`}
  </button>
  )}
  </>
  )}
                </div>

{isBookingPhase && (
  <p className="text-[8px] text-slate-400 italic text-center">Leaderboard and payouts will appear once the game goes live</p>
  )}
  
  {/* Warning for organizer: opt-ins not in pairings */}
  {hasMismatches && (
  <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md">
  <p className="text-[9px] text-amber-700 dark:text-amber-300 font-medium">
  Warning: {wwbOptInMismatches.length} player(s) opted in but are not in pairings. Consider regenerating pairings.
  </p>
  </div>
                )}

                {/* ── RECENT WINNERS from last completed game ── */}
                {recentCompletedWwbGame && recentCompletedWwbGame.adhoc_game_id !== activeWwbGame.adhoc_game_id && recentWinnersData && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <RecentWinnersSection game={recentCompletedWwbGame} data={recentWinnersData} />
                  </div>
                )}

              </CardContent>
            </Card>
          );
        })()}

        {/* ── WWB HISTORY + CUMULATIVE LEADERBOARD ── */}
        {WWB_CLUB_IDS.includes(myClub?.club_id ?? 0) && wwbHistory.length > 0 && (() => {
          // Compute cumulative leaderboard: count WW wins and birdie wins per member across all history games
          const cumulMap: Record<number, { member_id: number; member_name: string; wwWins: number; birdiePayouts: number; birdieGames: number }> = {};

          const addWin = (id: number | null, name: string | null) => {
            if (!id || !name) return;
            if (!cumulMap[id]) cumulMap[id] = { member_id: id, member_name: name, wwWins: 0, birdiePayouts: 0, birdieGames: 0 };
            cumulMap[id].wwWins += 1;
          };

          wwbHistory.forEach(game => {
            addWin(game.ww_front9_winner_id, game.ww_front9_winner_name);
            addWin(game.ww_back9_winner_id, game.ww_back9_winner_name);
            addWin(game.ww_overall_winner_id, game.ww_overall_winner_name);
            game.birdie_payouts.forEach(bp => {
              if (!cumulMap[bp.member_id]) cumulMap[bp.member_id] = { member_id: bp.member_id, member_name: bp.member_name, wwWins: 0, birdiePayouts: 0, birdieGames: 0 };
              cumulMap[bp.member_id].birdiePayouts += bp.payout_amount;
              cumulMap[bp.member_id].birdieGames += 1;
            });
          });

          const cumulRows = Object.values(cumulMap)
            .filter(r => r.wwWins > 0 || r.birdiePayouts > 0)
            .sort((a, b) => b.wwWins - a.wwWins || b.birdiePayouts - a.birdiePayouts);

          return (
            <>
              {/* Cumulative Leaderboard */}
              {cumulRows.length > 0 && (
                <Card className="border border-blue-200 dark:border-blue-800 shadow-sm">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      WWB Cumulative Leaderboard
                    </CardTitle>
                    <CardDescription className="text-[10px]">Last {wwbHistory.length} games — WW wins &amp; birdie payouts</CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className="rounded-xl border border-blue-100 dark:border-blue-800 overflow-hidden">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-[8px] font-semibold text-slate-500 uppercase tracking-wide">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Player</div>
                        <div className="col-span-3 text-center">WW Wins</div>
                        <div className="col-span-3 text-center">Birdie R</div>
                      </div>
                      {cumulRows.map((row, i) => (
                        <div key={row.member_id} className={`grid grid-cols-12 gap-1 items-center px-3 py-2 text-[10px] border-t border-blue-50 dark:border-blue-900/30 ${i === 0 ? "bg-blue-50/60 dark:bg-blue-900/20 font-bold" : ""}`}>
                          <div className={`col-span-1 text-[8px] font-bold ${i === 0 ? "text-blue-600" : i === 1 ? "text-slate-400" : "text-slate-300"}`}>
                            {i + 1}
                          </div>
                          <div className="col-span-5 truncate text-slate-700 dark:text-slate-200">{formatMemberName(row.member_name)}</div>
                          <div className="col-span-3 text-center">
                            {row.wwWins > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-[9px]">
                                {row.wwWins}
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-300">—</span>
                            )}
                          </div>
                          <div className="col-span-3 text-center">
                            {row.birdiePayouts > 0 ? (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">R{row.birdiePayouts.toFixed(0)}</span>
                            ) : (
                              <span className="text-[9px] text-slate-300">—</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Round-by-round history list */}
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    WWB Results History
                  </CardTitle>
                  <CardDescription className="text-[10px]">Tap a game to see full results</CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {wwbHistory.map(game => {
                    const isExpanded = expandedHistoryGames.has(game.adhoc_game_id);
                    const hasResults = game.ww_front9_winner_id != null || game.ww_back9_winner_id != null || game.ww_overall_winner_id != null || game.birdie_pool_total > 0;
                    return (
                      <div key={game.adhoc_game_id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Row header — always visible */}
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          onClick={() => setExpandedHistoryGames(prev => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(game.adhoc_game_id) : next.add(game.adhoc_game_id);
                            return next;
                          })}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                              {new Date(game.game_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                            </div>
                            <div className="text-[9px] text-slate-400 truncate">{game.course_name}</div>
                          </div>
                          {/* Quick-summary chips */}
                          {game.ww_overall_winner_name && (
                            <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 shrink-0 hidden sm:inline">{game.ww_overall_winner_name}</span>
                          )}
                          {!hasResults && (
                            <span className="text-[8px] italic text-slate-400 shrink-0">No results saved</span>
                          )}
                          <svg className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-3 py-2.5 space-y-2 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/60">
                            {!hasResults ? (
                              <p className="text-[9px] italic text-slate-400">Results not yet recorded for this game.</p>
                            ) : (
                              <>
                                {/* WW Winners */}
                                <div className="space-y-1.5">
                                  {[
                                    { label: "1st 9",   winnerId: game.ww_front9_winner_id,  winnerName: game.ww_front9_winner_name,  pts: game.ww_front9_points  },
                                    { label: "2nd 9",   winnerId: game.ww_back9_winner_id,   winnerName: game.ww_back9_winner_name,   pts: game.ww_back9_points   },
                                    { label: "Overall", winnerId: game.ww_overall_winner_id, winnerName: game.ww_overall_winner_name, pts: game.ww_overall_points },
                                  ].map(({ label, winnerId, winnerName, pts }) => (
                                    <div key={label} className="flex items-center gap-2">
                                      <span className={`text-[8px] font-bold uppercase tracking-wide w-12 shrink-0 ${label === "Overall" ? "text-indigo-600 dark:text-indigo-400" : "text-blue-500"}`}>{label}</span>
                                      <span className={`text-[10px] font-semibold flex-1 ${winnerId ? "text-slate-700 dark:text-slate-200" : "text-slate-400 italic"}`}>
                                        {winnerName ?? "Half — No Winner"}
                                      </span>
                                      {pts != null && winnerId && (
                                        <span className="text-[9px] text-slate-400 shrink-0">{pts} pts</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {/* Birdie payouts */}
                                {game.birdie_pool_total > 0 && (
                                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700">
                                    <div className="text-[8px] font-bold text-amber-600 uppercase tracking-wide mb-1">
                                      Birdie Pool — R{game.birdie_pool_total.toFixed(0)} · {game.birdie_pool_total_birdies} birdie{game.birdie_pool_total_birdies !== 1 ? "s" : ""} · R{game.birdie_pool_per_birdie.toFixed(0)}/birdie
                                    </div>
                                    {game.birdie_payouts.length > 0 ? (
                                      <div className="space-y-1">
                                        {game.birdie_payouts.sort((a, b) => b.payout_amount - a.payout_amount).map(bp => (
                                          <div key={bp.member_id} className="flex items-center gap-1.5">
                                            <svg className="w-2.5 h-2.5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                              <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/>
                                            </svg>
                                            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 flex-1">{formatMemberName(bp.member_name)}</span>
                                            <span className="text-[9px] text-slate-400 shrink-0">{bp.birdies_scored} birdie{bp.birdies_scored !== 1 ? "s" : ""}</span>
                                            <span className="text-[9px] font-bold text-emerald-600 shrink-0">R{bp.payout_amount.toFixed(0)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[9px] italic text-slate-400">No individual birdie payout records saved.</p>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          );
        })()}

        {/* Revenue Generated Card - Club 13 Only (Club 1 / ReMmoho rules projection) */}
        {WWB_CLUB_IDS.includes(myClub?.club_id ?? 0) && (() => {
          // Club 1 rules: R20/birdie, R100/lady, R110 late, R20 eagle per player per eagle made by others
          const BIRDIE_RATE = 20;
          const LADY_RATE = 100;
          const LATE_RATE = 110;
          const EAGLE_RATE = 20;

          // Build per-game revenue from allGamePairings
          const completedGames = allGamePairings
            .reduce((acc, pairing) => {
              const key = pairing.adhoc_game_id;
              if (!acc[key]) {
                const gameInfo = adhocGames.find(g => g.adhoc_game_id === key);
                acc[key] = { gameId: key, gameDate: pairing.game_date, courseName: pairing.course_name, members: [] };
              }
              pairing.members.forEach(m => {
                if (m.gross_score) acc[key].members.push(m);
              });
              return acc;
            }, {} as Record<number, { gameId: number; gameDate: string; courseName: string; members: PairingMember[] }>);

          const gameRevenues = Object.values(completedGames)
            .filter(g => g.members.length > 0)
            .map(g => {
              const totalBirdies = g.members.reduce((s, m) => s + (m.birdies_count || 0), 0);
              const totalEagles = g.members.reduce((s, m) => s + (m.eagles_count || 0), 0);
              const lateCount = g.members.filter(m => m.is_late).length;
              const ladyCount = g.members.reduce((s, m) => s + (m.ladies_count || 0), 0);
              const playerCount = g.members.length;

              // Birdie: each player pays R20 × (total birdies - own birdies)
              const birdieRevenue = g.members.reduce((s, m) => s + BIRDIE_RATE * (totalBirdies - (m.birdies_count || 0)), 0);
              // Eagle: each player pays R20 per eagle made by others
              const eagleRevenue = g.members.reduce((s, m) => s + EAGLE_RATE * (totalEagles - (m.eagles_count || 0)), 0);
              // Late: each late player pays R110
              const lateRevenue = lateCount * LATE_RATE;
              // Lady: each lady is R100
              const ladyRevenue = ladyCount * LADY_RATE;
              const total = birdieRevenue + eagleRevenue + lateRevenue + ladyRevenue;

              return {
                ...g,
                totalBirdies, totalEagles, lateCount, ladyCount, playerCount,
                birdieRevenue, eagleRevenue, lateRevenue, ladyRevenue, total
              };
            })
            .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
            .slice(0, 5);

          const grandTotal = gameRevenues.reduce((s, g) => s + g.total, 0);
          if (gameRevenues.length === 0) return null;

          return (
            <Card className="border border-orange-200 dark:border-orange-800 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Revenue Generated
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Projected revenue if ReMmoho (Club 1) rules applied — R{BIRDIE_RATE}/birdie · R{LADY_RATE}/lady · R{LATE_RATE} late · R{EAGLE_RATE}/eagle
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {gameRevenues.map((g) => (
                  <div key={g.gameId} className="bg-white dark:bg-slate-800 rounded-lg border border-orange-100 dark:border-orange-800 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50 dark:bg-orange-900/30 border-b border-orange-100 dark:border-orange-800">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{g.courseName}</span>
                        <span className="text-[9px] text-slate-400 ml-2">{new Date(g.gameDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span className="text-[8px] text-slate-400 ml-1">({g.playerCount} players)</span>
                      </div>
                      <span className="text-[11px] font-bold text-orange-700 dark:text-orange-300">R{g.total.toFixed(0)}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-0 divide-x divide-orange-100 dark:divide-orange-800">
                      <div className="px-2 py-1.5 text-center">
                        <div className="text-[8px] text-slate-400">Birdies</div>
                        <div className="text-[9px] font-semibold text-slate-700 dark:text-slate-300">R{g.birdieRevenue.toFixed(0)}</div>
                        <div className="text-[7px] text-slate-400">{g.totalBirdies} made</div>
                      </div>
                      <div className="px-2 py-1.5 text-center">
                        <div className="text-[8px] text-slate-400">Ladies</div>
                        <div className="text-[9px] font-semibold text-slate-700 dark:text-slate-300">R{g.ladyRevenue.toFixed(0)}</div>
                        <div className="text-[7px] text-slate-400">{g.ladyCount} made</div>
                      </div>
                      <div className="px-2 py-1.5 text-center">
                        <div className="text-[8px] text-slate-400">Late</div>
                        <div className="text-[9px] font-semibold text-slate-700 dark:text-slate-300">R{g.lateRevenue.toFixed(0)}</div>
                        <div className="text-[7px] text-slate-400">{g.lateCount} late</div>
                      </div>
                      <div className="px-2 py-1.5 text-center">
                        <div className="text-[8px] text-slate-400">Eagles</div>
                        <div className="text-[9px] font-semibold text-slate-700 dark:text-slate-300">R{g.eagleRevenue.toFixed(0)}</div>
                        <div className="text-[7px] text-slate-400">{g.totalEagles} made</div>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Grand total */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-600 text-white mt-1">
                  <span className="text-[10px] font-semibold">Total (last {gameRevenues.length} game{gameRevenues.length !== 1 ? "s" : ""})</span>
                  <span className="text-sm font-bold">R{grandTotal.toFixed(0)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        </div>}

        {/* Recent Games Table — part of Records tab */}
        {activeTab === "records" && <div className="space-y-4">
        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
          <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-semibold font-sans">Recent Games</CardTitle>
            <CardDescription className="text-[10px]">Your latest rounds and performance</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {recentGames && recentGames.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-2 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Date</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Course</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-wide text-slate-500 font-semibold text-center">Points</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-wide text-slate-500 font-semibold text-center">Gross</th>
                      <th className="py-2 px-2 text-[10px] uppercase tracking-wide text-slate-500 font-semibold text-center">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentGames.map((game) => (
                      <tr key={game.record_id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-2 px-2 text-xs">
                          {new Date(game.game_date).toLocaleDateString("en-ZA", {
                            day: "numeric",
                            month: "short"
                          })}
</td>
  <td className="py-2 px-2 text-xs font-medium">
  <div className="flex items-center gap-1.5 flex-wrap">
  <span>{game.courses?.course_name}</span>
  {!game.is_official && (
  <span className="px-1.5 py-0.5 text-[7px] font-bold bg-gray-500 text-white rounded-full shrink-0">
  UNOFFICIAL
  </span>
  )}
  </div>
  </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            game.points >= 36 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                              : game.points >= 30 
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' 
                                : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {game.points}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-xs">
                          {game.gross_score}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            game.medal_game 
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' 
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}>
                            {game.medal_game ? 'Medal' : 'Stableford'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                No games recorded yet. Get out on the course!
              </div>
            )}
          </CardContent>
        </Card>
</div>}
  
  {/* ═══════════════════════════════════════════════
  SHOP TAB
  ═══════════════════════════════════════════════ */}
  {activeTab === "shop" && <ShopTab />}
  
  {/* ═══════════════════════════════════════════════
  TRAVEL TAB
  ═══════════════════════════════════════════════ */}
  {activeTab === "travel" && <TravelTab />}
  
  {/* ═══════════════════════════════════════════════
  CLUB INFORMATION TAB
  ═══════════════════════════════════════════════ */}
        {activeTab === "club" && <div className="space-y-4">

        {/* Golf Clubs */}
        {clubData.length > 0 && (
          <Card className="border border-teal-200 dark:border-teal-800 shadow-sm bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-950">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                Golf Clubs
              </CardTitle>
              <CardDescription className="text-[10px]">Registered clubs and their details</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-2">
                {clubData.map(club => (
                  <div key={club.club_id} className="p-2.5 rounded-lg border border-teal-200 dark:border-teal-700 bg-white dark:bg-slate-800">
                    <div className="flex items-center gap-2.5 mb-2">
                      {club.logo_url && (
                        <img src={club.logo_url} alt={`${club.club_name} Logo`} width={44} height={44} className="rounded-md object-contain flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-teal-800 dark:text-teal-200">{club.club_name}</div>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200 mt-0.5">
                          {memberDirectory.filter(m => m.club_id === club.club_id).length} Members
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {club.primary_contact_name && (
                        <div>
                          <div className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide">Primary Contact</div>
                          <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300">{club.primary_contact_name} {club.primary_contact_surname}</div>
                          {club.primary_contact_number && <div className="text-[9px] text-slate-500">{club.primary_contact_number}</div>}
                          {club.primary_contact_email && <div className="text-[9px] text-blue-500 truncate">{club.primary_contact_email}</div>}
                        </div>
                      )}
                      {club.secondary_contact_name && (
                        <div>
                          <div className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide">Secondary Contact</div>
                          <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300">{club.secondary_contact_name} {club.secondary_contact_surname}</div>
                          {club.secondary_contact_number && <div className="text-[9px] text-slate-500">{club.secondary_contact_number}</div>}
                          {club.secondary_contact_email && <div className="text-[9px] text-blue-500 truncate">{club.secondary_contact_email}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Members List - disabled for all clubs */}
        {false && memberDirectory.length > 0 && (
          <Card className="border border-sky-200 dark:border-sky-800 shadow-sm bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950 dark:to-blue-950">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-2">
                <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Members
              </CardTitle>
              <CardDescription className="text-[10px]">
                {memberDirectory.length} registered members
                {clubData.length > 0 && ` across ${clubData.length} club${clubData.length > 1 ? "s" : ""}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {/* Header */}
              <div className="grid grid-cols-12 gap-1 mb-1.5 px-1.5 text-[8px] font-semibold text-slate-400 uppercase tracking-wide">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Name</div>
                <div className="col-span-3">Contact</div>
                <div className="col-span-3">Club</div>
              </div>
              {/* Members list */}
              <div className="max-h-[300px] overflow-y-auto space-y-0.5">
                {memberDirectory.map((member, idx) => {
                  const club = clubData.find(c => c.club_id === member.club_id);
                  const isMe = member.member_id === memberData?.member_id;
                  const isMemberEditor = memberData && MEMBER_EDITORS.includes(memberData.member_id);
                  const isEditing = editingMember === member.member_id;
                  return (
                    <div key={member.member_id}>
                      <div className={`grid grid-cols-12 gap-1 items-center py-1 px-1.5 rounded text-[10px] ${isMe ? "bg-blue-100 dark:bg-blue-900/40 font-semibold" : idx % 2 === 0 ? "bg-white dark:bg-slate-800/50" : "bg-slate-50 dark:bg-slate-800"}`}>
                        <div className="col-span-1 text-[9px] text-slate-400">{idx + 1}</div>
                        <div className={`${isMemberEditor ? "col-span-4" : "col-span-5"} text-slate-700 dark:text-slate-300 truncate`}>
                          {member.member_name}
                          {isMe && <span className="text-blue-500 ml-1 text-[7px]">YOU</span>}
                        </div>
                        <div className="col-span-3 text-slate-500 dark:text-slate-400 truncate text-[9px]">
                          {member.contact_number || "-"}
                        </div>
                        <div className="col-span-3 text-[8px] text-teal-600 dark:text-teal-400 truncate">
                          {club?.club_name?.replace(" Golf Club", "") || "-"}
                        </div>
                        {isMemberEditor && (
                          <div className="col-span-1 text-center">
                            <button
                              onClick={() => {
                                if (isEditing) { setEditingMember(null); }
                                else { setEditingMember(member.member_id); setEditMemberName(member.member_name); setEditMemberContact(member.contact_number || ""); }
                              }}
                              className="text-[8px] text-blue-500 hover:text-blue-700 font-semibold"
                            >
                              {isEditing ? "X" : "Edit"}
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing && (
                        <div className="mx-1.5 mb-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="text-[8px] text-slate-500 font-medium block mb-0.5">Name</label>
                              <input type="text" value={editMemberName} onChange={(e) => setEditMemberName(e.target.value)} className="w-full text-[10px] p-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" />
                            </div>
                            <div className="flex-1">
                              <label className="text-[8px] text-slate-500 font-medium block mb-0.5">Contact</label>
                              <input type="tel" value={editMemberContact} onChange={(e) => setEditMemberContact(e.target.value)} className="w-full text-[10px] p-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" />
                            </div>
                            <div className="flex-1">
                              <label className="text-[8px] text-slate-500 font-medium block mb-0.5">Gender</label>
                              <div className="flex gap-2">
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`gender_${member.member_id}`}
                                    checked={editGender === 'male'}
                                    onChange={() => setEditGender('male')}
                                    className="w-3 h-3"
                                  />
                                  <span className="text-[9px]">Male</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`gender_${member.member_id}`}
                                    checked={editGender === 'female'}
                                    onChange={() => setEditGender('female')}
                                    className="w-3 h-3"
                                  />
                                  <span className="text-[9px]">Female</span>
                                </label>
                              </div>
                            </div>
                            <Button size="sm" className="h-6 text-[9px] px-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleSaveMemberEdit(member.member_id)} disabled={savingMember}>
                              {savingMember ? "..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        </div>}

{/* ═══════════════════════════════════════════════
  MANAGE TAB (Admin only)
  ═══════════════════════════════════════════════ */}
{activeTab === "manage" && <div className="space-y-4">

  {/* WhatsApp Import - only for Club 13 (WSOE) admins */}
  {myClub?.club_id === CLUB13_ID && isClub13Admin && (
    <WhatsAppImport 
      gameId={liveScoreGameInfo?.adhoc_game_id ?? adhocGames.find(g => g.status === "open" || g.status === "live")?.adhoc_game_id ?? null} 
      onSuccess={() => {
        handleSilentRefresh();
        setActiveTab("play");
      }} 
    />
  )}
  
  {/* Manage Finances - Elias (9) & Sydney (36) only */}
        {isFinanceAdmin && (
          <Card className="border border-indigo-200 dark:border-indigo-800 shadow-sm bg-white dark:bg-slate-800">
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Manage Finances
                </CardTitle>
                <Button
                  size="sm"
                  variant={showFinanceAdmin ? "secondary" : "outline"}
                  className="text-[10px] h-6 px-2"
                  onClick={() => setShowFinanceAdmin(!showFinanceAdmin)}
                >
                  {showFinanceAdmin ? "Close" : "Open"}
                </Button>
              </div>
              <CardDescription className="text-[10px]">Add debits and credits to member accounts</CardDescription>
            </CardHeader>
            {showFinanceAdmin && (
              <CardContent className="px-3 pb-3">
                <div className="space-y-3">
                  {/* Member Select */}
                  <div>
                    <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Member</label>
                    <select
                      value={finMemberId}
                      onChange={e => setFinMemberId(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="">Select member...</option>
                      {memberDirectory.map(m => (
                        <option key={m.member_id} value={m.member_id}>{m.member_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Debit/Credit Toggle */}
                  <div>
                    <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Type</label>
                    <div className="flex rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
                      <button
                        className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors ${finType === "debit" ? "bg-red-500 text-white" : "bg-white dark:bg-slate-800 text-slate-500"}`}
                        onClick={() => setFinType("debit")}
                      >
                        Debit (Charge)
                      </button>
                      <button
                        className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors ${finType === "credit" ? "bg-emerald-500 text-white" : "bg-white dark:bg-slate-800 text-slate-500"}`}
                        onClick={() => setFinType("credit")}
                      >
                        Credit (Payment)
                      </button>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Amount (R)</label>
                    <input
                      type="number"
                      value={finAmount}
                      onChange={e => setFinAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Category</label>
                    <select
                      value={finCategory}
                      onChange={e => setFinCategory(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="">Select category...</option>
                      {accountCategories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                      {finCategory === "Other" ? "New Category Name (required)" : "Description (optional)"}
                    </label>
                    <input
                      type="text"
                      value={finDescription}
                      onChange={e => setFinDescription(e.target.value)}
                      placeholder={finCategory === "Other" ? "e.g. Waterkloof - Greenfee" : "Additional details..."}
                      className={`w-full px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${finCategory === "Other" ? "border-indigo-300 dark:border-indigo-600 ring-1 ring-indigo-200" : "border-slate-200 dark:border-slate-700"}`}
                    />
                    {finCategory === "Other" && (
                      <div className="text-[8px] text-indigo-500 mt-0.5">This will be saved as a new category for future use.</div>
                    )}
                  </div>

                  {/* Date */}
                  <div>
                    <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Date</label>
                    <input
                      type="date"
                      value={finDate}
                      onChange={e => setFinDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  {/* Submit */}
                  <Button
                    className={`w-full h-8 text-xs font-semibold ${finType === "debit" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white`}
                    onClick={handleFinanceSubmit}
                    disabled={finSaving || !finMemberId || !finAmount || !finCategory || (finCategory === "Other" && !finDescription.trim())}
                  >
                    {finSaving ? "Processing..." : `Add ${finType === "debit" ? "Debit" : "Credit"}`}
                  </Button>

                  {/* Success message */}
                  {finSuccess && (
                    <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-[10px] text-emerald-700 dark:text-emerald-300">
                      {finSuccess}
                    </div>
                  )}

                  {/* Recent entries log */}
                  {finRecentEntries.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Recent Entries This Session</div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {finRecentEntries.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[9px] py-1 border-b border-slate-100 dark:border-slate-700 last:border-0">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-700 dark:text-slate-300 truncate">{formatMemberName(entry.member_name)}</div>
                              <div className="text-slate-400 truncate">{entry.description}</div>
                            </div>
                            <div className="text-right ml-2">
                              <div className={`font-bold ${entry.debit > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                {entry.debit > 0 ? `+R${entry.debit.toFixed(0)}` : `-R${entry.credit.toFixed(0)}`}
                              </div>
                              <div className="text-[7px] text-slate-400">Bal: R{entry.balance.toFixed(2)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Handicap Index Admin - Tebele (37) & Elias (9) only */}
        {isHcpAdmin && (
          <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  {myClub?.club_id === 4 ? "Manage Playing Handicaps" : "Manage Handicap Indices"}
                </CardTitle>
                <Button
                  size="sm"
                  variant={showHcpAdmin ? "secondary" : "outline"}
                  className="text-[10px] h-6 px-2"
                  onClick={() => {
                    if (!showHcpAdmin) {
                      loadHcpMembers();
                    }
                    setShowHcpAdmin(!showHcpAdmin);
                  }}
                >
                  {showHcpAdmin ? "Close" : "Open"}
                </Button>
              </div>
              <CardDescription className="text-[10px]">
                {myClub?.club_id === 4
                  ? "Update Playing Handicap for members — saves instantly to database"
                  : `Update ${myClub?.club_name ? myClub.club_name.replace(" Golf Club", "") : "Club"} and HNA Official handicap indices for all members`}
              </CardDescription>
            </CardHeader>
            {showHcpAdmin && (
              <CardContent className="px-3 pb-3">
                {hcpLoading ? (
                  <div className="text-center py-4 text-xs text-slate-500">Loading members...</div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder="Search members..."
                        value={hcpSearch}
                        onChange={(e) => setHcpSearch(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>

                    {/* Header */}
                    <div className="grid grid-cols-12 gap-1 mb-1 px-1 text-[9px] font-semibold text-slate-500 uppercase">
                      <div className="col-span-4">Member</div>
                      <div className="col-span-2 text-center">Previous</div>
                      <div className="col-span-3 text-center">{myClub?.club_id === 4 ? "Playing HCP" : (myClub?.club_name ? myClub.club_name.replace(" Golf Club", "") : "Club")}</div>
                      <div className="col-span-3 text-center">{myClub?.club_id === 4 ? "Status" : "HNA Official"}</div>
                    </div>

                    {/* Members list */}
                    {/* Permissions: Diale Diale (member_id=54) can edit Club index for all; Members can edit their own HNA Official */}
                    <div className="max-h-[400px] overflow-y-auto space-y-0.5">
                      {hcpAllMembers
                        .filter(m => !hcpSearch || m.member_name.toLowerCase().includes(hcpSearch.toLowerCase()))
                        .map(member => {
                          const edit = hcpEdits[member.member_id] || { remmoho: "", official: "" };
                          const remmohoChanged = edit.remmoho !== (member.remmoho_handicap_index?.toFixed(1) ?? "");
                          const officialChanged = edit.official !== (member.official_handicap_index?.toFixed(1) ?? "");
                          // Club 4: Elias Diale (54) and Sepeke Manamela (53) can edit playing handicap
                          // Club 1 (and all others): Elias (9), Tebele (37), Diale Diale (54) can edit
                          const isClub4Admin = myClub?.club_id === 4 && [53, 54].includes(memberData?.member_id ?? 0);
                          const isClub1Admin = myClub?.club_id !== 4 && [9, 37, 54].includes(memberData?.member_id ?? 0);
                          const isOwnRecord = memberData?.member_id === member.member_id;
                          const canEditClubIndex = myClub?.club_id === 4 ? isClub4Admin : isClub1Admin;
                          const canEditOfficialIndex = myClub?.club_id === 4 ? isClub4Admin : (isClub1Admin || isOwnRecord);

                          // Instant save for Club 4
                          const saveInstant = async (field: "remmoho" | "official", value: string) => {
                            if (myClub?.club_id !== 4) return;
                            const parsed = value ? parseFloat(value) : null;
                            const supabase = createClient();
                            const updateData: Record<string, unknown> = {};
                            if (field === "remmoho") {
                              updateData.previous_handicap_index = member.remmoho_handicap_index;
                              updateData.remmoho_handicap_index = parsed;
                              updateData.official_handicap_index = parsed; // keep in sync for Club 4
                            }
                            const { error } = await supabase
                              .from("member_handicap_indices")
                              .update(updateData)
                              .eq("member_id", member.member_id);
                            if (error) {
                              alert("Failed to save. Please try again.");
                              return;
                            }
                            // Refresh admin list and, if this is the logged-in member, the profile card
                            await loadHcpMembers();
                            if (member.member_id === memberData?.member_id) await refreshMemberHandicap();
                          };
                          return (
                            <div key={member.member_id} className={`grid grid-cols-12 gap-1 items-center py-1 px-1 rounded ${(remmohoChanged || officialChanged) ? "bg-emerald-50 dark:bg-emerald-950/30" : isOwnRecord ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                              <div className="col-span-4 text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                                {formatMemberName(member.member_name)} {isOwnRecord && <span className="text-blue-500">(You)</span>}
                              </div>
                              <div className="col-span-2 text-center text-[10px] text-slate-400">
                                {member.previous_handicap_index?.toFixed(1) ?? "-"}
                              </div>
                              <div className="col-span-3">
                                {canEditClubIndex ? (
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={edit.remmoho}
                                    onChange={(e) => setHcpEdits(prev => ({ ...prev, [member.member_id]: { ...prev[member.member_id], remmoho: e.target.value } }))}
                                    onBlur={(e) => saveInstant("remmoho", e.target.value)}
                                    className={`w-full px-1.5 py-1 text-[10px] text-center border rounded ${remmohoChanged ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950 font-semibold" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}
                                    placeholder="N/A"
                                  />
                                ) : (
                                  <div className="w-full px-1.5 py-1 text-[10px] text-center text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded">
                                    {member.remmoho_handicap_index?.toFixed(1) ?? "-"}
                                  </div>
                                )}
                              </div>
                              <div className="col-span-3">
                                {myClub?.club_id === 4 ? (
                                  // For Club 4, show a read-only "saved" indicator instead of HNA field
                                  <div className={`w-full px-1.5 py-1 text-[10px] text-center rounded font-medium ${remmohoChanged ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                                    {remmohoChanged ? "Unsaved" : "Saved"}
                                  </div>
                                ) : canEditOfficialIndex ? (
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={edit.official}
                                    onChange={(e) => setHcpEdits(prev => ({ ...prev, [member.member_id]: { ...prev[member.member_id], official: e.target.value } }))}
                                    className={`w-full px-1.5 py-1 text-[10px] text-center border rounded ${officialChanged ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950 font-semibold" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}
                                    placeholder="N/A"
                                  />
                                ) : (
                                  <div className="w-full px-1.5 py-1 text-[10px] text-center text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded">
                                    {member.official_handicap_index?.toFixed(1) ?? "-"}
                                  </div>
                                )
                                }
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Save button - hidden for Club 4 (instant save on blur) */}
                    {myClub?.club_id !== 4 && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          className="text-xs h-7 px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={saveHcpChanges}
                          disabled={hcpSaving}
                        >
                          {hcpSaving ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    )}
                    {myClub?.club_id === 4 && (
                      <p className="mt-3 text-[10px] text-emerald-600 text-right font-medium">
                        Changes save automatically when you leave a field
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            )}
          </Card>
        )}

{/* Admin: Reset Member PIN - Available to Club Admins + Super Admins */}
  {(() => {
  // Use dynamic isClubAdmin check plus specific super admins
  const canResetPins = isClubAdmin || ELIAS_IDS.includes(memberData?.member_id ?? 0) || [37, 53].includes(memberData?.member_id ?? 0);
  
  return canResetPins && (
    <Card className="border border-rose-200 dark:border-rose-800 shadow-sm bg-white dark:bg-slate-800">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          Reset Member PIN
        </CardTitle>
        <CardDescription className="text-[10px]">
          Clear a member&apos;s PIN so they can log in with their contact number and set a new PIN.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2.5">
        <div>
          <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Select Member</label>
          <select
            value={pinResetMemberId}
            onChange={e => { setPinResetMemberId(e.target.value); setPinResetMsg(null); }}
            className="w-full px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
          >
            <option value="">Select member...</option>
            {memberDirectory.map(m => (
              <option key={m.member_id} value={m.member_id}>{m.member_name}</option>
            ))}
          </select>
        </div>

        {pinResetMsg && (
          <div className={`p-2 rounded-md border text-[10px] ${
            pinResetMsg.startsWith("PIN reset") 
              ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 text-emerald-700" 
              : "bg-red-50 dark:bg-red-950 border-red-200 text-red-600"
          }`}>
            {pinResetMsg}
          </div>
        )}

        <Button
          className="w-full h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
          disabled={!pinResetMemberId || pinResetLoading}
          onClick={async () => {
            if (!pinResetMemberId || !memberData) return;
            setPinResetLoading(true);
            setPinResetMsg(null);
            const result = await adminResetMemberPin(memberData.member_id, Number(pinResetMemberId));
            setPinResetLoading(false);
            if (result.error) {
              setPinResetMsg(result.error);
            } else {
              const name = memberDirectory.find(m => m.member_id === Number(pinResetMemberId))?.member_name ?? "Member";
              setPinResetMsg(`PIN reset for ${name}. They can now log in with their contact number.`);
              setPinResetMemberId("");
            }
          }}
        >
          {pinResetLoading ? "Resetting..." : "Reset PIN"}
        </Button>
      </CardContent>
    </Card>
  );
})()}

        </div>}

      {/* Hole-by-Hole Score Viewer Modal — rendered at root so it works from any tab */}
      {scoreViewerPlayer && (() => {
        const hcp = scoreViewerPlayer.playing_handicap;
        const holes = courseHoles.length > 0
          ? courseHoles
          : Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, stroke_index: i + 1 }));

        let totalGross = 0, totalNet = 0, totalPoints = 0, totalPar = 0;
        const front9 = holes.filter(h => h.hole_number <= 9);
        const back9  = holes.filter(h => h.hole_number >= 10);

  // Helper to calculate handicap strokes with gender support
  const getHcpStrokes = (handicap: number, strokeIndex: number, gender?: string, ladiesSI?: number): number => {
    if (!handicap || handicap <= 0) return 0;
    
    // Use ladies SI if player is female and ladies SI exists
    const effectiveSI = (gender === 'female' && ladiesSI) ? ladiesSI : strokeIndex;
    
    const handicapInt = Math.floor(handicap);
    let totalStrokes = Math.floor(handicapInt / 18);
    const remaining = handicapInt % 18;
    if (remaining > 0 && effectiveSI <= remaining) {
      totalStrokes++;
    }
    return totalStrokes;
  };

        // Get player gender for ladies SI lookup
        const playerMember = memberDirectory.find(m => m.member_name === scoreViewerPlayer?.member_name);
        const playerGender = playerMember?.gender;
        const game = adhocGames.find(g => g.adhoc_game_id === scorecardGameId);
        const courseId = game?.course_id;

        const scoreRows = holes.map(hole => {
          const strokes = scoreViewerHoles[hole.hole_number] ?? null;
          const ladiesSI = courseId ? ladiesStrokeMap[courseId]?.[hole.hole_number] : undefined;
          const hcpStrokes = strokes !== null ? getHcpStrokes(hcp, hole.stroke_index, playerGender, ladiesSI) : 0;
          const net = strokes !== null ? strokes - hcpStrokes : null;
          const cappedNet = net !== null ? Math.min(net, hole.par + 2) : null;
          const pts = cappedNet !== null ? Math.max(0, 2 + hole.par - cappedNet) : null;
          
          if (strokes !== null) { 
            totalGross += strokes; 
            totalPar += hole.par;
            if (net !== null) totalNet += net;
            if (pts !== null) totalPoints += pts;
          }
          
          return { ...hole, strokes, net, pts };
        });

        const front9Gross = front9.reduce((s, h) => s + (scoreViewerHoles[h.hole_number] ?? 0), 0);
        const back9Gross  = back9.reduce((s, h) => s + (scoreViewerHoles[h.hole_number] ?? 0), 0);
        const front9Points = scoreRows.filter(r => r.hole_number <= 9).reduce((s, r)  => s + (r.pts ?? 0), 0);
        const back9Points  = scoreRows.filter(r => r.hole_number >= 10).reduce((s, r) => s + (r.pts ?? 0), 0);
        
        // Calculate front 9 net total
        let front9NetTotal = 0;
        for (const r of scoreRows.filter(r => r.hole_number <= 9)) {
          if (r.strokes !== null) {
            const hcpStrokes = getHcpStrokes(hcp, r.stroke_index);
            front9NetTotal += r.strokes - hcpStrokes;
          }
        }
        
        // Calculate back 9 net total
        let back9NetTotal = 0;
        for (const r of scoreRows.filter(r => r.hole_number >= 10)) {
          if (r.strokes !== null) {
            const hcpStrokes = getHcpStrokes(hcp, r.stroke_index);
            back9NetTotal += r.strokes - hcpStrokes;
          }
        }

        // Compact score cell — small coloured indicator
        const ScoreCell = ({ strokes, par }: { strokes: number | null; par: number; pts: number | null }) => {
          if (strokes === null) return <td className="text-center py-0.5 px-0 text-[8px] text-slate-300 w-6">-</td>;
          const diff = par - strokes;
          const bg = diff >= 2 ? "bg-yellow-300 text-yellow-900"
            : diff === 1 ? "bg-red-500 text-white rounded-full"
            : diff === -1 ? "border border-slate-400 text-slate-700"
            : diff <= -2 ? "border-2 border-slate-400 text-slate-700"
            : "text-slate-700";
          return (
            <td className="text-center py-0.5 px-0 w-6">
              <span className={`inline-flex items-center justify-center w-5 h-5 text-[9px] font-bold ${bg}`}>{strokes}</span>
            </td>
          );
        };

        const HalfTable = ({ rows, subtotalGross, subtotalNet, subtotalPts, label }: {
          rows: typeof scoreRows; subtotalGross: number; subtotalNet: number; subtotalPts: number; label: string;
        }) => (
          <div className="overflow-x-auto">
            <table className="w-full text-[7px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "28px" }} />
                {rows.map(h => <col key={h.hole_number} style={{ width: "22px" }} />)}
                <col style={{ width: "24px" }} />
              </colgroup>
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <td className="py-0.5 font-semibold text-slate-500">{label}</td>
                  {rows.map(h => <td key={h.hole_number} className="text-center py-0.5 font-semibold">{h.hole_number}</td>)}
                  <td className="text-center py-0.5 font-bold text-slate-500">{label === "OUT" ? "OUT" : "IN"}</td>
                </tr>
                <tr className="text-slate-400">
                  <td className="py-0.5 text-slate-400">Par</td>
                  {rows.map(h => <td key={h.hole_number} className="text-center py-0.5">{h.par}</td>)}
                  <td className="text-center py-0.5 font-semibold text-slate-500">{rows.reduce((s, h) => s + h.par, 0)}</td>
                </tr>
                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <td className="py-0.5 text-slate-400">SI</td>
                  {rows.map(h => {
                    const isFemale = scoreViewerPlayer?.member_name && 
                      memberDirectory.find(m => m.member_name === scoreViewerPlayer.member_name)?.gender === 'female';
                    const ladiesSI = isFemale && courseId && ladiesStrokeMap[courseId]?.[h.hole_number];
                    const displaySI = ladiesSI || h.stroke_index;
                    return (
                      <td key={h.hole_number} className="text-center py-0.5">
                        <span className={ladiesSI ? "text-pink-600 font-semibold" : ""}>
                          {displaySI}
                        </span>
                      </td>
                    );
                  })}
                  <td></td>
                </tr>
              </thead>
              <tbody>
                {/* Gross row */}
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <td className="text-[8px] text-slate-600 dark:text-slate-300 font-semibold py-0.5">Grs</td>
                  {rows.map(r => <ScoreCell key={r.hole_number} strokes={r.strokes} par={r.par} pts={r.pts} />)}
                  <td className="text-center text-[9px] font-bold text-slate-700 dark:text-slate-200">{subtotalGross || "-"}</td>
                </tr>
                {/* Net row */}
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <td className="text-[8px] text-blue-600 dark:text-blue-400 font-semibold py-0.5">Net</td>
                  {rows.map(r => {
                    if (r.strokes === null) {
                      return <td key={r.hole_number} className="text-center py-0.5 px-0"><span className="text-[8px] text-slate-300">-</span></td>;
                    }
                    const hcpStrokes = getHcpStrokes(hcp, r.stroke_index);
                    const netScore = r.strokes - hcpStrokes;
                    return (
                      <td key={r.hole_number} className="text-center py-0.5 px-0">
                        <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400">{netScore}</span>
                      </td>
                    );
                  })}
                  <td className="text-center text-[9px] font-bold text-blue-600 dark:text-blue-400">{subtotalNet || "-"}</td>
                </tr>
                {/* Points row */}
                <tr>
                  <td className="text-[8px] text-indigo-500 font-semibold py-0.5">Pts</td>
                  {rows.map(r => (
                    <td key={r.hole_number} className="text-center py-0.5 text-[8px] text-indigo-600 dark:text-indigo-400 font-semibold">{r.pts ?? "-"}</td>
                  ))}
                  <td className="text-center text-[9px] font-bold text-indigo-600 dark:text-indigo-400">{subtotalPts}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );

        return (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setScoreViewerPlayer(null)}>
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="px-3 py-2 bg-indigo-600 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">{formatMemberName(scoreViewerPlayer.member_name)}</h3>
                  <p className="text-[10px] text-indigo-200">HCP {hcp} · Hole by Hole</p>
                </div>
                <button onClick={() => setScoreViewerPlayer(null)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              {scoreViewerLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-400">Loading scores...</div>
              ) : (
                <div className="overflow-y-auto flex-1 px-2 py-2 space-y-2">

                  {/* Legend — single compact row */}
                  <div className="flex items-center gap-2 text-[8px] text-slate-500">
                    <span className="flex items-center gap-0.5"><span className="inline-flex w-4 h-4 bg-yellow-300 text-yellow-900 items-center justify-center font-bold text-[7px] rounded-sm">2</span>Eagle</span>
                    <span className="flex items-center gap-0.5"><span className="inline-flex w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center font-bold text-[7px]">3</span>Birdie</span>
                    <span className="flex items-center gap-0.5"><span className="inline-flex w-4 h-4 items-center justify-center font-bold text-[7px] text-slate-600">4</span>Par</span>
                    <span className="flex items-center gap-0.5"><span className="inline-flex w-4 h-4 border border-slate-400 items-center justify-center font-bold text-[7px] text-slate-600">5</span>Bogey</span>
                    <span className="flex items-center gap-0.5"><span className="inline-flex w-4 h-4 border-2 border-slate-400 items-center justify-center font-bold text-[7px] text-slate-600">6</span>Dbl+</span>
                  </div>

                  {/* Front 9 */}
                  <div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Front 9</div>
                    <HalfTable rows={scoreRows.filter(r => r.hole_number <= 9)} subtotalGross={front9Gross} subtotalNet={front9NetTotal} subtotalPts={front9Points} label="OUT" />
                  </div>

                  {/* Back 9 */}
                  <div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Back 9</div>
                    <HalfTable rows={scoreRows.filter(r => r.hole_number >= 10)} subtotalGross={back9Gross} subtotalNet={back9NetTotal} subtotalPts={back9Points} label="IN" />
                  </div>

                  {/* Totals */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                    {[
                      { label: "Gross",  value: totalGross  || "-" },
                      { label: "Net",    value: totalNet    || "-" },
                      { label: "Points", value: totalPoints },
                      { label: "HCP",    value: hcp },
                    ].map(item => (
                      <div key={item.label} className="text-center bg-slate-50 dark:bg-slate-800 rounded py-1.5">
                        <div className="text-[7px] text-slate-400 uppercase tracking-wide">{item.label}</div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── PART 1: Captain Verify & Finalise dialogs ── */}
      {finalizeFlow && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { if (!finalizing) setFinalizeFlow(null); }}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

            {finalizeFlow.step === "incomplete" && (
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" /></svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Cannot finalise results</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">All players must complete their scores first. The following players have incomplete scores:</p>
                <div className="space-y-1 mb-4 max-h-44 overflow-y-auto">
                  {finalizeFlow.incomplete.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{p.name}</span>
                      <span className="text-amber-600 dark:text-amber-400 text-xs">{p.missing} hole{p.missing === 1 ? "" : "s"} missing</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9 text-sm" disabled={finalizing} onClick={() => setFinalizeFlow(null)}>Cancel</Button>
                  <Button className="flex-1 h-9 text-sm bg-amber-600 hover:bg-amber-700 text-white" disabled={finalizing} onClick={() => setFinalizeFlow(prev => prev ? { ...prev, step: "confirm" } : prev)}>Submit Anyway</Button>
                </div>
              </div>
            )}

            {finalizeFlow.step === "confirm" && (
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">All scores verified</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Finalise results now? This will process scores for all players in your group and cannot be undone.</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9 text-sm" disabled={finalizing} onClick={() => setFinalizeFlow(null)}>Cancel</Button>
                  <Button className="flex-1 h-9 text-sm bg-green-600 hover:bg-green-700 text-white" disabled={finalizing} onClick={confirmCaptainFinalize}>{finalizing ? "Finalising..." : "Confirm Finalise"}</Button>
                </div>
              </div>
            )}

            {finalizeFlow.step === "success" && (
              <div className="p-5 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">Results finalised successfully!</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Redirecting to the Play tab to review the results...</p>
                <Button
                  className="w-full h-9 text-sm bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    const gid = finalizeFlow.gameId;
                    setFinalizeFlow(null);
                    setShowScorecard(false);
                    if (gid) router.push(`/dashboard?gameId=${gid}`);
                    setActiveTab("play");
                  }}
                >
                  Go to Play tab
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PART 2: Login game notification popup ── */}
      {gameNotification && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setGameNotification(null)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`px-5 py-3 ${gameNotification.kind === "active" ? "bg-[#1a3a2a]" : "bg-indigo-600"}`}>
              <h3 className="text-sm font-bold text-white">{gameNotification.kind === "active" ? "You have a game!" : "Recent game result"}</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-700 dark:text-slate-200 mb-4">{gameNotification.message}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setGameNotification(null)}>Dismiss</Button>
                <Button
                  className={`flex-1 h-9 text-sm text-white ${gameNotification.kind === "active" ? "bg-[#1a3a2a] hover:bg-[#0f2318]" : "bg-indigo-600 hover:bg-indigo-700"}`}
                  onClick={() => {
                    const gid = gameNotification.gameId;
                    setGameNotification(null);
                    if (gameNotification.kind === "active") {
                      const g = adhocGames.find(x => x.adhoc_game_id === gid);
                      if (g) {
                        setLiveScoreGameInfo({
                          course_name: g.course_name,
                          game_date: g.game_date,
                          adhoc_game_id: g.adhoc_game_id,
                          course_id: g.course_id,
                          format: g.game_type || "Stableford",
                          tee_off_time: g.tee_off_time,
                          game_visibility: g.game_visibility,
                          club_id: g.club_id ?? undefined,
                        });
                        setShowScorecard(true);
                      }
                      setActiveTab("live");
                    } else {
                      router.push(`/dashboard?gameId=${gid}`);
                      setActiveTab("play");
                    }
                  }}
                >
                  {gameNotification.kind === "active" ? "Start Scoring" : "View Results"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
    </ErrorBoundary>
  );
}
