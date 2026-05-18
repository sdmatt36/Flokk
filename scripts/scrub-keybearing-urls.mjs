/**
 * scrub-keybearing-urls.mjs
 *
 * One-shot resumable sweep: null out every maps.googleapis.com URL in any image
 * column across all tables (including soft-deleted rows and backup tables).
 *
 * Strategy: follow the 302 redirect from the stored maps.googleapis.com URL to
 * the CDN image, persist to Flokk Supabase Storage. If redirect fails (expired),
 * set column to NULL. NEVER writes a Google URL back under any branch.
 *
 * Idempotent: WHERE clause only targets maps.googleapis.com URLs — already-healed
 * rows are never selected again.
 */

import { createHash } from "node:crypto";
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, "..", ".env.local");
const envVars = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
  if (m) envVars[m[1]] = m[2];
}

const DATABASE_URL = envVars.DATABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
if (!SUPABASE_SERVICE_ROLE_KEY) { console.error("Missing SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const PROJECT_REF = "egnvlwgngyrkhhbxtlqa";
const STORAGE_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1`;
const BUCKET = "place-photos";

function buildObjectKey(url) {
  const stripped = url
    .replace(/[?&](maxwidth|maxheight|width|height|w|h)=\d+/gi, "")
    .replace(/=s\d+(-w\d+)?(-h\d+)?(-k-no)?/g, "");
  const hash = createHash("sha256").update(stripped).digest("hex").slice(0, 40);
  return `photos/${hash}.jpg`;
}

function flokPublicUrl(objectKey) {
  return `${STORAGE_BASE}/object/public/${BUCKET}/${objectKey}`;
}

async function persistRemoteImage(remoteUrl) {
  if (!remoteUrl) return null;
  try {
    const objectKey = buildObjectKey(remoteUrl);
    const publicUrl = flokPublicUrl(objectKey);

    const headRes = await fetch(publicUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (headRes.ok) return publicUrl;

    const imgRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const bytes = await imgRes.arrayBuffer();
    if (bytes.byteLength < 1000) return null;

    const upRes = await fetch(`${STORAGE_BASE}/object/${BUCKET}/${objectKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
      signal: AbortSignal.timeout(30000),
    });

    if (!upRes.ok) {
      const body = await upRes.text().catch(() => "");
      if (body.toLowerCase().includes("already exist")) return publicUrl;
      return null;
    }
    return publicUrl;
  } catch {
    return null;
  }
}

