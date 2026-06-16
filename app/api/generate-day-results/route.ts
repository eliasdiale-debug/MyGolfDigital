import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";

const supabase = createApiClient();
// POST: Retroactively generate day_results for a completed game
export async function POST(req: Request) {
  try {
    const { adhocGameId } = await req.json();

    if (!adhocGameId) {
      return NextResponse.json({ error: "adhocGameId required" }, { status: 400 });
    }

    // Get game info
    const { data: game } = await supabase
      .from("adhoc_games")
      .select("adhoc_game_id, course_id, game_date, cost_per_player")
      .eq("adhoc_game_id", adhocGameId)
      .single();

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const greenFees = game.cost_per_player || 0;

    // Get all pairings with submitted results (including guests)
    const { data: pairings } = await supabase
      .from("pairings")
      .select("pairing_id, member_id, guest_id, gross_score, points, playing_handicap, birdies_count, eagles_count, hio_count, ladies_count, is_late, is_no_show, is_sub, result_submitted, guests(guest_name)")
      .eq("adhoc_game_id", adhocGameId)
      .eq("result_submitted", true);

    if (!pairings || pairings.length === 0) {
      return NextResponse.json({ error: "No submitted results found for this game" }, { status: 404 });
    }

    // Calculate game-wide totals (only from players who showed up)
    const activePlayers = pairings.filter(p => !p.is_no_show);
    const playerCount = activePlayers.length;
    const totalBirdies = activePlayers.reduce((sum, p) => sum + (p.birdies_count || 0), 0);
    const totalEagles = activePlayers.reduce((sum, p) => sum + (p.eagles_count || 0), 0);
    const totalHio = activePlayers.reduce((sum, p) => sum + (p.hio_count || 0), 0);

    // Delete existing day_results for this game date + course to avoid duplicates
    await supabase
      .from("day_results")
      .delete()
      .eq("game_date", game.game_date)
      .eq("course_id", game.course_id);

    const results = [];

    for (const p of pairings) {
      // Support both members and guests
      const isGuest = !p.member_id && !!p.guest_id;
      if (!p.member_id && !p.guest_id) continue;

      const guestData = Array.isArray(p.guests) ? p.guests[0] : p.guests as { guest_name: string } | null;
      const points = p.points || 0;
      const birdies = p.birdies_count || 0;
      const eagles = p.eagles_count || 0;
      const hio = p.hio_count || 0;
      const ladies = p.ladies_count || 0;

      // Sub fee based on points
      let subFee = 0;
      if (!p.is_no_show) {
        if (points < 10) subFee = 150;
        else if (points <= 17) subFee = 100;
        else if (points <= 25) subFee = 50;
        else if (points <= 29) subFee = 20;
      }

      // Ladies fee: R100 if any ladies
      const ladiesFee = ladies > 0 ? 100 : 0;

      // Late fee: R110
      const lateFee = p.is_late ? 110 : 0;

      // Birdies: R20 per birdie in the day, less own birdies
      const birdieCharge = (totalBirdies - birdies) * 20;

      // Birdie earnings: own birdies earn R20 from each other player
      const birdieEarnings = p.is_no_show ? 0 : birdies * 20 * (playerCount - 1);

      // Eagles: R20 per eagle
      const eagleCharge = totalEagles * 20;
      const eagleEarnings = p.is_no_show ? 0 : eagles * 20 * playerCount;
      const eaglePayout = p.is_no_show ? 0 : eagles * 20 * (playerCount - 1);

      // HiO: R50 per HiO
      const hioCharge = totalHio * 50;
      const hioEarnings = p.is_no_show ? 0 : hio * 50 * playerCount;

      // No Show fee
      let noShowFee = 0;
      if (p.is_no_show) {
        noShowFee = greenFees + birdieCharge + eagleCharge + hioCharge;
      }

      // Total owed to club
      const totalOwed = p.is_no_show
        ? noShowFee
        : subFee + ladiesFee + lateFee + birdieCharge + eagleCharge + hioCharge - eagleEarnings - hioEarnings;

      // Total member earns
      const totalMemberAmount = p.is_no_show ? 0 : birdieEarnings + eagleEarnings + hioEarnings;

      // Debtor/Creditor
      const debtorCreditor = p.is_no_show ? -noShowFee : totalMemberAmount - totalOwed;

      const record: Record<string, unknown> = {
        game_date: game.game_date,
        course_id: game.course_id,
        member_id: isGuest ? null : p.member_id,
        guest_id: isGuest ? p.guest_id : null,
        guest_name: isGuest ? guestData?.guest_name : null,
        points: p.is_no_show ? null : (points || null),
        gross_score: p.is_no_show ? null : (p.gross_score || null),
        playing_handicap: p.is_no_show ? null : (p.playing_handicap || null),
        birdies_count: birdies,
        eagles_count: eagles,
        ladies_count: ladies,
        is_late: p.is_late || false,
        is_sub: p.is_sub || false,
        no_show_fee: noShowFee,
        cash_paid: p.is_no_show ? 0 : greenFees,
        birdie_pool: birdieEarnings,
        lady_payout: ladiesFee,
        late_payout: lateFee,
        sub_payout: subFee,
        eagle_payout: eaglePayout,
        total_club: p.is_no_show ? noShowFee : totalOwed,
        total_member: totalMemberAmount,
        debtor_creditor: debtorCreditor,
      };

      await supabase.from("day_results").insert(record);
      results.push({ member_id: p.member_id, guest_id: p.guest_id, ...record });
    }

    return NextResponse.json({
      message: `Generated ${results.length} day_results for game ${adhocGameId}`,
      game_date: game.game_date,
      results,
    });
  } catch (err) {
    console.error("Generate day_results error:", err);
    return NextResponse.json({ error: "Failed to generate day results" }, { status: 500 });
  }
}
