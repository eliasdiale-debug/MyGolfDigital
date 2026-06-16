import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";

const supabase = createApiClient();
// WHS lookup table: number of rounds -> how many best differentials to use
// Also includes adjustment factor for fewer than 20 rounds
function getWhsSelection(numRounds: number): { use: number; adjustment: number } | null {
  if (numRounds < 3) return null; // Need at least 3 rounds
  if (numRounds === 3) return { use: 1, adjustment: -2.0 };
  if (numRounds === 4) return { use: 1, adjustment: -1.0 };
  if (numRounds === 5) return { use: 1, adjustment: 0 };
  if (numRounds === 6) return { use: 2, adjustment: -1.0 };
  if (numRounds <= 8) return { use: 2, adjustment: 0 };
  if (numRounds <= 11) return { use: 3, adjustment: 0 };
  if (numRounds <= 14) return { use: 4, adjustment: 0 };
  if (numRounds <= 16) return { use: 5, adjustment: 0 };
  if (numRounds <= 18) return { use: 6, adjustment: 0 };
  if (numRounds === 19) return { use: 7, adjustment: 0 };
  return { use: 8, adjustment: 0 }; // 20+ rounds
}

// POST: Recalculate handicap index for specific members after a game
export async function POST(req: Request) {
  try {
    const { adhocGameId, memberIds } = await req.json();

    if (!adhocGameId && (!memberIds || memberIds.length === 0)) {
      return NextResponse.json({ error: "adhocGameId or memberIds required" }, { status: 400 });
    }

    // If adhocGameId provided, get all members who played in that game with submitted results
    let targetMemberIds: number[] = memberIds || [];
    let gameInfo: { course_id: number; game_date: string } | null = null;

    if (adhocGameId) {
      const { data: game } = await supabase
        .from("adhoc_games")
        .select("course_id, game_date")
        .eq("adhoc_game_id", adhocGameId)
        .single();
      gameInfo = game;

      const { data: pairings } = await supabase
        .from("pairings")
        .select("member_id, guest_id, gross_score")
        .eq("adhoc_game_id", adhocGameId)
        .eq("result_submitted", true)
        .not("gross_score", "is", null);

      if (pairings) {
        // Only recalculate for actual members (not guests)
        targetMemberIds = [...new Set(pairings.filter(p => p.member_id).map(p => p.member_id as number))];

        // Also save differentials for this game
        if (gameInfo) {
          const { data: courseData } = await supabase
            .from("courses")
            .select("course_rating, slope_rating")
            .eq("course_id", gameInfo.course_id)
            .single();

          if (courseData && courseData.slope_rating > 0) {
            for (const p of pairings.filter(pp => pp.member_id && pp.gross_score)) {
              const differential = Math.round(((p.gross_score - courseData.course_rating) * 113 / courseData.slope_rating) * 10) / 10;

              // Upsert differential for this member + game
              const { data: existing } = await supabase
                .from("handicap_differentials")
                .select("differential_id")
                .eq("member_id", p.member_id)
                .eq("game_date", gameInfo.game_date)
                .eq("course_id", gameInfo.course_id)
                .limit(1);

              if (existing && existing.length > 0) {
                await supabase
                  .from("handicap_differentials")
                  .update({
                    gross_score: p.gross_score,
                    course_rating: courseData.course_rating,
                    slope_rating: courseData.slope_rating,
                    differential_value: differential,
                  })
                  .eq("differential_id", existing[0].differential_id);
              } else {
                await supabase
                  .from("handicap_differentials")
                  .insert({
                    member_id: p.member_id,
                    game_date: gameInfo.game_date,
                    course_id: gameInfo.course_id,
                    gross_score: p.gross_score,
                    course_rating: courseData.course_rating,
                    slope_rating: courseData.slope_rating,
                    differential_value: differential,
                  });
              }
            }
          }
        }
      }
    }

    if (targetMemberIds.length === 0) {
      return NextResponse.json({ message: "No members to recalculate", updated: 0 });
    }

    const results: { member_id: number; previous_index: number | null; new_index: number | null; rounds: number }[] = [];

    for (const memberId of targetMemberIds) {
      // Get all differentials for this member, most recent 20
      const { data: differentials } = await supabase
        .from("handicap_differentials")
        .select("differential_value")
        .eq("member_id", memberId)
        .not("differential_value", "is", null)
        .order("game_date", { ascending: false })
        .limit(20);

      if (!differentials || differentials.length === 0) {
        results.push({ member_id: memberId, previous_index: null, new_index: null, rounds: 0 });
        continue;
      }

      const numRounds = differentials.length;
      const selection = getWhsSelection(numRounds);

      if (!selection) {
        // Less than 3 rounds - not enough data
        results.push({ member_id: memberId, previous_index: null, new_index: null, rounds: numRounds });
        continue;
      }

      // Sort differentials ascending to pick the best (lowest)
      const sorted = differentials.map(d => d.differential_value as number).sort((a, b) => a - b);
      const bestDifferentials = sorted.slice(0, selection.use);
      const average = bestDifferentials.reduce((sum, d) => sum + d, 0) / bestDifferentials.length;
      const newIndex = Math.round((average + selection.adjustment) * 10) / 10;
      // Cap at 54.0 max per WHS
      const cappedIndex = Math.min(Math.max(newIndex, 0), 54.0);

      // Get current index before updating
      const { data: currentHcp } = await supabase
        .from("member_handicap_indices")
        .select("remmoho_handicap_index")
        .eq("member_id", memberId)
        .single();

      const previousIndex = currentHcp?.remmoho_handicap_index ?? null;

      // Update the handicap index with previous stored
      const { data: existingRow } = await supabase
        .from("member_handicap_indices")
        .select("handicap_index_id")
        .eq("member_id", memberId)
        .limit(1);

      if (existingRow && existingRow.length > 0) {
        await supabase
          .from("member_handicap_indices")
          .update({
            previous_handicap_index: previousIndex,
            remmoho_handicap_index: cappedIndex,
          })
          .eq("member_id", memberId);
      } else {
        await supabase
          .from("member_handicap_indices")
          .insert({
            member_id: memberId,
            previous_handicap_index: previousIndex,
            remmoho_handicap_index: cappedIndex,
          });
      }

      results.push({ member_id: memberId, previous_index: previousIndex, new_index: cappedIndex, rounds: numRounds });
    }

    return NextResponse.json({ message: "Handicap indices recalculated", results, updated: results.length });
  } catch (err) {
    console.error("Handicap recalculation error:", err);
    return NextResponse.json({ error: "Failed to recalculate handicap indices" }, { status: 500 });
  }
}
