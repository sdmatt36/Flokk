import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string; stopId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return new Response("Unauthorized", { status: 401 });

  const { id, stopId } = await context.params;

  const tour = await db.generatedTour.findUnique({
    where: { id },
    select: { familyProfileId: true },
  });
  if (!tour) return new Response("Tour not found", { status: 404 });
  if (tour.familyProfileId !== profileId) return new Response("Forbidden", { status: 403 });

  const stop = await db.tourStop.findUnique({
    where: { id: stopId },
    select: { tourId: true, deletedAt: true },
  });
  if (!stop) return new Response("Stop not found", { status: 404 });
  if (stop.tourId !== id) return new Response("Stop does not belong to tour", { status: 400 });
  if (!stop.deletedAt) return new Response("Stop is not deleted", { status: 400 });

  await db.tourStop.update({
    where: { id: stopId },
    data: { deletedAt: null },
  });
  return new Response(null, { status: 204 });
}
