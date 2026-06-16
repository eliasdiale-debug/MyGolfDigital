"use server";

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

function makeSupabase() {
  // Server-side action: prefer server env vars, fall back to the public ones.
  // NEXT_PUBLIC_* vars are inlined for client bundles and aren't always present
  // in the server runtime, so we resolve across all available names.
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase environment variables are not configured (missing URL or key)."
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

export async function loginMember(formData: FormData) {
  const memberName    = (formData.get("memberName")    as string)?.trim();
  const credential    = (formData.get("contactNumber") as string)?.trim(); // PIN or contact number

  if (!memberName || !credential) {
    return { error: "Please enter your name and PIN" };
  }

  try {
    const supabase = makeSupabase();

    // Fetch all matching members (name match, case-insensitive), with club name
    // Left join so nomad members (club_id IS NULL) are also returned
    const { data: members, error } = await supabase
      .from("members")
      .select("member_id, member_name, contact_number, club_id, pin, pin_set, user_type, golf_clubs(club_name)")
      .ilike("member_name", memberName);

    if (error) {
      console.error("Login DB error:", error);
      return { error: "An error occurred. Please try again." };
    }

    if (!members || members.length === 0) {
      return { error: "Name not found. Check spelling or contact your admin." };
    }

    // Authenticate: try PIN first, then fall back to contact_number for legacy accounts
    const authenticated = members.filter(m => {
      if (m.pin_set && m.pin) {
        // Member has set a PIN — verify against bcrypt hash
        return bcrypt.compareSync(credential, m.pin);
      } else {
        // Legacy fallback: match contact number directly
        return m.contact_number === credential;
      }
    });

    if (authenticated.length === 0) {
      // Give a hint if they have a PIN set but didn't provide it
      const hasPin = members.some(m => m.pin_set);
      if (hasPin) {
        return { error: "Incorrect PIN. If you have forgotten your PIN, contact your club admin to reset it." };
      }
      return { error: "Incorrect PIN or contact number. Please try again." };
    }

    // Check whether any authenticated member still needs to set their PIN
    const needsPinSetup = authenticated.some(m => !m.pin_set);

    // Single club match
    if (authenticated.length === 1) {
      const m = authenticated[0];
      const isNomad = m.user_type === "nomad" || m.club_id === 999;
      return {
        success: true,
        needsPinSetup,
        member: {
          member_id:   m.member_id,
          member_name: m.member_name,
          club_id:     m.club_id,
          club_name:   isNomad ? "Nomads Golf Club" : ((m.golf_clubs as any)?.club_name || "Unknown Club"),
        },
      };
    }

    // Multiple clubs — return all for selection
    return {
      success: true,
      needsPinSetup,
      multipleClubs: true,
      members: authenticated.map(m => {
        const isNomad = m.user_type === "nomad" || m.club_id === 999;
        return {
          member_id:   m.member_id,
          member_name: m.member_name,
          club_id:     m.club_id,
          club_name:   isNomad ? "Nomads Golf Club" : ((m.golf_clubs as any)?.club_name || "Unknown Club"),
        };
      }),
    };
  } catch (err) {
    console.error("Login error:", err);
    return { error: "An error occurred. Please try again." };
  }
}

/** Set or update the member's PIN (called from first-login prompt and profile change) */
export async function setMemberPin(memberId: number, newPin: string) {
  if (!newPin || newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
    return { error: "PIN must be 4–8 digits." };
  }

  try {
    const supabase = makeSupabase();
    const hashed   = await bcrypt.hash(newPin, 10);
    const { error } = await supabase
      .from("members")
      .update({ pin: hashed, pin_set: true })
      .eq("member_id", memberId);

    if (error) return { error: "Failed to save PIN. Please try again." };
    return { success: true };
  } catch {
    return { error: "An error occurred." };
  }
}

/** Admin: clear a member's PIN so they fall back to contact_number login */
export async function adminResetMemberPin(adminId: number, targetMemberId: number) {
  // Define authorized admins (must match frontend CLUB_ADMINS in app/dashboard/page.tsx)
  const ELIAS_IDS = [9, 54, 111, 458]; // Elias Diale - super admin across all clubs
  const CLUB_ADMINS: number[] = [
    612, 725, 551, 631, 646, // Club 13 (WSOE) - Connie, Carl, Alfred, Mandla, Smart
    1392,                    // Club 19 (Fairway Finders) - Edwin Mpofu
    1311,                    // Club 23 (WGS) - Peter Ntsoko
  ];
  const AUTHORIZED_ADMINS = [...new Set([...ELIAS_IDS, ...CLUB_ADMINS, 37, 53])];
  
  if (!AUTHORIZED_ADMINS.includes(adminId)) {
    return { error: "Unauthorized: Only administrators can reset PINs" };
  }
  
  const supabase = makeSupabase();
  
  // Clear the PIN hash and force PIN reset on next login
  const { error } = await supabase
    .from("members")
    .update({ 
      pin: null,
      pin_set: false,
    })
    .eq("member_id", targetMemberId);
  
  if (error) {
    console.error("PIN reset error:", error);
    return { error: error.message };
  }
  
  return { success: true };
}

/** Create a new Nomad member account */
const NOMADS_CLUB_ID = 999; // Reserved club_id for Nomads Golf Club

export async function createNomadMember(data: {
  name: string;
  phone: string;
  pin: string;
  gender: "male" | "female";
}) {
  const { name, phone, pin, gender } = data;
  
  if (!name?.trim() || !phone?.trim() || !pin) {
    return { error: "All fields are required." };
  }
  
  if (pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
    return { error: "PIN must be 4-8 digits." };
  }
  
  try {
    const supabase = makeSupabase();
    
    // Check if phone already exists
    const { data: existing } = await supabase
      .from("members")
      .select("member_id")
      .eq("contact_number", phone.trim())
      .maybeSingle();
    
    if (existing) {
      return { error: "This phone number is already registered." };
    }
    
    // Hash the PIN
    const hashedPin = await bcrypt.hash(pin, 10);
    
    // Create nomad member - assigned to Nomads Golf Club (club_id = 999)
    const { data: newMember, error: insertError } = await supabase
      .from("members")
      .insert({
        member_name: name.trim(),
        contact_number: phone.trim(),
        pin: hashedPin,
        pin_set: true,
        user_type: "nomad",
        gender: gender,
        club_id: NOMADS_CLUB_ID
      })
      .select("member_id, member_name, club_id")
      .single();
    
    if (insertError) {
      console.error("Nomad creation error:", insertError);
      return { error: "Failed to create account." };
    }
    
    return {
      success: true,
      member: {
        member_id: newMember.member_id,
        member_name: newMember.member_name,
        club_id: NOMADS_CLUB_ID,
        club_name: "Nomads Golf Club"
      }
    };
  } catch (err) {
    console.error("Nomad signup error:", err);
    return { error: "An error occurred." };
  }
}
