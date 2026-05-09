import { Suspense } from "react";
import { SavesScreen } from "@/components/features/saves/SavesScreen";

export default function SavesPage() {
  return (
    <Suspense>
      <SavesScreen />
    </Suspense>
  );
}
