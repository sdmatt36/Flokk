// Log key prefix at module load for verification
if (process.env.LOOPS_API_KEY) {
  console.log("[loops] LOOPS_API_KEY first 8:", process.env.LOOPS_API_KEY.slice(0, 8));
} else {
  console.log("[loops] LOOPS_API_KEY: MISSING");
}

export async function createLoopsContact(
  email: string,
  firstName: string,
  lastName: string
) {
  const key = process.env.LOOPS_API_KEY;
  console.log("[loops] createContact key first 8:", key ? key.slice(0, 8) : "MISSING");
  try {
    const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        userGroup: "beta",
        source: "clerk-signup",
      }),
    });
    const data = await res.json();
    console.log("[loops] createContact status:", res.status, "body:", JSON.stringify(data));
  } catch (e) {
    console.error("[loops] createContact failed:", e);
  }
}

export async function sendTripCompletedEvent(
  email: string,
  properties: {
    tripDestination: string;
    tripTitle: string;
  }
): Promise<void> {
  const key = process.env.LOOPS_API_KEY;
  try {
    const res = await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        email,
        eventName: "trip_completed",
        tripDestination: properties.tripDestination,
        tripTitle: properties.tripTitle,
      }),
    });
    const data = await res.json();
    console.log(`[loops] trip_completed sent to ${email} — status: ${res.status} body:`, JSON.stringify(data));
  } catch (err) {
    console.error("[loops] trip_completed failed:", err);
  }
}

export async function sendTransactional(
  email: string,
  transactionalId: string,
  dataVariables: Record<string, string>
) {
  const key = process.env.LOOPS_API_KEY;
  try {
    const res = await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        transactionalId,
        email,
        dataVariables,
      }),
    });
    const data = await res.json();
    console.log(`[loops] transactional ${transactionalId} to ${email} — status: ${res.status} body:`, JSON.stringify(data));
    return data;
  } catch (e) {
    console.error("[loops] sendTransactional failed:", e);
  }
}

export async function sendSaveMilestoneEvent(email: string, count: number) {
  try {
    await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOOPS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, eventName: "save_milestone", saveCount: count }),
    });
  } catch (e) { console.error("[loops] sendSaveMilestoneEvent error", e); }
}

export async function sendTripStolenEvent(email: string, { tripDestination }: { tripDestination: string }) {
  try {
    await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOOPS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, eventName: "trip_stolen", tripDestination }),
    });
  } catch (e) { console.error("[loops] sendTripStolenEvent error", e); }
}

export async function sendTripMadePublicEvent(email: string, { tripDestination }: { tripDestination: string }) {
  try {
    await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOOPS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, eventName: "trip_made_public", tripDestination }),
    });
  } catch (e) { console.error("[loops] sendTripMadePublicEvent error", e); }
}

export async function sendRatingsCompleteEvent(email: string, { tripDestination }: { tripDestination: string }) {
  try {
    await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOOPS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, eventName: "ratings_complete", tripDestination }),
    });
  } catch (e) { console.error("[loops] sendRatingsCompleteEvent error", e); }
}

export async function updateLoopsContact(email: string, properties: Record<string, string | number | boolean>) {
  try {
    await fetch("https://app.loops.so/api/v1/contacts/update", {
      method: "PUT",
      headers: { Authorization: `Bearer ${process.env.LOOPS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...properties }),
    });
  } catch (e) { console.error("[loops] updateLoopsContact error", e); }
}

export async function sendPreTripReminderEvent(email: string, { tripDestination, daysAway }: { tripDestination: string; daysAway: number }) {
  try {
    await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOOPS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, eventName: "pre_trip_reminder", tripDestination, daysAway }),
    });
  } catch (e) { console.error("[loops] sendPreTripReminderEvent error", e); }
}
