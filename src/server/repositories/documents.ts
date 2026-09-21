import { db } from '../db';
interface NewDocument {
  userId: string;
  key: string;
  name: string;
  size: number;
  contentType: string;
  purpose: string;
}
export const documents = {
  create: (data: NewDocument) => db.document.create({ data }),
  pending: (id: string, userId: string) =>
    db.document.findFirst({ where: { id, userId, verified: false } }),
  verifiedFor: (id: string, userId: string, purpose: string) =>
    db.document.findFirst({ where: { id, userId, purpose, verified: true } }),
  byId: (id: string) =>
    db.document.findUnique({ where: { id }, include: { user: { select: { propertyId: true } } } }),
  remove: (id: string) => db.document.delete({ where: { id } }),
  verify: (id: string) => db.document.update({ where: { id }, data: { verified: true } }),
  announcementFor: (id: string, propertyId: string) =>
    db.announcement.findFirst({ where: { propertyId, image: id } }),
};
