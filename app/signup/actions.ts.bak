"use server";

import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function createGolfClub(data: {
  club_name: string;
  password: string;
  primary_contact_name: string;
  primary_contact_surname: string;
  primary_contact_number: string;
  primary_contact_email: string;
  secondary_contact_name?: string;
  secondary_contact_surname?: string;
  secondary_contact_number?: string;
  secondary_contact_email?: string;
}) {
  try {
    const supabase = getAdminClient();

    // Check if club already exists
    const { data: existing } = await supabase
      .from("golf_clubs")
      .select("club_id")
      .ilike("club_name", data.club_name)
      .maybeSingle();

    if (existing) {
      return { error: "A club with this name already exists." };
    }

    const { data: club, error } = await supabase
      .from("golf_clubs")
      .insert({
        club_name: data.club_name.trim(),
        password: data.password,
        number_of_members: 0,
        primary_contact_name: data.primary_contact_name.trim(),
        primary_contact_surname: data.primary_contact_surname.trim(),
        primary_contact_number: data.primary_contact_number.trim(),
        primary_contact_email: data.primary_contact_email.trim(),
        secondary_contact_name: data.secondary_contact_name?.trim() || null,
        secondary_contact_surname: data.secondary_contact_surname?.trim() || null,
        secondary_contact_number: data.secondary_contact_number?.trim() || null,
        secondary_contact_email: data.secondary_contact_email?.trim() || null,
      })
      .select("club_id, club_name")
      .single();

    if (error) {
      console.error("Create club error:", error);
      return { error: "Failed to create club. Please try again." };
    }

    return { success: true, club };
  } catch (err) {
    console.error("Create club error:", err);
    return { error: "An unexpected error occurred." };
  }
}

export async function addMembersToClub(clubId: number, members: { name: string; contact_number: string; official_handicap?: string; remmoho_handicap?: string }[]) {
  try {
    const supabase = getAdminClient();

    const rows = members
      .filter(m => m.name.trim())
      .map(m => ({
        member_name: m.name.trim(),
        contact_number: m.contact_number.trim() || null,
        club_id: clubId,
        _official_handicap: m.official_handicap ? parseFloat(m.official_handicap) : null,
        _remmoho_handicap: m.remmoho_handicap ? parseFloat(m.remmoho_handicap) : null,
      }));

    if (rows.length === 0) {
      return { error: "Please add at least one member." };
    }

    // Check for existing members with the same name + contact ONLY IN THIS CLUB
    // Same name in different clubs is allowed
    const memberKeys = rows.map(r => `${r.member_name.toLowerCase()}|${r.contact_number || ""}`);
    const { data: existingMembers } = await supabase
      .from("members")
      .select("member_name, contact_number")
      .eq("club_id", clubId);

    const existingKeys = new Set(
      (existingMembers || []).map(m => `${m.member_name.toLowerCase()}|${m.contact_number || ""}`)
    );
    
    // Filter out members that already exist IN THIS CLUB
    const newRows = rows.filter(r => !existingKeys.has(`${r.member_name.toLowerCase()}|${r.contact_number || ""}`));
    const skippedCount = rows.length - newRows.length;

    if (newRows.length === 0) {
      return { error: `All ${rows.length} member(s) already exist in this club.` };
    }

    // Strip private handicap fields before inserting into members table
    const memberInsertRows = newRows.map(({ _official_handicap: _o, _remmoho_handicap: _r, ...rest }) => rest);

    const { data, error } = await supabase
      .from("members")
      .insert(memberInsertRows)
      .select("member_id, member_name");

    if (error) {
      console.error("Add members error:", error);
      if (error.code === "23505") {
        return { error: "One or more members already exist in this club. Please check the names and try again." };
      }
      return { error: "Failed to add members. Please try again." };
    }

    // Insert handicap indices for members that have them
    if (data && data.length > 0) {
      // Helper to clamp handicap to valid range (precision 4, scale 1 = max 999.9)
      const clampHandicap = (val: number | null): number | null => {
        if (val === null || val === undefined) return null;
        const num = Number(val);
        if (isNaN(num)) return null;
        // Clamp to reasonable golf handicap range (-10 to 54 per WHS, but allow up to 99.9 for flexibility)
        return Math.min(99.9, Math.max(-10, Math.round(num * 10) / 10));
      };

      const handicapRows = data
        .map((inserted, idx) => {
          const original = newRows.find(r => r.member_name === inserted.member_name);
          const official = clampHandicap(original?._official_handicap ?? null);
          const remmoho = clampHandicap(original?._remmoho_handicap ?? null);
          
          // Always create a record if we have an official handicap (Club handicap)
          // If no official handicap, still create record with remmoho if available
          if (official === null && remmoho === null) return null;
          
          return {
            member_id: inserted.member_id,
            official_handicap_index: official || 0, // Use 0 if not provided
            remmoho_handicap_index: remmoho || null,
            effective_date: new Date().toISOString().split("T")[0],
            season: String(new Date().getFullYear()),
          };
        })
        .filter(Boolean);
      if (handicapRows.length > 0) {
        await supabase.from("member_handicap_indices").insert(handicapRows);
      }
    }

    // Update member count on the club
    const { count } = await supabase
      .from("members")
      .select("member_id", { count: "exact", head: true })
      .eq("club_id", clubId);
    
    await supabase
      .from("golf_clubs")
      .update({ number_of_members: count || 0 })
      .eq("club_id", clubId);

    const addedCount = data?.length || 0;
    const message = skippedCount > 0 
      ? `Added ${addedCount} member(s). ${skippedCount} member(s) already existed in this club and were skipped.`
      : undefined;

    return { success: true, count: addedCount, message };
  } catch (err) {
    console.error("Add members error:", err);
    return { error: "An unexpected error occurred." };
  }
}
