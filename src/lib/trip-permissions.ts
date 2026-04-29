import { db } from '@/lib/db'
import { CollaboratorRole } from '@prisma/client'

export type TripAccess = {
  role: CollaboratorRole
  collaboratorId: string
}

export async function getTripAccess(familyProfileId: string, tripId: string): Promise<TripAccess | null> {
  const collab = await db.tripCollaborator.findFirst({
    where: {
      tripId,
      familyProfileId,
      acceptedAt: { not: null },
    },
    select: { id: true, role: true },
  })
  if (!collab) return null
  return { role: collab.role, collaboratorId: collab.id }
}

export async function canViewTrip(familyProfileId: string, tripId: string): Promise<boolean> {
  const access = await getTripAccess(familyProfileId, tripId)
  if (access) return true
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { privacy: true } })
  return trip?.privacy === 'PUBLIC'
}

export async function canEditTripContent(familyProfileId: string, tripId: string): Promise<boolean> {
  const access = await getTripAccess(familyProfileId, tripId)
  return access?.role === 'OWNER' || access?.role === 'EDITOR'
}

export async function canManageCollaborators(familyProfileId: string, tripId: string): Promise<boolean> {
  const access = await getTripAccess(familyProfileId, tripId)
  return access?.role === 'OWNER'
}

export async function getAccessibleTripIds(familyProfileId: string): Promise<string[]> {
  const collabs = await db.tripCollaborator.findMany({
    where: { familyProfileId, acceptedAt: { not: null } },
    select: { tripId: true },
  })
  return collabs.map((c) => c.tripId)
}

export async function canAccessTripForCloning(familyProfileId: string, tripId: string): Promise<boolean> {
  return canViewTrip(familyProfileId, tripId)
}
