import { createHash } from "node:crypto";

const PROJECT_REF = "egnvlwgngyrkhhbxtlqa";
const STORAGE_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1`;
const BUCKET = "place-photos";

function buildObjectKey(url: string): string {
  const stripped = url
    .replace(/[?&](maxwidth|maxheight|width|height|w|h)=\d+/gi, "")
    .replace(/=s\d+(-w\d+)?(-h\d+)?(-k-no)?/g, "");
  const hash = createHash("sha256").update(stripped).digest("hex").slice(0, 40);
  return `photos/${hash}.jpg`;
}

export function flokImgPublicUrl(objectKey: string): string {
  return `${STORAGE_BASE}/object/public/${BUCKET}/${objectKey}`;
}

export async function persistRemoteImage(remoteUrl: string): Promise<string | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;

  try {
    const objectKey = buildObjectKey(remoteUrl);
    const publicUrl = flokImgPublicUrl(objectKey);

    // Idempotency: HEAD the public CDN URL — 200 means already stored
    const headRes = await fetch(publicUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (headRes.ok) return publicUrl;

    // Fetch the remote image
    const imgRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const bytes = await imgRes.arrayBuffer();

    // Upload to Supabase Storage (x-upsert: false — race-safe)
    const upRes = await fetch(`${STORAGE_BASE}/object/${BUCKET}/${objectKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
      signal: AbortSignal.timeout(20000),
    });

    if (!upRes.ok) {
      const body = await upRes.text().catch(() => "");
      // Concurrent upload won — object exists, return public URL
      if (body.toLowerCase().includes("already exist")) return publicUrl;
      return null;
    }

    return publicUrl;
  } catch {
    return null;
  }
}

/**
 * Persist any photo URL to Supabase Storage and return a durable URL.
 * Falls back to the original URL if persistRemoteImage fails or returns null
 * (e.g. SUPABASE_SERVICE_ROLE_KEY absent, image fetch error, upload error).
 * Returns null only when the input is null/undefined/empty.
 * Never throws.
 */
export async function toDurableImageUrl(
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null;
  try {
    const persisted = await persistRemoteImage(url);
    return persisted ?? url;
  } catch (err) {
    console.error("[toDurableImageUrl] persistRemoteImage threw, falling back to source URL", { url, err });
    return url;
  }
}
