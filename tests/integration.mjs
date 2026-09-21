import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
async function request(path, body, cookie, origin = base) {
  return fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: origin }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function demo(role) {
  const r = await request('/api/auth/demo', { role });
  assert.equal(r.status, 200);
  return r.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}
assert.equal((await request('/api/dashboard')).status, 401);
assert.equal(
  (
    await fetch(base + '/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: '{bad-json',
    })
  ).status,
  400,
);
assert.equal(
  (
    await request('/api/auth', {
      type: 'login',
      email: 'a@example.com',
      password: 'x'.repeat(66000),
    })
  ).status,
  413,
);
assert.equal(
  (await request('/api/auth/demo', { role: 'OWNER' }, null, 'https://evil.example')).status,
  403,
);
const owner = await demo('OWNER');
const tenant = await demo('TENANT');
const tenantDashboard = await (await request('/api/dashboard', undefined, tenant)).json();
assert.equal(tenantDashboard.data.tenants.length, 1);
assert(tenantDashboard.data.rents.every((r) => r.tenantId === tenantDashboard.user.id));
assert.equal(
  (await request('/api/dashboard', { type: 'rent-status', id: 'rent-9', paid: true }, tenant))
    .status,
  403,
);
assert.equal(
  (await request('/api/dashboard', { type: 'announcement-read', id: 'does-not-exist' }, tenant))
    .status,
  404,
);
assert.equal(
  (await request('/api/dashboard', { type: 'rent-status', id: 'rent-9', paid: true }, owner))
    .status,
  200,
);
const updated = await (await request('/api/dashboard', undefined, owner)).json();
assert(updated.data.rents.find((r) => r.id === 'rent-9').paidAt);
assert.equal(
  (
    await request(
      '/api/dashboard',
      { type: 'complaint-update', id: 'complaint-1', status: 'Resolved', note: '' },
      owner,
    )
  ).status,
  400,
);
assert.equal(
  (
    await request(
      '/api/dashboard',
      {
        type: 'complaint-create',
        title: 'Leaking tap',
        description: 'The bathroom tap is leaking.',
        category: 'Maintenance',
        priority: 'Medium',
        photo: null,
      },
      tenant,
    )
  ).status,
  200,
);
assert.equal((await request('/api/auth/logout', {}, tenant)).status, 200);
process.stdout.write(
  'Integration checks passed: authentication, CSRF, tenant privacy, RBAC, rent updates, complaint validation, complaint creation, logout.\n',
);
