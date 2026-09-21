import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
class Session {
  cookies = new Map();
  async request(path, body) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: base }),
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';')[0];
      const i = pair.indexOf('=');
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return response;
  }
  async json(path, body) {
    const r = await this.request(path, body);
    const json = await r.json();
    assert.equal(r.status, 200, `${path}: ${JSON.stringify(json)}`);
    return json;
  }
}
const run = Date.now();
const password = `QA-${crypto.randomUUID()}`;
const owner = new Session();
const tenant = new Session();
const outsider = new Session();
const registered = await owner.json('/api/auth', {
  type: 'signup',
  name: 'QA Owner',
  email: `qa-owner-${run}@example.com`,
  password,
  role: 'OWNER',
});
assert.equal(registered.user.propertyId, null);
await owner.json('/api/onboarding', {
  type: 'owner',
  name: `QA House ${run}`,
  address: '12 Test Road, Bengaluru',
  rooms: 2,
  beds: 4,
  food: true,
});
let dashboard = await owner.json('/api/dashboard');
const code = dashboard.data.property.code;
await tenant.json('/api/auth', {
  type: 'signup',
  name: 'QA Tenant',
  email: `qa-tenant-${run}@example.com`,
  password,
  role: 'TENANT',
});
await tenant.json('/api/onboarding', {
  type: 'tenant',
  code,
  phone: '+919876543210',
  moveIn: new Date().toISOString().slice(0, 10),
});
let td = await tenant.json('/api/dashboard');
assert.equal(td.data.tenants.length, 1);
assert.equal(td.data.rents.length, 0);
await owner.json('/api/dashboard', {
  type: 'tenant-update',
  id: td.user.id,
  room: 'A-101',
  bed: '01',
  rent: 8500,
  deposit: 17000,
});
td = await tenant.json('/api/dashboard');
assert.equal(td.data.rents.length, 1);
assert.equal(
  (
    await tenant.request('/api/dashboard', {
      type: 'rent-status',
      id: td.data.rents[0].id,
      paid: true,
    })
  ).status,
  403,
);
await tenant.json('/api/dashboard', {
  type: 'complaint-create',
  title: 'QA fixture repair',
  description: 'Please repair the kitchen tap.',
  category: 'Maintenance',
  priority: 'High',
  photo: null,
});
dashboard = await owner.json('/api/dashboard');
assert.equal(dashboard.data.complaints.length, 1);
await owner.json('/api/dashboard', {
  type: 'complaint-update',
  id: dashboard.data.complaints[0].id,
  status: 'Resolved',
  note: 'The tap has been replaced.',
});
await owner.json('/api/dashboard', { type: 'rent-status', id: td.data.rents[0].id, paid: true });
td = await tenant.json('/api/dashboard');
assert(td.data.rents[0].paidAt);
assert.equal(td.data.complaints[0].status, 'Resolved');
await outsider.json('/api/auth', {
  type: 'signup',
  name: 'QA Other Owner',
  email: `qa-outsider-${run}@example.com`,
  password,
  role: 'OWNER',
});
await outsider.json('/api/onboarding', {
  type: 'owner',
  name: `QA Other House ${run}`,
  address: '16 Test Road, Bengaluru',
  rooms: 1,
  beds: 2,
  food: false,
});
assert.equal(
  (
    await outsider.request('/api/dashboard', {
      type: 'rent-status',
      id: td.data.rents[0].id,
      paid: false,
    })
  ).status,
  404,
);
const oldRefresh = tenant.cookies.get('pg_refresh');
const claims = JSON.parse(
  Buffer.from(tenant.cookies.get('pg_access').split('.')[1], 'base64url').toString(),
);
assert.equal(claims.passwordHash, undefined);
assert.equal(claims.phoneEncrypted, undefined);
await tenant.json('/api/auth/refresh', {});
assert.notEqual(tenant.cookies.get('pg_refresh'), oldRefresh);
const replay = new Session();
replay.cookies.set('pg_refresh', oldRefresh);
assert.equal((await replay.request('/api/auth/refresh', {})).status, 401);
assert.equal((await tenant.request('/api/auth/refresh', {})).status, 401);
assert.equal((await tenant.request('/api/dashboard')).status, 401);
const signedOutAccess = owner.cookies.get('pg_access');
await owner.json('/api/auth/logout', {});
assert.equal((await owner.request('/api/dashboard')).status, 401);
const staleAccess = new Session();
staleAccess.cookies.set('pg_access', signedOutAccess);
assert.equal((await staleAccess.request('/api/dashboard')).status, 401);
const login = new Session();
await login.json('/api/auth', { type: 'login', email: `qa-owner-${run}@example.com`, password });
assert.equal((await login.json('/api/dashboard')).data.property.code, code);
process.stdout.write(
  'Database integration passed: email signup/login, owner setup, tenant joining, automatic rent, tenant RBAC, complaint resolution, payments, property isolation, refresh rotation/replay revocation, logout.\n',
);
