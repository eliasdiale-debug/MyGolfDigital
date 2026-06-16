import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role for admin writes
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Attempt to scrape the HNA lookup page for a given hna_number.
// HNA does not have a public REST API. This scrapes the HTML response.
// If the page is unavailable (maintenance / migration) it returns null gracefully.
async function scrapeHnaHandicap(hnaNumber: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // HNA lookup form submits via POST to this endpoint (as of the pre-2026 system)
    const res = await fetch("https://www.handicaps.co.za/lookup-golfer/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; FairWayPro/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      body: new URLSearchParams({ golfer_id: hnaNumber, action: "lookup_golfer" }).toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const html = await res.text();

    // Parse handicap index from HTML — look for common patterns in HNA response
    // Pattern 1: "Handicap Index: 12.3" or "handicap_index">12.3<"
    const patterns = [
      /handicap[_\s-]index[^>]*>\s*([\d.]+)/i,
      /Handicap\s+Index[:\s]+([\d.]+)/i,
      /"handicap"[^>]*>\s*([\d.]+)/i,
      /HI[:\s]+([\d.]+)/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const val = parseFloat(match[1]);
        if (!isNaN(val) && val >= 0 && val <= 54) return val;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// POST /api/hna/fetch-handicap
// Body: { member_id: number, hna_number: string }
// Fetches the HNA handicap index for a member and updates the DB.
export async function POST(req: NextRequest) {
  try {
    const { member_id, hna_number } = await req.json();
    if (!member_id || !hna_number) {
      return NextResponse.json({ error: "member_id and hna_number are required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Save hna_number to the member record
    await supabase.from("members").update({ hna_number }).eq("member_id", member_id);

    // Attempt live scrape
    const scraped = await scrapeHnaHandicap(String(hna_number));

    if (scraped !== null) {
      // Upsert into member_handicap_indices
      const { data: existing } = await supabase
        .from("member_handicap_indices")
        .select("handicap_index_id, official_handicap_index")
        .eq("member_id", member_id)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date().toISOString();
      if (existing) {
        await supabase
          .from("member_handicap_indices")
          .update({
            previous_handicap_index: existing.official_handicap_index,
            official_handicap_index: scraped,
            hna_last_synced: now,
            hna_sync_source: "hna_scrape",
            effective_date: now.split("T")[0],
            updated_at: now,
          })
          .eq("member_id", member_id);
      } else {
        await supabase.from("member_handicap_indices").insert({
          member_id,
          official_handicap_index: scraped,
          hna_last_synced: now,
          hna_sync_source: "hna_scrape",
          effective_date: now.split("T")[0],
          created_at: now,
          updated_at: now,
        });
      }
      return NextResponse.json({ success: true, handicap_index: scraped, source: "hna_scrape" });
    }

    // HNA scrape unavailable — return success with null so UI can prompt manual entry
    return NextResponse.json({ success: true, handicap_index: null, source: "unavailable", message: "HNA lookup is currently unavailable. Please enter the handicap manually." });
  } catch (err) {
    console.error("[HNA] fetch-handicap error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/hna/bulk-sync
// Body: { club_id: number }
// Syncs HNA handicaps for all members of a club that have an hna_number set.
export async function PUT(req: NextRequest) {
  try {
    const { club_id } = await req.json();
    if (!club_id) return NextResponse.json({ error: "club_id required" }, { status: 400 });

    const supabase = getSupabase();
    const { data: members } = await supabase
      .from("members")
      .select("member_id, member_name, hna_number")
      .eq("club_id", club_id)
      .not("hna_number", "is", null);

    if (!members || members.length === 0) {
      return NextResponse.json({ synced: 0, message: "No members with HNA numbers found" });
    }

    let synced = 0, failed = 0, unavailable = 0;
    const results: { member_id: number; member_name: string; handicap_index: number | null; status: string }[] = [];

    for (const member of members) {
      if (!member.hna_number) continue;
      const scraped = await scrapeHnaHandicap(member.hna_number);
      if (scraped !== null) {
        const { data: existing } = await supabase
          .from("member_handicap_indices")
          .select("handicap_index_id, official_handicap_index")
          .eq("member_id", member.member_id)
          .order("effective_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        const now = new Date().toISOString();
        if (existing) {
          await supabase.from("member_handicap_indices").update({
            previous_handicap_index: existing.official_handicap_index,
            official_handicap_index: scraped,
            hna_last_synced: now,
            hna_sync_source: "hna_scrape",
            effective_date: now.split("T")[0],
            updated_at: now,
          }).eq("member_id", member.member_id);
        } else {
          await supabase.from("member_handicap_indices").insert({
            member_id: member.member_id,
            official_handicap_index: scraped,
            hna_last_synced: now,
            hna_sync_source: "hna_scrape",
            effective_date: now.split("T")[0],
            created_at: now,
            updated_at: now,
          });
        }
        synced++;
        results.push({ member_id: member.member_id, member_name: member.member_name, handicap_index: scraped, status: "synced" });
      } else {
        unavailable++;
        results.push({ member_id: member.member_id, member_name: member.member_name, handicap_index: null, status: "unavailable" });
      }
    }

    return NextResponse.json({ synced, failed, unavailable, total: members.length, results });
  } catch (err) {
    console.error("[HNA] bulk-sync error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
