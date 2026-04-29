import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { resolveShareToken } from "@/lib/share-token";
import { ShareItemView } from "@/components/share/ShareItemView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entity = await resolveShareToken(token);
  if (!entity) return { title: "Place — Flokk" };

  let title = "Place — Flokk";
  if (entity.entityType === "saved_item" && entity.savedItem) {
    const city = entity.savedItem.destinationCity;
    title = city
      ? `${entity.savedItem.rawTitle ?? "Place"} in ${city} — Flokk`
      : `${entity.savedItem.rawTitle ?? "Place"} — Flokk`;
  } else if (entity.entityType === "itinerary_item" && entity.itineraryItem) {
    title = `${entity.itineraryItem.title} — Flokk`;
  } else if (entity.entityType === "manual_activity" && entity.manualActivity) {
    title = `${entity.manualActivity.title} — Flokk`;
  } else if (entity.entityType === "generated_tour" && entity.generatedTour) {
    title = `${entity.generatedTour.title} in ${entity.generatedTour.destinationCity} — Flokk`;
  }

  return { title };
}

export default async function ShareItemPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entity = await resolveShareToken(token);
  if (!entity) notFound();

  const { userId } = await auth();
  const isSignedIn = !!userId;

  return <ShareItemView token={token} entity={entity} isSignedIn={isSignedIn} />;
}
