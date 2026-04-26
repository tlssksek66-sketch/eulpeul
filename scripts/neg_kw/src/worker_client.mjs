import { requireEnv, sleep } from './util.mjs';

const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000];

export const WRAPPER_KEYS = [
  'data', 'target', 'targets', 'result', 'results',
  'body', 'payload', 'response', 'item', 'items',
];
const PICK_MAX_DEPTH = 4;

export function isSuccessBody(body) {
  if (body == null || typeof body !== 'object') return true;
  if (Array.isArray(body)) return true;
  if (typeof body.status === 'string') {
    const s = body.status.toLowerCase();
    return ['ok', 'success', 'succeeded', 'paused', 'enabled', 'live'].includes(s);
  }
  if (typeof body.success === 'boolean') return body.success;
  if (typeof body.error === 'string' && body.error.length > 0) return false;
  return true;
}

export async function callWorker(method, pathAndQuery, { body, retry = true } = {}) {
  const base = requireEnv('WORKER_URL').replace(/\/$/, '');
  const token = requireEnv('WORKER_TOKEN');
  const url = `${base}${pathAndQuery.startsWith('/') ? '' : '/'}${pathAndQuery}`;

  const init = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const attempts = retry ? RETRY_DELAYS_MS.length + 1 : 1;
  let lastErr;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let parsed;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

      if (res.status === 403 && /allowlist/i.test(text)) {
        const e = new Error(`Worker host allowlist 거부 (${res.status}). 본 머신의 egress IP/Host를 Worker allowlist에 추가하세요.`);
        e.fatal = true;
        throw e;
      }

      if (res.status >= 500 || res.status === 429) {
        throw new Error(`Worker ${res.status}: ${text.slice(0, 200)}`);
      }

      if (res.status >= 400) {
        return { ok: false, http: res.status, body: parsed, raw: text };
      }

      if (!isSuccessBody(parsed)) {
        return { ok: false, http: res.status, body: parsed, raw: text, reason: 'wrapper_status_failure' };
      }

      return { ok: true, http: res.status, body: parsed };
    } catch (err) {
      lastErr = err;
      if (err.fatal) throw err;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined && attempt < attempts - 1) {
        console.warn(`[RETRY ${attempt + 1}/${RETRY_DELAYS_MS.length}] ${method} ${pathAndQuery} → ${err.message} (wait ${delay}ms)`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export function pickList(body, ...listKeys) {
  return pickListDeep(body, listKeys, 0) ?? [];
}

function pickListDeep(node, listKeys, depth) {
  if (node == null || depth > PICK_MAX_DEPTH) return undefined;
  if (Array.isArray(node)) return node;
  if (typeof node !== 'object') return undefined;
  for (const k of listKeys) {
    if (Array.isArray(node[k])) return node[k];
  }
  for (const wk of WRAPPER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(node, wk) && node[wk] !== undefined && node[wk] !== null) {
      const v = pickListDeep(node[wk], listKeys, depth + 1);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

export async function getCampaigns() {
  const r = await callWorker('GET', '/campaigns');
  if (!r.ok) throw new Error(`/campaigns failed: ${JSON.stringify(r).slice(0, 300)}`);
  return pickList(r.body, 'campaigns');
}

export async function getAdGroups(nccCampaignId) {
  const r = await callWorker('GET', `/adgroups?nccCampaignId=${encodeURIComponent(nccCampaignId)}`);
  if (!r.ok) throw new Error(`/adgroups ${nccCampaignId} failed`);
  return pickList(r.body, 'adgroups', 'adGroups');
}

export async function getTargets(ownerId) {
  const r = await callWorker('GET', `/targets?ownerId=${encodeURIComponent(ownerId)}`);
  if (!r.ok) throw new Error(`/targets ${ownerId} failed`);
  return pickList(r.body, 'targets');
}

export function pickField(body, ...names) {
  return pickFieldDeep(body, names, 0);
}

function pickFieldDeep(node, names, depth) {
  if (node == null || depth > PICK_MAX_DEPTH) return undefined;
  if (Array.isArray(node)) {
    for (const el of node) {
      const v = pickFieldDeep(el, names, depth + 1);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  if (typeof node !== 'object') return undefined;
  for (const n of names) {
    if (!Object.prototype.hasOwnProperty.call(node, n)) continue;
    const v = node[n];
    if (v === undefined || v === null) continue;
    if (WRAPPER_KEYS.includes(n) && typeof v === 'object' && !Array.isArray(v)) continue;
    return v;
  }
  for (const wk of WRAPPER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(node, wk) && node[wk] !== undefined && node[wk] !== null) {
      const v = pickFieldDeep(node[wk], names, depth + 1);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

export async function postTarget({ ownerId, keyword, match_type = 'exact' }) {
  const requestBody = { ownerId, type: 'NEGATIVE_KEYWORD', keyword, match_type };
  const r = await callWorker('POST', '/targets', { body: requestBody });
  if (!r.ok) return r;

  const echoedKeyword = pickField(r.body, 'keyword', 'target');
  const echoedOwner = pickField(r.body, 'ownerId', 'nccAdgroupId');
  const echoedTargetId = pickField(r.body, 'nccTargetId', 'id', 'targetId');

  const mismatches = [];
  if (echoedKeyword !== undefined && echoedKeyword !== keyword) {
    mismatches.push(`keyword: sent="${keyword}" got="${echoedKeyword}"`);
  }
  if (echoedOwner !== undefined && echoedOwner !== ownerId) {
    mismatches.push(`ownerId: sent="${ownerId}" got="${echoedOwner}"`);
  }
  if (mismatches.length) {
    return { ...r, ok: false, reason: 'request_response_mismatch', mismatches };
  }
  if (echoedTargetId === undefined && echoedKeyword === undefined) {
    return { ...r, ok: false, reason: 'response_lacks_identifiers', requested: requestBody };
  }
  return { ...r, verified_keyword: echoedKeyword ?? keyword, verified_target_id: echoedTargetId };
}

export async function deleteTarget(nccTargetId) {
  const r = await callWorker('DELETE', `/targets/${encodeURIComponent(nccTargetId)}`);
  if (!r.ok) return r;
  const echoedId = pickField(r.body, 'nccTargetId', 'id', 'targetId', 'deletedId');
  if (echoedId !== undefined && echoedId !== nccTargetId) {
    return { ...r, ok: false, reason: 'delete_id_mismatch', sent: nccTargetId, got: echoedId };
  }
  return r;
}
