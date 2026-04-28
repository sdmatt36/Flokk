export type EventCategory =
  | "live_music"
  | "sports_events"
  | "comedy_shows"
  | "seasonal_events"
  | "family_kids";

export type RawEvent = {
  sourceProvider: "thesportsdb" | "websearch_haiku" | "predicthq";
  sourceEventId: string;
  category: EventCategory;
  title: string;
  venue: string | null;
  venueLat: number | null;
  venueLng: number | null;
  startDateTime: Date;
  endDateTime: Date | null;
  description: string | null;
  imageUrl: string | null;
  ticketUrl: string | null;
};

export type EventQueryParams = {
  city: string;
  country: string | null;
  startDate: Date;
  endDate: Date;
  categories: EventCategory[];
};
