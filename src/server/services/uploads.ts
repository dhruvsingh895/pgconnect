import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { documents } from '../repositories/documents';
import { accounts } from '../repositories/accounts';
import { assert } from '../errors';
import type { Identity } from '@/lib/types';
import { requireProperty, requireRole } from '../auth/policy';
import { config } from '../config';
const client = new S3Client({ region: config.storage.region });
const schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('prepare'),
    name: z.string().min(1).max(200),
    size: z
      .number()
      .int()
      .min(1)
      .max(5 * 1024 * 1024),
    contentType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    purpose: z.enum(['kyc', 'complaint', 'announcement']),
  }),
  z.object({ type: z.literal('complete'), id: z.uuid() }),
]);
function bucket() {
  assert(
    config.storage.bucket,
    503,
    'STORAGE_UNAVAILABLE',
    'File storage is not configured yet. Please contact your PG owner.',
  );
  return config.storage.bucket;
}
export async function upload(user: Identity, input: unknown) {
  requireProperty(user);
  assert(!user.demo, 400, 'DEMO_UPLOAD', 'Private uploads are available in regular accounts.');
  const a = schema.parse(input);
  const Bucket = bucket();
  if (a.type === 'prepare') {
    if (a.purpose === 'announcement') requireRole(user, 'OWNER');
    else requireRole(user, 'TENANT');
    assert(
      a.purpose === 'kyc' || a.contentType !== 'application/pdf',
      400,
      'INVALID_FILE',
      'Please choose a JPG or PNG image.',
    );
    const key = `private/${user.propertyId}/${user.id}/${crypto.randomUUID()}`;
    const document = await documents.create({
      userId: user.id,
      key,
      name: a.name,
      size: a.size,
      contentType: a.contentType,
      purpose: a.purpose,
    });
    const post = await createPresignedPost(client, {
      Bucket,
      Key: key,
      Expires: 120,
      Fields: { 'Content-Type': a.contentType, 'x-amz-server-side-encryption': 'AES256' },
      Conditions: [
        ['content-length-range', 1, a.size],
        ['eq', '$Content-Type', a.contentType],
        ['eq', '$x-amz-server-side-encryption', 'AES256'],
      ],
    });
    return { id: document.id, ...post };
  }
  const document = await documents.pending(a.id, user.id);
  assert(document, 404, 'NOT_FOUND', 'Upload not found.');
  const head = await client.send(new HeadObjectCommand({ Bucket, Key: document.key }));
  assert(
    head.ContentLength === document.size && head.ContentType === document.contentType,
    400,
    'INVALID_FILE',
    'Uploaded file did not match the declared file.',
  );
  const object = await client.send(
    new GetObjectCommand({ Bucket, Key: document.key, Range: 'bytes=0-7' }),
  );
  const bytes = await object.Body?.transformToByteArray();
  assert(bytes, 400, 'INVALID_FILE', 'The uploaded file is empty.');
  const signature = Buffer.from(bytes);
  const valid =
    document.contentType === 'application/pdf'
      ? signature.subarray(0, 5).toString() === '%PDF-'
      : document.contentType === 'image/png'
        ? signature.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
        : signature.subarray(0, 3).toString('hex') === 'ffd8ff';
  if (!valid) {
    await client.send(new DeleteObjectCommand({ Bucket, Key: document.key }));
    await documents.remove(document.id);
    assert(false, 400, 'INVALID_FILE', 'The file contents do not match its type.');
  }
  await documents.verify(document.id);
  return { id: document.id };
}
export async function download(user: Identity, id: string) {
  requireProperty(user);
  assert(!user.demo, 404, 'NOT_FOUND', 'No uploaded file exists in this demo.');
  const document = await documents.byId(id);
  assert(document?.verified, 404, 'NOT_FOUND', 'Document not found.');
  let allowed =
    document.userId === user.id ||
    (user.role === 'OWNER' && document.user.propertyId === user.propertyId);
  if (!allowed && document.purpose === 'announcement') {
    const tenant = await accounts.byId(user.id);
    const announcement = await documents.announcementFor(id, user.propertyId!);
    allowed =
      !!announcement &&
      !!tenant &&
      (announcement.audience === 'All tenants' ||
        announcement.audience === tenant.room ||
        announcement.audience === `Block ${tenant.room[0]}`);
  }
  assert(allowed, 403, 'FORBIDDEN', 'You do not have access to this document.');
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket(),
      Key: document.key,
      ResponseContentDisposition: 'attachment',
      ResponseContentType: document.contentType,
    }),
    { expiresIn: 60 },
  );
  return { url };
}
