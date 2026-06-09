// Resolves the display-ready city image URL from the two DB fields.
// heroPhotoUrl takes priority; photoUrl is the legacy/fallback.
// Normalises empty-string and whitespace-only values to null so callers
// never receive a truthy-but-invalid src.
export function getCityImageUrl(
  heroPhotoUrl: string | null | undefined,
  photoUrl: string | null | undefined,
): string | null {
  const hero = heroPhotoUrl?.trim() || null;
  const legacy = photoUrl?.trim() || null;
  return hero ?? legacy;
}
