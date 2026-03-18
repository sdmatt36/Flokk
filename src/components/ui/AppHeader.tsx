import { auth, currentUser } from "@clerk/nextjs/server";
import { AppHeaderClient } from "./AppHeaderClient";

export async function AppHeader() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";

  // Greeting name: firstName → first word of fullName → email prefix → "there"
  const rawFirst =
    user?.firstName?.trim() ||
    user?.fullName?.trim().split(" ")[0] ||
    email.split("@")[0] ||
    "there";
  const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email.split("@")[0] || "User";

  return <AppHeaderClient firstName={firstName} fullName={fullName} email={email} />;
}
