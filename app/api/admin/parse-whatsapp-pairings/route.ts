// app/api/admin/parse-whatsapp-pairings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

interface ParsedPlayer {
  name: string;
  wwb: boolean;
  birdie: boolean;
  et: boolean;
  lt: boolean;
  raw_text: string;
}

interface ParsedFourball {
  tee_time: string;
  tee_box: 'F' | 'B';
  fourball_number: number;
  players: ParsedPlayer[];
}

function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[✔️✅]/g, '')
    .trim();
}

// Check if player name indicates a guest
function isGuest(name: string): boolean {
  return /\(Guest\)|\[G\]|\bGuest\b/i.test(name);
}

// Remove guest markers from name
function cleanGuestName(name: string): string {
  return name
    .replace(/\(Guest\)|\[G\]|\bGuest\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMarkers(text: string): { wwb: boolean; birdie: boolean; et: boolean; lt: boolean; cleanName: string } {
  let wwb = false;
  let birdie = false;
  let et = false;
  let lt = false;
  let cleanName = text;
  
  // Check for WWB
  if (/WWB/i.test(text) || /WafaWafa/i.test(text)) {
    wwb = true;
    cleanName = cleanName.replace(/WWB|WafaWafa/gi, '');
  }
  
  // Check for Birdie (B)
  if (/\(B\)|\[B\]|Bir/i.test(text)) {
    birdie = true;
    cleanName = cleanName.replace(/\(B\)|\[B\]|Bir/gi, '');
  }
  
  // Check for ET (Early Tee)
  if (/\bET\b/i.test(text)) {
    et = true;
    cleanName = cleanName.replace(/\bET\b/gi, '');
  }
  
  // Check for LT (Late Tee)
  if (/\bLT\b/i.test(text)) {
    lt = true;
    cleanName = cleanName.replace(/\bLT\b/gi, '');
  }
  
  // Remove checkmarks and other symbols
  cleanName = cleanName.replace(/[✔️✅\u2713\u2714]/g, '');
  cleanName = cleanName.replace(/[()]/g, '');
  cleanName = normalizeName(cleanName);
  
  return { wwb, birdie, et, lt, cleanName };
}

function parseWhatsAppMessage(text: string): ParsedFourball[] {
  const lines = text.split(/\r?\n/);
  const fourballs: ParsedFourball[] = [];
  let currentTeeTime: string | null = null;
  let currentTeeBox: 'F' | 'B' | null = null;
  let currentFourball: ParsedFourball | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Match tee time line (e.g., "7:16 F" or "7:16 AM F")
    const teeTimeMatch = trimmed.match(/^(\d{1,2}:\d{2})(?:\s*(?:AM|PM))?\s+([FB])$/i);
    if (teeTimeMatch) {
      // Save previous fourball if exists
      if (currentFourball && currentFourball.players.length > 0) {
        fourballs.push(currentFourball);
      }
      currentTeeTime = teeTimeMatch[1];
      currentTeeBox = teeTimeMatch[2].toUpperCase() as 'F' | 'B';
      currentFourball = null;
      continue;
    }
    
    // Match numbered player line (e.g., "1. Mandla Msimang ✔️✅ (WWB)")
    const playerMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (playerMatch && currentTeeTime && currentTeeBox) {
      const playerText = playerMatch[1];
      const markers = extractMarkers(playerText);
      
      // Start new fourball if needed (4 players per fourball)
      if (!currentFourball) {
        currentFourball = {
          tee_time: currentTeeTime,
          tee_box: currentTeeBox,
          fourball_number: fourballs.length + 1,
          players: [],
        };
      }
      
      currentFourball.players.push({
        name: markers.cleanName,
        wwb: markers.wwb,
        birdie: markers.birdie,
        et: markers.et,
        lt: markers.lt,
        raw_text: playerText,
      });
      
      // If we have 4 players, save and reset
      if (currentFourball.players.length === 4) {
        fourballs.push(currentFourball);
        currentFourball = null;
      }
    }
  }
  
  // Save any remaining fourball
  if (currentFourball && currentFourball.players.length > 0) {
    fourballs.push(currentFourball);
  }
  
  return fourballs;
}

async function findPlayerByName(name: string, clubId: number) {
  const supabase = createClient();
  const cleanName = normalizeName(name).toLowerCase();
  
  // Try exact match
  let { data } = await supabase
    .from("members")
    .select("member_id, member_name, member_handicap_indices(remmoho_handicap_index)")
    .ilike("member_name", cleanName)
    .eq("club_id", clubId)
    .limit(1);
  
  if (data && data.length > 0) {
    return data[0];
  }
  
  // Try first name only
  const firstName = cleanName.split(" ")[0];
  if (firstName) {
    const { data: firstNameMatch } = await supabase
      .from("members")
      .select("member_id, member_name, member_handicap_indices(remmoho_handicap_index)")
      .ilike("member_name", `${firstName}%`)
      .eq("club_id", clubId)
      .limit(1);
    
    if (firstNameMatch && firstNameMatch.length > 0) {
      return firstNameMatch[0];
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  const { text, gameId } = await request.json();
  
  if (!text || !gameId) {
    return NextResponse.json({ error: "Missing text or gameId" }, { status: 400 });
  }
  
  // Parse the WhatsApp message
  const parsedFourballs = parseWhatsAppMessage(text);
  
  if (parsedFourballs.length === 0) {
    return NextResponse.json({ error: "No valid fourballs found in text" }, { status: 400 });
  }
  
  // Get club ID from game
  const supabase = createClient();
  const { data: game } = await supabase
    .from("adhoc_games")
    .select("club_id")
    .eq("adhoc_game_id", gameId)
    .single();
  
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  
  // Match players to database
  const fourballsWithIds = [];
  const unmatchedPlayers: string[] = [];
  
  for (const fb of parsedFourballs) {
    const members = [];
    
    for (const player of fb.players) {
      // Check if this is a guest
      if (isGuest(player.raw_text)) {
        const guestName = cleanGuestName(player.name);
        members.push({
          member_id: null,
          guest_name: guestName,
          name: guestName,
          isGuest: true,
          wwb: player.wwb,
          birdie: player.birdie,
          et: player.et,
          lt: player.lt,
        });
      } else {
        // Look up in members table
        const dbPlayer = await findPlayerByName(player.name, game.club_id);
        
        if (dbPlayer) {
          members.push({
            member_id: dbPlayer.member_id,
            name: dbPlayer.member_name,
            isGuest: false,
            wwb: player.wwb,
            birdie: player.birdie,
            et: player.et,
            lt: player.lt,
            handicap: dbPlayer.member_handicap_indices?.[0]?.remmoho_handicap_index,
          });
        } else {
          unmatchedPlayers.push(player.name);
          members.push({
            member_id: null,
            name: player.name,
            isGuest: false,
            wwb: player.wwb,
            birdie: player.birdie,
            et: player.et,
            lt: player.lt,
            unmatched: true,
          });
        }
      }
    }
    
    fourballsWithIds.push({
      ...fb,
      members,
    });
  }
  
  return NextResponse.json({
    fourballs: fourballsWithIds,
    unmatched: unmatchedPlayers,
  });
}
