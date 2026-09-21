import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedData } from '../src/features/demo/seed';
import { encrypt, digest } from '../src/server/crypto';
const db = new PrismaClient();
async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('Set SEED_PASSWORD to a unique password of at least 12 characters.');
  const seed = seedData();
  const hash = await bcrypt.hash(password, 12);
  await db.$transaction(
    async (tx) => {
      const p = await tx.property.upsert({
        where: { code: seed.property.code },
        create: seed.property,
        update: {},
      });
      await tx.user.upsert({
        where: { email: 'owner@pgconnect.example' },
        create: {
          name: 'Aditya Sharma',
          email: 'owner@pgconnect.example',
          role: 'OWNER',
          passwordHash: hash,
          propertyId: p.id,
        },
        update: {},
      });
      for (const t of seed.tenants) {
        await tx.user.upsert({
          where: { id: t.id },
          create: {
            id: t.id,
            name: t.name,
            email: t.email,
            passwordHash: hash,
            phoneHash: digest(t.phone),
            phoneEncrypted: encrypt(t.phone),
            role: 'TENANT',
            propertyId: p.id,
            room: t.room,
            bed: t.bed,
            moveIn: t.moveIn,
            rent: t.rent,
            deposit: t.deposit,
          },
          update: {},
        });
      }
      for (const r of seed.rents)
        await tx.rent.upsert({
          where: { tenantId_month: { tenantId: r.tenantId, month: r.month } },
          create: { ...r, propertyId: p.id },
          update: {},
        });
      for (const c of seed.complaints)
        await tx.complaint.upsert({
          where: { id: c.id },
          create: { ...c, propertyId: p.id, createdAt: new Date(c.createdAt) },
          update: {},
        });
      for (const a of seed.announcements) {
        const { reads, ...fields } = a;
        await tx.announcement.upsert({
          where: { id: a.id },
          create: { ...fields, propertyId: p.id, createdAt: new Date(a.createdAt) },
          update: {},
        });
        await tx.announcementRead.createMany({
          data: reads.map((userId) => ({ announcementId: a.id, userId })),
          skipDuplicates: true,
        });
      }
      for (const m of seed.menu)
        await tx.menuDay.upsert({
          where: { propertyId_day: { propertyId: p.id, day: m.day } },
          create: { ...m, propertyId: p.id },
          update: {},
        });
    },
    { timeout: 30000 },
  );
  process.stdout.write(
    'Seed data created. Owner: owner@pgconnect.example. Tenant: aarav@example.com. Use your SEED_PASSWORD.\n',
  );
}
main()
  .catch(() => {
    process.stderr.write(
      'Seeding failed. Check DATABASE_URL, encryption configuration and SEED_PASSWORD.\n',
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
