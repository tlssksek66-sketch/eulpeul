import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickField, pickList, isSuccessBody, WRAPPER_KEYS } from '../src/worker_client.mjs';

const CANONICAL = { nccTargetId: 'T1', keyword: 'foo', ownerId: 'O1' };

test('pickField — flat shape', () => {
  assert.equal(pickField(CANONICAL, 'keyword'), 'foo');
  assert.equal(pickField(CANONICAL, 'ownerId'), 'O1');
  assert.equal(pickField(CANONICAL, 'nccTargetId', 'id', 'targetId'), 'T1');
});

test('pickField — data wrapper', () => {
  const body = { data: CANONICAL };
  assert.equal(pickField(body, 'keyword'), 'foo');
  assert.equal(pickField(body, 'nccTargetId', 'id'), 'T1');
});

test('pickField — target wrapper', () => {
  const body = { target: CANONICAL };
  assert.equal(pickField(body, 'keyword'), 'foo');
});

test('pickField — result wrapper', () => {
  const body = { result: CANONICAL };
  assert.equal(pickField(body, 'keyword'), 'foo');
});

test('pickField — body wrapper (Worker double-200)', () => {
  const body = { status: 'ok', body: CANONICAL };
  assert.equal(pickField(body, 'keyword'), 'foo');
  assert.equal(pickField(body, 'ownerId'), 'O1');
});

test('pickField — payload wrapper', () => {
  const body = { payload: CANONICAL };
  assert.equal(pickField(body, 'keyword'), 'foo');
});

test('pickField — response wrapper', () => {
  const body = { response: CANONICAL };
  assert.equal(pickField(body, 'keyword'), 'foo');
});

test('pickField — single-element array under data', () => {
  const body = { data: [CANONICAL] };
  assert.equal(pickField(body, 'keyword'), 'foo');
  assert.equal(pickField(body, 'nccTargetId'), 'T1');
});

test('pickField — bare array', () => {
  assert.equal(pickField([CANONICAL], 'keyword'), 'foo');
});

test('pickField — double wrapper data.target', () => {
  const body = { data: { target: CANONICAL } };
  assert.equal(pickField(body, 'keyword'), 'foo');
});

test('pickField — triple wrapper body.data.target', () => {
  const body = { body: { data: { target: CANONICAL } } };
  assert.equal(pickField(body, 'keyword'), 'foo');
});

test('pickField — alias id maps to nccTargetId search', () => {
  const body = { data: { id: 'T1', keyword: 'foo', ownerId: 'O1' } };
  assert.equal(pickField(body, 'nccTargetId', 'id', 'targetId'), 'T1');
});

test('pickField — alias nccAdgroupId maps to ownerId search', () => {
  const body = { nccAdgroupId: 'O1', keyword: 'foo', nccTargetId: 'T1' };
  assert.equal(pickField(body, 'ownerId', 'nccAdgroupId'), 'O1');
});

test('pickField — flat primitive at wrapper-key name returns primitive', () => {
  // {target: 'mykw'} — 'target' is a wrapper key but value is primitive → return as value
  const body = { target: 'mykw' };
  assert.equal(pickField(body, 'keyword', 'target'), 'mykw');
});

test('pickField — wrapper-key with object value defers to recursion', () => {
  // {target: {keyword: 'X'}} searching ['keyword', 'target'] — must NOT return the object,
  // must recurse and return 'X'
  const body = { target: { keyword: 'X' } };
  assert.equal(pickField(body, 'keyword', 'target'), 'X');
});

test('pickField — empty/null body returns undefined', () => {
  assert.equal(pickField(null, 'keyword'), undefined);
  assert.equal(pickField(undefined, 'keyword'), undefined);
  assert.equal(pickField({}, 'keyword'), undefined);
  assert.equal(pickField('not-an-object', 'keyword'), undefined);
});

