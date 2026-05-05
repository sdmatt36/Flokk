"use client";

const ROUTE_PATH =
  "M 350 505 Q 480 525 590 510 Q 700 492 815 470 Q 870 458 990 415 Q 1010 405 760 340 Q 720 325 990 260 Q 1010 250 760 180 Q 720 165 990 90";

export default function BuildATourHero() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "720px",
          borderRadius: "24px",
          overflow: "hidden",
          background: "linear-gradient(180deg, #FAEAD0 0%, #F0D5A8 100%)",
        }}
      >
        {/* LAYERS 1–3: map background + route + pins */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          viewBox="0 0 1200 720"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="map-blocks" x="0" y="0" width="180" height="180" patternUnits="userSpaceOnUse">
              <rect x="10" y="10" width="68" height="58" fill="#EBD8B8" opacity="0.6" rx="2" />
              <rect x="88" y="16" width="58" height="50" fill="#E5CCA8" opacity="0.6" rx="2" />
              <rect x="12" y="78" width="55" height="65" fill="#E8D2B0" opacity="0.6" rx="2" />
              <rect x="78" y="74" width="50" height="70" fill="#EFDCBC" opacity="0.6" rx="2" />
              <rect x="138" y="92" width="40" height="55" fill="#E0C8A0" opacity="0.6" rx="2" />
              <rect x="38" y="152" width="62" height="22" fill="#E8D0AC" opacity="0.6" rx="2" />
              <rect x="110" y="158" width="55" height="20" fill="#E2C8A4" opacity="0.6" rx="2" />
            </pattern>
          </defs>

          {/* Block fill */}
          <rect width="1200" height="720" fill="url(#map-blocks)" />

          {/* Tokyo Bay */}
          <path
            d="M 0 560 Q 150 550 320 558 Q 480 568 640 560 Q 820 550 1000 565 Q 1100 570 1200 560 L 1200 720 L 0 720 Z"
            fill="#3A8FB5"
            opacity="1"
          />
          <path
            d="M 0 560 Q 150 550 320 558 Q 480 568 640 560 Q 820 550 1000 565 Q 1100 570 1200 560"
            stroke="#2E7896"
            strokeWidth="2"
            fill="none"
            opacity="0.6"
          />
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

          {/* Parks */}
          <ellipse cx="1110" cy="280" rx="38" ry="22" fill="#5FAA42" opacity="0.78" />
          <ellipse cx="640" cy="180" rx="32" ry="18" fill="#5FAA42" opacity="0.78" />
          <ellipse cx="180" cy="430" rx="42" ry="24" fill="#5FAA42" opacity="0.78" />
          <ellipse cx="180" cy="430" rx="42" ry="24" fill="#4A8C30" opacity="0.78" />

          {/* Major horizontal roads */}
          <line x1="0" y1="110" x2="1200" y2="110" stroke="white" strokeWidth="8" opacity="0.95" />
          <line x1="0" y1="270" x2="1200" y2="270" stroke="white" strokeWidth="7" opacity="0.92" />
          <line x1="0" y1="425" x2="1200" y2="425" stroke="white" strokeWidth="6" opacity="0.90" />
          <line x1="0" y1="540" x2="1200" y2="540" stroke="white" strokeWidth="4" opacity="0.8" />

          {/* Major vertical roads (slight diagonal) */}
          <line x1="540" y1="0" x2="575" y2="720" stroke="white" strokeWidth="7" opacity="0.92" />
          <line x1="720" y1="0" x2="745" y2="720" stroke="white" strokeWidth="8" opacity="0.95" />
          <line x1="900" y1="0" x2="925" y2="720" stroke="white" strokeWidth="7" opacity="0.92" />
          <line x1="1080" y1="0" x2="1105" y2="720" stroke="white" strokeWidth="7" opacity="0.92" />

          {/* Minor cross-streets — horizontal */}
          <line x1="0" y1="69" x2="1200" y2="69" stroke="white" strokeWidth="3" opacity="0.71" />
          <line x1="0" y1="202" x2="1200" y2="202" stroke="white" strokeWidth="3" opacity="0.70" />
          <line x1="0" y1="355" x2="1200" y2="355" stroke="white" strokeWidth="3" opacity="0.72" />

          {/* Minor cross-streets — vertical */}
          <line x1="215" y1="0" x2="215" y2="720" stroke="white" strokeWidth="3" opacity="0.71" />
          <line x1="375" y1="0" x2="375" y2="720" stroke="white" strokeWidth="3" opacity="0.70" />
          <line x1="654" y1="0" x2="654" y2="720" stroke="white" strokeWidth="3" opacity="0.71" />
          <line x1="832" y1="0" x2="832" y2="720" stroke="white" strokeWidth="3" opacity="0.71" />
          <line x1="1012" y1="0" x2="1012" y2="720" stroke="white" strokeWidth="3" opacity="0.70" />

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
            opacity="0.85"
          />

          {/* LAYER 3: Labels first, pins on top */}

          {/* Stop 1 */}
          <rect x="370" y="487" width="180" height="40" rx="7" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="460" y="502" textAnchor="middle" fontSize="13" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Tsukiji Outer Market</text>
          <text x="460" y="517" textAnchor="middle" fontSize="10" fill="#888888" fontFamily="DM Sans, system-ui, sans-serif">8:00 AM · breakfast</text>

          {/* Stop 2 */}
          <rect x="608" y="495" width="160" height="34" rx="6" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="688" y="510" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Hama-rikyu Gardens</text>
          <text x="688" y="523" textAnchor="middle" fontSize="9" fill="#888888" fontFamily="DM Sans, system-ui, sans-serif">10:30 AM · stroll</text>

          {/* Stop 3 */}
          <rect x="833" y="455" width="155" height="34" rx="6" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="910" y="470" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Ginza food halls</text>
          <text x="910" y="483" textAnchor="middle" fontSize="9" fill="#888888" fontFamily="DM Sans, system-ui, sans-serif">12:00 PM · lunch</text>

          {/* Stop 4 — terracotta border */}
          <rect x="800" y="400" width="170" height="34" rx="6" fill="white" stroke="#C4664A" strokeWidth="1.5" />
          <text x="885" y="415" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Poop break</text>
          <text x="885" y="428" textAnchor="middle" fontSize="9" fill="#C4664A" fontFamily="DM Sans, system-ui, sans-serif">1:15 PM · family-pro</text>

          {/* Stop 5 */}
          <rect x="780" y="325" width="170" height="34" rx="6" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="865" y="340" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Imperial Palace</text>
          <text x="865" y="353" textAnchor="middle" fontSize="9" fill="#888888" fontFamily="DM Sans, system-ui, sans-serif">2:30 PM · culture</text>

          {/* Stop 6 */}
          <rect x="800" y="245" width="170" height="34" rx="6" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="885" y="260" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Akihabara</text>
          <text x="885" y="273" textAnchor="middle" fontSize="9" fill="#888888" fontFamily="DM Sans, system-ui, sans-serif">4:00 PM · stop</text>

          {/* Stop 7 — no label */}

          {/* Stop 8 */}
          <rect x="790" y="72" width="180" height="42" rx="7" fill="white" stroke="#E0E0E0" strokeWidth="0.5" />
          <text x="880" y="88" textAnchor="middle" fontSize="13" fontWeight="600" fill="#1B3A5C" fontFamily="DM Sans, system-ui, sans-serif">Senso-ji + ramen</text>
          <text x="880" y="104" textAnchor="middle" fontSize="10" fill="#C4664A" fontFamily="DM Sans, system-ui, sans-serif">5:30 PM · finale</text>

          {/* Pins */}
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

        {/* LAYER 4: Left gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(250,234,208,0.97) 0%, rgba(250,234,208,0.92) 26%, rgba(250,234,208,0.55) 36%, rgba(250,234,208,0) 44%)",
            pointerEvents: "none",
          }}
        />

        {/* LAYER 5: Headline content */}
        <div style={{ position: "relative", padding: "3rem 2rem 2rem", maxWidth: "600px", zIndex: 2 }}>
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
