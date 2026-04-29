import { db } from "@/lib/db";
import type { CollaboratorRole } from "@prisma/client";

// AggregatedFamilyContext aggregates constraint and preference signals from ALL accepted
// collaborator families on a trip, per Discipline 4.12 / Chat 41 aggregation rules:
//   UNION for constraints (dietary, accessibility, kid ages) — must accommodate everyone
//   BLEND for preferences (pace, interests, style) — family-weighted (1 family = 1 vote)
//
// VIEWER collaborators are included: they're traveling, their needs matter.
// Pending invitations (acceptedAt IS NULL) are excluded — they haven't joined the trip.
//
// allergens: schema has no separate allergens field on FamilyMember; field reserved for
// future schema addition, always empty today.

export type AggregatedFamilyContext = {
  // UNION fields (constraints — non-negotiable, must satisfy everyone)
  dietaryRestrictions: string[];
  accessibilityNeeds: string[];
  // Each band represents one unique child age across all families (min === max for exact ages)
  kidAgeBands: { min: number; max: number }[];
  allergens: string[]; // reserved — no schema field yet

  // BLENDED fields (preferences — family-weighted, one family = one vote)
  pacePreferences: Array<{ pace: string; weight: number }>;
  interestSignals: Record<string, number>; // interestKey → blended weight (0..1)
  styleCues: string[]; // union of travelStyle values (ADVENTUROUS | BALANCED | RELAXED)

  // METADATA
  collaboratorCount: number;
  primaryCollaboratorId: string; // OWNER's profileId — backwards-compat anchor
  isMultiFamily: boolean;
  contributingFamilies: Array<{
    familyProfileId: string;
    familyName: string | null;
    role: CollaboratorRole;
    memberCount: number;
  }>;
};

function ageAtDate(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const m = referenceDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birthDate.getDate())) age--;
  return age;
}

