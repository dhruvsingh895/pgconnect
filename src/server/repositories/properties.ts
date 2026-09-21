import { db } from '../db';
import { assert } from '../errors';
interface NewProperty {
  name: string;
  address: string;
  rooms: number;
  beds: number;
  food: boolean;
  code: string;
}
export async function createPropertyForOwner(userId: string, data: NewProperty) {
  return db.$transaction(async (tx) => {
    const property = await tx.property.create({ data });
    const updated = await tx.user.updateMany({
      where: { id: userId, propertyId: null, role: 'OWNER' },
      data: { propertyId: property.id },
    });
    assert(updated.count === 1, 409, 'ALREADY_ONBOARDED', 'Your account already belongs to a PG.');
    await tx.property.update({ where: { id: property.id }, data: { revision: { increment: 1 } } });
    return property.id;
  });
}
export async function joinProperty(
  userId: string,
  code: string,
  phoneEncrypted: string,
  moveIn: string,
) {
  return db.$transaction(
    async (tx) => {
      const property = await tx.property.findUnique({
        where: { code },
        include: { _count: { select: { users: { where: { role: 'TENANT' } } } } },
      });
      assert(property, 404, 'INVALID_INVITE', 'No PG found for this invite code.');
      // Capacity and membership must be checked in the same serializable transaction.
      assert(
        property._count.users < property.beds,
        409,
        'PG_FULL',
        'This PG is at full capacity. Please contact the owner.',
      );
      const updated = await tx.user.updateMany({
        where: { id: userId, propertyId: null, role: 'TENANT' },
        data: {
          propertyId: property.id,
          phoneEncrypted,
          moveIn,
          room: 'Unassigned',
          bed: userId.slice(0, 6),
        },
      });
      assert(
        updated.count === 1,
        409,
        'ALREADY_ONBOARDED',
        'Your account already belongs to a PG.',
      );
      await tx.property.update({
        where: { id: property.id },
        data: { revision: { increment: 1 } },
      });
      return property.id;
    },
    { isolationLevel: 'Serializable' },
  );
}
