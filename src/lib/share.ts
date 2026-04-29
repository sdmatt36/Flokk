import { ShareEntityType } from "@/lib/share-token";

export interface ShareRequest {
  entityType: ShareEntityType;
  entityId: string;
}

export interface ShareResult {
  ok: boolean;
  url?: string;
  error?: string;
}

// Called from any Share button on the platform.
// Lazily generates the entity-level /s/{token} URL and copies it to clipboard.
export async function shareEntity(req: ShareRequest): Promise<ShareResult> {
  try {
    const res = await fetch("/api/share/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: req.entityType, entityId: req.entityId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: (body as { error?: string }).error ?? "Share failed" };
    }

    const { token } = await res.json() as { token: string };
    const url = `${window.location.origin}/s/${token}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard unavailable (non-HTTPS or denied) — still return url so caller can show it
    }

    return { ok: true, url };
  } catch {
    return { ok: false, error: "Share failed" };
  }
}
