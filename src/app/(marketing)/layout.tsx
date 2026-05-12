import { AppHeader } from "@/components/ui/AppHeader";
import { SiteFooter } from "@/components/ui/SiteFooter";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
