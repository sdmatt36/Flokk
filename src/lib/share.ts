import { ShareEntityType } from "@/lib/share-token";

export interface ShareRequest {
  entityType: ShareEntityType;
  entityId: string;
  title?: string;
}

export interface ShareResult {
  ok: boolean;
  url?: string;
  error?: string;
}

// Clipboard API fails silently on iOS after any await (user gesture consumed by async).
// Use execCommand as fallback so copy always works.
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fall through */ }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

// Fetches a share token for the entity and returns the shareable URL.
// Does not copy or share — lets the caller decide what to do with the URL.
export async function getShareUrl(entityType: ShareEntityType, entityId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/share/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId }),
    });
    if (!res.ok) return null;
    const { token } = await res.json() as { token: string };
    return `${window.location.origin}/s/${token}`;
  } catch {
    return null;
  }
}

// Invokes navigator.share on any device that supports it (no isTouchDevice guard).
// Returns { shared: true } on success, { cancelled: true } on AbortError,
// { fallback: true } when navigator.share is unavailable.
export async function invokeNativeShare(
  url: string,
  title: string,
): Promise<{ shared: boolean; cancelled: boolean; fallback: boolean }> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return { shared: false, cancelled: false, fallback: true };
  }
  try {
    await navigator.share({ url, title });
    return { shared: true, cancelled: false, fallback: false };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { shared: false, cancelled: true, fallback: false };
    }
    return { shared: false, cancelled: false, fallback: true };
  }
}

// Called from any Share button on the platform.
// Lazily generates the entity-level /s/{token} URL and shares or copies it.
// On mobile: tries Web Share API first (native sheet, works after async on iOS).
// Returns ok: false when native sheet was shown so callers suppress "copied" toast.
// Returns ok: true when link was copied to clipboard.
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

    // Web Share API on touch devices: works after async on iOS, avoids clipboard permission issues
    const isTouchDevice =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    if (isTouchDevice && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: req.title ?? "Check this out on Flokk", url });
        return { ok: false, url }; // native sheet was shown — caller should not show "copied" toast
      } catch (err) {
        if ((err as Error).name === "AbortError") return { ok: false, url }; // user dismissed
        // fall through to clipboard
      }
    }

    const copied = await copyToClipboard(url);
    return { ok: copied, url };
  } catch {
    return { ok: false, error: "Share failed" };
  }
}
