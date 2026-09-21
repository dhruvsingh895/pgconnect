import { spawn } from 'node:child_process';

const origin = process.env.APP_ORIGIN;
if (
  !origin ||
  !origin.startsWith('https://') ||
  !process.env.DATABASE_URL ||
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32 ||
  !/^[a-f\d]{64}$/i.test(process.env.ENCRYPTION_KEY || '')
) {
  process.stderr.write(
    'Production requires an HTTPS APP_ORIGIN, DATABASE_URL, JWT_SECRET, and a 64-hex-character ENCRYPTION_KEY.\n',
  );
  process.exit(1);
}
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--hostname',
    '0.0.0.0',
    '--port',
    process.env.PORT || '3000',
  ],
  { stdio: 'inherit', env: process.env },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', () => {
  process.stderr.write('Unable to start the application.\n');
  process.exit(1);
});
