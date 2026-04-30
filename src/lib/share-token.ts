import { db } from "@/lib/db";
import { nanoid } from "nanoid";

export type ShareEntityType = "saved_item" | "itinerary_item" | "manual_activity" | "generated_tour";

export interface ResolvedShareEntity {
  entityType: ShareEntityType;
  savedItem?: {
    id: string;
    rawTitle: string | null;
    rawDescription: string | null;
    placePhotoUrl: string | null;
    mediaThumbnailUrl: string | null;
    websiteUrl: string | null;
    destinationCity: string | null;
    destinationCountry: string | null;
    lat: number | null;
    lng: number | null;
    categoryTags: string[];
    userRating: number | null;
    userNote: string | null;
    sourcePlatform: string | null;
    sourceMethod: string | null;
    sourceUrl: string | null;
    savedAt: string;
    shareToken: string;
    trip: { title: string; destinationCity: string | null } | null;
  };
  itineraryItem?: {
    id: string;
    type: string;
    title: string;
    scheduledDate: string | null;
    departureTime: string | null;
    arrivalTime: string | null;
    fromAirport: string | null;
    toAirport: string | null;
    fromCity: string | null;
    toCity: string | null;
    confirmationCode: string | null;
    notes: string | null;
    address: string | null;
    totalCost: number | null;
    currency: string | null;
    latitude: number | null;
    longitude: number | null;
    venueUrl: string | null;
    shareToken: string;
    trip: { title: string; destinationCity: string | null } | null;
    // resolved parallel SavedItem (for LODGING/ACTIVITY when found)
    parallelSavedItem?: {
      id: string;
      rawTitle: string | null;
      rawDescription: string | null;
      placePhotoUrl: string | null;
      websiteUrl: string | null;
      destinationCity: string | null;
      destinationCountry: string | null;
      categoryTags: string[];
      userRating: number | null;
    } | null;
  };
  manualActivity?: {
    id: string;
    title: string;
    date: string;
    time: string | null;
    endTime: string | null;
    venueName: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    website: string | null;
    price: number | null;
    currency: string | null;
    notes: string | null;
    status: string;
    city: string | null;
    type: string | null;
    imageUrl: string | null;
    dayIndex: number | null;
    confirmationCode: string | null;
    shareToken: string;
    trip: { title: string; destinationCity: string | null } | null;
  };
  generatedTour?: {
    id: string;
    title: string;
    destinationCity: string;
    destinationCountry: string | null;
    prompt: string;
    durationLabel: string;
    transport: string;
    categoryTags: string[];
    shareToken: string;
    stops: {
      id: string;
      orderIndex: number;
      name: string;
      address: string | null;
      lat: number | null;
      lng: number | null;
      durationMin: number | null;
      travelTimeMin: number | null;
      why: string | null;
      familyNote: string | null;
      imageUrl: string | null;
      websiteUrl: string | null;
      ticketRequired: string | null;
      placeTypes: string[];
    }[];
  };
}

export async function getOrCreateShareToken(
  entityType: ShareEntityType,
  entityId: string
): Promise<string> {
  switch (entityType) {
    case "saved_item": {
      const existing = await db.savedItem.findUnique({
        where: { id: entityId },
        select: { shareToken: true },
      });
      if (!existing) throw new Error("SavedItem not found");
      if (existing.shareToken) return existing.shareToken;
      const token = nanoid(12);
      try {
        const updated = await db.savedItem.update({
          where: { id: entityId },
          data: { shareToken: token },
          select: { shareToken: true },
        });
        return updated.shareToken!;
      } catch (e: unknown) {
        // P2002 = unique constraint violation (race condition)
        if ((e as { code?: string }).code === "P2002") {
          const refetch = await db.savedItem.findUnique({
            where: { id: entityId },
            select: { shareToken: true },
          });
          return refetch!.shareToken!;
        }
        throw e;
      }
    }

    case "itinerary_item": {
      const existing = await db.itineraryItem.findUnique({
        where: { id: entityId },
        select: { shareToken: true },
      });
      if (!existing) throw new Error("ItineraryItem not found");
      if (existing.shareToken) return existing.shareToken;
      const token = nanoid(12);
      try {
        const updated = await db.itineraryItem.update({
          where: { id: entityId },
          data: { shareToken: token },
          select: { shareToken: true },
        });
        return updated.shareToken!;
      } catch (e: unknown) {
        if ((e as { code?: string }).code === "P2002") {
          const refetch = await db.itineraryItem.findUnique({
            where: { id: entityId },
            select: { shareToken: true },
          });
          return refetch!.shareToken!;
        }
        throw e;
      }
    }

    case "manual_activity": {
      const existing = await db.manualActivity.findUnique({
        where: { id: entityId },
        select: { shareToken: true },
      });
      if (!existing) throw new Error("ManualActivity not found");
      if (existing.shareToken) return existing.shareToken;
      const token = nanoid(12);
      try {
        const updated = await db.manualActivity.update({
          where: { id: entityId },
          data: { shareToken: token },
          select: { shareToken: true },
        });
        return updated.shareToken!;
      } catch (e: unknown) {
        if ((e as { code?: string }).code === "P2002") {
          const refetch = await db.manualActivity.findUnique({
            where: { id: entityId },
            select: { shareToken: true },
          });
          return refetch!.shareToken!;
        }
        throw e;
      }
    }

    case "generated_tour": {
      const existing = await db.generatedTour.findUnique({
        where: { id: entityId },
        select: { shareToken: true },
      });
      if (!existing) throw new Error("GeneratedTour not found");
      if (existing.shareToken) return existing.shareToken;
      const token = nanoid(12);
      try {
        const updated = await db.generatedTour.update({
          where: { id: entityId },
          data: { shareToken: token },
          select: { shareToken: true },
        });
        return updated.shareToken!;
      } catch (e: unknown) {
        if ((e as { code?: string }).code === "P2002") {
          const refetch = await db.generatedTour.findUnique({
            where: { id: entityId },
            select: { shareToken: true },
          });
          return refetch!.shareToken!;
        }
        throw e;
      }
    }
  }
}

