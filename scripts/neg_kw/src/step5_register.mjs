import path from 'node:path';
import { existsSync } from 'node:fs';
import { loadEnv, ts, outputDir, writeJson, readJson, isoNow, parseArgs, pLimit } from './util.mjs';
import { postTarget, deleteTarget } from './worker_client.mjs';
import { loadOrInitMaster, saveMaster, setGroupStatus, appendChangeLog, printHandoff } from './inventory_helper.mjs';
import { validateRegisterGates } from './gates.mjs';

loadEnv();
const { flags } = parseArgs();

const planFile = flags['plan-file'];
const planPath = planFile
  ? (path.isAbsolute(planFile) ? planFile : path.join(outputDir(), planFile))
  : null;
const planFileExists = planPath ? existsSync(planPath) : false;
let plan = null;
if (planFileExists) {
  try { plan = readJson(planPath); }
  catch (err) {
    console.error(`[STEP5] GATE 2 실패 — plan 파일 파싱 실패: ${err.message}`);
    process.exit(2);
  }
}

const gate = validateRegisterGates({
  flags,
  plan,
  planFileProvided: !!planFile,
  planFileExists,
});
if (!gate.ok) {
  const where = planPath && gate.gate === 2 && !planFileExists ? `: ${planPath}` : '';
  console.error(`[STEP5] GATE ${gate.gate} 실패 — ${gate.error}${where}`);
  process.exit(gate.code);
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

const master = loadOrInitMaster();
const involvedIdxs = new Set(plan.actions.map((a) => a.idx));
for (const idx of involvedIdxs) {
  setGroupStatus(master, idx, 'in_progress', { register_started_at: startedAt });
}
appendChangeLog(master, {
  step: 5,
  action: 'REGISTER_START',
  decision: plan.decision,
  approved_by: plan.approved_by,
  delete_planned: deleteActions.length,
  post_planned: postActions.length,
});
saveMaster(master);

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

const failedIdxs = new Set();
for (const r of [...deleteResults, ...postResults]) {
  if (r.ok && r.value?.ok !== false) continue;
  const original = r.value || r;
  if (original.idx !== undefined) failedIdxs.add(original.idx);
}

const master2 = loadOrInitMaster();
for (const idx of involvedIdxs) {
  setGroupStatus(master2, idx, failedIdxs.has(idx) ? 'failed' : 'registered', {
    register_finished_at: report.finished_at,
  });
}
appendChangeLog(master2, {
  step: 5,
  action: 'REGISTER_DONE',
  delete_ok: report.delete.ok,
  delete_fail: report.delete.fail,
  post_ok: report.post.ok,
  post_fail: report.post.fail,
  result_file: path.basename(out),
});
saveMaster(master2);

console.log('');
console.log('[STEP5] 실행 결과');
console.log(`  DELETE  OK ${report.delete.ok} / FAIL ${report.delete.fail}`);
console.log(`  POST    OK ${report.post.ok} / FAIL ${report.post.fail}`);

if (report.delete.fail || report.post.fail) {
  console.error('[STEP5] WARN — 일부 실패. 04_register_results 검토 필요');
  printHandoff(5, [
    `상태: PARTIAL FAIL`,
    `DELETE: ok=${report.delete.ok} fail=${report.delete.fail}`,
    `POST: ok=${report.post.ok} fail=${report.post.fail}`,
    `실패 그룹 (status=failed): ${[...failedIdxs].sort((a,b)=>a-b).join(', ')}`,
    `산출물: ${path.basename(out)}`,
    ``,
    `다음 세션 Claude에 공유: "T010 STEP 5 부분 실패. ${path.basename(out)} 검토 후 재시도 결정 필요"`,
    ``,
    `다음 단계: 실패 사유 분석 후 step5 재실행 또는 step6 (10분 대기 후 검증)`,
  ]);
  process.exit(1);
}
console.log('[STEP5] OK — 10분 후 step6 verify 실행');
printHandoff(5, [
  `상태: OK`,
  `DELETE: ${report.delete.ok}건 / POST: ${report.post.ok}건 모두 성공`,
  `register_groups status=registered (검증 대기)`,
  `산출물: ${path.basename(out)}`,
  ``,
  `다음 단계: node src/step6_verify.mjs  (기본 10분 대기 후 재dump)`,
]);
