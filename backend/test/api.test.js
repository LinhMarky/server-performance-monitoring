import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { STUDENT_SEARCH_SQL } from '../src/utils/queries.js';
import { readConfig } from '../src/config/index.js';
import codesModule from '../../scripts/generate-benchmark-codes.js';

async function withServer(pool, fn) {
  const server = createApp(pool).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('search executes exactly one unchanged parameterized query; invalid inputs never reach DB', async () => {
  const calls = [];
  await withServer({ query: async (...args) => { calls.push(args); return { rows: [{ id: '1', student_code: 'SV0000001' }] }; } }, async base => {
    for (const query of ['', '?code=x', '?code=SV0000001&code=SV0000002', '?code=SV0000001%27%20OR%201=1--']) {
      assert.equal((await fetch(`${base}/api/students/search${query}`)).status,400);
    }
    assert.equal(calls.length,0);
    const response = await fetch(`${base}/api/students/search?code=SV0000001`);
    assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal((await response.json()).data.id,1);
    assert.deepEqual(calls, [[STUDENT_SEARCH_SQL,['SV0000001']]]);
  });
});
test('DB outage returns safe errors; server recovers without restart', async () => {
  let fail = true;
  await withServer({ query: async () => {
    if (fail) throw Object.assign(new Error('private password should not appear'), { code:'ECONNREFUSED' });
    return { rows:[] };
  } }, async base => {
    const health = await fetch(`${base}/api/health`); assert.equal(health.status,503);
    const search = await fetch(`${base}/api/students/search?code=SV0000001`);
    assert.equal(search.status,503); assert.ok(!(await search.text()).includes('password'));
    fail = false;
    assert.equal((await fetch(`${base}/api/health`)).status,200);
    assert.equal((await fetch(`${base}/api/students/search?code=SV0000001`)).status,404);
  });
});
test('unexpected DB errors hide internals and remain HTTP 500', async () => {
  await withServer({ query: async () => { throw Object.assign(new Error('secret schema trace'), { code:'42P01' }); } }, async base => {
    const response = await fetch(`${base}/api/stats`); assert.equal(response.status,500);
    assert.ok(!(await response.text()).includes('secret'));
  });
});
test('benchmark codes cover every supported scale deterministically', () => {
  for (const size of [100,100000,200000,300000,500000,1000000]) {
    const codes = codesModule.generateCodes(size);
    assert.ok(codes.length >= 100); assert.equal(new Set(codes).size,codes.length);
    assert.equal(codes[0],'SV0000001'); assert.equal(Number(codes.at(-1).slice(2)),size);
    assert.deepEqual(codes,codesModule.generateCodes(size));
    assert.ok(codes.every(code => /^SV\d{7}$/.test(code) && Number(code.slice(2)) <= size));
  }
  for (const size of [0,99,1000001,Infinity,1.1]) assert.throws(() => codesModule.generateCodes(size));
});
test('configuration rejects missing password and invalid pool sizing', () => {
  const oldPassword = process.env.POSTGRES_PASSWORD;
  const oldMax = process.env.DB_POOL_MAX;
  try {
    delete process.env.POSTGRES_PASSWORD; assert.throws(readConfig);
    process.env.POSTGRES_PASSWORD='unit-test-only'; process.env.DB_POOL_MAX='0'; assert.throws(readConfig);
    process.env.DB_POOL_MAX='10'; assert.equal(readConfig().database.max,10);
  } finally {
    if (oldPassword === undefined) delete process.env.POSTGRES_PASSWORD; else process.env.POSTGRES_PASSWORD=oldPassword;
    if (oldMax === undefined) delete process.env.DB_POOL_MAX; else process.env.DB_POOL_MAX=oldMax;
  }
});
