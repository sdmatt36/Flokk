export interface MergeableItineraryItem {
  id: string;
  type: string;
  title: string;
  scheduledDate: Date | string | null;
  confirmationCode: string | null;
  imageUrl?: string | null;
  currency?: string | null;
}

function normalizeTitle(title: string): string {
  return title.replace(/^check-(?:in|out):\s*/i, "").trim().toLowerCase();
}

function normalizeDate(d: Date | string | null): string {
  if (!d) return "";
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

const ISO_CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "SEK", "NZD"]);

/**
 * Collapses multi-confirmation LODGING check-in rows for the same stay into a
 * single item. Confirmation codes from suppressed secondaries are carried in
 * `additionalConfirmations` on the primary.
 *
 * Rules:
 * - Only LODGING items with non-null scheduledDate are candidates.
 * - Check-out rows are never merged (render layer suppresses them separately).
 * - Merge key: normalizeTitle(title) + "|" + YYYY-MM-DD(scheduledDate).
 * - Primary election: has imageUrl → ISO currency → lexicographic id (stable).
 * - Items from other types pass through unchanged.
 */
export function mergeDuplicateLodging<T extends MergeableItineraryItem>(
  items: T[]
): (T & { additionalConfirmations?: string[] })[] {
  const mergedIds = new Set<string>();
  const mergeMap = new Map<string, string[]>(); // primaryId → additionalConfirmations

  const candidates = items.filter(
    it => it.type === "LODGING" && it.scheduledDate !== null && !/check-out/i.test(it.title)
  );

  const groups = new Map<string, T[]>();
  for (const item of candidates) {
    const key = normalizeTitle(item.title) + "|" + normalizeDate(item.scheduledDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => {
      const aImg = a.imageUrl ? 1 : 0;
      const bImg = b.imageUrl ? 1 : 0;
      if (bImg !== aImg) return bImg - aImg;
      const aCur = a.currency && ISO_CURRENCIES.has(a.currency) ? 1 : 0;
      const bCur = b.currency && ISO_CURRENCIES.has(b.currency) ? 1 : 0;
      if (bCur !== aCur) return bCur - aCur;
      return a.id < b.id ? -1 : 1;
    });
    const primary = sorted[0];
    const secondaries = sorted.slice(1);
    mergeMap.set(
      primary.id,
      secondaries.map(s => s.confirmationCode).filter((c): c is string => c !== null && c !== "")
    );
    for (const sec of secondaries) mergedIds.add(sec.id);
  }

  return items
    .filter(it => !mergedIds.has(it.id))
    .map(it => {
      const extra = mergeMap.get(it.id);
      return extra ? { ...it, additionalConfirmations: extra } : it;
    });
}