export async function aggregateTripContext(tripId: string): Promise<AggregatedFamilyContext> {
  // Fetch trip for start date (used for age computation)
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { startDate: true },
  });
  const referenceDate = trip?.startDate ?? new Date();

  // Fetch all accepted collaborators with their family profiles + members + interests
  const collaborators = await db.tripCollaborator.findMany({
    where: { tripId, acceptedAt: { not: null }, familyProfileId: { not: null } },
    select: {
      role: true,
      familyProfile: {
        select: {
          id: true,
          familyName: true,
          travelStyle: true,
          pace: true,
          members: {
            select: {
              role: true,
              birthDate: true,
              dietaryRequirements: true,
              mobilityNotes: true,
            },
          },
          interests: {
            select: { interestKey: true },
          },
        },
      },
    },
    orderBy: { invitedAt: "asc" },
  });

  // Filter to collaborators with a resolved profile (satisfies TypeScript — familyProfileId not null above)
  const resolved = collaborators.filter(
    (c): c is typeof c & { familyProfile: NonNullable<typeof c.familyProfile> } =>
      c.familyProfile !== null
  );

  if (resolved.length === 0) {
    // Degenerate case: no accepted collaborators — return empty/minimal context
    return {
      dietaryRestrictions: [],
      accessibilityNeeds: [],
      kidAgeBands: [],
      allergens: [],
      pacePreferences: [],
      interestSignals: {},
      styleCues: [],
      collaboratorCount: 0,
      primaryCollaboratorId: "",
      isMultiFamily: false,
      contributingFamilies: [],
    };
  }

  const collaboratorCount = resolved.length;
  const familyWeight = 1 / collaboratorCount; // each family contributes equally to blended prefs

  // Find OWNER for primaryCollaboratorId
  const ownerCollaborator = resolved.find((c) => c.role === "OWNER") ?? resolved[0];
  const primaryCollaboratorId = ownerCollaborator.familyProfile.id;

  // UNION: dietary restrictions
  const dietarySet = new Set<string>();
  // UNION: accessibility / mobility needs
  const accessSet = new Set<string>();
  // UNION: unique child ages across all families
  const childAgeSet = new Set<number>();

  // BLEND: pace preferences (family-weighted)
  const paceMap = new Map<string, number>(); // pace → accumulated weight
  // BLEND: interest signals (family-weighted)
  const interestMap = new Map<string, number>(); // interestKey → accumulated weight
  // BLEND: style cues (union — multiple styles can coexist)
  const styleSet = new Set<string>();

  const contributingFamilies: AggregatedFamilyContext["contributingFamilies"] = [];

  for (const collab of resolved) {
    const profile = collab.familyProfile;

    contributingFamilies.push({
      familyProfileId: profile.id,
      familyName: profile.familyName ?? null,
      role: collab.role,
      memberCount: profile.members.length,
    });

    // Dietary — UNION
    for (const member of profile.members) {
      for (const req of member.dietaryRequirements as string[]) {
        if (req) dietarySet.add(req);
      }
    }

    // Accessibility — UNION
    for (const member of profile.members) {
      if (member.mobilityNotes) accessSet.add(member.mobilityNotes);
    }

    // Kid ages — UNION across families
    for (const member of profile.members) {
      if (member.role === "CHILD" && member.birthDate) {
        const age = ageAtDate(member.birthDate, referenceDate);
        if (age >= 0) childAgeSet.add(age);
      }
    }

    // Pace — BLEND (family-weighted)
    if (profile.pace) {
      const key = profile.pace.toString();
      paceMap.set(key, (paceMap.get(key) ?? 0) + familyWeight);
    }

    // Interests — BLEND (family-weighted; each family's interests contribute equally)
    const familyInterestKeys = profile.interests.map((i) => i.interestKey);
    // Normalize within the family: if a family has N interests, each gets weight 1/N * familyWeight
    // This prevents families with many interests dominating over families with few
    const perInterestWeight = familyInterestKeys.length > 0
      ? familyWeight / familyInterestKeys.length
      : 0;
    for (const key of familyInterestKeys) {
      interestMap.set(key, (interestMap.get(key) ?? 0) + perInterestWeight);
    }

    // Style cues — union
    if (profile.travelStyle) {
      styleSet.add(profile.travelStyle.toString());
    }
  }

  // Convert pace map to sorted array (descending weight)
  const pacePreferences = Array.from(paceMap.entries())
    .map(([pace, weight]) => ({ pace, weight: Math.round(weight * 1000) / 1000 }))
    .sort((a, b) => b.weight - a.weight);

  // Convert interest map to record
  const interestSignals: Record<string, number> = {};
  for (const [key, weight] of interestMap.entries()) {
    interestSignals[key] = Math.round(weight * 1000) / 1000;
  }

  // Convert kid ages to sorted band array (each age = { min: age, max: age })
  const kidAgeBands = Array.from(childAgeSet)
    .sort((a, b) => a - b)
    .map((age) => ({ min: age, max: age }));

  return {
    dietaryRestrictions: Array.from(dietarySet),
    accessibilityNeeds: Array.from(accessSet),
    kidAgeBands,
    allergens: [], // reserved — no allergens field in schema
    pacePreferences,
    interestSignals,
    styleCues: Array.from(styleSet),
    collaboratorCount,
    primaryCollaboratorId,
    isMultiFamily: collaboratorCount > 1,
    contributingFamilies,
  };
}

// Derive a flat child ages array from kidAgeBands (for downstream consumers that need number[])
export function flatChildAges(ctx: AggregatedFamilyContext): number[] {
  return ctx.kidAgeBands.map((b) => b.min);
}

// Derive a human-readable pace description for prompt injection
// e.g. "BALANCED" (single family) or "mix of RELAXED and PACKED, leaning RELAXED" (multi)
export function describePace(ctx: AggregatedFamilyContext): string | null {
  if (ctx.pacePreferences.length === 0) return null;
  if (ctx.pacePreferences.length === 1) return ctx.pacePreferences[0].pace;
  const dominant = ctx.pacePreferences[0];
  const others = ctx.pacePreferences.slice(1).map((p) => p.pace);
  return `mix of ${[dominant.pace, ...others].join(" and ")}, leaning ${dominant.pace}`;
}

// Derive top interest keys by blended weight (descending), up to maxCount
export function topInterests(ctx: AggregatedFamilyContext, maxCount = 5): string[] {
  return Object.entries(ctx.interestSignals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([key]) => key);
}
