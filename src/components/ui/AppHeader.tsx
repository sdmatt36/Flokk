import { auth, currentUser } from "@clerk/nextjs/server";
import { AppHeaderClient } from "./AppHeaderClient";

export async function AppHeader() {
  const { userId } = await auth();

  let fullName = "";
  let email = "";

  if (userId) {
    const user = await currentUser();
    email = user?.emailAddresses?.[0]?.emailAddress ?? "";
    fullName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      email.split("@")[0] ||
      "User";
  }

  return (
    <AppHeaderClient isLoggedIn={!!userId} fullName={fullName} email={email} />
  );
}
