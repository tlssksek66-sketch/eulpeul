import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.WORKER_URL = 'http://test.local';
process.env.WORKER_TOKEN = 'TEST_TOKEN_xyz';

const {
  callWorker, postTarget, deleteTarget,
  getCampaigns, getAdGroups, getTargets,
} = await import('../src/worker_client.mjs');

const FAST = [0, 0, 0, 0];

let originalFetch;
let calls;
let originalWarn;

before(() => {
  originalFetch = globalThis.fetch;
  originalWarn = console.warn;
  console.warn = () => {};
});

after(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
});

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function setFetch(handler) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const r = await handler(url, init, calls.length - 1);
    return r;
  };
}

function makeResp({ status = 200, body = null }) {
  let text;
  if (body === null || body === undefined) text = '';
  else if (typeof body === 'string') text = body;
  else text = JSON.stringify(body);
  return { status, text: async () => text };
}

function queueResp(...responses) {
  setFetch((_url, _init, i) => {
    if (i >= responses.length) throw new Error(`unexpected fetch call #${i}`);
    const r = responses[i];
    if (r instanceof Error) throw r;
    return makeResp(r);
  });
}

test('callWorker — 200 with flat success body', async () => {
  queueResp({ status: 200, body: { ok: true } });
  const r = await callWorker('GET', '/x', { retryDelays: FAST });
  assert.equal(r.ok, true);
  assert.equal(r.http, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(calls.length, 1);
});

test('callWorker — 200 with status:"error" → wrapper_status_failure', async () => {
  queueResp({ status: 200, body: { status: 'error', message: 'bad' } });
  const r = await callWorker('GET', '/x', { retryDelays: FAST });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'wrapper_status_failure');
});

test('callWorker — 200 with success:false → wrapper_status_failure', async () => {
  queueResp({ status: 200, body: { success: false } });
  const r = await callWorker('GET', '/x', { retryDelays: FAST });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'wrapper_status_failure');
});

test('callWorker — 403 with allowlist body → fatal throw, no retry', async () => {
  queueResp({ status: 403, body: 'Host not in allowlist' });
  await assert.rejects(
    () => callWorker('GET', '/x', { retryDelays: FAST }),
    (err) => err.fatal === true && /allowlist/i.test(err.message),
  );
  assert.equal(calls.length, 1, 'must not retry on fatal');
});

test('callWorker — 404 → ok:false, http:404, no retry', async () => {
  queueResp({ status: 404, body: { error: 'not found' } });
  const r = await callWorker('GET', '/x', { retryDelays: FAST });
  assert.equal(r.ok, false);
  assert.equal(r.http, 404);
  assert.deepEqual(r.body, { error: 'not found' });
  assert.equal(calls.length, 1);
});

test('callWorker — 500 then 200 → retries once and succeeds', async () => {
  queueResp(
    { status: 500, body: 'oops' },
    { status: 200, body: { ok: true } },
  );
  const r = await callWorker('GET', '/x', { retryDelays: FAST });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 2);
});

test('callWorker — 500 always → retries 4 times then throws', async () => {
  setFetch(() => makeResp({ status: 500, body: 'oops' }));
  await assert.rejects(
    () => callWorker('GET', '/x', { retryDelays: FAST }),
    /Worker 500/,
  );
  assert.equal(calls.length, 5, 'initial + 4 retries');
});

test('callWorker — 429 then 200 → retries and succeeds', async () => {
  queueResp(
    { status: 429, body: 'rate limited' },
    { status: 200, body: { ok: true } },
  );
  const r = await callWorker('GET', '/x', { retryDelays: FAST });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 2);
});

test('callWorker — fetch throws then succeeds → retries network errors', async () => {
  let i = 0;
  setFetch(() => {
    if (i++ === 0) throw new Error('ECONNRESET');
    return makeResp({ status: 200, body: { ok: true } });
  });
  const r = await callWorker('GET', '/x', { retryDelays: FAST });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 2);
});

test('callWorker — fetch throws always → throws after retries', async () => {
  setFetch(() => { throw new Error('ECONNRESET'); });
  await assert.rejects(
    () => callWorker('GET', '/x', { retryDelays: FAST }),
    /ECONNRESET/,
  );
  assert.equal(calls.length, 5);
});

test('callWorker — body argument sets Content-Type and stringifies', async () => {
  queueResp({ status: 200, body: { ok: true } });
  await callWorker('POST', '/x', { body: { a: 1 }, retryDelays: FAST });
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.body, JSON.stringify({ a: 1 }));
});

test('callWorker — Authorization header bears token', async () => {
  queueResp({ status: 200, body: { ok: true } });
  await callWorker('GET', '/x', { retryDelays: FAST });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer TEST_TOKEN_xyz');
});

test('callWorker — retry:false skips retries', async () => {
  setFetch(() => makeResp({ status: 500, body: 'oops' }));
  await assert.rejects(
    () => callWorker('GET', '/x', { retry: false, retryDelays: FAST }),
    /Worker 500/,
  );
  assert.equal(calls.length, 1);
});

