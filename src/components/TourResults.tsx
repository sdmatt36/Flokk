"use client";

import { Clock, MapPin } from "lucide-react";

type Stop = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  why: string;
  familyNote: string;
};

type Props = {
  stops: Stop[];
  destinationCity: string;
  prompt: string;
};

export default function TourResults({ stops, destinationCity, prompt }: Props) {
  return (
    <div>
      <p className="font-serif text-xl font-semibold text-[#1B3A5C] mb-1">{prompt}</p>
      <p className="text-sm text-gray-400 mb-6">{destinationCity}</p>

      {stops.map((stop, index) => (
        <div key={index} className="border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm bg-white">
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full bg-[#C4664A] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {index + 1}
            </div>
            <span className="text-sm font-semibold text-[#1B3A5C] ml-3">{stop.name}</span>
          </div>

          <div className="flex items-center mt-2">
            <Clock size={12} className="text-gray-400" />
            <span className="text-xs text-gray-400 ml-1">{stop.duration} min</span>
          </div>

          {stop.address && (
            <div className="flex items-center mt-1">
              <MapPin size={12} className="text-gray-400" />
              <span className="text-xs text-gray-400 ml-1">{stop.address}</span>
            </div>
          )}

          <p className="text-sm text-gray-600 mt-2 leading-relaxed">{stop.why}</p>

          {stop.familyNote && (
            <p className="text-xs text-[#C4664A] mt-1 italic">{stop.familyNote}</p>
          )}
        </div>
      ))}
    </div>
  );
}