async function resolveAndPersist(mapsUrl) {
  try {
    const res = await fetch(mapsUrl, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    if (!res.url || res.url === mapsUrl) return null;
    if (res.url.includes("maps.googleapis.com")) return null;
    return persistRemoteImage(res.url);
  } catch {
    return null;
  }
}

async function scrubTable({ client, tableName, urlCol }) {
  const stats = { persisted: 0, nulled: 0, errors: 0 };

  // No deletedAt filter — scrub ALL rows including soft-deleted
  const { rows } = await client.query(
    `SELECT id, "${urlCol}" FROM "${tableName}"
     WHERE "${urlCol}" LIKE '%maps.googleapis.com%'
     ORDER BY id`
  );

  if (rows.length === 0) {
    console.log(`[${tableName}.${urlCol}] 0 rows — skip`);
    return stats;
  }

  console.log(`\n[${tableName}.${urlCol}] ${rows.length} key-bearing rows`);

  for (const row of rows) {
    const storedUrl = row[urlCol];
    try {
      const flokUrl = await resolveAndPersist(storedUrl);

      if (flokUrl) {
        if (flokUrl.includes("googleapis.com") || flokUrl.includes("googleusercontent.com")) {
          console.warn(`  [SAFETY BLOCK] ${row.id}: resolved to Google URL, nulling`);
          await client.query(`UPDATE "${tableName}" SET "${urlCol}" = NULL WHERE id = $1`, [row.id]);
          stats.nulled++;
        } else {
          await client.query(`UPDATE "${tableName}" SET "${urlCol}" = $1 WHERE id = $2`, [flokUrl, row.id]);
          stats.persisted++;
          console.log(`  ✓ ${row.id} → ${flokUrl.slice(-24)}`);
        }
      } else {
        await client.query(`UPDATE "${tableName}" SET "${urlCol}" = NULL WHERE id = $1`, [row.id]);
        stats.nulled++;
        console.log(`  ✗ ${row.id} → NULL (expired)`);
      }
    } catch (err) {
      console.error(`  [ERROR] ${row.id}: ${err.message}`);
      stats.errors++;
    }
  }

  console.log(`[${tableName}.${urlCol}] persisted: ${stats.persisted}, nulled: ${stats.nulled}, errors: ${stats.errors}`);
  return stats;
}

// All image columns across all tables including backup tables.
// No deletedAt guards — soft-deleted rows must also be scrubbed.
const TARGETS = [
  { tableName: "SavedItem",                    urlCol: "placePhotoUrl"   },
  { tableName: "SavedItem",                    urlCol: "mediaThumbnailUrl" },
  { tableName: "SavedItem_backup_20260419",    urlCol: "placePhotoUrl"   },
  { tableName: "SavedItem_backup_20260419",    urlCol: "mediaThumbnailUrl" },
  { tableName: "CommunitySpot",                urlCol: "photoUrl"        },
  { tableName: "CommunitySpot_backup_20260418", urlCol: "photoUrl"       },
  { tableName: "TourStop",                     urlCol: "imageUrl"        },
  { tableName: "ManualActivity",               urlCol: "imageUrl"        },
  { tableName: "RecommendedItem",              urlCol: "heroImageUrl"    },
  { tableName: "Trip",                         urlCol: "heroImageUrl"    },
  { tableName: "Article",                      urlCol: "coverImage"      },
  { tableName: "Article",                      urlCol: "thumbnailUrl"    },
  { tableName: "City",                         urlCol: "heroPhotoUrl"    },
  { tableName: "City",                         urlCol: "photoUrl"        },
  { tableName: "Country",                      urlCol: "photoUrl"        },
  { tableName: "Continent",                    urlCol: "photoUrl"        },
  { tableName: "Event",                        urlCol: "imageUrl"        },
  { tableName: "ItineraryItem",                urlCol: "imageUrl"        },
  { tableName: "TravelVideo",                  urlCol: "thumbnailUrl"    },
];

// Verification query — re-run this independently to confirm gate.
const VERIFY_SQL = TARGETS.map(
  ({ tableName, urlCol }) =>
    `SELECT '${tableName}.${urlCol}' AS col, COUNT(*) AS cnt FROM "${tableName}" WHERE "${urlCol}" LIKE '%maps.googleapis.com%'`
).join("\nUNION ALL\n");

async function main() {
  console.log("=== Flokk key-bearing URL scrub (all tables, all rows) ===");

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    const totals = { persisted: 0, nulled: 0, errors: 0 };
    for (const t of TARGETS) {
      const s = await scrubTable({ client, ...t });
      totals.persisted += s.persisted;
      totals.nulled    += s.nulled;
      totals.errors    += s.errors;
    }

    console.log("\n=== FINAL TOTALS ===");
    console.log(`Persisted: ${totals.persisted}, Nulled: ${totals.nulled}, Errors: ${totals.errors}`);

    console.log("\n=== Verification (zero must appear for all rows) ===");
    const { rows: remaining } = await client.query(VERIFY_SQL);
    let fail = false;
    for (const r of remaining) {
      if (parseInt(r.cnt) > 0) {
        console.error(`  FAIL ${r.col}: ${r.cnt} remaining`);
        fail = true;
      }
    }
    if (fail) { process.exit(1); }
    else { console.log("  ✓ Zero key-bearing URLs remain across all columns"); }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
