import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenProtectPatterns, matchProtect, analyzeGroup } from '../src/diff_analyzer.mjs';

const PROTECT_CONFIG = {
  categories: [
    { name: 'T010_본질_카테고리', patterns: ['귀걸이형', '이어후크', '귀에거는'] },
    { name: '자사_카테고리', patterns: ['골전도', '오픈형', '오픈이어'] },
    { name: '시리즈_단독', patterns: ['오픈핏', '오픈런'] },
    { name: 'G_카테고리_락인', patterns: ['추천', '후기', '리뷰'] },
  ],
};

const FLAT = flattenProtectPatterns(PROTECT_CONFIG);

test('flattenProtectPatterns — flat list of {pattern, category}', () => {
  assert.equal(FLAT.length, 11);
  assert.deepEqual(FLAT[0], { pattern: '귀걸이형', category: 'T010_본질_카테고리' });
  assert.deepEqual(FLAT[3], { pattern: '골전도', category: '자사_카테고리' });
});

test('flattenProtectPatterns — handles missing/empty config', () => {
  assert.deepEqual(flattenProtectPatterns({}), []);
  assert.deepEqual(flattenProtectPatterns(null), []);
  assert.deepEqual(flattenProtectPatterns(undefined), []);
  assert.deepEqual(flattenProtectPatterns({ categories: [] }), []);
});

test('flattenProtectPatterns — category with no patterns', () => {
  const r = flattenProtectPatterns({ categories: [{ name: 'X', patterns: [] }, { name: 'Y' }] });
  assert.deepEqual(r, []);
});

test('matchProtect — substring match positive', () => {
  const hits = matchProtect('귀걸이형 이어폰', FLAT);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].pattern, '귀걸이형');
});

test('matchProtect — no match', () => {
  assert.deepEqual(matchProtect('아무관계없는키워드', FLAT), []);
});

test('matchProtect — multiple patterns hit one keyword', () => {
  const hits = matchProtect('오픈이어 골전도 헤드폰', FLAT);
  const patterns = hits.map((h) => h.pattern).sort();
  assert.deepEqual(patterns, ['골전도', '오픈이어']);
});

test('matchProtect — pattern must be exact substring (case-sensitive)', () => {
  // Korean has no case but ensure ASCII case-sensitivity if used
  assert.equal(matchProtect('OPENFIT', FLAT).length, 0); // not in protect list
});

test('matchProtect — non-string keyword returns empty', () => {
  assert.deepEqual(matchProtect(undefined, FLAT), []);
  assert.deepEqual(matchProtect(null, FLAT), []);
  assert.deepEqual(matchProtect(123, FLAT), []);
});

test('matchProtect — overlapping pattern hits report both', () => {
  // '오픈이어' matches 자사_카테고리 only; '오픈' would not appear since not a single pattern;
  // but if keyword contains both '오픈이어' AND '오픈핏', both hit
  const hits = matchProtect('오픈핏 오픈이어 헤드셋', FLAT);
  const patterns = hits.map((h) => h.pattern).sort();
  assert.deepEqual(patterns, ['오픈이어', '오픈핏']);
});

test('analyzeGroup — all KW match protect → all kept', () => {
  const group = {
    idx: 1, campaign: 'C1', group: 'G1', nccAdgroupId: 'A1', high_cost: false,
    current_neg_kws: [
      { nccTargetId: 'T1', keyword: '귀걸이형 헤드폰', match_type: 'exact' },
      { nccTargetId: 'T2', keyword: '오픈이어 추천', match_type: 'exact' },
    ],
  };
  const r = analyzeGroup(group, FLAT, new Set(['신규KW']));
  assert.equal(r.to_keep.length, 2);
  assert.equal(r.to_remove_safe.length, 0);
  assert.equal(r.duplicate_with_new.length, 0);
  assert.equal(r.conflict_kws.length, 2);
  assert.equal(r.to_keep[0].protect_categories.length, 1);
  assert.equal(r.to_keep[1].protect_categories.length, 2);
});

test('analyzeGroup — protect priority over duplicate (KW in newKwSet AND matches protect → kept)', () => {
  // 보존 패턴이 우선. newKwSet에 있어도 protect 매칭이 있으면 to_keep으로 분류
  const group = {
    idx: 1, current_neg_kws: [{ nccTargetId: 'T1', keyword: '오픈이어 신규' }],
  };
  const newKwSet = new Set(['오픈이어 신규']);
  const r = analyzeGroup(group, FLAT, newKwSet);
  assert.equal(r.to_keep.length, 1);
  assert.equal(r.duplicate_with_new.length, 0);
});

