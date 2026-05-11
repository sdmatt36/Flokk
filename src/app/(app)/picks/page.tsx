import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { db } from "@/lib/db";
import { normalizeCategorySlug } from "@/lib/categories";
import { PicksBrowseSection } from "./_components/PicksBrowseSection";
import type { PicksBrowseSpot } from "./_components/PicksBrowseSection";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Picks · Flokk",
  description: "Places, food, lodging, and activities rated by Flokkers.",
};

const TRANSPORT_CATEGORIES = ["train", "flight", "airline", "transport", "transit"];

async function fetchPicks(): Promise<PicksBrowseSpot[]> {
  const spots = await db.communitySpot.findMany({
    where: {
      isPublic: true,
      OR: [
        { category: null },
        { category: { notIn: TRANSPORT_CATEGORIES } },
      ],
    },
    orderBy: [{ averageRating: "desc" }, { ratingCount: "desc" }],
    take: 500,
    select: {
      id: true,
      name: true,
      city: true,
      country: true,
      category: true,
      photoUrl: true,
      shareToken: true,
      averageRating: true,
      ratingCount: true,
      description: true,
      author: { select: { familyName: true } },
    },
  });

  return spots.map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    country: s.country ?? null,
    category: normalizeCategorySlug(s.category) ?? s.category ?? null,
    photoUrl: s.photoUrl ?? null,
    shareToken: s.shareToken ?? null,
    averageRating: s.averageRating ?? null,
    ratingCount: s.ratingCount,
    description: s.description ?? null,
    contributorName: s.author?.familyName ?? null,
  }));
}

export default async function PicksPage() {
  let spots: PicksBrowseSpot[] = [];
  try {
    spots = await fetchPicks();
  } catch {
    // non-fatal — renders empty state
  }

  return (
    <main>
      <div
        className="flex flex-col items-center justify-center h-24 md:h-36 gap-2 text-center px-4"
        style={{ backgroundColor: "#1B3A5C" }}
      >
        <p
          className={`${playfair.className} text-3xl md:text-5xl font-normal tracking-tight`}
          style={{ color: "#FAF7F2" }}
        >
          Flokk Picks
        </p>
        <p className="text-sm md:text-base italic" style={{ color: "rgba(250, 247, 242, 0.8)" }}>
          Places, food, lodging, and activities rated by Flokkers.
        </p>
      </div>

      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px 80px" }}>
        <PicksBrowseSection spots={spots} />
      </div>
    </main>
  );
}
