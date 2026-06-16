import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Helper: add N minutes to a "HH:MM:SS" or "HH:MM" time string
function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { adhocGameId, memberId, guestId } = await request.json();

  if (!adhocGameId || (!memberId && !guestId)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Get game details
  const { data: gameData, error: gameError } = await supabase
    .from("adhoc_games")
    .select("course_id, club_id, tee_off_time, tee_start")
    .eq("adhoc_game_id", adhocGameId)
    .single();

  if (gameError || !gameData) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Get existing pairings for this game, grouped by fourball_number
  const { data: existingPairings, error: pairingsError } = await supabase
    .from("pairings")
    .select("pairing_id, fourball_number, member_id, guest_id, tee_off_time, starting_hole")
    .eq("adhoc_game_id", adhocGameId)
    .order("fourball_number", { ascending: true });

  if (pairingsError) {
    return NextResponse.json({ error: pairingsError.message }, { status: 500 });
  }

  // No pairings exist yet — caller should use generate-fourballs instead
  if (!existingPairings || existingPairings.length === 0) {
    return NextResponse.json({ error: "No pairings exist yet. Generate pairings first." }, { status: 400 });
  }

  // Count members per fourball
  const groupSizes: Record<number, number> = {};
  const groupTeeTime: Record<number, string> = {};
  const groupStartingHole: Record<number, number> = {};

  for (const p of existingPairings) {
    groupSizes[p.fourball_number] = (groupSizes[p.fourball_number] || 0) + 1;
    if (!groupTeeTime[p.fourball_number]) groupTeeTime[p.fourball_number] = p.tee_off_time;
    if (!groupStartingHole[p.fourball_number]) groupStartingHole[p.fourball_number] = p.starting_hole ?? 1;
  }

  // Find a group with fewer than 4 players
  let targetFourball: number | null = null;
  const sortedGroups = Object.keys(groupSizes).map(Number).sort((a, b) => a - b);
  for (const fn of sortedGroups) {
    if (groupSizes[fn] < 4) {
      targetFourball = fn;
      break;
    }
  }

  let assignedFourball: number;
  let assignedTeeTime: string;
  let assignedStartingHole: number;

  if (targetFourball !== null) {
    // Slot into existing group with space
    assignedFourball = targetFourball;
    assignedTeeTime = groupTeeTime[targetFourball];
    assignedStartingHole = groupStartingHole[targetFourball];
  } else {
    // All groups are full — create a new group
    const maxFourball = Math.max(...sortedGroups);
    assignedFourball = maxFourball + 1;

    // Calculate tee time for the new group
    const teeStart = gameData.tee_start ?? '1';
    if (teeStart === 'split') {
      const slotIndex = Math.floor(maxFourball / 2);
      assignedTeeTime = addMinutes(gameData.tee_off_time || "08:00:00", slotIndex * 9);
      assignedStartingHole = maxFourball % 2 === 0 ? 1 : 10;
    } else {
      assignedTeeTime = addMinutes(gameData.tee_off_time || "08:00:00", maxFourball * 9);
      assignedStartingHole = 1;
    }
  }

  // Calculate playing handicap for the new member (if applicable)
  let playingHandicap: number | null = null;
  if (memberId) {
    const { data: hcpData } = await supabase
      .from("member_handicap_indices")
      .select("official_handicap_index")
      .eq("member_id", memberId)
      .eq("season", String(new Date().getFullYear()))
      .maybeSingle();

    const { data: courseData } = await supabase
      .from("courses")
      .select("course_rating, slope_rating, par")
      .eq("course_id", gameData.course_id)
      .single();

    const { data: memberData } = await supabase
      .from("members")
      .select("club_id")
      .eq("member_id", memberId)
      .single();

    const hcpIndex = hcpData?.official_handicap_index ?? null;
    if (hcpIndex !== null && courseData) {
      const raw = Math.round(
        (hcpIndex * courseData.slope_rating / 113) +
        (courseData.course_rating - (courseData.par || 72))
      );
      playingHandicap = memberData?.club_id === 1 ? Math.min(raw, 18) : raw;
    }
  } else if (guestId) {
    const { data: guestData } = await supabase
      .from("guests")
      .select("handicap_index")
      .eq("guest_id", guestId)
      .single();

    const { data: courseData } = await supabase
      .from("courses")
      .select("course_rating, slope_rating, par")
      .eq("course_id", gameData.course_id)
      .single();

    const hcpIndex = guestData?.handicap_index ?? null;
    if (hcpIndex !== null && courseData) {
      playingHandicap = Math.round(
        (hcpIndex * courseData.slope_rating / 113) +
        (courseData.course_rating - (courseData.par || 72))
      );
    }
  }

  // Insert the new pairing row
  const newRow = {
    adhoc_game_id: adhocGameId,
    fourball_number: assignedFourball,
    member_id: memberId ?? null,
    guest_id: guestId ?? null,
    is_captain: false,
    playing_handicap: playingHandicap,
    tee_off_time: assignedTeeTime,
    starting_hole: assignedStartingHole,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("pairings")
    .insert(newRow)
    .select("pairing_id, adhoc_game_id, fourball_number, member_id, guest_id, is_captain, playing_handicap, tee_off_time, starting_hole")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Fetch name for the response
  let displayName: string | null = null;
  if (memberId) {
    const { data: m } = await supabase.from("members").select("member_name").eq("member_id", memberId).single();
    displayName = m?.member_name ?? null;
  } else if (guestId) {
    const { data: g } = await supabase.from("guests").select("guest_name").eq("guest_id", guestId).single();
    displayName = g?.guest_name ? `${g.guest_name} (G)` : null;
  }

  return NextResponse.json({
    pairing: {
      ...inserted,
      member_name: memberId ? displayName : null,
      guest_name: guestId ? displayName : null,
      is_new_group: targetFourball === null,
    },
  });
}