export async function resolveShareToken(token: string): Promise<ResolvedShareEntity | null> {
  // Try SavedItem first
  const savedItem = await db.savedItem.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      rawTitle: true,
      rawDescription: true,
      placePhotoUrl: true,
      mediaThumbnailUrl: true,
      websiteUrl: true,
      destinationCity: true,
      destinationCountry: true,
      lat: true,
      lng: true,
      categoryTags: true,
      userRating: true,
      userNote: true,
      sourcePlatform: true,
      sourceMethod: true,
      sourceUrl: true,
      savedAt: true,
      shareToken: true,
      deletedAt: true,
      trip: {
        select: {
          title: true,
          destinationCity: true,
        },
      },
    },
  });
  if (savedItem && !savedItem.deletedAt) {
    return {
      entityType: "saved_item",
      savedItem: {
        ...savedItem,
        shareToken: savedItem.shareToken!,
        savedAt: savedItem.savedAt.toISOString(),
      },
    };
  }

  // Try ItineraryItem
  const itineraryItem = await db.itineraryItem.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      type: true,
      title: true,
      tripId: true,
      scheduledDate: true,
      departureTime: true,
      arrivalTime: true,
      fromAirport: true,
      toAirport: true,
      fromCity: true,
      toCity: true,
      confirmationCode: true,
      notes: true,
      address: true,
      totalCost: true,
      currency: true,
      latitude: true,
      longitude: true,
      venueUrl: true,
      shareToken: true,
      trip: {
        select: {
          title: true,
          destinationCity: true,
        },
      },
    },
  });
  if (itineraryItem) {
    let parallelSavedItem = null;

    // For LODGING/ACTIVITY: attempt three-step resolver to find parallel SavedItem
    if (itineraryItem.type === "LODGING" || itineraryItem.type === "ACTIVITY") {
      // Step 1: TripDocument lookup
      if (itineraryItem.tripId) {
        const strippedTitle = itineraryItem.title
          .replace(/^(check-in|check-out):\s*/i, "")
          .replace(/\s*\(.*?\)\s*/g, "")
          .trim();
        const tripDoc = await db.tripDocument.findFirst({
          where: {
            tripId: itineraryItem.tripId,
            type: "booking",
            label: strippedTitle,
            savedItemId: { not: null },
          },
          select: { savedItemId: true },
        });

        if (tripDoc?.savedItemId) {
          parallelSavedItem = await db.savedItem.findUnique({
            where: { id: tripDoc.savedItemId },
            select: {
              id: true,
              rawTitle: true,
              rawDescription: true,
              placePhotoUrl: true,
              websiteUrl: true,
              destinationCity: true,
              destinationCountry: true,
              categoryTags: true,
              userRating: true,
            },
          });
        }

        // Step 2: rawTitle match fallback
        if (!parallelSavedItem && itineraryItem.tripId) {
          parallelSavedItem = await db.savedItem.findFirst({
            where: {
              tripId: itineraryItem.tripId,
              rawTitle: strippedTitle,
              deletedAt: null,
            },
            select: {
              id: true,
              rawTitle: true,
              rawDescription: true,
              placePhotoUrl: true,
              websiteUrl: true,
              destinationCity: true,
              destinationCountry: true,
              categoryTags: true,
              userRating: true,
            },
          });
        }
      }
    }

    return {
      entityType: "itinerary_item",
      itineraryItem: {
        ...itineraryItem,
        shareToken: itineraryItem.shareToken!,
        parallelSavedItem,
      },
    };
  }

  // Try ManualActivity
  const manualActivity = await db.manualActivity.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      title: true,
      date: true,
      time: true,
      endTime: true,
      venueName: true,
      address: true,
      lat: true,
      lng: true,
      website: true,
      price: true,
      currency: true,
      notes: true,
      status: true,
      city: true,
      type: true,
      imageUrl: true,
      dayIndex: true,
      confirmationCode: true,
      shareToken: true,
      deletedAt: true,
      trip: {
        select: {
          title: true,
          destinationCity: true,
        },
      },
    },
  });
  if (manualActivity && !manualActivity.deletedAt) {
    return { entityType: "manual_activity", manualActivity: { ...manualActivity, shareToken: manualActivity.shareToken! } };
  }

  // Try GeneratedTour
  const generatedTour = await db.generatedTour.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      title: true,
      destinationCity: true,
      destinationCountry: true,
      prompt: true,
      durationLabel: true,
      transport: true,
      categoryTags: true,
      shareToken: true,
      deletedAt: true,
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          orderIndex: true,
          name: true,
          address: true,
          lat: true,
          lng: true,
          durationMin: true,
          travelTimeMin: true,
          why: true,
          familyNote: true,
          imageUrl: true,
          websiteUrl: true,
          ticketRequired: true,
          placeTypes: true,
        },
      },
    },
  });
  if (generatedTour && !generatedTour.deletedAt) {
    return {
      entityType: "generated_tour",
      generatedTour: { ...generatedTour, shareToken: generatedTour.shareToken! },
    };
  }

  return null;
}
