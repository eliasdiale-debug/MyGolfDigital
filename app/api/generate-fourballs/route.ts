import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Helper: split players into groups preferring 4s, then 3s (never 5s)
function splitIntoGroups<T extends { member_id: number | null; guest_id: number | null }>(players: T[]): T[][] {
  const n = players.length;
  if (n <= 4) return [players];

  // Calculate optimal split: use as many 4-balls as possible, 
  // with 3-balls to handle the remainder (never 5-balls)
  // n = 4a + 3b where a = number of 4-balls, b = number of 3-balls
  const remainder = n % 4;
  let numFours: number;
  let numThrees: number;

  if (remainder === 0) {
    numFours = n / 4;
    numThrees = 0;
  } else if (remainder === 1) {
    // e.g. 5 players: 1x3 + (skip) doesn't work, need special handling
    // 5 = 1x4 + 1x1? No. 5 = 0x4 + 1x3 + 1x2? Better: treat as one 3-ball + one 2-ball
    // Actually: n=5 => 1 four + 1 one? No. Better: convert one 4 into a 3: (a-1) fours + (b) threes
    // 4*(a-1) + 3*b = n, where 4*a = n-1 => doesn't work simply
    // Formula: remainder 1 means we need one less 4-ball and one more set of 3s
    // n = 4(a-1) + 3*b + 4 - 4 + 1 => not clean. Let's just compute:
    // remainder 1: convert one 4-ball into a 3-ball, leaving one extra player for another 3-ball
    // So: (floor(n/4) - 1) fours + (1+1) = 2 threes? Check: 4*(a-1) + 3*2 = 4a - 4 + 6 = 4a + 2
    // That's n+1, wrong. Let me think differently:
    // remainder 1: we need 4*a + 3*b = n, with a = (n-3b)/4
    // b=0: n%4=1, no. b=1: (n-3)%4=? (n-3) must be div by 4. n%4=1 => (n-3)%4=2, no. 
    // b=2: (n-6)%4=? n%4=1 => (n-6)%4=3, no. b=3: (n-9)%4=0 when n%4=1? (n-9)%4 = (1-1)%4=0, yes!
    // So for remainder 1: numThrees = 3, numFours = (n - 9) / 4
    // But this only works if n >= 9. For n=5: just do one 3-ball + one 2-ball
    if (n >= 9) {
      numThrees = 3;
      numFours = (n - 9) / 4;
    } else {
      // n=5: one 3 + one 2
      numThrees = 1;
      numFours = 0;
    }
  } else if (remainder === 2) {
    // e.g. 6 = 0x4 + 2x3, or 10 = 1x4 + 2x3
    numThrees = 2;
    numFours = (n - 6) / 4;
  } else {
    // remainder === 3: e.g. 7 = 1x4 + 1x3, 11 = 2x4 + 1x3
    numThrees = 1;
    numFours = (n - 3) / 4;
  }

  const groups: T[][] = [];
  let idx = 0;
  for (let g = 0; g < numFours; g++) {
    groups.push(players.slice(idx, idx + 4));
    idx += 4;
  }
  for (let g = 0; g < numThrees; g++) {
    const size = idx + 3 <= n ? 3 : n - idx;
    groups.push(players.slice(idx, idx + size));
    idx += size;
  }
  // Handle any remaining players (e.g. n=5 case with 2 leftover)
  if (idx < n) {
    groups.push(players.slice(idx));
  }

  return groups;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { adhocGameId, teeStart } = await request.json();

  if (!adhocGameId) {
    return NextResponse.json({ error: "Missing adhocGameId" }, { status: 400 });
  }

  // Get game details including tee_off_time and tee_start for staggered start times
  const { data: gameData, error: gameError } = await supabase
    .from("adhoc_games")
    .select("course_id, club_id, tee_off_time, tee_start")
    .eq("adhoc_game_id", adhocGameId)
    .single();

  if (gameError || !gameData) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Get all confirmed bookings for this game
  const { data: bookings, error: bookingsError } = await supabase
    .from("adhoc_game_bookings")
    .select("member_id, guest_id")
    .eq("adhoc_game_id", adhocGameId)
    .eq("booking_status", "confirmed");

  if (bookingsError || !bookings || bookings.length < 2) {
    return NextResponse.json({ error: "Need at least 2 confirmed players" }, { status: 400 });
  }

  // Fetch handicap indices for members (current season)
  const memberIds = bookings.filter(b => b.member_id).map(b => b.member_id);
  let handicapMap: Record<number, number | null> = {};
  let memberClubMap: Record<number, number> = {};

  if (memberIds.length > 0) {
    const { data: handicaps } = await supabase
      .from("member_handicap_indices")
      .select("member_id, official_handicap_index")
      .eq("season", String(new Date().getFullYear()))
      .in("member_id", memberIds);

    if (handicaps) {
      handicaps.forEach(h => {
        handicapMap[h.member_id] = h.official_handicap_index;
      });
    }

    // Fetch club IDs for members
    const { data: members } = await supabase
      .from("members")
      .select("member_id, club_id")
      .in("member_id", memberIds);

    if (members) {
      members.forEach(m => {
        memberClubMap[m.member_id] = m.club_id;
      });
    }
  }

  // Fetch course details
  const { data: courseData } = await supabase
    .from("courses")
    .select("course_rating, slope_rating, par")
    .eq("course_id", gameData.course_id)
    .single();

  // Helper function to calculate course handicap
  const calculateCourseHandicap = (handicapIndex: number | null | undefined, clubId: number): number | null => {
    // handicapIndex null/undefined means no record — return null so the dashboard can show "-"
    if (handicapIndex === null || handicapIndex === undefined) return null;
    if (!courseData) return Math.round(handicapIndex);
    
    const courseHcp = Math.round(
      (handicapIndex * courseData.slope_rating / 113) + 
      (courseData.course_rating - (courseData.par || 72))
    );
    
    // Cap at 18 for Club ID 1
    if (clubId === 1 && courseHcp > 18) return 18;
    return courseHcp;
  };

  // Delete any existing pairings first
  await supabase.from("pairings").delete().eq("adhoc_game_id", adhocGameId);

  // Helper: add N minutes to a "HH:MM:SS" or "HH:MM" time string, returns "HH:MM:SS"
  function addMinutes(timeStr: string, minutes: number): string {
    const [h, m] = timeStr.split(":").map(Number);
    const total = h * 60 + m + minutes;
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  }

  const baseTeeTime: string = gameData.tee_off_time || "08:00:00";

  // Resolve tee start: prefer the value passed from the client (which may differ 
  // if the organizer hasn't saved a new value yet); fall back to the DB value.
  const resolvedTeeStart: '1' | 'split' = teeStart ?? gameData.tee_start ?? '1';

  // Build unified players list with handicap info for sorting
  const players: { member_id: number | null; guest_id: number | null; handicap: number }[] = bookings.map(b => {
    let hcp = 99; // Default high handicap for sorting (guests without handicap, etc.)
    if (b.member_id) {
      const idx = handicapMap[b.member_id];
      if (idx !== null && idx !== undefined) {
        const clubId = memberClubMap[b.member_id] || gameData.club_id;
        hcp = calculateCourseHandicap(idx, clubId) ?? 99;
      }
    }
    return {
      member_id: b.member_id ?? null,
      guest_id: b.guest_id ?? null,
      handicap: hcp,
    };
  });

  // Sort players by handicap (lowest first)
  const sortedByHandicap = [...players].sort((a, b) => a.handicap - b.handicap);

  // Split into low and high handicap groups
  const midpoint = Math.ceil(sortedByHandicap.length / 2);
  const lowHandicapPlayers = sortedByHandicap.slice(0, midpoint);
  const highHandicapPlayers = sortedByHandicap.slice(midpoint);

  // Shuffle randomly within each group
  for (let i = lowHandicapPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lowHandicapPlayers[i], lowHandicapPlayers[j]] = [lowHandicapPlayers[j], lowHandicapPlayers[i]];
  }
  for (let i = highHandicapPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [highHandicapPlayers[i], highHandicapPlayers[j]] = [highHandicapPlayers[j], highHandicapPlayers[i]];
  }

  // Build fourballs: 2 low + 2 high per group
  const balancedPlayers: typeof players = [];
  const maxPairs = Math.max(Math.ceil(lowHandicapPlayers.length / 2), Math.ceil(highHandicapPlayers.length / 2));
  for (let i = 0; i < maxPairs; i++) {
    // Add 2 from low handicap group
    if (lowHandicapPlayers[i * 2]) balancedPlayers.push(lowHandicapPlayers[i * 2]);
    if (lowHandicapPlayers[i * 2 + 1]) balancedPlayers.push(lowHandicapPlayers[i * 2 + 1]);
    // Add 2 from high handicap group
    if (highHandicapPlayers[i * 2]) balancedPlayers.push(highHandicapPlayers[i * 2]);
    if (highHandicapPlayers[i * 2 + 1]) balancedPlayers.push(highHandicapPlayers[i * 2 + 1]);
  }

  // Split into groups (fourballs/threeballs)
  const groups = splitIntoGroups(balancedPlayers);

  // Sort groups: smaller groups (2-ball, 3-ball) tee off first; full fourballs follow.
  groups.sort((a, b) => a.length - b.length);

  // For split tee: odd-numbered groups (1, 3, 5 …) tee off hole 1,
  //               even-numbered groups (2, 4, 6 …) tee off hole 10 at the same time.
  // Tee time staggering:
  //   - Single tee: each group 8 min after previous
  //   - Split tee: groups on the same tee stagger by 8 min, interleaved
  //     e.g. group1@08:00(h1), group2@08:00(h10), group3@08:08(h1), group4@08:08(h10), …
  const pairingRows = groups.flatMap((group, groupIdx) => {
    let groupTeeTime: string;
    if (resolvedTeeStart === 'split') {
      // Odd 4Balls (1,3,5,7) tee off hole 1, even 4Balls (2,4,6,8) tee off hole 10
      // Both tees start at the same base time, staggered by 8 min within each tee
      // 4Ball 1 & 2 at 07:24, 4Ball 3 & 4 at 07:32, etc.
      // groupIdx 0 → 4Ball 1 (hole 1, slot 0), groupIdx 1 → 4Ball 2 (hole 10, slot 0)
      // groupIdx 2 → 4Ball 3 (hole 1, slot 1), groupIdx 3 → 4Ball 4 (hole 10, slot 1)
      const slotIndex = Math.floor(groupIdx / 2);
      groupTeeTime = addMinutes(baseTeeTime, slotIndex * 8);
    } else {
      groupTeeTime = addMinutes(baseTeeTime, groupIdx * 8);
    }

    // Captain selection: lowest handicap member in the group (guests excluded)
    const membersInGroup = group.filter(p => p.member_id !== null);
    const sortedMembers = [...membersInGroup].sort((a, b) => a.handicap - b.handicap);
    const captainMemberId = sortedMembers.length > 0 ? sortedMembers[0].member_id : null;

    return group.map((player) => {
      const isCaptain = player.member_id !== null && player.member_id === captainMemberId;

      const clubId = player.member_id ? (memberClubMap[player.member_id] || gameData.club_id) : gameData.club_id;
      const handicapIndex = player.member_id ? handicapMap[player.member_id] : null;
      const playingHandicap = player.member_id ? calculateCourseHandicap(handicapIndex, clubId) : 0;

      // starting_hole: for split tee odd 4Balls start hole 1, even 4Balls start hole 10
      const startingHole = resolvedTeeStart === 'split'
        ? (groupIdx % 2 === 0 ? 1 : 10)
        : 1;

      return {
        adhoc_game_id: adhocGameId,
        fourball_number: groupIdx + 1,
        member_id: player.member_id,
        guest_id: player.guest_id,
        is_captain: isCaptain,
        playing_handicap: playingHandicap,
        tee_off_time: groupTeeTime,
        starting_hole: startingHole,
        result_submitted: false,
        scores_submitted_at: null,
      };
    });
  });

  const { data: insertedPairings, error: insertError } = await supabase
    .from("pairings")
    .insert(pairingRows)
    .select("pairing_id, adhoc_game_id, fourball_number, member_id, guest_id, is_captain, playing_handicap, tee_off_time, starting_hole");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Back-fill wwb_ww / wwb_birdie on newly inserted pairings from adhoc_game_wwb_optins.
  // For Tuesday Clinique (club_id = 4) every member defaults to ww=true, birdie=true.
  // For other WWB clubs we read from the dedicated opt-ins table.
  const WWB_CLUB_IDS = [13, 4]; // Club 13 (WSOE) and Club 4 (Tuesday Clinique) - Keep in sync with dashboard constant
  const TUESDAY_CLINIQUE_ID = 4;
  if (WWB_CLUB_IDS.includes(gameData.club_id) && insertedPairings && insertedPairings.length > 0) {
    // Load existing per-game opt-ins
    const { data: optIns } = await supabase
      .from("adhoc_game_wwb_optins")
      .select("member_id, guest_id, ww, birdie")
      .eq("adhoc_game_id", adhocGameId);

    const optInMap: Record<string, { ww: boolean; birdie: boolean }> = {};
    (optIns || []).forEach((o: { member_id: number | null; guest_id: number | null; ww: boolean; birdie: boolean }) => {
      const key = o.member_id != null ? `m_${o.member_id}` : `g_${o.guest_id}`;
      optInMap[key] = { ww: o.ww, birdie: o.birdie };
    });

    // For Tuesday Clinique: upsert a default opt-in for any member that doesn't already have one
    if (gameData.club_id === TUESDAY_CLINIQUE_ID) {
      const upsertRows = insertedPairings
        .filter(p => p.member_id && !optInMap[`m_${p.member_id}`])
        .map(p => ({ adhoc_game_id: adhocGameId, member_id: p.member_id, ww: true, birdie: true }));
      if (upsertRows.length > 0) {
        await supabase.from("adhoc_game_wwb_optins").upsert(upsertRows, { onConflict: "adhoc_game_id,member_id" });
        upsertRows.forEach(r => { optInMap[`m_${r.member_id}`] = { ww: true, birdie: true }; });
      }
    }

    // Now update each pairing's wwb_ww / wwb_birdie from the merged opt-in map
    const pairingUpdates = insertedPairings.map(p => {
      let opts: { ww: boolean; birdie: boolean };
      if (p.member_id) {
        opts = optInMap[`m_${p.member_id}`] ?? (gameData.club_id === TUESDAY_CLINIQUE_ID ? { ww: true, birdie: true } : { ww: false, birdie: false });
      } else if (p.guest_id) {
        opts = optInMap[`g_${p.guest_id}`] ?? { ww: false, birdie: false };
      } else {
        opts = { ww: false, birdie: false };
      }
      return supabase
        .from("pairings")
        .update({ wwb_ww: opts.ww, wwb_birdie: opts.birdie })
        .eq("pairing_id", p.pairing_id);
    });
    await Promise.all(pairingUpdates);

    // Attach the resolved flags onto insertedPairings for the enriched response
    insertedPairings.forEach(p => {
      let opts: { ww: boolean; birdie: boolean };
      if (p.member_id) {
        opts = optInMap[`m_${p.member_id}`] ?? (gameData.club_id === TUESDAY_CLINIQUE_ID ? { ww: true, birdie: true } : { ww: false, birdie: false });
      } else if (p.guest_id) {
        opts = optInMap[`g_${p.guest_id}`] ?? { ww: false, birdie: false };
      } else {
        opts = { ww: false, birdie: false };
      }
      (p as Record<string, unknown>).wwb_ww = opts.ww;
      (p as Record<string, unknown>).wwb_birdie = opts.birdie;
    });
  }

  // Fetch member and guest names to enrich the response
  const newMemberIds = (insertedPairings || []).filter(p => p.member_id).map(p => p.member_id as number);
  const newGuestIds = (insertedPairings || []).filter(p => p.guest_id).map(p => p.guest_id as number);
  
  const [membersRes, guestsRes] = await Promise.all([
    newMemberIds.length > 0 ? supabase.from("members").select("member_id, member_name").in("member_id", newMemberIds) : Promise.resolve({ data: [] }),
    newGuestIds.length > 0 ? supabase.from("guests").select("guest_id, guest_name, handicap_index").in("guest_id", newGuestIds) : Promise.resolve({ data: [] }),
  ]);

  const memberNameMap: Record<number, string> = {};
  (membersRes.data || []).forEach((m: { member_id: number; member_name: string }) => { memberNameMap[m.member_id] = m.member_name; });
  const guestMap: Record<number, { guest_name: string; handicap_index: number | null }> = {};
  (guestsRes.data || []).forEach((g: { guest_id: number; guest_name: string; handicap_index: number | null }) => { guestMap[g.guest_id] = g; });

  const enrichedPairings = (insertedPairings || []).map(p => ({
    ...p,
    member_name: p.member_id ? (memberNameMap[p.member_id] ?? null) : null,
    guest_name: p.guest_id ? (guestMap[p.guest_id]?.guest_name ?? null) : null,
    guest_handicap_index: p.guest_id ? (guestMap[p.guest_id]?.handicap_index ?? null) : null,
    gross_score: null,
    points: null,
    result_submitted: false,
    birdies_count: 0,
    eagles_count: 0,
    hio_count: 0,
    ladies_count: 0,
    is_late: false,
    is_no_show: false,
    scores_submitted_at: null,
    // wwb_ww / wwb_birdie were attached above (or already present from DB insert)
    wwb_ww: (p as Record<string, unknown>).wwb_ww as boolean ?? false,
    wwb_birdie: (p as Record<string, unknown>).wwb_birdie as boolean ?? false,
  }));

  return NextResponse.json({ 
    message: "Fourballs generated", 
    groups: groups.length, 
    players: players.length,
    regenerated: true,
    pairings: enrichedPairings,
  });
}

