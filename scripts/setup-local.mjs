import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = process.cwd();
const dir = path.join(root, '.data');
await mkdir(dir, { recursive: true });
const envFile = path.join(root, '.env');
try {
  await access(envFile);
  process.stdout.write('Existing .env preserved.\n');
} catch {
  const password = randomBytes(24).toString('hex');
  await writeFile(
    envFile,
    `DATABASE_URL=postgresql://pgconnect:${password}@127.0.0.1:54329/pgconnect\nAPP_ORIGIN=http://127.0.0.1:3000\nJWT_SECRET=${randomBytes(48).toString('hex')}\nENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nDEMO_ENABLED=true\nSEED_PASSWORD=${randomBytes(18).toString('base64url')}\n`,
  );
  await writeFile(path.join(dir, 'postgres-password.txt'), password);
  process.stdout.write('Created private local environment configuration.\n');
}
if (process.platform !== 'win32') {
  process.stdout.write('Configure PostgreSQL using DATABASE_URL on your system.\n');
  process.exit(0);
}
const bin = process.env.POSTGRES_BIN || 'C:\\Program Files\\PostgreSQL\\17\\bin';
const database = path.join(dir, 'postgres');
try {
  await access(path.join(database, 'PG_VERSION'));
  process.stdout.write('Existing local database preserved.\n');
} catch {
  const init = spawnSync(
    path.join(bin, 'initdb.exe'),
    [
      '-D',
      database,
      '-U',
      'pgconnect',
      '--auth=scram-sha-256',
      '--pwfile',
      path.join(dir, 'postgres-password.txt'),
      '--encoding=UTF8',
      '--locale=C',
    ],
    { cwd: root, windowsHide: true, encoding: 'utf8', stdio: 'ignore' },
  );
  if (init.status !== 0) {
    process.stderr.write(init.stderr || 'Unable to initialize PostgreSQL. Set POSTGRES_BIN.');
    process.exit(1);
  }
  await writeFile(
    path.join(database, 'postgresql.auto.conf'),
    "listen_addresses = '127.0.0.1'\nport = 54329\n",
    { flag: 'a' },
  );
  process.stdout.write('Initialized isolated PostgreSQL data inside product/.data.\n');
}
const status = spawnSync(path.join(bin, 'pg_ctl.exe'), ['-D', database, 'status'], {
  cwd: root,
  windowsHide: true,
  encoding: 'utf8',
});
if (status.status !== 0) {
  const start = spawnSync(
    path.join(bin, 'pg_ctl.exe'),
    ['-D', database, '-l', path.join(dir, 'postgres.log'), 'start', '-w'],
    { cwd: root, windowsHide: true, encoding: 'utf8', stdio: 'ignore' },
  );
  if (start.status !== 0) {
    process.stderr.write('PostgreSQL could not start. Check .data/postgres.log.\n');
    process.exit(1);
  }
}
const env = await readFile(envFile, 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1];
if (!url) throw new Error('DATABASE_URL missing');
const parsed = new URL(url);
const createdb = spawnSync(
  path.join(bin, 'createdb.exe'),
  ['-h', '127.0.0.1', '-p', '54329', '-U', 'pgconnect', 'pgconnect'],
  {
    cwd: root,
    windowsHide: true,
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: decodeURIComponent(parsed.password) },
  },
);
if (createdb.status !== 0 && !createdb.stderr.includes('already exists')) {
  process.stderr.write(createdb.stderr);
  process.exit(1);
}
process.stdout.write(
  'Local database is ready on 127.0.0.1:54329. All data stays in product/.data.\n',
);
