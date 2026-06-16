import { NextResponse } from "next/server";

// Mock golf days data. Replace with a real query when available.
export async function GET() {
  const golfDays = [
    {
      id: "1",
      venue: "Sun City - Gary Player Course",
      startTime: "2025-02-10T08:00:00Z",
      tournamentName: "Annual Charity Classic",
      entryFee: 550,
    },
    {
      id: "2",
      venue: "Fancourt - The Links",
      startTime: "2025-02-25T07:30:00Z",
      tournamentName: "Fancourt Open",
      entryFee: 1200,
    },
    {
      id: "3",
      venue: "Steenberg Golf Course",
      startTime: "2025-03-05T11:00:00Z",
      tournamentName: "Wednesday Social Day",
      entryFee: 0,
    },
  ];

  return NextResponse.json({ golfDays });
}
