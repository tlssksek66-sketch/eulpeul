const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization, x-event-bus-token",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...(init.headers ?? {}),
    },
  });

const fail = (status, message, extra) =>
  json({ ok: false, error: message, ...(extra ?? {}) }, { status });

const nowIsoUtc = () => new Date().toISOString();

const toKst = (utcIso) => {
  const ms = new Date(utcIso).getTime() + KST_OFFSET_MS;
  return new Date(ms).toISOString().replace("Z", "+09:00");
};

const isAuthorized = (request, env) => {
  if (!env.EVENT_BUS_TOKEN) return false;
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token");
  const fromHeader = request.headers.get("x-event-bus-token");
  const presented = fromQuery ?? fromHeader;
  return typeof presented === "string" && presented === env.EVENT_BUS_TOKEN;
};

const safeJsonParse = (s) => {
  if (s == null) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

async function handleEvent(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid json body");
  }
  if (!body || typeof body !== "object") {
    return fail(400, "body must be a json object");
  }

  const source = String(body.source ?? "").trim();
  const kind = String(body.kind ?? "").trim();
  const status = String(body.status ?? "").trim();
  if (!source || !kind || !status) {
    return fail(400, "source, kind, status are required");
  }

  const summary = body.summary == null ? null : String(body.summary);
  const payload =
    body.payload == null
      ? null
      : typeof body.payload === "string"
        ? body.payload
        : JSON.stringify(body.payload);

  const ts = nowIsoUtc();
  const ts_kst = toKst(ts);

  const result = await env.DB.prepare(
    `INSERT INTO events (ts, ts_kst, source, kind, status, summary, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(ts, ts_kst, source, kind, status, summary, payload)
    .run();

  const id = result?.meta?.last_row_id ?? null;
  return json({ ok: true, id, ts, ts_kst });
}

async function handleEvents(request, env) {
  const url = new URL(request.url);

  const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(
    Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1),
    500,
  );

  const filters = [];
  const binds = [];
  for (const key of ["source", "kind", "status"]) {
    const v = url.searchParams.get(key);
    if (v) {
      filters.push(`${key} = ?`);
      binds.push(v);
    }
  }
  const since = url.searchParams.get("since");
  if (since) {
    filters.push("ts >= ?");
    binds.push(since);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const sql = `SELECT id, ts, ts_kst, source, kind, status, summary, payload
               FROM events
               ${where}
               ORDER BY ts DESC, id DESC
               LIMIT ?`;
  binds.push(limit);

  const { results } = await env.DB.prepare(sql)
    .bind(...binds)
    .all();

  const events = (results ?? []).map((row) => ({
    ...row,
    payload: safeJsonParse(row.payload),
  }));

  return json({ ok: true, count: events.length, events });
}

async function handleStats(_request, env) {
  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM events`,
  ).first();
  const total = totalRow?.n ?? 0;

  const bySourceStatus = await env.DB.prepare(
    `SELECT source, status, COUNT(*) AS n
     FROM events
     GROUP BY source, status
     ORDER BY n DESC`,
  ).all();

  const byKind = await env.DB.prepare(
    `SELECT kind, COUNT(*) AS n
     FROM events
     GROUP BY kind
     ORDER BY n DESC
     LIMIT 20`,
  ).all();

  const last = await env.DB.prepare(
    `SELECT id, ts, ts_kst, source, kind, status
     FROM events
     ORDER BY ts DESC, id DESC
     LIMIT 1`,
  ).first();

  return json({
    ok: true,
    total,
    by_source_status: bySourceStatus.results ?? [],
    by_kind: byKind.results ?? [],
    last: last ?? null,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, "access-control-max-age": "86400" },
      });
    }

    if (pathname === "/health" && method === "GET") {
      return json({ ok: true, ts: nowIsoUtc() });
    }

    if (!isAuthorized(request, env)) {
      return fail(401, "unauthorized");
    }

    try {
      if (pathname === "/event" && method === "POST") {
        return await handleEvent(request, env);
      }
      if (pathname === "/events" && method === "GET") {
        return await handleEvents(request, env);
      }
      if (pathname === "/stats" && method === "GET") {
        return await handleStats(request, env);
      }
    } catch (err) {
      return fail(500, "internal error", { detail: String(err?.message ?? err) });
    }

    return fail(404, "not found");
  },
};
