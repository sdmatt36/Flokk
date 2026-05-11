import { auth, currentUser } from "@clerk/nextjs/server";
import { AppHeaderClient } from "./AppHeaderClient";

export async function AppHeader() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email.split("@")[0] || "User";

  return <AppHeaderClient fullName={fullName} email={email} />;
}
