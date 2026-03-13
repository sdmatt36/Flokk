import { AppHeader } from "@/components/ui/AppHeader";
import { BottomNav } from "@/components/ui/BottomNav";
import { SiteFooter } from "@/components/ui/SiteFooter";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <div className="hidden md:block">
        <SiteFooter />
      </div>
      <BottomNav />
    </div>
  );
}
