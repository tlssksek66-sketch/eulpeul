import path from 'node:path';
import { readFileSync } from 'node:fs';
import { loadEnv, ts, outputDir, writeJson, isoNow, pLimit } from './util.mjs';
import { getCampaigns, getAdGroups, getTargets } from './worker_client.mjs';
import { loadOrInitMaster, saveMaster, upsertGroup, appendChangeLog, writeDumpSummary, printHandoff } from './inventory_helper.mjs';

loadEnv();

const targetGroups = JSON.parse(readFileSync(path.join(import.meta.dirname || new URL('.', import.meta.url).pathname, '..', 'config', 'target_groups.json'), 'utf8'));

console.log('[STEP2] 28그룹 전수 dump 시작');

const campaigns = await getCampaigns();
const t010Campaigns = campaigns
  .map((c) => ({ name: c.name || c.campaignName || c.nccCampaignName, id: c.nccCampaignId || c.id }))
  .filter((c) => targetGroups.campaigns.includes(c.name));

const groupResolvers = await pLimit(t010Campaigns, 3, async (camp) => {
  const groups = await getAdGroups(camp.id);
  return { camp, groups };
});

const groupIndex = new Map();
for (const r of groupResolvers) {
  if (!r.ok) { console.error(`[STEP2] adgroups 조회 실패: ${r.error}`); continue; }
  for (const g of r.value.groups) {
    const key = `${r.value.camp.name}|${g.name || g.adgroupName || g.nccAdgroupName}`;
    groupIndex.set(key, { campaign: r.value.camp, group: g });
  }
}

const resolved = [];
for (const target of targetGroups.groups) {
  const key = `${target.campaign}|${target.group}`;
  const found = groupIndex.get(key);
  if (!found) {
    resolved.push({ idx: target.idx, campaign: target.campaign, group: target.group, error: 'group_not_found' });
    continue;
  }
  resolved.push({
    idx: target.idx,
    campaign: target.campaign,
    nccCampaignId: found.campaign.id,
    group: target.group,
    nccAdgroupId: found.group.nccAdgroupId || found.group.id,
    high_cost: target.high_cost,
  });
}

const errors = resolved.filter((r) => r.error);
if (errors.length) {
  console.error(`[STEP2] WARN — ${errors.length}개 그룹 식별 실패`);
  for (const e of errors) console.error(`  - ${e.idx}. ${e.campaign} | ${e.group}`);
}

console.log(`[STEP2] ${resolved.length - errors.length}/${resolved.length} 그룹 식별. /targets 호출 시작`);

const dumps = await pLimit(
  resolved.filter((r) => !r.error),
  3,
  async (r) => {
    const tgts = await getTargets(r.nccAdgroupId);
    return {
      idx: r.idx,
      campaign: r.campaign,
      nccCampaignId: r.nccCampaignId,
      group: r.group,
      nccAdgroupId: r.nccAdgroupId,
      high_cost: r.high_cost,
      current_neg_kws: tgts.map((t) => ({
        nccTargetId: t.nccTargetId || t.id,
        keyword: t.keyword || t.target,
        match_type: t.match_type || t.matchType || t.type_extension,
        type: t.type,
      })),
    };
  }
);

const groupsDump = [];
const dumpFails = [];
for (let i = 0; i < dumps.length; i++) {
  if (dumps[i].ok) groupsDump.push(dumps[i].value);
  else dumpFails.push({ ...resolved[i], error: dumps[i].error });
}

const totalKw = groupsDump.reduce((s, g) => s + g.current_neg_kws.length, 0);
const report = {
  dump_timestamp: isoNow(),
  total_groups: groupsDump.length,
  total_existing_neg_kws: totalKw,
  group_resolution_failures: errors,
  dump_failures: dumpFails,
  groups: groupsDump,
};

const stamp = ts();
const out = path.join(outputDir(), `01_dump_before_${stamp}.json`);
writeJson(out, report);

const summaryPath = writeDumpSummary(stamp, report);

const master = loadOrInitMaster();
for (const g of groupsDump) {
  upsertGroup(master, {
    idx: g.idx,
    campaign: g.campaign,
    group: g.group,
    high_cost: g.high_cost,
    register_status: 'pending',
    status_updated_at: isoNow(),
    before_kw_count: g.current_neg_kws.length,
    last_dump_timestamp: report.dump_timestamp,
  });
}
appendChangeLog(master, {
  step: 2,
  action: 'DUMP_COMPLETE',
  groups_dumped: groupsDump.length,
  total_existing_kws: totalKw,
  output_file: path.basename(out),
  inventory_summary: path.basename(summaryPath),
});
saveMaster(master);

console.log(`[STEP2] OK — ${groupsDump.length}그룹 / 기존 KW ${totalKw}건 dump 완료`);
if (dumpFails.length) {
  console.error(`[STEP2] WARN — ${dumpFails.length}개 그룹 dump 실패`);
  printHandoff(2, [
    `상태: PARTIAL — ${dumpFails.length}개 그룹 실패`,
    `산출물: output/${path.basename(out)} + inventory/${path.basename(summaryPath)}`,
    `다음: 실패 그룹 재시도 후 step3 진행`,
  ]);
  process.exit(1);
}
printHandoff(2, [
  `상태: OK`,
  `28그룹 dump 완료. 기존 KW 총 ${totalKw}건`,
  `산출물(output): ${path.basename(out)}`,
  `산출물(inventory): ${path.basename(summaryPath)} ← 다음 세션 인계용 (민감정보 제거)`,
  `register_groups 모두 status=pending`,
  `다음 단계: node src/step3_diff.mjs`,
]);
