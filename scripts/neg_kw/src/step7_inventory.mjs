import path from 'node:path';
import fs from 'node:fs';
import { loadEnv, ts, outputDir, inventoryDir, writeJson, readJson, isoNow, latestFile, parseArgs } from './util.mjs';

loadEnv();
const { flags } = parseArgs();

const planFile = flags['plan-file'] ? (path.isAbsolute(flags['plan-file']) ? flags['plan-file'] : path.join(outputDir(), flags['plan-file'])) : latestFile(outputDir(), '03_register_plan_');
const resultFile = flags['result-file'] ? (path.isAbsolute(flags['result-file']) ? flags['result-file'] : path.join(outputDir(), flags['result-file'])) : latestFile(outputDir(), '04_register_results_');
const verifyFile = flags['verify-file'] ? (path.isAbsolute(flags['verify-file']) ? flags['verify-file'] : path.join(outputDir(), flags['verify-file'])) : latestFile(outputDir(), '05_diff_after_');
const beforeFile = flags['before-file'] ? (path.isAbsolute(flags['before-file']) ? flags['before-file'] : path.join(outputDir(), flags['before-file'])) : latestFile(outputDir(), '01_dump_before_');

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
const sanitizeAction = (a) => ({ type: a.type, idx: a.idx, group: a.group, keyword: a.keyword, reason: a.reason });

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

const invDir = inventoryDir();
const masterPath = path.join(invDir, 't010_inventory_master.json');
const logPath = path.join(invDir, 't010_change_log.md');

const master = fs.existsSync(masterPath) ? readJson(masterPath) : {
  task_id: 'T010_NEGKW_REPLACE_2026-04-26',
  created_at: isoNow(),
  change_log: [],
  register_groups: [],
};

master.change_log.push({
  timestamp: summary.finalized_at,
  action: 'REGISTERED',
  operation: summary.decision,
  before_count: summary.before_total_kws,
  after_count: summary.before_total_kws - summary.delete_ok + summary.post_ok,
  added_kws: summary.added_kws,
  removed_kws: summary.removed_kws,
  protect_matched_count: summary.protect_pattern_matched_in_existing.length,
  verification: summary.verification_passed ? 'passed' : 'failed',
  approved_by: summary.approved_by,
});

const groupKey = (g) => `${g.idx}|${g.group}`;
const existingByKey = new Map(master.register_groups.map((g) => [groupKey(g), g]));
for (const g of summary.per_group_changes) {
  existingByKey.set(groupKey(g), {
    idx: g.idx, group: g.group,
    register_status: summary.verification_passed ? 'registered' : 'partial',
    register_timestamp: summary.finalized_at,
    last_added: g.added,
    last_removed: g.removed,
    after_count: g.after_count,
  });
}
master.register_groups = [...existingByKey.values()].sort((a, b) => a.idx - b.idx);
writeJson(masterPath, master);

const logEntry = [
  `## ${summary.finalized_at}  ${summary.decision}`,
  `- 승인자: ${summary.approved_by}`,
  `- 기존 → 후: ${summary.before_total_kws} → ${summary.before_total_kws - summary.delete_ok + summary.post_ok}`,
  `- DELETE ok/fail: ${summary.delete_ok}/${summary.delete_fail}`,
  `- POST ok/fail: ${summary.post_ok}/${summary.post_fail}`,
  `- 보존 매칭: ${summary.protect_pattern_matched_in_existing.length}건`,
  `- 추가 KW: ${summary.added_kws.join(', ')}`,
  summary.removed_kws.length ? `- 삭제 KW: ${summary.removed_kws.join(', ')}` : null,
  `- 검증: ${summary.verification_passed ? 'passed' : 'failed'}`,
  '',
].filter(Boolean).join('\n');

const header = '# T010 제외KW 변경 이력\n\n';
const existing = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : header;
const next = existing.startsWith(header) ? existing.replace(header, header + logEntry + '\n') : header + logEntry + '\n' + existing;
fs.writeFileSync(logPath, next, 'utf8');
console.log(`[WRITE] ${logPath}`);

console.log('[STEP7] inventory 동기화 완료');
console.log(`  master: ${masterPath}`);
console.log(`  log:    ${logPath}`);
console.log(`  final:  ${finalOut}`);
