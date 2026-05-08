import path from 'node:path';
import { loadEnv, ts, outputDir, writeJson, readJson, isoNow, latestFile, parseArgs } from './util.mjs';
import { loadOrInitMaster, saveMaster, appendChangeLog, appendChangeLogMd, printHandoff } from './inventory_helper.mjs';

loadEnv();
const { flags } = parseArgs();

const resolve = (flagName, prefix) => {
  const v = flags[flagName];
  if (v) return path.isAbsolute(v) ? v : path.join(outputDir(), v);
  return latestFile(outputDir(), prefix);
};

const planFile = resolve('plan-file', '03_register_plan_');
const resultFile = resolve('result-file', '04_register_results_');
const verifyFile = resolve('verify-file', '05_diff_after_');
const beforeFile = resolve('before-file', '01_dump_before_');

if (!planFile || !resultFile || !verifyFile || !beforeFile) {
  console.error('[STEP7] 필요한 산출물 미발견 (plan / result / verify / before 모두 필요)');
  console.error(`  plan=${planFile}  result=${resultFile}  verify=${verifyFile}  before=${beforeFile}`);
  process.exit(2);
}

const plan = readJson(planFile);
const result = readJson(resultFile);
const verify = readJson(verifyFile);
const before = readJson(beforeFile);

const sanitizeKw = (k) => ({ keyword: k.keyword, match_type: k.match_type, categories: k.categories });

const summary = {
  task_id: 'T010_NEGKW_REPLACE_2026-04-26',
  finalized_at: isoNow(),
  decision: plan.decision,
  decision_label: plan.decision_label,
  approved_by: plan.approved_by,
  before_total_kws: before.total_existing_neg_kws,
  delete_count_planned: plan.expected_delete_count,
  post_count_planned: plan.expected_register_post_count,
  delete_ok: result.delete.ok,
  delete_fail: result.delete.fail,
  post_ok: result.post.ok,
  post_fail: result.post.fail,
  verification_passed: verify.passed,
  protect_pattern_matched_in_existing: plan.conflict_check.protect_pattern_matched_kws_in_existing.map(sanitizeKw),
  added_kws: [...new Set(plan.actions.filter((a) => a.type === 'POST').map((a) => a.keyword))],
  removed_kws: [...new Set(plan.actions.filter((a) => a.type === 'DELETE').map((a) => a.keyword))],
  per_group_changes: verify.per_group.map((g) => ({
    idx: g.idx, group: g.group,
    before_count: g.before_count, after_count: g.after_count,
    added: g.added, removed: g.removed,
  })),
};

const finalOut = path.join(outputDir(), `06_inventory_final_${ts()}.json`);
writeJson(finalOut, summary);

const master = loadOrInitMaster();
appendChangeLog(master, {
  step: 7,
  action: 'FINALIZED',
  operation: summary.decision,
  before_count: summary.before_total_kws,
  after_count: summary.before_total_kws - summary.delete_ok + summary.post_ok,
  added_kws: summary.added_kws,
  removed_kws: summary.removed_kws,
  protect_matched_count: summary.protect_pattern_matched_in_existing.length,
  verification: summary.verification_passed ? 'passed' : 'failed',
  approved_by: summary.approved_by,
});
saveMaster(master);

const logLines = [
  `## ${summary.finalized_at}  ${summary.decision}`,
  `- 승인자: ${summary.approved_by}`,
  `- 기존 → 후: ${summary.before_total_kws} → ${summary.before_total_kws - summary.delete_ok + summary.post_ok}`,
  `- DELETE ok/fail: ${summary.delete_ok}/${summary.delete_fail}`,
  `- POST ok/fail: ${summary.post_ok}/${summary.post_fail}`,
  `- 보존 매칭: ${summary.protect_pattern_matched_in_existing.length}건`,
  `- 추가 KW: ${summary.added_kws.join(', ')}`,
];
if (summary.removed_kws.length) logLines.push(`- 삭제 KW: ${summary.removed_kws.join(', ')}`);
logLines.push(`- 검증: ${summary.verification_passed ? 'passed' : 'failed'}`);
appendChangeLogMd(logLines);

console.log('[STEP7] inventory 동기화 완료');
console.log(`  final:  ${finalOut}`);

const verifiedCount = master.register_groups.filter((g) => g.register_status === 'verified').length;
const failedCount = master.register_groups.filter((g) => g.register_status === 'failed').length;

printHandoff(7, [
  `상태: FINALIZED`,
  `결정: ${summary.decision} (${summary.decision_label})`,
  `등록 KW: ${summary.added_kws.join(', ')}`,
  `검증된 그룹: ${verifiedCount}/${master.register_groups.length}  (실패 ${failedCount})`,
  `산출물: ${path.basename(finalOut)} + inventory/t010_inventory_master.json + inventory/t010_change_log.md`,
  ``,
  `[다음 세션 Claude에 공유할 raw]`,
  `T010 NEGKW 작업 완료 (${summary.finalized_at}).`,
  `${summary.decision} 옵션으로 ${summary.post_ok}건 POST + ${summary.delete_ok}건 DELETE 성공.`,
  `28개 그룹 중 ${verifiedCount}개 verified, ${failedCount}개 failed.`,
  `다음 세션에서 inventory/t010_inventory_master.json 참조 가능.`,
  `사후 점검 트리거: T+1/T+3/T+7/T+14/T+28 (README.md 참조).`,
]);
