import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GREENE_PROFILE_ID = 'cmmmv15y7000104jvocfz5kt6';
const EMAILS_TO_CLEAR = ['sdmatt36@gmail.com', 'jcamdenjackson@gmail.com'];

async function clearUnverifiedEmails() {
  // 1. Remove from senderEmails array on FamilyProfile
  const profile = await prisma.familyProfile.findUnique({
    where: { id: GREENE_PROFILE_ID },
    select: { senderEmails: true }
  });

  const cleaned = (profile?.senderEmails ?? []).filter(e => !EMAILS_TO_CLEAR.includes(e));

  await prisma.familyProfile.update({
    where: { id: GREENE_PROFILE_ID },
    data: { senderEmails: cleaned }
  });

  // 2. Delete any existing SenderEmailVerification records for these emails
  await prisma.senderEmailVerification.deleteMany({
    where: {
      familyProfileId: GREENE_PROFILE_ID,
      email: { in: EMAILS_TO_CLEAR }
    }
  });

  console.log(`✅ Cleared ${EMAILS_TO_CLEAR.join(', ')} from Greene profile`);
  console.log(`   senderEmails is now: ${JSON.stringify(cleaned)}`);
  await prisma.$disconnect();
}

clearUnverifiedEmails().catch(console.error);
