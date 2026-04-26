import path from 'node:path';
import { readFileSync } from 'node:fs';
import { loadEnv, ts, outputDir, writeJson, readJson, isoNow, latestFile, parseArgs, sleep, pLimit } from './util.mjs';
import { getTargets } from './worker_client.mjs';
import { loadOrInitMaster, saveMaster, setGroupStatus, appendChangeLog, printHandoff } from './inventory_helper.mjs';

loadEnv();
const { flags } = parseArgs();

const beforePath = flags['before-file'] || latestFile(outputDir(), '01_dump_before_');
if (!beforePath) {
  console.error('[STEP6] before dump 미발견. --before-file=... 지정');
  process.exit(2);
}
const before = readJson(beforePath);

const newKws = JSON.parse(readFileSync(path.join(import.meta.dirname || new URL('.', import.meta.url).pathname, '..', 'config', 'new_keywords.json'), 'utf8'));
const newKwSet = new Set(newKws.keywords.map((k) => k.keyword));

if (!flags['no-wait']) {
  const waitMs = Number(flags['wait-sec'] || 600) * 1000;
  console.log(`[STEP6] ${waitMs / 1000}s 대기 (memory #6 학습 — 등록 반영 지연)`);
  await sleep(waitMs);
}

console.log('[STEP6] 28그룹 재dump');
const dumps = await pLimit(before.groups, 3, async (g) => {
  const tgts = await getTargets(g.nccAdgroupId);
  return {
    idx: g.idx,
    campaign: g.campaign,
    group: g.group,
    nccAdgroupId: g.nccAdgroupId,
    high_cost: g.high_cost,
    current_neg_kws: tgts.map((t) => ({
      nccTargetId: t.nccTargetId || t.id,
      keyword: t.keyword || t.target,
      match_type: t.match_type || t.matchType,
      type: t.type,
    })),
  };
});

const groupsAfter = dumps.filter((r) => r.ok).map((r) => r.value);
const fails = dumps.filter((r) => !r.ok);

const groupDiff = [];
for (const g of groupsAfter) {
  const beforeG = before.groups.find((b) => b.nccAdgroupId === g.nccAdgroupId);
  const beforeKws = new Set((beforeG?.current_neg_kws || []).map((k) => k.keyword));
  const afterKws = new Set(g.current_neg_kws.map((k) => k.keyword));
  const added = [...afterKws].filter((k) => !beforeKws.has(k));
  const removed = [...beforeKws].filter((k) => !afterKws.has(k));
  const newKwsPresent = [...newKwSet].filter((k) => afterKws.has(k));
  groupDiff.push({
    idx: g.idx,
    campaign: g.campaign,
    group: g.group,
    before_count: beforeG?.current_neg_kws.length || 0,
    after_count: g.current_neg_kws.length,
    added,
    removed,
    new_kws_registered: newKwsPresent,
    new_kws_missing: [...newKwSet].filter((k) => !afterKws.has(k)),
  });
}

const allNewMissing = groupDiff.flatMap((g) => g.new_kws_missing.map((k) => `${g.idx}.${g.group}|${k}`));
const verification = {
  verify_timestamp: isoNow(),
  before_dump: path.basename(beforePath),
  groups_verified: groupsAfter.length,
  dump_failures: fails.length,
  total_new_kw_missing_slots: allNewMissing.length,
  passed: fails.length === 0 && allNewMissing.length === 0,
  per_group: groupDiff,
};

const dumpAfter = {
  dump_timestamp: isoNow(),
  total_groups: groupsAfter.length,
  total_existing_neg_kws: groupsAfter.reduce((s, g) => s + g.current_neg_kws.length, 0),
  groups: groupsAfter,
};

const t = ts();
const dumpAfterPath = path.join(outputDir(), `05_dump_after_${t}.json`);
const diffAfterPath = path.join(outputDir(), `05_diff_after_${t}.json`);
writeJson(dumpAfterPath, dumpAfter);
writeJson(diffAfterPath, verification);

const master = loadOrInitMaster();
for (const g of groupDiff) {
  const allEightPresent = g.new_kws_missing.length === 0;
  setGroupStatus(master, g.idx, allEightPresent ? 'verified' : 'failed', {
    verified_at: verification.verify_timestamp,
    after_kw_count: g.after_count,
    new_kws_present: g.new_kws_registered,
    new_kws_missing_at_verify: g.new_kws_missing,
  });
}
appendChangeLog(master, {
  step: 6,
  action: 'VERIFY_DONE',
  passed: verification.passed,
  groups_verified: groupsAfter.length,
  missing_slots: allNewMissing.length,
  dump_after: path.basename(dumpAfterPath),
  diff_after: path.basename(diffAfterPath),
});
saveMaster(master);

console.log(`[STEP6] passed=${verification.passed}  groups=${groupsAfter.length}  missing_slots=${allNewMissing.length}`);
if (!verification.passed) {
  console.error('[STEP6] FAIL — 누락 슬롯:');
  for (const m of allNewMissing.slice(0, 20)) console.error(`  - ${m}`);
  printHandoff(6, [
    `상태: FAIL`,
    `누락 슬롯: ${allNewMissing.length}건`,
    `dump 실패: ${fails.length}개`,
    `산출물: ${path.basename(dumpAfterPath)}, ${path.basename(diffAfterPath)}`,
    ``,
    `다음 세션 Claude에 공유: "T010 STEP 6 검증 실패. ${path.basename(diffAfterPath)} 누락 슬롯 분석 필요"`,
    ``,
    `다음 단계: 누락 KW만 재등록 후 step6 재실행`,
  ]);
  process.exit(1);
}
printHandoff(6, [
  `상태: VERIFIED`,
  `28그룹 모두 신규 8KW 등록 확인`,
  `register_groups status=verified`,
  `산출물: ${path.basename(dumpAfterPath)}, ${path.basename(diffAfterPath)}`,
  ``,
  `다음 단계: node src/step7_inventory.mjs  (인벤토리 자산화 + change_log 시간흐름)`,
]);
