import BetaInvitation from "@/emails/BetaInvitation";

export default function EmailPreviewPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#e5e7eb", padding: "40px 24px" }}>
      <BetaInvitation firstName="Matt" />
    </div>
  );
}
