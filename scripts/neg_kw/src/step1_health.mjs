import path from 'node:path';
import { loadEnv, ts, outputDir, writeJson, isoNow } from './util.mjs';
import { getCampaigns } from './worker_client.mjs';
import { readFileSync } from 'node:fs';

loadEnv();

const targetGroupsPath = path.join(import.meta.dirname || new URL('.', import.meta.url).pathname, '..', 'config', 'target_groups.json');
const targetGroups = JSON.parse(readFileSync(targetGroupsPath, 'utf8'));
const expectedCampaigns = new Set(targetGroups.campaigns);

console.log('[STEP1] health check 시작');
console.log(`[STEP1] WORKER_URL=${process.env.WORKER_URL}`);
console.log(`[STEP1] OUTPUT_DIR=${outputDir()}`);

const campaigns = await getCampaigns();
console.log(`[STEP1] 전체 캠페인 ${campaigns.length}개 조회 성공`);

const matched = campaigns
  .map((c) => ({ name: c.name || c.campaignName || c.nccCampaignName, id: c.nccCampaignId || c.id }))
  .filter((c) => c.name && c.name.includes('T010'));

const matchedNames = new Set(matched.map((c) => c.name));
const missing = [...expectedCampaigns].filter((n) => !matchedNames.has(n));
const extra = matched.filter((c) => !expectedCampaigns.has(c.name)).map((c) => c.name);

const report = {
  timestamp: isoNow(),
  worker_url: process.env.WORKER_URL,
  total_campaigns: campaigns.length,
  t010_campaigns_found: matched,
  expected_count: expectedCampaigns.size,
  matched_count: matched.length,
  missing_expected: missing,
  unexpected_t010: extra,
  ok: missing.length === 0,
};

const out = path.join(outputDir(), `00_health_${ts()}.json`);
writeJson(out, report);

if (!report.ok) {
  console.error(`[STEP1] FAIL — 예상 캠페인 누락: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('[STEP1] OK — T010 5개 캠페인 모두 확인');
