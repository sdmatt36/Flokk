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
