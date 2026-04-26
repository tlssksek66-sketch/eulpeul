import path from 'node:path';
import { readFileSync } from 'node:fs';
import { loadEnv, ts, outputDir, writeJson, isoNow, pLimit } from './util.mjs';
import { getCampaigns, getAdGroups, getTargets } from './worker_client.mjs';

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

const out = path.join(outputDir(), `01_dump_before_${ts()}.json`);
writeJson(out, report);

console.log(`[STEP2] OK — ${groupsDump.length}그룹 / 기존 KW ${totalKw}건 dump 완료`);
if (dumpFails.length) {
  console.error(`[STEP2] WARN — ${dumpFails.length}개 그룹 dump 실패`);
  process.exit(1);
}
