const SERVICES = [
  { name: "Web app", status: "operational" },
  { name: "API", status: "operational" },
  { name: "Authentication", status: "operational" },
  { name: "Save extraction", status: "operational" },
  { name: "AI recommendations", status: "operational" },
  { name: "Map export", status: "operational" },
];

const INCIDENTS: { date: string; title: string; body: string; resolved: boolean }[] = [];

export default function StatusPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>Status</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", maxWidth: "640px", margin: "0 auto 24px", lineHeight: 1.2 }}>
            System status
          </h1>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", backgroundColor: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "999px", padding: "10px 20px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block" }} />
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#4ade80" }}>All systems operational</span>
          </div>
        </div>
      </section>

      {/* Services */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 32px" }}>Services</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {SERVICES.map((service) => (
              <div key={service.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", backgroundColor: "#F9F9F9", borderRadius: "10px" }}>
                <span style={{ fontSize: "15px", fontWeight: 500, color: "#1B3A5C" }}>{service.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#16a34a", textTransform: "capitalize" }}>{service.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Incident history */}
          <div style={{ marginTop: "64px" }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 24px" }}>Incident history</h2>
            {INCIDENTS.length === 0 ? (
              <div style={{ backgroundColor: "#F9F9F9", borderRadius: "12px", padding: "32px", textAlign: "center" }}>
                <p style={{ fontSize: "15px", color: "#717171", margin: 0 }}>No incidents in the past 90 days.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {INCIDENTS.map((inc) => (
                  <div key={inc.date} style={{ border: "1px solid #F0F0F0", borderRadius: "12px", padding: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C" }}>{inc.title}</span>
                      <span style={{ fontSize: "13px", color: "#999" }}>{inc.date}</span>
                    </div>
                    <p style={{ fontSize: "14px", color: "#717171", margin: 0, lineHeight: 1.6 }}>{inc.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
