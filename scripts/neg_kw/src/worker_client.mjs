import { requireEnv, sleep } from './util.mjs';

const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000];

function isSuccessBody(body) {
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

export async function getCampaigns() {
  const r = await callWorker('GET', '/campaigns');
  if (!r.ok) throw new Error(`/campaigns failed: ${JSON.stringify(r).slice(0, 300)}`);
  const list = Array.isArray(r.body) ? r.body : (r.body?.data || r.body?.campaigns || []);
  return list;
}

export async function getAdGroups(nccCampaignId) {
  const r = await callWorker('GET', `/adgroups?nccCampaignId=${encodeURIComponent(nccCampaignId)}`);
  if (!r.ok) throw new Error(`/adgroups ${nccCampaignId} failed`);
  return Array.isArray(r.body) ? r.body : (r.body?.data || r.body?.adgroups || []);
}

export async function getTargets(ownerId) {
  const r = await callWorker('GET', `/targets?ownerId=${encodeURIComponent(ownerId)}`);
  if (!r.ok) throw new Error(`/targets ${ownerId} failed`);
  return Array.isArray(r.body) ? r.body : (r.body?.data || r.body?.targets || []);
}

export async function postTarget({ ownerId, keyword, match_type = 'exact' }) {
  return callWorker('POST', '/targets', {
    body: { ownerId, type: 'NEGATIVE_KEYWORD', keyword, match_type },
  });
}

export async function deleteTarget(nccTargetId) {
  return callWorker('DELETE', `/targets/${encodeURIComponent(nccTargetId)}`);
}
