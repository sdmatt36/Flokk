// Log key prefix at module load for verification
if (process.env.LOOPS_API_KEY) {
  console.log("[loops] LOOPS_API_KEY prefix:", process.env.LOOPS_API_KEY.slice(0, 4));
}

export async function createLoopsContact(
  email: string,
  firstName: string,
  lastName: string
) {
  try {
    const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.LOOPS_API_KEY}`,
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
    console.log("[loops] createContact:", data);
  } catch (e) {
    console.error("[loops] createContact failed:", e);
  }
}

export async function sendTransactional(
  email: string,
  transactionalId: string,
  dataVariables: Record<string, string>
) {
  try {
    const res = await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.LOOPS_API_KEY}`,
      },
      body: JSON.stringify({
        transactionalId,
        email,
        dataVariables,
      }),
    });
    const data = await res.json();
    console.log(`[loops] sent ${transactionalId} to ${email}:`, data);
    return data;
  } catch (e) {
    console.error("[loops] sendTransactional failed:", e);
  }
}
