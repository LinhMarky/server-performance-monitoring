'use strict';
const assert = require('node:assert/strict');
const { generateCodes } = require('./generate-benchmark-codes.js');
const base = process.argv[2] || 'http://127.0.0.1:3000';
const expected = Number(process.argv[3] || process.env.STUDENT_COUNT || 200000);
let passed = 0;
async function request(url, status = 200) {
  const response = await fetch(`${base}${url}`, { signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  assert.equal(response.status, status, `${url}: ${JSON.stringify(body)}`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return body;
}
async function check(label, action) { await action(); passed++; console.log(`PASS ${label}`); }
async function run() {
  await check('health', async () => assert.deepEqual(await request('/api/health'), { status: 'ok', database: 'connected' }));
  await check('database counts', async () => assert.deepEqual(await request('/api/stats'), { total_students: expected, total_subjects: 40, total_grades: expected*6 }));
  await check('stable backend pagination', async () => {
    const first = await request('/api/students?page=1&limit=20');
    const second = await request('/api/students?page=2&limit=20');
    assert.equal(first.data.length, 20); assert.equal(second.data.length, 20);
    assert.equal(first.data[0].id, 1); assert.equal(second.data[0].id, 21);
    assert.equal(new Set([...first.data, ...second.data].map(s => s.id)).size, 40);
    assert.equal(first.pagination.has_next, true);
    const last = await request(`/api/students?page=${Math.ceil(expected/100)}&limit=100`);
    assert.equal(last.data.at(-1).id, expected); assert.equal(last.pagination.has_next, false);
    const empty = await request(`/api/students?page=${Math.ceil(expected/100)+1}&limit=100`);
    assert.equal(empty.data.length, 0); assert.equal(empty.pagination.has_next, false);
  });
  await check('all distributed benchmark codes and real timings', async () => {
    for (const code of generateCodes(expected)) {
      const result = await request(`/api/students/search?code=${code}`);
      assert.equal(result.success, true); assert.equal(result.data.student_code, code);
      assert.equal(result.data.id, Number(code.slice(2)));
      assert.ok(result.performance.db_query_ms >= 0);
      assert.ok(result.performance.api_processing_ms >= result.performance.db_query_ms);
    }
  });
  await check('404 for a well-formed absent code', async () => {
    const result = await request('/api/students/search?code=SV9999999', 404);
    assert.equal(result.error.code, 'STUDENT_NOT_FOUND'); assert.equal(result.data, null);
    await request('/api/students/SV9999999/transcript', 404);
  });
  await check('validation and SQL injection protection', async () => {
    for (const url of ['/api/students/search', '/api/students/search?code=sv0000001',
      '/api/students/search?code=SV0000001&code=SV0000002',
      '/api/students/search?code=' + encodeURIComponent("SV0000001' OR 1=1--"),
      '/api/students?page=0', '/api/students?page=1.5', '/api/students?limit=101',
      '/api/students?limit=-1', '/api/students?page=1&page=2', '/api/students/invalid/transcript']) {
      const result = await request(url, 400); assert.equal(result.success, false);
    }
    assert.equal((await request('/api/stats')).total_students, expected);
  });
  await check('transcript, deterministic scores and weighted GPA', async () => {
    for (const id of [1, Math.floor(expected/2), expected]) {
      const code = `SV${String(id).padStart(7,'0')}`;
      const { data } = await request(`/api/students/${code}/transcript`);
      assert.equal(data.student.id, id); assert.equal(data.grades.length, 6);
      assert.equal(new Set(data.grades.map(g => g.subject_code)).size, 6);
      let cents = 0, credits = 0;
      for (const grade of data.grades) {
        const subjectId = Number(grade.subject_code.slice(2));
        const slot = [0,1,2,3,4,5].find(k => ((id-1)*7+k*3)%40+1 === subjectId);
        assert.notEqual(slot, undefined);
        assert.equal(grade.midterm_score, ((id*17+slot*13)%101)/10);
        assert.equal(grade.final_score, ((id*23+slot*19)%101)/10);
        assert.equal(grade.total_score, Math.round((grade.midterm_score*0.4+grade.final_score*0.6)*100)/100);
        assert.equal(grade.credits, subjectId >= 13 && subjectId <= 18 ? 2 : 3);
        assert.equal(grade.semester, '2025-2026-HK2');
        credits += grade.credits; cents += Math.round(grade.total_score*100)*grade.credits;
      }
      assert.equal(data.summary.total_subjects, 6);
      assert.equal(data.summary.total_credits, credits);
      assert.equal(data.summary.gpa_10, Math.round(cents/credits)/100);
    }
  });
  await check('frontend assets and unknown route', async () => {
    for (const url of ['/', '/styles.css', '/app.js', '/favicon.svg']) {
      const response = await fetch(`${base}${url}`); assert.equal(response.status, 200);
      assert.ok((await response.text()).length > 100);
    }
    assert.equal((await request('/api/not-found', 404)).error.code, 'NOT_FOUND');
  });
  console.log(`\n${passed} functional groups passed against ${base}. No index or data was changed.`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
