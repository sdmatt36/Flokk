/**
 * Soft-delete pre-existing duplicate SavedItem rows for the Greene family profile.
 *
 * Context: familyProfileId cmmmv15y7000104jvocfz5kt6 accumulated duplicate SavedItem
 * rows on 2026-05-13 from 3-4 repeated Steal/import operations that bypassed dedup.
 * 140 groups had COUNT > 1, totalling 174 excess rows. 126 were excluded (unique trip/
 * tour/communitySpot associations not shared by the oldest row). 48 safe to soft-delete.
 *
 * Rule: within each duplicate group, keep the oldest row (min savedAt). Soft-delete
 * the rest (set deletedAt = now()) only where the row carries no unique association
 * (tripId, tourId, communitySpotId) that the kept row lacks.
 *
 * Reversible: set deletedAt = NULL on these IDs to restore.
 * Never hard-deletes. Scoped strictly to familyProfileId cmmmv15y7000104jvocfz5kt6.
 */

import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.production") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const IDS_TO_SOFT_DELETE = [
  "cmp4kzwy7000v04kwxzpdz7nb", "cmp4mc0t8000304jx049qed8z",
  "cmp4kzwy7000p04kwh0omj6cs", "cmp4maa55000304lbnx6tits0",
  "cmp4kzwy7000t04kwk37ui1xq", "cmp4mc0t8000104jxvmg5gf3u",
  "cmp4kzwy7000r04kw2gcej5nq", "cmp4maa55000504lbg0idskpl",
  "cmp4kzwy7000z04kwwn4947q8", "cmp4mdiq8000704jxdke4yq5r",
  "cmp4kzwy7000y04kwxehip65j", "cmp4mdiq8000604jxfk4oef2q",
  "cmp4kzwy7000x04kw1shncc9l", "cmp4mdiq8000504jxp2j76gqm",
  "cmp4kzwy7000w04kw1egyrxuh", "cmp4mdiq8000404jxouw1t7gh",
  "cmp4kzwy7000s04kwqsee6l7m", "cmp4mc0t8000004jxuh6abqm8",
  "cmp4kzwy7000q04kwwt3qv4ns", "cmp4maa55000404lbu396t4ck",
  "cmp4kzwy7000u04kwozhk1csf", "cmp4mc0t8000204jxifeloc2a",
  "cmp4kzwy7000o04kww0w3wbhd", "cmp4maa55000204lb42bejqav",
  "cmp4kzwy7001504kwr92i8w4y", "cmp10673l002404jr8yybdar2",
  "cmp1069iq004t04jrm2dseqpc", "cmp4kzwy7001204kwz3qq1icu",
  "cmp4kzwy7001304kwroo99el2", "cmp4kzwy7001404kw1t5g4d92",
  "cmp4kzwy7001704kwlxeabcgl", "cmo530qep000vlrrqs3vzuagn",
  "cmp10696g004f04jrurgv6mnw", "cmp4kzwy7001604kwug63kfah",
  "cmp4kzwy7001104kw6ozszaq7", "cmp4kzwy7001004kw09u202d7",
  "cmo5316mw0013lrrq69mqrxvs", "cmp1067op002s04jr9ho62jiq",
  "cmp1068qg003x04jrpwdkpe1c", "cmp1068jd003p04jrx9v4q9si",
  "cmoxtztmn000304jt1mq8xg2v", "cmp1069g3004q04jr70e0tmid",
  "cmp1068rc003y04jra8g13593", "cmp1067my002q04jr57i76nd8",
  "cmp1067qi002u04jrmmv4y85h", "cmp10695k004e04jr0nr4pagd",
  "cmp1068on003v04jr9l76jo6b", "cmp1069ld004w04jr6nffsn5e",
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Safety check: all target IDs belong to the correct family profile and are not already deleted
const checkRes = await client.query(
  `SELECT id FROM "SavedItem"
   WHERE id = ANY($1::text[])
     AND "familyProfileId" = 'cmmmv15y7000104jvocfz5kt6'
     AND "deletedAt" IS NULL`,
  [IDS_TO_SOFT_DELETE]
);
console.log(`Safety check: ${checkRes.rows.length} of ${IDS_TO_SOFT_DELETE.length} target IDs are live and on correct profile`);
if (checkRes.rows.length !== IDS_TO_SOFT_DELETE.length) {
  const found = new Set(checkRes.rows.map(r => r.id));
  const missing = IDS_TO_SOFT_DELETE.filter(id => !found.has(id));
  console.log(`Missing/already-deleted: ${missing.join(", ")}`);
}

// Count before
const beforeRes = await client.query(
  `SELECT COUNT(*) FROM "SavedItem"
   WHERE "familyProfileId" = 'cmmmv15y7000104jvocfz5kt6' AND "deletedAt" IS NULL`
);
const countBefore = parseInt(beforeRes.rows[0].count);
console.log(`Live SavedItem count before: ${countBefore}`);

// Execute soft-delete
const updateRes = await client.query(
  `UPDATE "SavedItem"
   SET "deletedAt" = now()
   WHERE id = ANY($1::text[])
     AND "familyProfileId" = 'cmmmv15y7000104jvocfz5kt6'
     AND "deletedAt" IS NULL`,
  [IDS_TO_SOFT_DELETE]
);
console.log(`Rows soft-deleted: ${updateRes.rowCount}`);

// Count after
const afterRes = await client.query(
  `SELECT COUNT(*) FROM "SavedItem"
   WHERE "familyProfileId" = 'cmmmv15y7000104jvocfz5kt6' AND "deletedAt" IS NULL`
);
const countAfter = parseInt(afterRes.rows[0].count);
console.log(`Live SavedItem count after: ${countAfter}`);
console.log(`Net reduction: ${countBefore - countAfter}`);

await client.end();
console.log("DONE");
