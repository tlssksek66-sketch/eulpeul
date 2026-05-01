import path from 'node:path';
import fs from 'node:fs';
import { inventoryDir, isoNow, readJson } from './util.mjs';

const TASK_ID = 'T010_NEGKW_REPLACE_2026-04-26';
const VALID_STATUSES = ['pending', 'in_progress', 'registered', 'verified', 'failed'];

export function masterPath() {
  return path.join(inventoryDir(), 't010_inventory_master.json');
}

export function changeLogMdPath() {
  return path.join(inventoryDir(), 't010_change_log.md');
}

export function dumpSummaryPath(timestamp) {
  return path.join(inventoryDir(), `t010_dump_summary_${timestamp}.json`);
}

export function loadOrInitMaster() {
  const p = masterPath();
  if (fs.existsSync(p)) return readJson(p);
  return {
    task_id: TASK_ID,
    created_at: isoNow(),
    last_updated_at: isoNow(),
    register_groups: [],
    change_log: [],
  };
}

export function saveMaster(master) {
  master.last_updated_at = isoNow();
  fs.writeFileSync(masterPath(), JSON.stringify(master, null, 2) + '\n', 'utf8');
  console.log(`[INVENTORY] master 갱신: ${masterPath()}`);
}

export function upsertGroup(master, payload) {
  if (payload.register_status && !VALID_STATUSES.includes(payload.register_status)) {
    throw new Error(`invalid register_status: ${payload.register_status}`);
  }
  const i = master.register_groups.findIndex((g) => g.idx === payload.idx);
  if (i === -1) master.register_groups.push(payload);
  else master.register_groups[i] = { ...master.register_groups[i], ...payload };
}

export function setGroupStatus(master, idx, status, extra = {}) {
  if (!VALID_STATUSES.includes(status)) throw new Error(`invalid status: ${status}`);
  const g = master.register_groups.find((x) => x.idx === idx);
  if (!g) {
    upsertGroup(master, { idx, register_status: status, status_updated_at: isoNow(), ...extra });
  } else {
    g.register_status = status;
    g.status_updated_at = isoNow();
    Object.assign(g, extra);
  }
}

export function appendChangeLog(master, entry) {
  master.change_log.push({ timestamp: isoNow(), ...entry });
}

export function appendChangeLogMd(lines) {
  const p = changeLogMdPath();
  const header = '# T010 제외KW 변경 이력\n\n';
  const block = lines.join('\n') + '\n\n';
  const existing = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : header;
  const next = existing.startsWith(header) ? existing.replace(header, header + block) : header + block + existing;
  fs.writeFileSync(p, next, 'utf8');
  console.log(`[INVENTORY] log 갱신: ${p}`);
}

export function writeDumpSummary(timestamp, dumpReport) {
  const summary = {
    summary_timestamp: isoNow(),
    source_dump_timestamp: dumpReport.dump_timestamp,
    total_groups: dumpReport.total_groups,
    total_existing_neg_kws: dumpReport.total_existing_neg_kws,
    per_group: dumpReport.groups.map((g) => ({
      idx: g.idx,
      campaign: g.campaign,
      group: g.group,
      high_cost: g.high_cost,
      kw_count: g.current_neg_kws.length,
      keywords: g.current_neg_kws.map((k) => ({ keyword: k.keyword, match_type: k.match_type })),
    })),
  };
  const p = dumpSummaryPath(timestamp);
  fs.writeFileSync(p, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  console.log(`[INVENTORY] dump 요약: ${p}`);
  return p;
}

export function printHandoff(step, lines) {
  const banner = '═'.repeat(72);
  console.log('');
  console.log(banner);
  console.log(`📋 STEP ${step} 종료 — 다음 세션 인계 메시지 (raw로 Claude에 공유)`);
  console.log(banner);
  for (const l of lines) console.log(l);
  console.log(banner);
  console.log('');
}

export function printPauseBanner(title, lines) {
  const banner = '⚠'.repeat(36);
  console.log('');
  console.log(banner);
  console.log(`  ${title}`);
  console.log(banner);
  for (const l of lines) console.log(`  ${l}`);
  console.log(banner);
  console.log('');
}
