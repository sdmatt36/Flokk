import { AppHeader } from "@/components/ui/AppHeader";
import { BottomNav } from "@/components/ui/BottomNav";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { AddToItineraryProvider } from "@/components/features/places/AddToItineraryProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AddToItineraryProvider>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AppHeader />
        <main style={{ flex: "1 0 auto" }}>
          {children}
        </main>
        <div className="hidden md:block">
          <SiteFooter />
        </div>
        <BottomNav />
      </div>
    </AddToItineraryProvider>
  );
}