test('analyzeGroup — KW in newKwSet without protect match → duplicate_with_new', () => {
  const group = {
    idx: 1, current_neg_kws: [{ nccTargetId: 'T1', keyword: '신규제외KW' }],
  };
  const newKwSet = new Set(['신규제외KW']);
  const r = analyzeGroup(group, FLAT, newKwSet);
  assert.equal(r.duplicate_with_new.length, 1);
  assert.equal(r.to_keep.length, 0);
  assert.equal(r.to_remove_safe.length, 0);
});

test('analyzeGroup — KW unmatched anywhere → to_remove_safe', () => {
  const group = {
    idx: 1, current_neg_kws: [{ nccTargetId: 'T1', keyword: '평범한일반제외KW' }],
  };
  const r = analyzeGroup(group, FLAT, new Set());
  assert.equal(r.to_remove_safe.length, 1);
  assert.equal(r.to_keep.length, 0);
  assert.equal(r.duplicate_with_new.length, 0);
});

test('analyzeGroup — mixed group preserves classification', () => {
  const group = {
    idx: 5, campaign: 'C', group: 'G', nccAdgroupId: 'A', high_cost: true,
    current_neg_kws: [
      { nccTargetId: 'T1', keyword: '귀걸이형 무선' },        // protect
      { nccTargetId: 'T2', keyword: '오픈런 베스트' },         // protect
      { nccTargetId: 'T3', keyword: '신규KW1' },              // duplicate
      { nccTargetId: 'T4', keyword: '아무관계없는KW' },        // removable
      { nccTargetId: 'T5', keyword: '리뷰모음' },             // protect
    ],
  };
  const r = analyzeGroup(group, FLAT, new Set(['신규KW1']));
  assert.equal(r.to_keep.length, 3);
  assert.equal(r.duplicate_with_new.length, 1);
  assert.equal(r.to_remove_safe.length, 1);
  assert.equal(r.conflict_kws.length, 3);
  assert.equal(r.existing_count, 5);
  assert.equal(r.high_cost, true);
});

test('analyzeGroup — empty group', () => {
  const r = analyzeGroup({ idx: 1, current_neg_kws: [] }, FLAT, new Set());
  assert.equal(r.existing_count, 0);
  assert.equal(r.to_keep.length, 0);
});

test('analyzeGroup — current_neg_kws missing (treated as empty)', () => {
  const r = analyzeGroup({ idx: 1 }, FLAT, new Set());
  assert.equal(r.existing_count, 0);
});

test('analyzeGroup — preserves group meta (idx/campaign/group/nccAdgroupId/high_cost)', () => {
  const r = analyzeGroup({
    idx: 7, campaign: 'X', group: 'Y', nccAdgroupId: 'Z', high_cost: true,
    current_neg_kws: [],
  }, FLAT, new Set());
  assert.equal(r.idx, 7);
  assert.equal(r.campaign, 'X');
  assert.equal(r.group, 'Y');
  assert.equal(r.nccAdgroupId, 'Z');
  assert.equal(r.high_cost, true);
});

test('analyzeGroup — keyword with multiple protect category matches keeps all categories', () => {
  // '오픈이어 추천' → 자사_카테고리(오픈이어) + G_카테고리_락인(추천)
  const group = {
    idx: 1, current_neg_kws: [{ nccTargetId: 'T1', keyword: '오픈이어 추천' }],
  };
  const r = analyzeGroup(group, FLAT, new Set());
  assert.equal(r.to_keep.length, 1);
  const cats = r.to_keep[0].protect_categories.sort();
  assert.deepEqual(cats, ['G_카테고리_락인', '자사_카테고리']);
});

test('analyzeGroup — kw fields preserved in result', () => {
  const group = {
    idx: 1, current_neg_kws: [
      { nccTargetId: 'T-99', keyword: '귀걸이형', match_type: 'exact', type: 'NEGATIVE_KEYWORD' },
    ],
  };
  const r = analyzeGroup(group, FLAT, new Set());
  assert.equal(r.to_keep[0].nccTargetId, 'T-99');
  assert.equal(r.to_keep[0].keyword, '귀걸이형');
  assert.equal(r.to_keep[0].match_type, 'exact');
  assert.equal(r.to_keep[0].type, 'NEGATIVE_KEYWORD');
});
