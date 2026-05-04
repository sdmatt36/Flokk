"use client";

// Edit 3: stop 1 moved up from y=535 to y=505
const ROUTE_PATH =
  "M 350 505 Q 480 525 590 510 Q 700 492 815 470 Q 870 458 990 415 Q 1010 405 760 340 Q 720 325 990 260 Q 1010 250 760 180 Q 720 165 990 90";

export default function BuildATourHero() {
  return (
    // Edit 1: outer wrapper constrains hero to max-width 1200, matching form below
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "620px",
          borderRadius: "24px", // Edit 1: all-corner radius (was 0 0 24px 24px)
          overflow: "hidden",
          background: "linear-gradient(180deg, #FBF1DE 0%, #F5DFC0 100%)", // Edit 5: honey/peach
        }}
      >
        {/* LAYERS 1–3: map background + route + pins */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          viewBox="0 0 1200 620"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Edit 5: warmer block colors */}
            <pattern id="map-blocks" x="0" y="0" width="180" height="180" patternUnits="userSpaceOnUse">
              <rect x="10" y="10" width="68" height="58" fill="#F2D9B8" opacity="0.65" rx="2" />
              <rect x="88" y="16" width="58" height="50" fill="#E8C8A0" opacity="0.6" rx="2" />
              <rect x="12" y="78" width="55" height="65" fill="#ECCFA8" opacity="0.65" rx="2" />
              <rect x="78" y="74" width="50" height="70" fill="#F3DAB5" opacity="0.65" rx="2" />
              <rect x="138" y="92" width="40" height="55" fill="#E9CCA0" opacity="0.6" rx="2" />
              <rect x="38" y="152" width="62" height="22" fill="#EFD4AC" opacity="0.65" rx="2" />
              <rect x="110" y="158" width="55" height="20" fill="#E8C8A0" opacity="0.6" rx="2" />
            </pattern>
          </defs>

          {/* Block fill */}
          <rect width="1200" height="620" fill="url(#map-blocks)" />

          {/* Edit 4: Bay moved up from y=590 to y=560 — Edit 5: richer blue */}
          <path
            d="M 0 560 Q 150 550 320 558 Q 480 568 640 560 Q 820 550 1000 565 Q 1100 570 1200 560 L 1200 620 L 0 620 Z"
            fill="#5DA3C4"
            opacity="1"
          />
          <path
            d="M 0 560 Q 150 550 320 558 Q 480 568 640 560 Q 820 550 1000 565 Q 1100 570 1200 560"
            stroke="#4A8AAA"
            strokeWidth="1.5"
            fill="none"
            opacity="0.6"
          />
          {/* Edit 4: wave details shifted up */}
          <path
            d="M 100 580 Q 200 578 300 580 Q 400 582 500 580"
            stroke="white"
            strokeWidth="1"
            fill="none"
            opacity="0.5"
          />
          <path
            d="M 600 590 Q 700 588 800 590 Q 900 592 1000 590"
            stroke="white"
            strokeWidth="1"
            fill="none"
            opacity="0.5"
          />

          {/* Edit 5: brighter greens, lower opacity */}
          <ellipse cx="1110" cy="280" rx="38" ry="22" fill="#8BCB6A" opacity="0.58" />
          <ellipse cx="640" cy="180" rx="32" ry="18" fill="#8BCB6A" opacity="0.55" />
          <ellipse cx="180" cy="430" rx="42" ry="24" fill="#7BBF5C" opacity="0.57" />
          <ellipse cx="180" cy="430" rx="42" ry="24" fill="#82B560" opacity="0.4" />

          {/* Major horizontal roads */}
          <line x1="0" y1="110" x2="1200" y2="110" stroke="white" strokeWidth="7" opacity="0.9" />
          <line x1="0" y1="270" x2="1200" y2="270" stroke="white" strokeWidth="6" opacity="0.88" />
          <line x1="0" y1="425" x2="1200" y2="425" stroke="white" strokeWidth="5" opacity="0.85" />
          <line x1="0" y1="540" x2="1200" y2="540" stroke="white" strokeWidth="4" opacity="0.8" />

          {/* Major vertical roads (slight diagonal) */}
          <line x1="540" y1="0" x2="575" y2="620" stroke="white" strokeWidth="6" opacity="0.88" />
          <line x1="720" y1="0" x2="745" y2="620" stroke="white" strokeWidth="7" opacity="0.9" />
          <line x1="900" y1="0" x2="925" y2="620" stroke="white" strokeWidth="6" opacity="0.88" />
          <line x1="1080" y1="0" x2="1105" y2="620" stroke="white" strokeWidth="6" opacity="0.88" />

          {/* Minor cross-streets — horizontal */}
          <line x1="0" y1="69" x2="1200" y2="69" stroke="white" strokeWidth="2.5" opacity="0.57" />
          <line x1="0" y1="202" x2="1200" y2="202" stroke="white" strokeWidth="2.5" opacity="0.55" />
          <line x1="0" y1="355" x2="1200" y2="355" stroke="white" strokeWidth="2.5" opacity="0.58" />

          {/* Minor cross-streets — vertical */}
          <line x1="215" y1="0" x2="215" y2="620" stroke="white" strokeWidth="2.5" opacity="0.56" />
          <line x1="375" y1="0" x2="375" y2="620" stroke="white" strokeWidth="2.5" opacity="0.55" />
          <line x1="654" y1="0" x2="654" y2="620" stroke="white" strokeWidth="2.5" opacity="0.57" />
          <line x1="832" y1="0" x2="832" y2="620" stroke="white" strokeWidth="2.5" opacity="0.56" />
          <line x1="1012" y1="0" x2="1012" y2="620" stroke="white" strokeWidth="2.5" opacity="0.55" />

          {/* LAYER 2: Route line */}
          <path
            d={ROUTE_PATH}
            stroke="#C4664A"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={ROUTE_PATH}
            stroke="#FFFFFF"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="3,10"
            opacity="0.75"
          />

          {/* LAYER 3: Labels first, pins on top */}

          {/* Edit 3: Stop 1 label shifted up — y=517→487, text y=532→502 and y=547→517 */}
          <rect x="370" y="487" width="180" height="40" rx="7" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="460" y="502" textAnchor="middle" fontSize="13" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Tsukiji Outer Market</text>
          <text x="460" y="517" textAnchor="middle" fontSize="10" fill="#888888" fontFamily="DM Sans, system-ui, sans-serif">8:00 AM · breakfast</text>

          {/* Stop 2 label */}
          <rect x="608" y="495" width="160" height="34" rx="6" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="688" y="510" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Hama-rikyu Gardens</text>
          <text x="688" y="523" textAnchor="middle" fontSize="9" fill="#888888" fontFamily="DM Sans, system-ui, sans-serif">10:30 AM · stroll</text>

          {/* Stop 3 label */}
          <rect x="833" y="455" width="155" height="34" rx="6" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="910" y="470" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Ginza food halls</text>
          <text x="910" y="483" textAnchor="middle" fontSize="9" fill="#888888" fontFamily="DM Sans, system-ui, sans-serif">12:00 PM · lunch</text>

          {/* Stop 4 label — terracotta border, label LEFT of pin */}
          <rect x="800" y="400" width="170" height="34" rx="6" fill="white" stroke="#C4664A" strokeWidth="1.5" />
          <text x="885" y="415" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Poop break</text>
          <text x="885" y="428" textAnchor="middle" fontSize="9" fill="#C4664A" fontFamily="DM Sans, system-ui, sans-serif">1:15 PM · family-pro</text>

          {/* Stop 5 label */}
          <rect x="780" y="325" width="170" height="34" rx="6" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="865" y="340" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Imperial Palace</text>
          <text x="865" y="353" textAnchor="middle" fontSize="9" fill="#888888" fontFamily="DM Sans, system-ui, sans-serif">2:30 PM · culture</text>

          {/* Stop 6 label — LEFT of pin */}
          <rect x="800" y="245" width="170" height="34" rx="6" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="885" y="260" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Akihabara</text>
          <text x="885" y="273" textAnchor="middle" fontSize="9" fill="#888888" fontFamily="DM Sans, system-ui, sans-serif">4:00 PM · stop</text>

          {/* Stop 7 — no label */}

          {/* Stop 8 label — LEFT of pin */}
          <rect x="790" y="72" width="180" height="42" rx="7" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="880" y="88" textAnchor="middle" fontSize="13" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Senso-ji + ramen</text>
          <text x="880" y="104" textAnchor="middle" fontSize="10" fill="#C4664A" fontFamily="DM Sans, system-ui, sans-serif">5:30 PM · finale</text>

          {/* Pins — rendered last, sit on top of labels */}

          {/* Edit 3: Stop 1 pin moved up cy=535→505 */}
          <g transform="translate(350, 505)">
            <circle r="20" fill="#C4664A" stroke="white" strokeWidth="4" />
            <text x="0" y="5" textAnchor="middle" fontSize="14" fontWeight="700" fill="white" fontFamily="DM Sans, system-ui, sans-serif">1</text>
          </g>

          <g transform="translate(590, 510)">
            <circle r="14" fill="white" stroke="#C4664A" strokeWidth="3" />
            <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#C4664A" fontFamily="DM Sans, system-ui, sans-serif">2</text>
          </g>

          <g transform="translate(815, 470)">
            <circle r="14" fill="white" stroke="#C4664A" strokeWidth="3" />
            <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#C4664A" fontFamily="DM Sans, system-ui, sans-serif">3</text>
          </g>

          <g transform="translate(990, 415)">
            <circle r="14" fill="white" stroke="#C4664A" strokeWidth="3" />
            <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#C4664A" fontFamily="DM Sans, system-ui, sans-serif">4</text>
          </g>

          <g transform="translate(760, 340)">
            <circle r="14" fill="white" stroke="#C4664A" strokeWidth="3" />
            <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#C4664A" fontFamily="DM Sans, system-ui, sans-serif">5</text>
          </g>

          <g transform="translate(990, 260)">
            <circle r="14" fill="white" stroke="#C4664A" strokeWidth="3" />
            <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#C4664A" fontFamily="DM Sans, system-ui, sans-serif">6</text>
          </g>

          <g transform="translate(760, 180)">
            <circle r="14" fill="white" stroke="#C4664A" strokeWidth="3" />
            <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#C4664A" fontFamily="DM Sans, system-ui, sans-serif">7</text>
          </g>

          <g transform="translate(990, 90)">
            <circle r="20" fill="#C4664A" stroke="white" strokeWidth="4" />
            <text x="0" y="5" textAnchor="middle" fontSize="14" fontWeight="700" fill="white" fontFamily="DM Sans, system-ui, sans-serif">8</text>
          </g>
        </svg>

        {/* LAYER 4: Left gradient overlay — Edit 5: updated to new base color */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(251,241,222,0.97) 0%, rgba(251,241,222,0.93) 22%, rgba(251,241,222,0.55) 30%, rgba(251,241,222,0) 36%)",
            pointerEvents: "none",
          }}
        />

        {/* LAYER 5: Headline content */}
        <div style={{ position: "relative", padding: "3rem 2rem 2rem", maxWidth: "540px", zIndex: 2 }}>
          {/* Pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 11px",
              background: "white",
              border: "1px solid rgba(196,102,74,0.3)",
              borderRadius: "16px",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.8px",
              color: "#C4664A",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              marginBottom: "16px",
              fontFamily: "DM Sans, system-ui, sans-serif",
            }}
          >
            <div style={{ width: "5px", height: "5px", background: "#C4664A", borderRadius: "50%" }} />
            BUILD A TOUR · FLOKK POWERED
          </div>

          {/* Edit 2: font-size 46px → 42px so "Catered to Your Family." stays on one line */}
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "42px",
              fontWeight: 700,
              lineHeight: 1.02,
              color: "#1B3A5C",
              letterSpacing: "-0.8px",
              margin: "0 0 14px",
            }}
          >
            Custom Tours.
            <br />
            <span style={{ color: "#C4664A", fontStyle: "italic" }}>Catered to Your Family.</span>
          </h1>

          {/* Subhead */}
          <p
            style={{
              fontSize: "14px",
              color: "#5A6B7D",
              lineHeight: 1.55,
              maxWidth: "440px",
              margin: "0 0 20px",
              fontFamily: "DM Sans, system-ui, sans-serif",
            }}
          >
            Personalized tours for your family. Plan ahead, or build one in five seconds when you&apos;re stuck
            mid-day and need a fresh idea.
          </p>

          {/* Featured chip */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              padding: "11px 16px",
              background: "white",
              border: "1px solid rgba(196,102,74,0.2)",
              borderRadius: "12px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              fontFamily: "DM Sans, system-ui, sans-serif",
            }}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                background: "#C4664A",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "white", fontSize: "11px", fontWeight: 700 }}>8</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#1B3A5C" }}>Featured · Tokyo</span>
            <div style={{ width: "1px", height: "14px", background: "#E0E0E0" }} />
            <span style={{ fontSize: "11px", color: "#888888" }}>Greene family · ★ 4.9</span>
          </div>
        </div>
      </div>
    </div>
  );
}
