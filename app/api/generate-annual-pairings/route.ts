import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Generate pairings for annual games 6 hours before game day
export async function POST(request: Request) {
  const supabase = await createClient();
  const { scheduleId } = await request.json();

  if (!scheduleId) {
    return NextResponse.json({ error: "Missing scheduleId" }, { status: 400 });
  }

  // Get the annual schedule entry
  const { data: schedule } = await supabase
    .from("annual_schedule")
    .select("schedule_id, game_date, activity, course_name, format, event_type")
    .eq("schedule_id", scheduleId)
    .single();

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  // Check if an adhoc game already exists for this schedule date and course
  const { data: existingGame } = await supabase
    .from("adhoc_games")
    .select("adhoc_game_id")
    .eq("game_date", schedule.game_date)
    .eq("notes", `annual:${scheduleId}`)
    .limit(1);

  let adhocGameId: number;

  if (existingGame && existingGame.length > 0) {
    adhocGameId = existingGame[0].adhoc_game_id;
  } else {
    // Find the course_id from courses table matching the schedule course_name
    let courseId: number | null = null;
    if (schedule.course_name) {
      const { data: courseData } = await supabase
        .from("courses")
        .select("course_id")
        .ilike("course_name", `%${schedule.course_name}%`)
        .limit(1);
      if (courseData && courseData.length > 0) {
        courseId = courseData[0].course_id;
      }
    }

    if (!courseId) {
      return NextResponse.json({ error: "Course not found for this schedule" }, { status: 400 });
    }

    // Create an adhoc_game entry for this annual game
    const { data: newGame, error: createError } = await supabase
      .from("adhoc_games")
      .insert({
        organizer_id: 37, // Tebele as default organizer for annual games
        course_id: courseId,
        game_date: schedule.game_date,
        tee_off_time: "07:00",
        max_players: 40,
        notes: `annual:${scheduleId}`,
        status: "open",
        cost_per_player: 0,
      })
      .select("adhoc_game_id")
      .single();

    if (createError || !newGame) {
      return NextResponse.json({ error: createError?.message || "Failed to create game" }, { status: 500 });
    }
    adhocGameId = newGame.adhoc_game_id;
  }

  // Get all confirmed bookings for this schedule (members only, not guests yet)
  const { data: bookings } = await supabase
    .from("game_bookings")
    .select("member_id, guest_name, guest_handicap")
    .eq("schedule_id", scheduleId)
    .eq("booking_status", "confirmed");

  if (!bookings || bookings.length < 2) {
    return NextResponse.json({ error: "Need at least 2 confirmed players" }, { status: 400 });
  }

  // Clear existing adhoc bookings and pairings for regeneration
  await supabase.from("pairings").delete().eq("adhoc_game_id", adhocGameId);
  await supabase.from("adhoc_game_bookings").delete().eq("adhoc_game_id", adhocGameId);

  // Insert member bookings into adhoc_game_bookings
  for (const b of bookings) {
    if (b.member_id && !b.guest_name) {
      await supabase.from("adhoc_game_bookings").insert({
        adhoc_game_id: adhocGameId,
        member_id: b.member_id,
        booking_status: "confirmed",
      });
    }
    // Guest bookings - need to insert as guest in guests table first
    if (b.guest_name) {
      // Check if guest already exists
      const { data: existingGuest } = await supabase
        .from("guests")
        .select("guest_id")
        .eq("guest_name", b.guest_name)
        .limit(1);

      let guestId: number;
      if (existingGuest && existingGuest.length > 0) {
        guestId = existingGuest[0].guest_id;
      } else {
        const { data: newGuest } = await supabase
          .from("guests")
          .insert({ guest_name: b.guest_name, handicap_index: b.guest_handicap })
          .select("guest_id")
          .single();
        if (!newGuest) continue;
        guestId = newGuest.guest_id;
      }

      await supabase.from("adhoc_game_bookings").insert({
        adhoc_game_id: adhocGameId,
        guest_id: guestId,
        member_id: b.member_id,
        booking_status: "confirmed",
      });
    }
  }

  // Now generate fourballs via the existing endpoint logic
  const { data: allBookings } = await supabase
    .from("adhoc_game_bookings")
    .select("member_id, guest_id")
    .eq("adhoc_game_id", adhocGameId)
    .eq("booking_status", "confirmed");

  if (!allBookings || allBookings.length < 2) {
    return NextResponse.json({ error: "Not enough players after sync" }, { status: 400 });
  }

  // Fetch game details for club_id and course info
  const { data: gameData } = await supabase
    .from("adhoc_games")
    .select("course_id, club_id")
    .eq("adhoc_game_id", adhocGameId)
    .single();

  // Fetch handicap indices and member club IDs
  const memberIds = allBookings.filter(b => b.member_id).map(b => b.member_id);
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
    .eq("course_id", gameData?.course_id)
    .single();

  // Helper function to calculate course handicap
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

  // Shuffle players
  const players = allBookings.map(b => ({
    member_id: b.member_id ?? null,
    guest_id: b.guest_id ?? null,
  }));
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  // Split into fourballs
  const n = players.length;
  const remainder = n % 4;
  let numFours: number, numThrees: number;
  if (remainder === 0) { numFours = n / 4; numThrees = 0; }
  else if (remainder === 1) {
    if (n >= 9) { numThrees = 3; numFours = (n - 9) / 4; }
    else { numThrees = 1; numFours = 0; }
  } else if (remainder === 2) { numThrees = 2; numFours = (n - 6) / 4; }
  else { numThrees = 1; numFours = (n - 3) / 4; }

  const groups: typeof players[] = [];
  let idx = 0;
  for (let g = 0; g < numFours; g++) { groups.push(players.slice(idx, idx + 4)); idx += 4; }
  for (let g = 0; g < numThrees; g++) { const size = idx + 3 <= n ? 3 : n - idx; groups.push(players.slice(idx, idx + size)); idx += size; }
  if (idx < n) groups.push(players.slice(idx));

  const pairingRows = groups.flatMap((group, groupIdx) => {
    let captainAssigned = false;
    return group.map(player => {
      const isCaptain = !captainAssigned && player.member_id !== null;
      if (isCaptain) captainAssigned = true;
      
      const clubId = player.member_id ? (memberClubMap[player.member_id] || gameData?.club_id || 1) : gameData?.club_id || 1;
      const handicapIndex = player.member_id ? handicapMap[player.member_id] : null;
      const playingHandicap = player.member_id ? calculateCourseHandicap(handicapIndex, clubId) : 0;

      return {
        adhoc_game_id: adhocGameId,
        fourball_number: groupIdx + 1,
        member_id: player.member_id,
        guest_id: player.guest_id,
        is_captain: isCaptain,
        playing_handicap: playingHandicap,
      };
    });
  });

  const { error: insertError } = await supabase.from("pairings").insert(pairingRows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "Annual game pairings generated",
    adhoc_game_id: adhocGameId,
    groups: groups.length,
    players: players.length,
  });
}
