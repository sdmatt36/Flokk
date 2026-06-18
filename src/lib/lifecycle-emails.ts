import crypto from "node:crypto";
import { sendEmail, type SendEmailResult } from "@/lib/email";
import { emailLayout, ctaButton } from "@/lib/email-templates";
import { db } from "@/lib/db";

const BASE = "https://www.flokktravel.com";

function url(path: string): string {
  return `${BASE}${path}`;
}

function buildUnsubscribeUrl(email: string): string {
  const secret = process.env.CRON_SECRET ?? "dev";
  const token = crypto.createHmac("sha256", secret).update(email).digest("hex");
  return `${BASE}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

export type LifecycleEmailType =
  | "welcome"
  | "trip_created"
  | "forward_confirmed"
  | "pre_trip_90"
  | "pre_trip_30"
  | "pre_trip_7"
  | "pre_trip_1"
  | "post_trip_rating"
  | "inactivity";

export const LIFECYCLE_EMAIL_TYPES: LifecycleEmailType[] = [
  "welcome",
  "trip_created",
  "forward_confirmed",
  "pre_trip_90",
  "pre_trip_30",
  "pre_trip_7",
  "pre_trip_1",
  "post_trip_rating",
  "inactivity",
];

export interface LifecycleEmailParams {
  to: string;
  tripId?: string;
  destination?: string;
}

// ── Shared fragments ──────────────────────────────────────────────────────────

const SERIF = "Georgia,'Times New Roman',serif";
const SANS  = "Arial,Helvetica,sans-serif";
const PB    = "margin:0 0 16px;font-size:16px;line-height:1.6;color:#2c2c2c;";

function greetLine(): string {
  return `<p style="margin:0 0 16px;line-height:1.6;font-family:${SERIF};font-size:18px;font-weight:600;color:#1B3A5C;">Hi, Flokker!</p>`;
}

function p(text: string): string {
  return `<p style="${PB}font-family:${SANS};">${text}</p>`;
}

function signOff(): string {
  return `<p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:#2c2c2c;font-family:${SANS};">Matt and Jen, Co-Founders, Flokk</p>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

function tmpl_welcome(discoverHref: string, newTripHref: string) {
  return {
    subject: "You're in. Here's the one thing to do first.",
    html: emailLayout(
      greetLine() +
      p("Welcome to Flokk. You are one of a small group of families building this with us from the start.") +
      p("One thing worth doing right now: get a trip going. It does not need to be booked. A destination and rough dates is enough.") +
      p("That trip becomes the container everything organizes around: the places you save, the bookings you forward, the plan that comes together.") +
      p("The fastest way to start is to steal one. Families who have already traveled have shared full itineraries on Discover, day by day. Find one close to where you are headed and copy it into your own trip in a tap.") +
      ctaButton("Find a trip to steal", discoverHref) +
      `<p style="text-align:center;margin:-8px 0 24px;font-size:15px;font-family:${SANS};"><a href="${newTripHref}" style="color:#C4664A;text-decoration:underline;">Or start a blank trip</a></p>` +
      p("Reply with anything that felt confusing. We read everything.") +
      signOff()
    ),
  };
}

function tmpl_trip_created(tripHref: string) {
  return {
    subject: "Your trip is live. Two ways to fill it.",
    html: emailLayout(
      greetLine() +
      p("Your trip is set up. Two fast ways to make it useful.") +
      p("Forward a booking. Send any hotel, flight, or tour confirmation in your inbox to trips@flokktravel.com, and Flokk drops the details into the right day.") +
      p("Save a place. Paste a link from anywhere, a restaurant, a hotel, a tour, and Flokk pulls the details into your trip library.") +
      ctaButton("Open your trip", tripHref) +
      p("Reply here if anything looks off.") +
      signOff()
    ),
  };
}

function tmpl_forward_confirmed(tripHref: string) {
  return {
    subject: "That booking just filed itself.",
    html: emailLayout(
      greetLine() +
      p("The confirmation you forwarded just landed in your trip.") +
      p("Flokk read it, worked out which trip it belongs to, and dropped the details into the right day: dates, confirmation code, and cost.") +
      p("Got more sitting in your inbox? Forward them to trips@flokktravel.com. Return flights, other hotels, train tickets, tour bookings, they all stack up the same way.") +
      p("The itinerary starts looking like a real plan fast.") +
      ctaButton("See it in your itinerary", tripHref) +
      p("If anything landed in the wrong place, reply here and we will fix it.") +
      signOff()
    ),
  };
}

function tmpl_pre_trip_90(destination: string, tripHref: string) {
  return {
    subject: `${destination} is about three months out. Time to start shaping it.`,
    html: emailLayout(
      greetLine() +
      p(`${destination} is roughly three months away. Early, but this is the best time to start.`) +
      p("Drop in the places you are already curious about. A restaurant someone mentioned, a hotel you keep eyeing, a neighborhood from a video. Paste the link and Flokk saves it to this trip.") +
      p(`And if you want a head start, see how other families did ${destination}. Their full itineraries are on Discover, and you can steal any day straight into your plan.`) +
      ctaButton(`Open your ${destination} trip`, tripHref) +
      signOff()
    ),
  };
}

function tmpl_pre_trip_30(destination: string, tripHref: string) {
  return {
    subject: `${destination} is a month away. Time to lock it in.`,
    html: emailLayout(
      greetLine() +
      p("One month out. This is when a trip goes from idea to plan.") +
      p("Forward your bookings. Send any confirmations you have to trips@flokktravel.com, flights, hotels, tours, and Flokk files them into the right days automatically.") +
      p("Fill the gaps. Open your itinerary and look for empty days. Pull from your saves, or steal a day from another family who has been there.") +
      ctaButton(`Open your ${destination} trip`, tripHref) +
      signOff()
    ),
  };
}

function tmpl_pre_trip_7(destination: string, tripHref: string) {
  return {
    subject: `${destination} is a week away. A couple of things worth doing.`,
    html: emailLayout(
      greetLine() +
      p("One week out. Two things before you go.") +
      p("Forward any last confirmations to trips@flokktravel.com. Better to have everything in Flokk than to dig through your inbox from a hotel lobby.") +
      p("Give your itinerary a once-over and make sure the days are in the shape you want.") +
      ctaButton(`Open your ${destination} trip`, tripHref) +
      signOff()
    ),
  };
}

function tmpl_pre_trip_1(destination: string, tripHref: string) {
  return {
    subject: "Tomorrow's the day. A quick checklist.",
    html: emailLayout(
      greetLine() +
      p("Tomorrow you leave. A few things before you go.") +
      p("Screenshot your itinerary. Flokk has your confirmation codes, addresses, and times, and a screenshot is your offline backup.") +
      p(`Download maps for ${destination} so you have directions without data.`) +
      p("Give yourself time at the airport. Three hours for international, two for domestic, and more with kids.") +
      ctaButton("View your itinerary", tripHref) +
      p("Have a great trip. We want to hear how it goes when you are back.") +
      signOff()
    ),
  };
}

function tmpl_post_trip_rating(destination: string, tripHref: string) {
  return {
    subject: `How was ${destination}?`,
    html: emailLayout(
      greetLine() +
      p(`Hope ${destination} delivered.`) +
      p("Before the details fade, open your trip and rate the places you visited. It takes a few minutes while it is still fresh.") +
      p("Which hotel was worth it. Which restaurant your kids actually ate at. Which activity ran long. That is the intel no travel blog has, and it is exactly what other families are looking for.") +
      ctaButton(`Rate your ${destination} places`, tripHref) +
      signOff()
    ),
  };
}

function tmpl_inactivity(homeHref: string, unsubUrl: string) {
  return {
    subject: "Still planning something?",
    html: emailLayout(
      greetLine() +
      p("We have not seen you in Flokk for a few weeks. Travel planning comes in waves, so no worries.") +
      p("If something is on the horizon, even vaguely, now is a good time to drop in a few saves. Places you save today will be waiting when you are ready to plan, even months from now.") +
      p("And if you have taken a trip since we last saw you, it is worth capturing the places before they fade.") +
      ctaButton("Open Flokk", homeHref) +
      p("And if Flokk is not fitting how you travel, reply and tell us why. That feedback is worth a lot.") +
      signOff(),
      { marketing: true, unsubscribeUrl: unsubUrl }
    ),
  };
}

// ── Send funnel ───────────────────────────────────────────────────────────────

export async function sendLifecycleEmail(
  type: LifecycleEmailType,
  params: LifecycleEmailParams
): Promise<SendEmailResult> {
  const { to, tripId } = params;

  let dest = params.destination ?? "";
  if (!dest && tripId) {
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: { destinationCity: true, destinationCountry: true, title: true },
    });
    if (trip) {
      dest = trip.destinationCity ?? trip.destinationCountry ?? trip.title;
    }
  }

  const tripHref    = tripId ? url(`/trips/${tripId}`) : url("/trips");
  const discoverHref = url("/discover");
  const newTripHref  = url("/trips/new");
  const homeHref     = url("/home");
  const d            = dest || "your destination";

  let tpl: { subject: string; html: string };

  switch (type) {
    case "welcome":
      tpl = tmpl_welcome(discoverHref, newTripHref);
      break;
    case "trip_created":
      tpl = tmpl_trip_created(tripHref);
      break;
    case "forward_confirmed":
      tpl = tmpl_forward_confirmed(tripHref);
      break;
    case "pre_trip_90":
      tpl = tmpl_pre_trip_90(d, tripHref);
      break;
    case "pre_trip_30":
      tpl = tmpl_pre_trip_30(d, tripHref);
      break;
    case "pre_trip_7":
      tpl = tmpl_pre_trip_7(d, tripHref);
      break;
    case "pre_trip_1":
      tpl = tmpl_pre_trip_1(d, tripHref);
      break;
    case "post_trip_rating":
      tpl = tmpl_post_trip_rating(d, tripHref);
      break;
    case "inactivity": {
      const unsubUrl = buildUnsubscribeUrl(to);
      tpl = tmpl_inactivity(homeHref, unsubUrl);
      break;
    }
    default: {
      const _: never = type;
      throw new Error(`Unknown lifecycle email type: ${_}`);
    }
  }

  const MARKETING_TYPES = new Set<LifecycleEmailType>(["inactivity"]);
  const isMarketing = MARKETING_TYPES.has(type);
  const unsubUrl = isMarketing ? buildUnsubscribeUrl(to) : undefined;

  return sendEmail(to, tpl.subject, tpl.html, type, {
    replyTo: "hello@flokktravel.com",
    ...(params.tripId ? { tripId: params.tripId } : {}),
    ...(isMarketing && unsubUrl ? {
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    } : {}),
  });
}
