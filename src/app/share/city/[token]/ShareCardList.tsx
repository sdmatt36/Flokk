"use client";

import { useState } from "react";
import { SaveCard, mapApiItem } from "@/components/features/saves/SaveCard";
import type { ApiItem } from "@/components/features/saves/SaveCard";

type Props = {
  saves: ApiItem[];
};

export function ShareCardList({ saves }: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const mappedSaves = saves.map(mapApiItem);

  if (mappedSaves.length === 0) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 40 }}>
      {mappedSaves.map((save) => (
        <SaveCard
          key={save.id}
          save={save}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          assignTrip={() => {}}
          onTripClick={() => {}}
          onCardClick={() => {}}
          availableTrips={[]}
          readOnly
        />
      ))}
    </div>
  );
}