test('callWorker — URL composition handles trailing slash', async () => {
  process.env.WORKER_URL = 'http://test.local/';
  queueResp({ status: 200, body: { ok: true } });
  await callWorker('GET', '/path', { retryDelays: FAST });
  assert.equal(calls[0].url, 'http://test.local/path');
  process.env.WORKER_URL = 'http://test.local';
});

test('postTarget — 200 with correct echo → ok, verified_keyword set', async () => {
  queueResp({ status: 200, body: {
    nccTargetId: 'NEG-1', ownerId: 'GRP-1', keyword: 'foo', match_type: 'exact',
  } });
  const r = await postTarget({ ownerId: 'GRP-1', keyword: 'foo' });
  assert.equal(r.ok, true);
  assert.equal(r.verified_keyword, 'foo');
  assert.equal(r.verified_target_id, 'NEG-1');
});

test('postTarget — keyword mismatch → ok:false, request_response_mismatch', async () => {
  queueResp({ status: 200, body: {
    nccTargetId: 'NEG-1', ownerId: 'GRP-1', keyword: 'BAR_TAMPERED',
  } });
  const r = await postTarget({ ownerId: 'GRP-1', keyword: 'foo' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'request_response_mismatch');
  assert.ok(r.mismatches.some((m) => /keyword/.test(m)));
});

test('postTarget — owner mismatch → ok:false', async () => {
  queueResp({ status: 200, body: {
    nccTargetId: 'NEG-1', ownerId: 'GRP-WRONG', keyword: 'foo',
  } });
  const r = await postTarget({ ownerId: 'GRP-1', keyword: 'foo' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'request_response_mismatch');
  assert.ok(r.mismatches.some((m) => /ownerId/.test(m)));
});

test('postTarget — empty body lacks identifiers → response_lacks_identifiers', async () => {
  queueResp({ status: 200, body: {} });
  const r = await postTarget({ ownerId: 'GRP-1', keyword: 'foo' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'response_lacks_identifiers');
});

test('postTarget — wrapped response (data wrapper) verified via pickField', async () => {
  queueResp({ status: 200, body: {
    status: 'ok',
    data: { nccTargetId: 'NEG-2', ownerId: 'GRP-2', keyword: 'wrappedkw' },
  } });
  const r = await postTarget({ ownerId: 'GRP-2', keyword: 'wrappedkw' });
  assert.equal(r.ok, true);
  assert.equal(r.verified_keyword, 'wrappedkw');
  assert.equal(r.verified_target_id, 'NEG-2');
});

test('postTarget — propagates 4xx body without mismatch check', async () => {
  queueResp({ status: 400, body: { error: 'bad keyword' } });
  const r = await postTarget({ ownerId: 'GRP-1', keyword: 'foo' });
  assert.equal(r.ok, false);
  assert.equal(r.http, 400);
});

test('deleteTarget — 200 → ok', async () => {
  queueResp({ status: 200, body: { nccTargetId: 'NEG-1', deleted: true } });
  const r = await deleteTarget('NEG-1');
  assert.equal(r.ok, true);
});

test('deleteTarget — id mismatch → ok:false, delete_id_mismatch', async () => {
  queueResp({ status: 200, body: { nccTargetId: 'NEG-WRONG' } });
  const r = await deleteTarget('NEG-1');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'delete_id_mismatch');
  assert.equal(r.sent, 'NEG-1');
  assert.equal(r.got, 'NEG-WRONG');
});

test('deleteTarget — empty body returns ok (id echo absent)', async () => {
  queueResp({ status: 200, body: {} });
  const r = await deleteTarget('NEG-1');
  assert.equal(r.ok, true);
});

test('getCampaigns — Worker double-wrap body.data → flat array', async () => {
  queueResp({ status: 200, body: {
    status: 'ok',
    body: { data: [{ nccCampaignId: 'C1', name: '#SP05_T010_N_MO' }] },
  } });
  // getCampaigns uses default retry delays; we mock to return on first call
  const list = await getCampaigns();
  assert.equal(list.length, 1);
  assert.equal(list[0].nccCampaignId, 'C1');
});

test('getAdGroups — adGroups camelCase variant resolves', async () => {
  queueResp({ status: 200, body: {
    data: { adGroups: [{ nccAdgroupId: 'G1', name: '00.브랜드키워드' }] },
  } });
  const list = await getAdGroups('C1');
  assert.equal(list.length, 1);
  assert.equal(list[0].nccAdgroupId, 'G1');
});

test('getTargets — flat array response', async () => {
  queueResp({ status: 200, body: [
    { nccTargetId: 'T1', keyword: 'a' },
    { nccTargetId: 'T2', keyword: 'b' },
  ] });
  const list = await getTargets('G1');
  assert.equal(list.length, 2);
});
