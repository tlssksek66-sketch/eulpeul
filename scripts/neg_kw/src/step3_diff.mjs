import path from 'node:path';
import { readFileSync } from 'node:fs';
import { loadEnv, ts, outputDir, writeJson, readJson, isoNow, latestFile, parseArgs } from './util.mjs';

loadEnv();
const { flags } = parseArgs();

const cfgRoot = path.join(import.meta.dirname || new URL('.', import.meta.url).pathname, '..', 'config');
const protect = JSON.parse(readFileSync(path.join(cfgRoot, 'protect_patterns.json'), 'utf8'));
const newKws = JSON.parse(readFileSync(path.join(cfgRoot, 'new_keywords.json'), 'utf8'));

const dumpPath = flags['dump-file'] || latestFile(outputDir(), '01_dump_before_');
if (!dumpPath) {
  console.error('[STEP3] dump 파일 미발견. step2 먼저 실행 또는 --dump-file=... 지정');
  process.exit(2);
}
console.log(`[STEP3] dump 파일: ${dumpPath}`);
const dump = readJson(dumpPath);

const newKwSet = new Set(newKws.keywords.map((k) => k.keyword));
const flatPatterns = protect.categories.flatMap((c) => c.patterns.map((p) => ({ pattern: p, category: c.name })));

function matchProtect(kw) {
  return flatPatterns.filter(({ pattern }) => kw.includes(pattern));
}

const groupAnalyses = [];
const protectMatchedAll = [];
const duplicates = [];
let totalExisting = 0;

for (const g of dump.groups) {
  const kept = [];
  const removable = [];
  const dupes = [];
  const conflicts = [];

  for (const kw of g.current_neg_kws) {
    totalExisting++;
    const hits = matchProtect(kw.keyword);
    if (hits.length) {
      kept.push({ ...kw, protect_categories: hits.map((h) => h.category), patterns_matched: hits.map((h) => h.pattern) });
      conflicts.push({ ...kw, patterns_matched: hits.map((h) => h.pattern), categories: hits.map((h) => h.category) });
      protectMatchedAll.push({
        idx: g.idx, campaign: g.campaign, group: g.group,
        nccTargetId: kw.nccTargetId, keyword: kw.keyword,
        patterns_matched: hits.map((h) => h.pattern),
        categories: hits.map((h) => h.category),
      });
    } else if (newKwSet.has(kw.keyword)) {
      dupes.push(kw);
      duplicates.push({ idx: g.idx, campaign: g.campaign, group: g.group, ...kw });
    } else {
      removable.push(kw);
    }
  }

  groupAnalyses.push({
    idx: g.idx,
    campaign: g.campaign,
    group: g.group,
    nccAdgroupId: g.nccAdgroupId,
    high_cost: g.high_cost,
    existing_count: g.current_neg_kws.length,
    to_keep: kept,
    duplicate_with_new: dupes,
    to_remove_safe: removable,
    conflict_kws: conflicts,
  });
}

const report = {
  analysis_timestamp: isoNow(),
  source_dump: path.basename(dumpPath),
  total_existing_kws: totalExisting,
  total_groups: dump.groups.length,
  protect_pattern_matched_kws_in_existing: protectMatchedAll,
  duplicate_with_new_kws: duplicates,
  groups_with_conflicts: groupAnalyses.filter((g) => g.conflict_kws.length).map((g) => ({ idx: g.idx, campaign: g.campaign, group: g.group, conflict_count: g.conflict_kws.length })),
  groups_clean: groupAnalyses.filter((g) => g.conflict_kws.length === 0 && g.existing_count === 0).map((g) => g.idx),
  per_group: groupAnalyses,
  decision_options: {
    "1": "전체 교체 — 기존 전체 DELETE + 신규 8개 POST. ⚠️ 보존 KW도 삭제됨",
    "2": "신규 8개만 추가 — DELETE 없음, POST만. 가장 안전 (권장)",
    "3": "충돌 KW 보존 + 그 외 교체 — protect 매칭만 유지, 나머지 DELETE + 신규 POST",
    "4": "작업 보류 — dump만 보존, 등록 별도 시점"
  },
  partner_review_required: true,
};

const out = path.join(outputDir(), `02_diff_analysis_${ts()}.json`);
writeJson(out, report);

console.log('[STEP3] 요약');
console.log(`  - 기존 KW 합계: ${totalExisting}건`);
console.log(`  - 보존 패턴 매칭: ${protectMatchedAll.length}건  (⚠️ 옵션 1 시 누수 위험)`);
console.log(`  - 신규와 중복: ${duplicates.length}건`);
console.log(`  - 충돌 그룹: ${groupAnalyses.filter((g) => g.conflict_kws.length).length}/28`);
console.log('');
console.log('[STEP3] ⚠️ 파트너 검토 단계 — diff 파일을 검토 후 step4를 옵션과 함께 실행');
console.log(`        node src/step4_plan.mjs --option=1|2|3|4 --diff-file=${path.basename(out)}`);
