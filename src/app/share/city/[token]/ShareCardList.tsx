"use client";

import { useState } from "react";
import { SaveCard, mapApiItem } from "@/components/features/saves/SaveCard";
import { SavesCardGrid } from "@/components/features/saves/SavesCardGrid";
import type { ApiItem } from "@/components/features/saves/SaveCard";

type Props = {
  saves: ApiItem[];
};

export function ShareCardList({ saves }: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const mappedSaves = saves.map(mapApiItem);

  if (mappedSaves.length === 0) return null;

  return (
    <div style={{ marginBottom: 40 }}>
      <SavesCardGrid>
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
      </SavesCardGrid>
    </div>
  );
}
