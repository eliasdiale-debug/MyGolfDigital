import { createApiClient } from "@/lib/supabase/api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
const supabase = createApiClient();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clubId = formData.get("club_id") as string | null;

    if (!file || !clubId) {
      return NextResponse.json({ error: "File and club_id are required." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `club-logos/club_${clubId}.${ext}`;
    const buffer = await file.arrayBuffer();

    // Upload to Supabase Storage (bucket: public-assets)
    const { error: uploadError } = await supabase.storage
      .from("public-assets")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      // Bucket may not exist - try creating it first
      await supabase.storage.createBucket("public-assets", { public: true });
      const { error: retryError } = await supabase.storage
        .from("public-assets")
        .upload(path, buffer, { contentType: file.type, upsert: true });
      if (retryError) {
        return NextResponse.json({ error: "Failed to upload logo." }, { status: 500 });
      }
    }

    const { data: publicUrl } = supabase.storage
      .from("public-assets")
      .getPublicUrl(path);

    // Save logo_url to golf_clubs
    await supabase
      .from("golf_clubs")
      .update({ logo_url: publicUrl.publicUrl })
      .eq("club_id", parseInt(clubId));

    return NextResponse.json({ success: true, logo_url: publicUrl.publicUrl });
  } catch (err) {
    console.error("[v0] Upload logo error:", err);
    return NextResponse.json({ error: "Unexpected error uploading logo." }, { status: 500 });
  }
}
