import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegisterGates } from '../src/gates.mjs';

const VALID_PLAN = {
  decision: 2,
  approved_by: '파트너A',
  confirm_text_required: 'REGISTER 224',
  conflict_check: {
    matched_count: 0,
    protect_pattern_matched_kws_in_existing: [],
  },
  expected_register_post_count: 224,
  expected_delete_count: 0,
  actions: [],
};

const VALID_FLAGS = {
  approve: true,
  'plan-file': '03_register_plan_X.json',
  'confirm-text': 'REGISTER 224',
};

test('gate ok — all conditions satisfied', () => {
  const r = validateRegisterGates({
    flags: VALID_FLAGS,
    plan: VALID_PLAN,
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.ok, true);
});

test('GATE 1 — --approve missing', () => {
  const r = validateRegisterGates({
    flags: { ...VALID_FLAGS, approve: undefined },
    plan: VALID_PLAN,
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.ok, false);
  assert.equal(r.gate, 1);
  assert.equal(r.code, 2);
  assert.match(r.error, /--approve/);
});

test('GATE 1 — --approve falsy (empty string)', () => {
  const r = validateRegisterGates({
    flags: { ...VALID_FLAGS, approve: '' },
    plan: VALID_PLAN,
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 1);
});

test('GATE 2 — plan-file flag absent', () => {
  const r = validateRegisterGates({
    flags: { ...VALID_FLAGS, 'plan-file': undefined },
    plan: null,
    planFileProvided: false,
    planFileExists: false,
  });
  assert.equal(r.gate, 2);
  assert.match(r.error, /--plan-file/);
});

test('GATE 2 — plan-file given but file missing', () => {
  const r = validateRegisterGates({
    flags: VALID_FLAGS,
    plan: null,
    planFileProvided: true,
    planFileExists: false,
  });
  assert.equal(r.gate, 2);
  assert.match(r.error, /plan 파일 없음/);
});

test('GATE 2 — plan parsed null/undefined despite file exists', () => {
  const r = validateRegisterGates({
    flags: VALID_FLAGS,
    plan: null,
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 2);
  assert.match(r.error, /파싱 실패/);
});

test('GATE 2 — plan missing conflict_check', () => {
  const r = validateRegisterGates({
    flags: VALID_FLAGS,
    plan: { ...VALID_PLAN, conflict_check: undefined },
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 2);
  assert.match(r.error, /protect_pattern_matched_kws_in_existing/);
});

test('GATE 2 — protect_pattern_matched_kws_in_existing not an array', () => {
  const r = validateRegisterGates({
    flags: VALID_FLAGS,
    plan: { ...VALID_PLAN, conflict_check: { matched_count: 0, protect_pattern_matched_kws_in_existing: 'not-array' } },
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 2);
});

test('GATE 2 — protect_pattern_matched_kws_in_existing missing key', () => {
  const r = validateRegisterGates({
    flags: VALID_FLAGS,
    plan: { ...VALID_PLAN, conflict_check: { matched_count: 0 } },
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 2);
});

test('GATE 3 — --confirm-text missing', () => {
  const r = validateRegisterGates({
    flags: { ...VALID_FLAGS, 'confirm-text': undefined },
    plan: VALID_PLAN,
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 3);
  assert.match(r.error, /confirm-text/);
});

test('GATE 3 — --confirm-text different value', () => {
  const r = validateRegisterGates({
    flags: { ...VALID_FLAGS, 'confirm-text': 'REGISTER 99' },
    plan: VALID_PLAN,
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 3);
  assert.match(r.error, /REGISTER 224/);
});

test('GATE 3 — --confirm-text whitespace differs (strict equality)', () => {
  const r = validateRegisterGates({
    flags: { ...VALID_FLAGS, 'confirm-text': 'REGISTER  224' }, // double space
    plan: VALID_PLAN,
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 3);
});

test('GATE 3 — --confirm-text case differs (strict equality)', () => {
  const r = validateRegisterGates({
    flags: { ...VALID_FLAGS, 'confirm-text': 'register 224' },
    plan: VALID_PLAN,
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 3);
});

test('GATE 3 — plan.approved_by missing', () => {
  const r = validateRegisterGates({
    flags: VALID_FLAGS,
    plan: { ...VALID_PLAN, approved_by: undefined },
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 3);
  assert.match(r.error, /approved_by/);
});

test('GATE 3 — plan.approved_by empty string', () => {
  const r = validateRegisterGates({
    flags: VALID_FLAGS,
    plan: { ...VALID_PLAN, approved_by: '' },
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 3);
});

test('gate ok — non-empty protect array passes', () => {
  const r = validateRegisterGates({
    flags: VALID_FLAGS,
    plan: { ...VALID_PLAN, conflict_check: { matched_count: 1, protect_pattern_matched_kws_in_existing: ['kw1'] } },
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.ok, true);
});

test('gate ordering — approve checked before plan-file', () => {
  // both --approve missing and --plan-file missing → must report gate 1 first
  const r = validateRegisterGates({
    flags: { 'plan-file': undefined, 'confirm-text': undefined },
    plan: null,
    planFileProvided: false,
    planFileExists: false,
  });
  assert.equal(r.gate, 1);
});

test('gate ordering — plan-file checked before plan structure', () => {
  // --approve given but --plan-file missing → gate 2 (file), not deeper plan checks
  const r = validateRegisterGates({
    flags: { approve: true, 'plan-file': undefined, 'confirm-text': 'wrong' },
    plan: null,
    planFileProvided: false,
    planFileExists: false,
  });
  assert.equal(r.gate, 2);
  assert.match(r.error, /--plan-file/);
});

test('gate ordering — confirm-text checked before approved_by', () => {
  // confirm-text wrong AND approved_by missing → gate 3 with confirm-text message first
  const r = validateRegisterGates({
    flags: { ...VALID_FLAGS, 'confirm-text': 'WRONG' },
    plan: { ...VALID_PLAN, approved_by: undefined },
    planFileProvided: true,
    planFileExists: true,
  });
  assert.equal(r.gate, 3);
  assert.match(r.error, /confirm-text/);
});
