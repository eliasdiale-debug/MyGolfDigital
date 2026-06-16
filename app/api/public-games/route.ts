import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns public adhoc games that are open and still have available slots.
export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    // Fetch upcoming public, open games with course + organizer + club info
    const { data: games, error } = await supabase
      .from("adhoc_games")
      .select(
        "adhoc_game_id, course_id, club_id, game_date, tee_off_time, max_players, status, game_visibility, organizer_id, courses(course_name), members!adhoc_games_organizer_id_fkey(member_name)"
      )
      .eq("game_visibility", "public")
      .eq("status", "open")
      .gte("game_date", today)
      .order("game_date", { ascending: true });

    if (error) {
      console.log("[v0] public-games query error:", error.message);
      return NextResponse.json({ games: [] });
    }

    const gameList = games || [];
    if (gameList.length === 0) {
      return NextResponse.json({ games: [] });
    }

    // Count confirmed bookings per game to compute available slots
    const gameIds = gameList.map((g) => g.adhoc_game_id);
    const { data: bookings } = await supabase
      .from("adhoc_game_bookings")
      .select("adhoc_game_id")
      .in("adhoc_game_id", gameIds)
      .eq("booking_status", "confirmed");

    const bookedCounts = new Map<number, number>();
    (bookings || []).forEach((b) => {
      bookedCounts.set(b.adhoc_game_id, (bookedCounts.get(b.adhoc_game_id) || 0) + 1);
    });

    // Resolve club names
    const clubIds = [...new Set(gameList.map((g) => g.club_id).filter(Boolean))] as number[];
    const clubNames = new Map<number, string>();
    if (clubIds.length > 0) {
      const { data: clubs } = await supabase
        .from("golf_clubs")
        .select("club_id, club_name")
        .in("club_id", clubIds);
      (clubs || []).forEach((c) => clubNames.set(c.club_id, c.club_name));
    }

    const result = gameList
      .map((g) => {
        const booked = bookedCounts.get(g.adhoc_game_id) || 0;
        const available = g.max_players - booked;
        const courseName =
          (g.courses as unknown as { course_name: string } | null)?.course_name || "Unknown Course";
        const organizerName =
          (g.members as unknown as { member_name: string } | null)?.member_name || "Unknown";
        // Combine date and tee time into an ISO start time
        const startTime = g.tee_off_time
          ? `${g.game_date}T${g.tee_off_time}`
          : `${g.game_date}T00:00:00`;
        return {
          id: String(g.adhoc_game_id),
          venue: courseName,
          startTime,
          schoolName: g.club_id ? clubNames.get(g.club_id) || "Public Game" : "Public Game",
          organizerName,
          maxPlayers: g.max_players,
          availableSlots: available,
        };
      })
      // Only show games that still have open slots
      .filter((g) => g.availableSlots > 0);

    return NextResponse.json({ games: result });
  } catch (err) {
    console.log("[v0] public-games route error:", err);
    return NextResponse.json({ games: [] });
  }
}
