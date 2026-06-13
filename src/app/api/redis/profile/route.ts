import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/redis";
import { LearnerProfile } from "@/lib/types";

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  const profile = await getProfile(uid);

  if (!profile) {
    const defaultProfile: LearnerProfile = {
      uid,
      xp: 0,
      streak: 0,
      hearts: 3,
      last_active: new Date().toISOString(),
      unit_progress: {
        kitchen_1: "current",
        cafe_1: "locked",
      },
    };
    return NextResponse.json(defaultProfile);
  }

  return NextResponse.json(profile);
}
