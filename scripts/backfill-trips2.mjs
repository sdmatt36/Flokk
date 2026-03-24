import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: "postgresql://postgres.egnvlwgngyrkhhbxtlqa:KnMtaLDaFG3nBgi1@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true" });

const MAP = {
  'tokyo': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
  'kyoto': 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80',
  'osaka': 'https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&q=80',
  'okinawa': 'https://images.unsplash.com/photo-1580640810088-1ac1d5f0ffe2?w=800&q=80',
  'naha': 'https://images.unsplash.com/photo-1580640810088-1ac1d5f0ffe2?w=800&q=80',
  'kamakura': 'https://images.unsplash.com/photo-1571890246824-795f3f28b4c4?w=800&q=80',
  'nara': 'https://images.unsplash.com/photo-1590245349325-b90a35b30a9e?w=800&q=80',
  'hiroshima': 'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80',
  'seoul': 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&q=80',
  'busan': 'https://images.unsplash.com/photo-1578637387939-43c525550085?w=800&q=80',
  'chiang mai': 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&q=80',
  'chiang rai': 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80',
  'bangkok': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80',
  'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
  'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80',
  'paris': 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80',
  'london': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80',
  'barcelona': 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80',
  'rome': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80',
  'amsterdam': 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&q=80',
  'lisbon': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80',
  'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80',
  'istanbul': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80',
  'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80',
  'sydney': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80',
  'marrakech': 'https://images.unsplash.com/photo-1597212618440-806262de4f2b?w=800&q=80',
  'marrakesh': 'https://images.unsplash.com/photo-1597212618440-806262de4f2b?w=800&q=80',
  'madrid': 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=800&q=80',
  'montreal': 'https://images.unsplash.com/photo-1519178614-68673b201f36?w=800&q=80',
  'buenos aires': 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=800&q=80',
  'colombo': 'https://images.unsplash.com/photo-1567591370078-c3a7f7c91b88?w=800&q=80',
  'sri lanka': 'https://images.unsplash.com/photo-1567591370078-c3a7f7c91b88?w=800&q=80',
  'japan': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
  'thailand': 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80',
  'korea': 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&q=80',
  'south korea': 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&q=80',
  'morocco': 'https://images.unsplash.com/photo-1597212618440-806262de4f2b?w=800&q=80',
};
const DEFAULT = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80';

function getImg(city, country) {
  const ck = (city ?? '').toLowerCase().trim();
  const co = (country ?? '').toLowerCase().trim();
  if (ck && MAP[ck]) return MAP[ck];
  const keys = Object.keys(MAP);
  if (ck) { const m = keys.find(k => ck.includes(k) || (k.length >= 4 && k.includes(ck))); if (m) return MAP[m]; }
  if (co && MAP[co]) return MAP[co];
  if (co) { const m = keys.find(k => co.includes(k) || (k.length >= 4 && k.includes(co))); if (m) return MAP[m]; }
  return DEFAULT;
}

const trips = await pool.query('SELECT id, "destinationCity", "destinationCountry", "heroImageUrl" FROM "Trip"');
console.log('All trips:', trips.rows.length);
let updated = 0;
for (const t of trips.rows) {
  const correct = getImg(t.destinationCity, t.destinationCountry);
  if (t.heroImageUrl !== correct) {
    await pool.query('UPDATE "Trip" SET "heroImageUrl" = $1 WHERE id = $2', [correct, t.id]);
    console.log('Updated:', t.destinationCity, '->', correct.substring(0, 60));
    updated++;
  } else {
    console.log('OK:', t.destinationCity, '(unchanged)');
  }
}
console.log('Total updated:', updated);
await pool.end();
