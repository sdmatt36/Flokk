/**
 * replay-extractions.mjs
 *
 * Replays 2 failed ExtractionLog rows by posting the stored rawEmail directly
 * to the production webhook (no Clerk auth required — webhook resolves profile
 * by sender email exactly as CloudMailin would).
 *
 * Usage:
 *   node scripts/replay-extractions.mjs
 */

const WEBHOOK_URL = "https://www.flokktravel.com/api/webhooks/email-inbound";

const REPLAYS = [
  {
    label: "Matt Bali flight (JL5013 NRT→DPS, May 31 2026)",
    originalLogId: "cmpdq3pmj000004jrevgaz7dw",
    senderEmail: "sdmatt36@gmail.com",
    subject: "Fwd: View your flight details for your Denpasar-Bali trip",
    body: `Best,

Matt Greene
c: 619.251.4575

---------- Forwarded message ---------
From: Capital One <capitalone@capitalonebooking.com>
Date: Wed, May 20, 2026 at 2:53 PM
Subject: View your flight details for your Denpasar-Bali trip
To: Jody Greene <sdmatt36@gmail.com>

Here are your Capital One Business Travel and airline confirmation codes

Pack your bags for Denpasar-Bali!

Your confirmation codes
Japan Airlines
BURUJL
Capital One Business Travel
H-GEUJWG

Outbound to Denpasar-Bali
Economy semi Flex
May 31, 2026

7h 25m  Nonstop
Japan Airlines - JL5013
Tokyo
NRT
11:00 a.m.

Denpasar-Bali
DPS
5:25 p.m.
Operated by Garuda.

Jody Coughlin Greene
Base Fare: $529.00
Taxes and Fees: $248.60
Ticket #: 1317442908960

Matthew Eric Greene
Base Fare: $529.00
Taxes and Fees: $248.60
Ticket #: 1317442908961

Miles Camden Greene child
Base Fare: $397.00
Taxes and Fees: $240.90
Ticket #: 1317442908963

Beau Jackson Greene child
Base Fare: $397.00
Taxes and Fees: $240.90
Ticket #: 1317442908962

Total US$2,831.00
`,
  },
  {
    label: "Jenifer Spanish AirEuropa 9WI77Q",
    originalLogId: "cmpctyaiz000004kt0s8u6lbm",
    senderEmail: "jenifer.luisi@gmail.com",
    subject: "Fwd: Confirmación de compra Localizador <9WI77Q>",
    body: `---------- Forwarded message ---------
From: "WEB AIR EUROPA 2 " <eticket@amadeus.com>
Date: Tue, May 19, 2026 at 2:48 PM
Subject: Confirmación de compra Localizador <9WI77Q>
To: <JENIFER.LUISI@gmail.com>

Confirmación de compra Localizador <9WI77Q>
Gracias por volar con AirEuropa, a continuación, le detallamos toda la
información de su reserva.* Le recordamos que debe conservar este correo,
ya que podría ser solicitado durante su viaje.* ¡Buen viaje!

Thank you for flying with AirEuropa, please find below all the information
for your flight. *We remind you to keep this email as it may be requested
during your trip*
`,
  },
];

for (const item of REPLAYS) {
  console.log(`\n${"=".repeat(68)}`);
  console.log(`REPLAY: ${item.label}`);
  console.log(`Original log ID: ${item.originalLogId}`);
  console.log(`Sender: ${item.senderEmail} | Body: ${item.body.length} chars`);
  console.log(`Fired at: ${new Date().toISOString()}`);

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        envelope: { from: item.senderEmail, to: "trips@flokktravel.com" },
        headers: { subject: item.subject },
        plain: item.body,
        html: "",
      }),
    });
    const body = await res.json().catch(() => null);
    console.log(`HTTP ${res.status} | response: ${JSON.stringify(body)}`);
  } catch (e) {
    console.error(`FETCH ERROR: ${e.message}`);
  }

  console.log(`Finished at: ${new Date().toISOString()}`);
}

console.log("\nDone. Query ExtractionLog via Supabase MCP for new rows.");
