import { auth, currentUser } from "@clerk/nextjs/server";
import { AppHeaderClient } from "./AppHeaderClient";

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.trim()?.[0]?.toUpperCase() ?? "";
  const l = lastName?.trim()?.[0]?.toUpperCase() ?? "";
  return (f + l) || "?";
}

export async function AppHeader() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const initials = getInitials(user?.firstName, user?.lastName);
  const firstName = user?.firstName ?? "there";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";

  return <AppHeaderClient initials={initials} firstName={firstName} fullName={fullName} email={email} />;
}
