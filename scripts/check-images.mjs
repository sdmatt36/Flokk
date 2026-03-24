import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: "postgresql://postgres.egnvlwgngyrkhhbxtlqa:KnMtaLDaFG3nBgi1@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true" });

// Show all trips with hero images
const trips = await pool.query('SELECT id, title, "destinationCity", "heroImageUrl" FROM "Trip" ORDER BY "startDate" ASC NULLS LAST');
console.log('\n=== TRIP COVERS ===');
for (const t of trips.rows) {
  console.log(t.title.padEnd(30), (t.heroImageUrl ?? 'NULL').substring(0, 70));
}

// Show all SavedItems with mediaThumbnailUrl
const items = await pool.query(`
  SELECT id, "rawTitle", "mediaThumbnailUrl", "destinationCity", "categoryTags"
  FROM "SavedItem"
  WHERE "mediaThumbnailUrl" IS NOT NULL
  ORDER BY "savedAt" DESC
  LIMIT 30
`);
console.log('\n=== RECENT SAVED ITEMS WITH THUMBNAILS ===');
for (const i of items.rows) {
  console.log(
    (i.rawTitle ?? 'untitled').substring(0, 25).padEnd(26),
    (i.destinationCity ?? '?').padEnd(12),
    (i.mediaThumbnailUrl ?? '').substring(0, 60)
  );
}

await pool.end();