// GET endpoint: check for games approaching tee-off and auto-generate pairings
export async function GET() {
  const supabase = await createClient();

  // Find open adhoc games where tee-off is within the next hour (or past) and pairings don't exist yet
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5);

  // Get games for today that are still open
  const { data: games } = await supabase
    .from("adhoc_games")
    .select("adhoc_game_id, tee_off_time, max_players, course_id, club_id")
    .eq("game_date", today)
    .in("status", ["open", "full"]);

  if (!games || games.length === 0) {
    return NextResponse.json({ message: "No games to process" });
  }

  const generated: number[] = [];

  for (const game of games) {
    // Check if tee-off is within the next hour or already past
    const teeOff = game.tee_off_time?.slice(0, 5);
    if (!teeOff) continue;
    
    const isWithinHour = teeOff <= oneHourLater;
    if (!isWithinHour) continue;

    // Check confirmed bookings
    const { data: bookings } = await supabase
      .from("adhoc_game_bookings")
      .select("member_id, guest_id")
      .eq("adhoc_game_id", game.adhoc_game_id)
      .eq("booking_status", "confirmed");

    if (!bookings || bookings.length < 2) continue;

    // Check if pairings already exist
    const { data: existing } = await supabase
      .from("pairings")
      .select("pairing_id")
      .eq("adhoc_game_id", game.adhoc_game_id)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Fetch handicap indices and member club IDs
    const memberIds = bookings.filter(b => b.member_id).map(b => b.member_id);
    let handicapMap: Record<number, number | null> = {};
    let memberClubMap: Record<number, number> = {};

    if (memberIds.length > 0) {
      const { data: handicaps } = await supabase
        .from("member_handicap_indices")
        .select("member_id, official_handicap_index")
        .eq("season", String(new Date().getFullYear()))
        .in("member_id", memberIds);

      if (handicaps) {
        handicaps.forEach(h => {
          handicapMap[h.member_id] = h.official_handicap_index;
        });
      }

      const { data: members } = await supabase
        .from("members")
        .select("member_id, club_id")
        .in("member_id", memberIds);

      if (members) {
        members.forEach(m => {
          memberClubMap[m.member_id] = m.club_id;
        });
      }
    }

    // Fetch course details
    const { data: courseData } = await supabase
      .from("courses")
      .select("course_rating, slope_rating, par")
      .eq("course_id", game.course_id)
      .single();

    // Helper function
    const calculateCourseHandicap = (handicapIndex: number | null | undefined, clubId: number): number => {
      if (!handicapIndex) return 0;
      if (!courseData) return Math.round(handicapIndex);
      
      const courseHcp = Math.round(
        (handicapIndex * courseData.slope_rating / 113) + 
        (courseData.course_rating - (courseData.par || 72))
      );
      
      if (clubId === 1 && courseHcp > 18) return 18;
      return courseHcp;
    };

    // Build unified players list with handicap info for balanced distribution
    const players: { member_id: number | null; guest_id: number | null; handicap: number }[] = bookings.map(b => {
      let hcp = 99;
      if (b.member_id) {
        const idx = handicapMap[b.member_id];
        if (idx !== null && idx !== undefined) {
          const clubId = memberClubMap[b.member_id] || game.club_id;
          hcp = calculateCourseHandicap(idx, clubId) ?? 99;
        }
      }
      return {
        member_id: b.member_id ?? null,
        guest_id: b.guest_id ?? null,
        handicap: hcp,
      };
    });

    // Sort by handicap, split into low/high groups, shuffle within each
    const sortedByHcp = [...players].sort((a, b) => a.handicap - b.handicap);
    const mid = Math.ceil(sortedByHcp.length / 2);
    const lowHcp = sortedByHcp.slice(0, mid);
    const highHcp = sortedByHcp.slice(mid);

    for (let i = lowHcp.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lowHcp[i], lowHcp[j]] = [lowHcp[j], lowHcp[i]];
    }
    for (let i = highHcp.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [highHcp[i], highHcp[j]] = [highHcp[j], highHcp[i]];
    }

    // Build balanced fourballs: 2 low + 2 high
    const balancedPlayers: typeof players = [];
    const maxPairs = Math.max(Math.ceil(lowHcp.length / 2), Math.ceil(highHcp.length / 2));
    for (let i = 0; i < maxPairs; i++) {
      if (lowHcp[i * 2]) balancedPlayers.push(lowHcp[i * 2]);
      if (lowHcp[i * 2 + 1]) balancedPlayers.push(lowHcp[i * 2 + 1]);
      if (highHcp[i * 2]) balancedPlayers.push(highHcp[i * 2]);
      if (highHcp[i * 2 + 1]) balancedPlayers.push(highHcp[i * 2 + 1]);
    }

    const groups = splitIntoGroups(balancedPlayers);

    const baseTeeTimeAuto: string = game.tee_off_time || "08:00:00";
    const addMinsAuto = (timeStr: string, mins: number): string => {
      const [h, m] = timeStr.split(":").map(Number);
      const total = h * 60 + m + mins;
      const hh = Math.floor(total / 60) % 24;
      const mm = total % 60;
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
    };

    const pairingRows = groups.flatMap((group, groupIdx) => {
      const groupTeeTime = addMinsAuto(baseTeeTimeAuto, groupIdx * 8);
      
      // Captain: lowest handicap member (guests excluded)
      const membersInGrp = group.filter(p => p.member_id !== null);
      const sortedMems = [...membersInGrp].sort((a, b) => a.handicap - b.handicap);
      const captainId = sortedMems.length > 0 ? sortedMems[0].member_id : null;

      return group.map((player) => {
        const isCaptain = player.member_id !== null && player.member_id === captainId;

        const clubId = player.member_id ? (memberClubMap[player.member_id] || game.club_id) : game.club_id;
        const handicapIndex = player.member_id ? handicapMap[player.member_id] : null;
        const playingHandicap = player.member_id ? calculateCourseHandicap(handicapIndex, clubId) : 0;

        return {
          adhoc_game_id: game.adhoc_game_id,
          fourball_number: groupIdx + 1,
          member_id: player.member_id,
          guest_id: player.guest_id,
          is_captain: isCaptain,
          playing_handicap: playingHandicap,
          tee_off_time: groupTeeTime,
          result_submitted: false,
          scores_submitted_at: null,
        };
      });
    });

    const { error } = await supabase.from("pairings").insert(pairingRows);
    if (!error) generated.push(game.adhoc_game_id);
  }

  return NextResponse.json({ message: `Generated pairings for ${generated.length} game(s)`, gameIds: generated });
}
