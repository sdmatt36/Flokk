"use client";

import { useState } from "react";
import { AirportAutocomplete } from "@/components/shared/AirportAutocomplete";

export default function AirportTestPage() {
  const [a, setA] = useState("");
  const [b, setB] = useState("HND");

  return (
    <div className="mx-auto max-w-md p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-[#1B3A5C]">AirportAutocomplete scratch</h1>

      <div>
        <label className="mb-1 block text-sm text-[#1B3A5C]">Empty start</label>
        <AirportAutocomplete value={a} onChange={setA} ariaLabel="From airport" />
        <div className="mt-1 text-xs text-gray-500">Selected: {a || "(none)"}</div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[#1B3A5C]">Pre-filled HND</label>
        <AirportAutocomplete value={b} onChange={setB} ariaLabel="To airport" />
        <div className="mt-1 text-xs text-gray-500">Selected: {b || "(none)"}</div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[#1B3A5C]">Disabled</label>
        <AirportAutocomplete value="KEF" onChange={() => {}} disabled />
      </div>
    </div>
  );
}
