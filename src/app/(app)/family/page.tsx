import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { EditFamilyClient } from "@/components/features/family/EditFamilyClient";

export const dynamic = "force-dynamic";

export default async function EditFamilyPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const profileId = await resolveProfileId(userId);
  if (!profileId) redirect("/onboarding");

  const profile = await db.familyProfile.findUnique({
    where: { id: profileId },
    include: { members: { orderBy: { createdAt: "asc" } } },
  });
  if (!profile) redirect("/onboarding");

  const { familyName, members } = profile;

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
    </div>
  );
}