test('pickField — flat name takes precedence over wrapped', () => {
  // {keyword: 'flat', data: {keyword: 'wrapped'}} → flat wins
  const body = { keyword: 'flat', data: { keyword: 'wrapped' } };
  assert.equal(pickField(body, 'keyword'), 'flat');
});

test('pickField — name order is honored before wrapper traversal', () => {
  // body has both nccTargetId at top AND id deeper — top-level nccTargetId wins
  const body = { nccTargetId: 'TOP', data: { id: 'DEEP' } };
  assert.equal(pickField(body, 'nccTargetId', 'id'), 'TOP');
});

test('pickField — depth limit prevents infinite recursion on cycles', () => {
  const a = { data: null };
  const b = { data: a };
  a.data = b;
  // should not throw, just return undefined
  assert.equal(pickField(a, 'keyword'), undefined);
});

test('pickField — first non-empty array element resolves', () => {
  const body = { data: [null, CANONICAL] };
  assert.equal(pickField(body, 'keyword'), 'foo');
});

test('pickField — null value at flat name is treated as missing', () => {
  const body = { keyword: null, data: { keyword: 'recovered' } };
  assert.equal(pickField(body, 'keyword'), 'recovered');
});

test('pickList — bare array', () => {
  const body = [CANONICAL];
  assert.deepEqual(pickList(body, 'campaigns'), [CANONICAL]);
});

test('pickList — flat under data', () => {
  const body = { data: [CANONICAL] };
  assert.deepEqual(pickList(body, 'campaigns'), [CANONICAL]);
});

test('pickList — flat under named key', () => {
  const body = { campaigns: [CANONICAL] };
  assert.deepEqual(pickList(body, 'campaigns'), [CANONICAL]);
});

test('pickList — Worker double-wrap body.data', () => {
  const body = { status: 'ok', body: { data: [CANONICAL] } };
  assert.deepEqual(pickList(body, 'campaigns'), [CANONICAL]);
});

test('pickList — adGroups camelCase variant', () => {
  const body = { data: { adGroups: [CANONICAL] } };
  assert.deepEqual(pickList(body, 'adgroups', 'adGroups'), [CANONICAL]);
});

test('pickList — empty when not found', () => {
  assert.deepEqual(pickList({ unrelated: 'x' }, 'campaigns'), []);
  assert.deepEqual(pickList(null, 'campaigns'), []);
});

test('pickList — named key wins over wrapper traversal', () => {
  // {campaigns: [A], data: [B]} — campaigns at this level wins
  const body = { campaigns: [{ name: 'A' }], data: [{ name: 'B' }] };
  assert.deepEqual(pickList(body, 'campaigns'), [{ name: 'A' }]);
});

test('isSuccessBody — null/array/empty pass through as success', () => {
  assert.equal(isSuccessBody(null), true);
  assert.equal(isSuccessBody([]), true);
  assert.equal(isSuccessBody({}), true);
});

test('isSuccessBody — explicit success status', () => {
  for (const s of ['ok', 'OK', 'success', 'succeeded', 'paused', 'enabled', 'live']) {
    assert.equal(isSuccessBody({ status: s }), true, `status=${s}`);
  }
});

test('isSuccessBody — explicit failure status', () => {
  for (const s of ['error', 'failed', 'invalid', 'pending']) {
    assert.equal(isSuccessBody({ status: s }), false, `status=${s}`);
  }
});

test('isSuccessBody — boolean success field', () => {
  assert.equal(isSuccessBody({ success: true }), true);
  assert.equal(isSuccessBody({ success: false }), false);
});

test('isSuccessBody — non-empty error string fails', () => {
  assert.equal(isSuccessBody({ error: 'bad request' }), false);
  assert.equal(isSuccessBody({ error: '' }), true);
});

test('WRAPPER_KEYS — includes the documented set', () => {
  for (const k of ['data', 'target', 'targets', 'result', 'results', 'body', 'payload', 'response', 'item', 'items']) {
    assert.ok(WRAPPER_KEYS.includes(k), `missing wrapper key: ${k}`);
  }
});
