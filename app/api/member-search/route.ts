import { createApiClient } from "@/lib/supabase/api";
import { NextRequest, NextResponse } from "next/server";

const supabase = createApiClient();
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  // Require at least 2 characters before querying
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("members")
    .select("member_id, member_name")
    .ilike("member_name", `%${q}%`)
    .order("member_name")
    .limit(8);

  if (error) return NextResponse.json([]);

  return NextResponse.json(data ?? []);
}
