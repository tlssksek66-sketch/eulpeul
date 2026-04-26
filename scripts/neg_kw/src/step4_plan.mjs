import path from 'node:path';
import { readFileSync } from 'node:fs';
import { loadEnv, ts, outputDir, writeJson, readJson, isoNow, latestFile, parseArgs } from './util.mjs';

loadEnv();
const { flags } = parseArgs();

const option = String(flags.option || '');
if (!['1', '2', '3', '4'].includes(option)) {
  console.error('[STEP4] --option=1|2|3|4 필수');
  console.error('  1: 전체 교체  2: 신규만 추가  3: 보존+그외교체  4: 보류');
  process.exit(2);
}

const approvedBy = flags['approved-by'];
if (!approvedBy && option !== '4') {
  console.error('[STEP4] --approved-by="파트너명" 필수 (옵션 4 제외)');
  process.exit(2);
}

const diffPath = flags['diff-file']
  ? (path.isAbsolute(flags['diff-file']) ? flags['diff-file'] : path.join(outputDir(), flags['diff-file']))
  : latestFile(outputDir(), '02_diff_analysis_');
if (!diffPath) {
  console.error('[STEP4] diff 파일 미발견');
  process.exit(2);
}
console.log(`[STEP4] diff 파일: ${diffPath}`);
const diff = readJson(diffPath);

const newKws = JSON.parse(readFileSync(path.join(import.meta.dirname || new URL('.', import.meta.url).pathname, '..', 'config', 'new_keywords.json'), 'utf8'));

const actions = [];

for (const g of diff.per_group) {
  if (option === '1') {
    for (const kw of [...g.to_keep, ...g.to_remove_safe, ...g.duplicate_with_new]) {
      actions.push({ type: 'DELETE', nccTargetId: kw.nccTargetId, idx: g.idx, group: g.group, keyword: kw.keyword, reason: 'option1_full_replace' });
    }
  } else if (option === '3') {
    for (const kw of [...g.to_remove_safe, ...g.duplicate_with_new]) {
      actions.push({ type: 'DELETE', nccTargetId: kw.nccTargetId, idx: g.idx, group: g.group, keyword: kw.keyword, reason: 'option3_drop_non_protect' });
    }
  }

  if (option === '4') continue;

  const existingKwSet = new Set(g.to_keep.concat(g.duplicate_with_new).map((k) => k.keyword));
  for (const k of newKws.keywords) {
    if (option === '1' || option === '3' || !existingKwSet.has(k.keyword)) {
      actions.push({
        type: 'POST',
        nccAdgroupId: g.nccAdgroupId,
        idx: g.idx,
        group: g.group,
        keyword: k.keyword,
        match_type: newKws.match_type,
        reason: k.reason,
      });
    }
  }
}

const counts = {
  DELETE: actions.filter((a) => a.type === 'DELETE').length,
  POST: actions.filter((a) => a.type === 'POST').length,
};

const plan = {
  plan_timestamp: isoNow(),
  source_diff: path.basename(diffPath),
  decision: `옵션 ${option}`,
  decision_label: diff.decision_options[option],
  approved_by: approvedBy || null,
  approved_timestamp: approvedBy ? isoNow() : null,
  conflict_check: {
    protect_pattern_matched_kws_in_existing: diff.protect_pattern_matched_kws_in_existing || [],
    duplicate_with_new_kws: diff.duplicate_with_new_kws || [],
    matched_count: (diff.protect_pattern_matched_kws_in_existing || []).length,
  },
  expected_register_post_count: counts.POST,
  expected_delete_count: counts.DELETE,
  confirm_text_required: `REGISTER ${counts.POST}`,
  actions,
};

const out = path.join(outputDir(), `03_register_plan_${ts()}.json`);
writeJson(out, plan);

console.log('[STEP4] 계획 확정');
console.log(`  옵션:           ${plan.decision} — ${plan.decision_label}`);
console.log(`  POST 예정:       ${counts.POST}건`);
console.log(`  DELETE 예정:     ${counts.DELETE}건`);
console.log(`  보존 매칭:        ${plan.conflict_check.matched_count}건`);
console.log(`  confirm-text:    "${plan.confirm_text_required}"`);

if (option === '4') {
  console.log('[STEP4] 옵션 4 — 등록 미수행. step5 호출 금지.');
  process.exit(0);
}

console.log('');
console.log('[STEP4] step5 실행 명령 (3중 게이트):');
console.log(`  node src/step5_register.mjs --approve --plan-file=${path.basename(out)} --confirm-text="${plan.confirm_text_required}"`);
