import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, assert } from './errors';
import { config } from './config';
import { logger } from './logger';
import { Prisma } from '@prisma/client';
export async function readJson(request: NextRequest): Promise<unknown> {
  const reader = request.body?.getReader();
  assert(reader, 400, 'INVALID_JSON', 'A JSON request body is required.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 65536) {
      await reader.cancel();
      throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Please send valid JSON.');
  }
}
export async function endpoint(request: NextRequest, handler: () => Promise<unknown>) {
  const requestId = crypto.randomUUID();
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      const allowed = new Set([
        config.origin,
        ...(!config.production ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
      ]);
      assert(origin && allowed.has(origin), 403, 'CSRF_REJECTED', 'Request origin is not allowed.');
      assert(
        request.headers.get('content-type')?.startsWith('application/json'),
        415,
        'INVALID_CONTENT_TYPE',
        'Use JSON requests.',
      );
      assert(
        Number(request.headers.get('content-length') || 0) <= 65536,
        413,
        'PAYLOAD_TOO_LARGE',
        'Request is too large.',
      );
    }
    return NextResponse.json(await handler(), {
      headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    )
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'This record changed or already exists. Refresh and try again.',
            requestId,
          },
        },
        { status: 409 },
      );
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: error.issues[0]?.message || 'Invalid input.',
            requestId,
          },
        },
        { status: 400 },
      );
    if (error instanceof AppError)
      return NextResponse.json(
        { error: { code: error.code, message: error.message, requestId } },
        { status: error.status },
      );
    logger.error(
      { requestId, errorType: error instanceof Error ? error.name : 'UnknownError' },
      'Request failed',
    );
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
