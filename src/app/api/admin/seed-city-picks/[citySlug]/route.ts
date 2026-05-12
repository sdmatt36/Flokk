import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { seedCity } from "@/lib/seed-city-picks";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ citySlug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { citySlug } = await params;
  const body = await req.json().catch(() => ({})) as { count?: number };
  const count = Math.min(body.count ?? 20, 30);

  const result = await seedCity(citySlug, count);
  return NextResponse.json(result);
}
