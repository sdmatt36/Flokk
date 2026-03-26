export async function GET() {
  return Response.json({
    signingKeyPrefix: process.env.INNGEST_SIGNING_KEY?.slice(0, 20) ?? "NOT SET",
    fallbackPrefix: process.env.INNGEST_SIGNING_KEY_FALLBACK?.slice(0, 20) ?? "NOT SET",
  });
}
