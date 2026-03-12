import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BottomNav } from "@/components/ui/BottomNav";
import { EditFamilyClient } from "@/components/features/family/EditFamilyClient";

export const dynamic = "force-dynamic";

export default async function EditFamilyPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: {
      familyProfile: {
        include: { members: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!user?.familyProfile) redirect("/onboarding");

  const { familyName, members } = user.familyProfile;

  // Serialize for client — convert Date to ISO string
  const serializedMembers = members.map((m) => ({
    id: m.id,
    name: m.name ?? null,
    role: m.role as "ADULT" | "CHILD",
    birthDate: m.birthDate ? m.birthDate.toISOString() : null,
  }));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF" }}>
      <EditFamilyClient familyName={familyName} initialMembers={serializedMembers} />
      <BottomNav />
    </div>
  );
}
