import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"

// Helper: convert a URL or local path to a base64 data URI
async function toBase64(urlOrPath: string): Promise<string> {
  // Local file (starts with /)
  if (urlOrPath.startsWith("/") && !urlOrPath.startsWith("//")) {
    try {
      const filePath = join(process.cwd(), "public", urlOrPath)
      const buf = readFileSync(filePath)
      const ext = urlOrPath.split(".").pop()?.toLowerCase() ?? "png"
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : "image/png"
      return `data:${mime};base64,${buf.toString("base64")}`
    } catch { return "" }
  }
  // Remote URL — extract from full URL if passed
  const fetchUrl = urlOrPath.startsWith("http") ? urlOrPath : `https:${urlOrPath}`
  try {
    const res = await fetch(fetchUrl, { cache: "force-cache" })
    if (!res.ok) return ""
    const ct = res.headers.get("content-type") ?? "image/jpeg"
    const buf = await res.arrayBuffer()
    return `data:${ct.split(";")[0]};base64,${Buffer.from(buf).toString("base64")}`
  } catch { return "" }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const imageUrl = searchParams.get("imageUrl")

  // Single image proxy — used by the pairings export
  if (imageUrl) {
    const base64 = await toBase64(imageUrl)
    return NextResponse.json({ base64 })
  }

  // Welcome letter logos — WSOE + app logo
  const [wsoeLogoBase64, appLogoBase64] = await Promise.all([
    toBase64("https://bhgbuyzjgpeavspgrxvh.supabase.co/storage/v1/object/public/public-assets/club-logos/club_13.jpg"),
    toBase64("/images/mygolf-digital-logo.png"),
  ])

  return NextResponse.json({ wsoeLogoBase64, appLogoBase64 })
}
