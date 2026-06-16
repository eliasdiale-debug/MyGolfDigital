import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";

const supabase = createApiClient();
// Calculate Stableford points for a single hole
function calculateStablefordPoints(
  strokes: number,
  par: number,
  strokeIndex: number,
  playingHandicap: number
): number {
  // How many strokes does the player get on this hole?
  let extraStrokes = 0;
  if (playingHandicap >= strokeIndex) extraStrokes++;
  if (playingHandicap >= strokeIndex + 18) extraStrokes++;
  if (playingHandicap >= strokeIndex + 36) extraStrokes++; // For very high handicaps

  const netStrokes = strokes - extraStrokes;
  const scoreToPar = netStrokes - par;

  // Stableford points: 0 = double bogey or worse, 1 = bogey, 2 = par, 3 = birdie, 4 = eagle, 5 = albatross
  if (scoreToPar >= 2) return 0;      // Double bogey or worse
  if (scoreToPar === 1) return 1;     // Bogey
  if (scoreToPar === 0) return 2;     // Par
  if (scoreToPar === -1) return 3;    // Birdie
  if (scoreToPar === -2) return 4;    // Eagle
  if (scoreToPar === -3) return 5;    // Albatross
  return 6;                            // Double eagle or better (extremely rare)
}

export async function POST(req: NextRequest) {
  try {
    const { adhocGameId } = await req.json();
    if (!adhocGameId) return NextResponse.json({ error: "adhocGameId required" }, { status: 400 });

    // ── 1. Load game info ────────────────────────────────────────────────────
    const { data: game, error: gameErr } = await supabase
      .from("adhoc_games")
      .select("adhoc_game_id, game_date, course_id, club_id, cost_per_player, game_type, is_multi_round, total_rounds, round_number")
      .eq("adhoc_game_id", adhocGameId)
      .single();
    if (gameErr || !game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    const { game_date, course_id, club_id, cost_per_player, game_type } = game;
    const greenFees = cost_per_player || 0;
    const isMedal = game_type === "Medal";

    // ── Multi-round check ────────────────────────────────────────────────────
    // For intermediate rounds (not the last round), skip financial/stat records.
    // Only write performance_records, day_results and accounts on the FINAL round.
    const isMultiRound = !!(game as Record<string,unknown>).is_multi_round;
    const totalRounds: number = (game as Record<string,unknown>).total_rounds as number ?? 1;
    const roundNumber: number = (game as Record<string,unknown>).round_number as number ?? 1;
    const isIntermediateRound = isMultiRound && roundNumber < totalRounds;

    // ── 2. Load all pairings for this game ───────────────────────────────────
    const { data: pairings, error: pairErr } = await supabase
      .from("pairings")
      .select("pairing_id, member_id, guest_id, gross_score, points, playing_handicap, birdies_count, eagles_count, hio_count, ladies_count, is_late, is_no_show, is_sub, result_submitted, wwb_birdie, guests(guest_name), members(member_name)")
      .eq("adhoc_game_id", adhocGameId);
    if (pairErr || !pairings) return NextResponse.json({ error: "Pairings not found" }, { status: 404 });

    // ── 2a. AGGREGATION STEP: Check for hole_scores and aggregate to pairings ──
    // If a pairing has hole_scores but no gross_score, calculate and update it
    const { data: holeScores } = await supabase
      .from("hole_scores")
      .select("pairing_id, hole_number, strokes, is_lady")
      .eq("adhoc_game_id", adhocGameId);

    const { data: courseHoles } = await supabase
      .from("course_holes")
      .select("hole_number, par, stroke_index")
      .eq("course_id", course_id)
      .order("hole_number");

    // Group hole scores by pairing_id
    const scoresByPairing: Record<number, { hole_number: number; strokes: number; is_lady?: boolean }[]> = {};
    if (holeScores) {
      holeScores.forEach(hs => {
        if (!scoresByPairing[hs.pairing_id]) scoresByPairing[hs.pairing_id] = [];
        scoresByPairing[hs.pairing_id].push(hs);
      });
    }

    // Create a lookup for course holes
    const holeInfo: Record<number, { par: number; stroke_index: number }> = {};
    if (courseHoles) {
      courseHoles.forEach(ch => {
        holeInfo[ch.hole_number] = { par: ch.par, stroke_index: ch.stroke_index };
      });
    }

    // Update pairings that have hole_scores but missing gross_score
    for (const pairing of pairings) {
      const pairingScores = scoresByPairing[pairing.pairing_id];
      
      // Skip if no hole scores exist for this pairing
      if (!pairingScores || pairingScores.length === 0) continue;
      
      // Skip if gross_score is already set (scores were manually entered)
      if (pairing.gross_score !== null && pairing.gross_score !== undefined) continue;

      // Calculate gross score (sum of strokes)
      const grossScore = pairingScores.reduce((sum, hs) => sum + (hs.strokes || 0), 0);
      
      // Calculate Stableford points if we have course hole data and playing handicap
      let totalPoints = 0;
      const playingHcp = pairing.playing_handicap ?? 0;
      
      if (Object.keys(holeInfo).length > 0) {
        pairingScores.forEach(hs => {
          const hole = holeInfo[hs.hole_number];
          if (hole && hs.strokes) {
            totalPoints += calculateStablefordPoints(hs.strokes, hole.par, hole.stroke_index, playingHcp);
          }
        });
      }

      // Count ladies (holes marked as is_lady)
      const ladiesCount = pairingScores.filter(hs => hs.is_lady).length;

      // Update the pairing with aggregated values
      const updateData: Record<string, unknown> = {
        gross_score: grossScore,
        result_submitted: true,
        scores_submitted_at: new Date().toISOString(),
      };

      // Only set points for non-Medal games
      if (!isMedal && totalPoints > 0) {
        updateData.points = totalPoints;
      }

      // Update ladies_count if we found any
      if (ladiesCount > 0 && (pairing.ladies_count === null || pairing.ladies_count === 0)) {
        updateData.ladies_count = ladiesCount;
      }

      await supabase
        .from("pairings")
        .update(updateData)
        .eq("pairing_id", pairing.pairing_id);

      // Update local pairing object for the rest of the processing
      pairing.gross_score = grossScore;
      pairing.points = isMedal ? null : totalPoints;
      pairing.result_submitted = true;
      if (ladiesCount > 0) pairing.ladies_count = ladiesCount;

      console.log(`[finalize-game] Aggregated hole scores for pairing ${pairing.pairing_id}: gross=${grossScore}, points=${totalPoints}, ladies=${ladiesCount}`);
    }

    // ── END AGGREGATION STEP ──

    // Only process members (not guests) who submitted results
    const memberPairings = pairings.filter(p => !p.guest_id && p.result_submitted);

    // ── 3. Compute game-wide totals (for sin calculations) ───────────────────
    const activePlayers = memberPairings.filter(p => !p.is_no_show);
    const totalBirdies = activePlayers.reduce((s, p) => s + (p.birdies_count || 0), 0);
    const totalEagles = activePlayers.reduce((s, p) => s + (p.eagles_count || 0), 0);
    const totalHio = activePlayers.reduce((s, p) => s + (p.hio_count || 0), 0);

    // ── 4. Check what already exists to avoid duplicates ────────────────────
    const memberIds = memberPairings.map(p => p.member_id);
    const { data: existingPR } = await supabase
      .from("performance_records")
      .select("member_id")
      .eq("course_id", course_id)
      .eq("game_date", game_date)
      .in("member_id", memberIds);
    const { data: existingDR } = await supabase
      .from("day_results")
      .select("member_id")
      .eq("course_id", course_id)
      .eq("game_date", game_date)
      .in("member_id", memberIds);

    const existingPRIds = new Set((existingPR || []).map(r => r.member_id));
    const existingDRIds = new Set((existingDR || []).map(r => r.member_id));

    // ── 5. Process each member ───────────────────────────────────────────────
    for (const p of memberPairings) {
      const {
        member_id, gross_score, points, playing_handicap,
        birdies_count: birdies = 0, eagles_count: eagles = 0,
        hio_count: hio = 0, ladies_count: ladies = 0,
        is_late = false, is_no_show = false, is_sub = false
      } = p;

      // Sin calculations (same as client-side handleSaveResults)
      let subFee = 0;
      if (!isMedal) {
        const pts = points || 0;
        if (pts < 10) subFee = 150;
        else if (pts <= 17) subFee = 100;
        else if (pts <= 25) subFee = 50;
        else if (pts <= 29) subFee = 20;
      }
      const ladiesFee = ladies > 0 ? 100 : 0;
      const lateFee = is_late ? 110 : 0;
      const birdieCharge = (totalBirdies - birdies) * 20;
      const eagleCharge = totalEagles * 20;
      const hioCharge = totalHio * 50;
      const noShowFee = is_no_show ? greenFees + birdieCharge + eagleCharge + hioCharge : 0;
      const totalOwed = is_no_show ? noShowFee : subFee + ladiesFee + lateFee + birdieCharge + eagleCharge + hioCharge;
      const debtorCreditor = -totalOwed;

      // For intermediate rounds of a multi-round game, we only update the pairings row
      // (already done above). Skip all financial/stat writes until the final round.
      if (isIntermediateRound) continue;

      // ── 5a. performance_records ──────────────────────────────────────────
      if (!is_no_show) {
        const prRow: Record<string, unknown> = {
          member_id,
          course_id,
          game_date,
          club_id,
          gross_score: gross_score || null,
          points: !isMedal ? (points || null) : null,
        };
        if (isMedal) {
          prRow.medal_game = true;
          prRow.medal_gross = gross_score || null;
          prRow.medal_net = gross_score != null && playing_handicap != null ? gross_score - playing_handicap : null;
        }
        const { data: prData } = await supabase
          .from("performance_records")
          .upsert(prRow, { onConflict: "member_id,course_id,game_date", ignoreDuplicates: false })
          .select("record_id")
          .single();

        const recordId = prData?.record_id || null;

        // birdies - delete existing then insert (no unique constraint exists)
        if (birdies > 0) {
          await supabase.from("birdies").delete().eq("member_id", member_id).eq("game_date", game_date);
          await supabase.from("birdies").insert(
            { member_id, course_id, record_id: recordId, game_date, birdie_count: birdies }
          );
        }
        // eagles - delete existing then insert (no unique constraint exists)
        if (eagles > 0) {
          await supabase.from("eagles").delete().eq("member_id", member_id).eq("game_date", game_date);
          await supabase.from("eagles").insert(
            { member_id, course_id, record_id: recordId, game_date, eagle_count: eagles }
          );
        }
        // ladies - delete existing then insert (no unique constraint exists)
        if (ladies > 0) {
          await supabase.from("ladies").delete().eq("member_id", member_id).eq("game_date", game_date);
          await supabase.from("ladies").insert(
            { member_id, course_id, record_id: recordId, game_date, ladies_count: ladies }
          );
        }
      }

      // ── 5b. late / no_shows ──────────────────────────────────────────────
      if (is_late) {
        const { data: existLate } = await supabase.from("late").select("id").eq("member_id", member_id).eq("game_date", game_date).maybeSingle();
        if (!existLate) await supabase.from("late").insert({ member_id, game_date });
      }
      if (is_no_show) {
        const { data: existNS } = await supabase.from("no_shows").select("id").eq("member_id", member_id).eq("game_date", game_date).maybeSingle();
        if (!existNS) await supabase.from("no_shows").insert({ member_id, game_date });
      }

      // ── 5c. day_results ──────────────────────────────────────────────────
      if (!existingDRIds.has(member_id)) {
        const drRow: Record<string, unknown> = {
          game_date,
          course_id,
          member_id,
          club_id,
          gross_score: is_no_show ? null : (gross_score || null),
          points: is_no_show || isMedal ? null : (points || null),
          playing_handicap: is_no_show ? null : (playing_handicap || null),
          birdies_count: birdies,
          eagles_count: eagles,
          ladies_count: ladies,
          is_late,
          is_sub,
          no_show_fee: noShowFee,
          cash_paid: is_no_show ? 0 : greenFees,
          birdie_pool: 0,
          lady_payout: ladiesFee,
          late_payout: lateFee,
          sub_payout: subFee,
          eagle_payout: 0,
          total_club: is_no_show ? noShowFee : totalOwed,
          total_member: 0,
          debtor_creditor: debtorCreditor,
        };
        if (isMedal) {
          drRow.medal_gross = gross_score || null;
          drRow.medal_net = gross_score != null && playing_handicap != null ? gross_score - playing_handicap : null;
        }
        await supabase.from("day_results").insert(drRow);
      }

      // ── 5d. accounts ─────────────────────────────────────────────────────
      if (debtorCreditor !== 0) {
        // Only insert if no account entry already exists for this member+date+course
        const { data: existAcc } = await supabase
          .from("accounts")
          .select("account_id")
          .eq("member_id", member_id)
          .eq("transaction_date", game_date)
          .eq("course_id", course_id)
          .maybeSingle();

        if (!existAcc) {
          const { data: latestAcc } = await supabase
            .from("accounts")
            .select("balance")
            .eq("member_id", member_id)
            .order("account_id", { ascending: false })
            .limit(1)
            .maybeSingle();
          const currentBalance = latestAcc?.balance ?? 0;
          const sinAmount = Math.abs(debtorCreditor);
          const newBalance = currentBalance + sinAmount;
          const { data: courseRow } = await supabase.from("courses").select("course_name").eq("course_id", course_id).maybeSingle();
          await supabase.from("accounts").insert({
            member_id,
            transaction_date: game_date,
            course_id,
            description: `${courseRow?.course_name || "Game"} - Sins`,
            debit: sinAmount,
            credit: 0,
            balance: newBalance,
          });
        }
      }
    }

    // ── 5e. Process guests for day_results (no performance_records or accounts) ────
    if (!isIntermediateRound) {
      const guestPairings = pairings.filter(p => p.guest_id && !p.member_id && p.result_submitted);
      
      // Check existing guest day_results
      const guestIds = guestPairings.map(p => p.guest_id).filter(Boolean) as number[];
      const { data: existingGuestDR } = guestIds.length > 0 ? await supabase
        .from("day_results")
        .select("guest_id")
        .eq("course_id", course_id)
        .eq("game_date", game_date)
        .in("guest_id", guestIds) : { data: [] };
      
      const existingGuestDRIds = new Set((existingGuestDR || []).map(r => r.guest_id));
      
      for (const gp of guestPairings) {
        if (!gp.guest_id || existingGuestDRIds.has(gp.guest_id)) continue;
        
        const guestData = (gp as Record<string, unknown>).guests as { guest_name: string } | null;
        const gross_score = gp.gross_score;
        const points = gp.points || 0;
        const playing_handicap = gp.playing_handicap;
        const birdies = gp.birdies_count || 0;
        const eagles = gp.eagles_count || 0;
        const ladies = gp.ladies_count || 0;
        const is_late = gp.is_late || false;
        const is_no_show = gp.is_no_show || false;
        const is_sub = gp.is_sub || false;
        
        // Calculate fees for guest (similar to members)
        let subFee = 0;
        if (!isMedal && !is_no_show) {
          if (points < 10) subFee = 150;
          else if (points <= 17) subFee = 100;
          else if (points <= 25) subFee = 50;
          else if (points <= 29) subFee = 20;
        }
        const ladiesFee = ladies > 0 ? 100 : 0;
        const lateFee = is_late ? 110 : 0;
        const birdieCharge = (totalBirdies - birdies) * 20;
        const eagleCharge = totalEagles * 20;
        const hioCharge = totalHio * 50;
        const noShowFee = is_no_show ? greenFees + birdieCharge + eagleCharge + hioCharge : 0;
        const totalOwed = is_no_show ? noShowFee : subFee + ladiesFee + lateFee + birdieCharge + eagleCharge + hioCharge;
        const debtorCreditor = -totalOwed;
        
        const guestDrRow: Record<string, unknown> = {
          game_date,
          course_id,
          member_id: null,
          guest_id: gp.guest_id,
          guest_name: guestData?.guest_name || null,
          club_id,
          gross_score: is_no_show ? null : (gross_score || null),
          points: is_no_show || isMedal ? null : (points || null),
          playing_handicap: is_no_show ? null : (playing_handicap || null),
          birdies_count: birdies,
          eagles_count: eagles,
          ladies_count: ladies,
          is_late,
          is_sub,
          no_show_fee: noShowFee,
          cash_paid: is_no_show ? 0 : greenFees,
          birdie_pool: 0,
          lady_payout: ladiesFee,
          late_payout: lateFee,
          sub_payout: subFee,
          eagle_payout: 0,
          total_club: is_no_show ? noShowFee : totalOwed,
          total_member: 0,
          debtor_creditor: debtorCreditor,
        };
        if (isMedal) {
          guestDrRow.medal_gross = gross_score || null;
          guestDrRow.medal_net = gross_score != null && playing_handicap != null ? gross_score - playing_handicap : null;
        }
        await supabase.from("day_results").insert(guestDrRow);
      }
    }

    // ── 6. Calculate and store WWB (Birdie Pool) results ────────────────────
    // Only for WWB-enabled clubs (Club 13 = WSOE, Club 4 = Tuesday Clinique)
    const WWB_CLUB_IDS = [13, 4];
    if (WWB_CLUB_IDS.includes(club_id) && !isIntermediateRound) {
      // Get birdie pool fee from game
      const { data: gameWithFee } = await supabase
        .from("adhoc_games")
        .select("birdie_pool_fee")
        .eq("adhoc_game_id", adhocGameId)
        .single();
      const birdiePoolFee = gameWithFee?.birdie_pool_fee ?? 50;

      // Find all entrants who opted into the birdie pool (wwb_birdie = true)
      // Include both members and guests
      const birdieEntrants = pairings.filter(p => 
        p.wwb_birdie === true && 
        p.result_submitted && 
        !p.is_no_show
      );
      
      const entrantCount = birdieEntrants.length;
      const poolTotal = entrantCount * birdiePoolFee;
      
      // Sum total birdies from all entrants
      const totalBirdiesFromEntrants = birdieEntrants.reduce((sum, p) => sum + (p.birdies_count || 0), 0);
      
      // Calculate per-birdie payout (avoid division by zero)
      const perBirdiePayout = totalBirdiesFromEntrants > 0 ? poolTotal / totalBirdiesFromEntrants : 0;
      
      // Upsert wwb_results
      await supabase.from("wwb_results").upsert({
        adhoc_game_id: adhocGameId,
        club_id,
        game_date,
        birdie_pool_total: poolTotal,
        birdie_pool_per_birdie: perBirdiePayout,
        birdie_pool_entrants: entrantCount,
        birdie_pool_total_birdies: totalBirdiesFromEntrants,
      }, { onConflict: "adhoc_game_id" });
      
      // Delete existing birdie payouts for this game and insert fresh ones
      await supabase.from("wwb_birdie_payouts").delete().eq("adhoc_game_id", adhocGameId);
      
      // Calculate and insert individual payouts for entrants with birdies
      // Handle guests: if member_id is negative, it's a guest with guest_id = abs(member_id)
      const payoutRows = birdieEntrants
        .filter(p => (p.birdies_count || 0) > 0)
        .map(p => {
          const isGuest = (p.member_id || 0) < 0;
          const actualGuestId = isGuest ? Math.abs(p.member_id || 0) : (p.guest_id || null);
          return {
            adhoc_game_id: adhocGameId,
            member_id: isGuest ? null : (p.member_id || null),
            guest_id: actualGuestId,
            birdies_scored: p.birdies_count || 0,
            payout_amount: (p.birdies_count || 0) * perBirdiePayout,
          };
        });
      
      if (payoutRows.length > 0) {
        await supabase.from("wwb_birdie_payouts").insert(payoutRows);
      }
    }

    // ── 7. Mark round completed when every pairing has been submitted ────────
    // For multi-round games: mark each individual round as "completed" once all pairings
    // are in. The overall tournament is considered done when the FINAL round is completed.
    const allSubmitted = pairings.length > 0 && pairings.every(p => p.result_submitted);
    if (allSubmitted) {
      await supabase.from("adhoc_games").update({ status: "completed" }).eq("adhoc_game_id", adhocGameId);
    }

    return NextResponse.json({ success: true, allSubmitted });
  } catch (err) {
    console.error("[finalize-game]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
