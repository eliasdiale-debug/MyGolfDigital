// app/api/admin/import-whatsapp-pairings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  const { fourballs, gameId } = await request.json();
  
  if (!fourballs || !gameId) {
    return NextResponse.json({ error: "Missing fourballs or gameId" }, { status: 400 });
  }
  
  const supabase = createClient();
  
  // Delete existing pairings for this game
  await supabase.from("pairings").delete().eq("adhoc_game_id", gameId);
  
  // Also clear opt-ins
  await supabase.from("adhoc_game_wwb_optins").delete().eq("adhoc_game_id", gameId);
  
  // Get game info for guest creation
  const { data: game } = await supabase
    .from("adhoc_games")
    .select("game_date, course_id")
    .eq("adhoc_game_id", gameId)
    .single();

  // Insert new pairings and opt-ins
  for (const fb of fourballs) {
    for (let i = 0; i < fb.members.length; i++) {
      const member = fb.members[i];
      
      let memberId = member.member_id;
      let guestId = null;
      
      // Handle guests
      if (member.isGuest) {
        // Create guest record
        const { data: guestData, error: guestError } = await supabase
          .from("guests")
          .insert({
            guest_name: member.guest_name || member.name,
            game_date: game?.game_date,
            course_id: game?.course_id,
          })
          .select()
          .single();
        
        if (guestError) {
          console.error("Error creating guest:", guestError);
          continue;
        }
        
        guestId = guestData.guest_id;
        // Use negative guest_id as member_id for pairing
        memberId = -guestId;
      } else if (!member.member_id && !member.isGuest) {
        // Skip unmatched non-guest players
        console.warn(`Skipping unmatched player: ${member.name}`);
        continue;
      }
      
      // Insert pairing
      const { data: pairing, error: pairingError } = await supabase
        .from("pairings")
        .insert({
          adhoc_game_id: gameId,
          fourball_number: fb.fourball_number,
          member_id: memberId,
          guest_id: guestId,
          is_captain: i === 0,
          playing_handicap: member.handicap ?? (member.isGuest ? 18 : null),
          tee_off_time: fb.tee_time,
          // ET = Early Tee starts on Hole 1, LT = Late Tee starts on Hole 10
          starting_hole: member.lt ? 10 : (member.et ? 1 : (fb.tee_box === 'F' ? 1 : 10)),
        })
        .select()
        .single();
      
      if (pairingError) {
        console.error("Error inserting pairing:", pairingError);
        continue;
      }
      
      // Insert WWB opt-in if applicable
      if (member.wwb || member.birdie) {
        // For guests, use guest_id; for members, use member_id
        if (guestId) {
          await supabase.from("adhoc_game_wwb_optins").upsert({
            adhoc_game_id: gameId,
            guest_id: guestId,
            member_id: null,
            ww: member.wwb || false,
            birdie: member.birdie || false,
          }, { onConflict: "adhoc_game_id,guest_id" });
        } else {
          await supabase.from("adhoc_game_wwb_optins").upsert({
            adhoc_game_id: gameId,
            member_id: member.member_id,
            guest_id: null,
            ww: member.wwb || false,
            birdie: member.birdie || false,
          }, { onConflict: "adhoc_game_id,member_id" });
        }
        
        // Also update the pairing record
        if (pairing) {
          await supabase
            .from("pairings")
            .update({
              wwb_ww: member.wwb || false,
              wwb_birdie: member.birdie || false,
            })
            .eq("pairing_id", pairing.pairing_id);
        }
      }
    }
  }
  
  // Update game tee start based on ET/LT presence
  const hasEarlyTee = fourballs.some((fb: { members: { et?: boolean }[] }) => fb.members.some(m => m.et));
  const hasLateTee = fourballs.some((fb: { members: { lt?: boolean }[] }) => fb.members.some(m => m.lt));
  
  if (hasEarlyTee && hasLateTee) {
    await supabase
      .from("adhoc_games")
      .update({ tee_start: 'split' })
      .eq("adhoc_game_id", gameId);
  }
  
  return NextResponse.json({ success: true, fourballsCount: fourballs.length });
}
