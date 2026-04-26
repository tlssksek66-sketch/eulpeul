import path from 'node:path';
import { existsSync } from 'node:fs';
import { loadEnv, ts, outputDir, writeJson, readJson, isoNow, parseArgs, pLimit } from './util.mjs';
import { postTarget, deleteTarget } from './worker_client.mjs';

loadEnv();
const { flags } = parseArgs();

if (!flags.approve) {
  console.error('[STEP5] GATE 1 실패 — --approve 필수');
  process.exit(2);
}

const planFile = flags['plan-file'];
if (!planFile) {
  console.error('[STEP5] GATE 2 실패 — --plan-file=output/03_register_plan_*.json 필수');
  process.exit(2);
}
const planPath = path.isAbsolute(planFile) ? planFile : path.join(outputDir(), planFile);
if (!existsSync(planPath)) {
  console.error(`[STEP5] GATE 2 실패 — plan 파일 없음: ${planPath}`);
  process.exit(2);
}
const plan = readJson(planPath);

if (!plan.conflict_check || !Array.isArray(plan.conflict_check.protect_pattern_matched_kws_in_existing)) {
  console.error('[STEP5] GATE 2 실패 — plan.conflict_check.protect_pattern_matched_kws_in_existing 필드 누락. step4 재실행 필요.');
  process.exit(2);
}

const expected = plan.confirm_text_required;
const got = flags['confirm-text'];
if (got !== expected) {
  console.error(`[STEP5] GATE 3 실패 — --confirm-text="${expected}" 필수 (받은값: "${got || ''}")`);
  process.exit(2);
}

if (!plan.approved_by) {
  console.error('[STEP5] plan.approved_by 누락 — step4를 --approved-by 와 함께 재실행');
  process.exit(2);
}

console.log('[STEP5] 3중 게이트 통과');
console.log(`  옵션:        ${plan.decision}`);
console.log(`  승인자:       ${plan.approved_by}`);
console.log(`  POST:        ${plan.expected_register_post_count}건`);
console.log(`  DELETE:      ${plan.expected_delete_count}건`);
console.log(`  보존 매칭:    ${plan.conflict_check.matched_count}건`);
console.log('');

const startedAt = isoNow();

const deleteActions = plan.actions.filter((a) => a.type === 'DELETE');
const postActions = plan.actions.filter((a) => a.type === 'POST');

console.log(`[STEP5] DELETE ${deleteActions.length}건 실행 (병렬 3)`);
const deleteResults = await pLimit(deleteActions, 3, async (a) => {
  const r = await deleteTarget(a.nccTargetId);
  return { ...a, http: r.http, ok: r.ok, body: r.body, reason_fail: r.reason };
});

console.log(`[STEP5] POST ${postActions.length}건 실행 (병렬 3)`);
const postResults = await pLimit(postActions, 3, async (a) => {
  const r = await postTarget({ ownerId: a.nccAdgroupId, keyword: a.keyword, match_type: a.match_type });
  return { ...a, http: r.http, ok: r.ok, body: r.body, reason_fail: r.reason };
});

const summarize = (arr) => ({
  total: arr.length,
  ok: arr.filter((r) => r.ok && r.value?.ok !== false).length,
  fail: arr.filter((r) => !r.ok || r.value?.ok === false).length,
  details: arr.map((r) => r.ok ? r.value : { ok: false, error: r.error }),
});

const report = {
  started_at: startedAt,
  finished_at: isoNow(),
  plan_file: path.basename(planPath),
  decision: plan.decision,
  approved_by: plan.approved_by,
  delete: summarize(deleteResults),
  post: summarize(postResults),
};

const out = path.join(outputDir(), `04_register_results_${ts()}.json`);
writeJson(out, report);

console.log('');
console.log('[STEP5] 실행 결과');
console.log(`  DELETE  OK ${report.delete.ok} / FAIL ${report.delete.fail}`);
console.log(`  POST    OK ${report.post.ok} / FAIL ${report.post.fail}`);

if (report.delete.fail || report.post.fail) {
  console.error('[STEP5] WARN — 일부 실패. 04_register_results 검토 필요');
  process.exit(1);
}
console.log('[STEP5] OK — 10분 후 step6 verify 실행');
