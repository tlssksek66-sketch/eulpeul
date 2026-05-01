#!/usr/bin/env node
import { appendFileSync } from 'fs';
import { homedir } from 'os';

const LOG = homedir() + '/.claude/hooks/eventbus.log';
const URL_BASE = process.env.EVENT_BUS_URL || 'https://shokz-event-bus.eupeul.workers.dev';
const TOKEN = process.env.EVENT_BUS_TOKEN || 'shokz-event-bus-2026';

function log(msg) {
  try { appendFileSync(LOG, new Date().toISOString() + ' ' + msg + '\n'); } catch {}
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => raw += c);
process.stdin.on('end', async () => {
  let h = {};
  try { h = raw ? JSON.parse(raw) : {}; } catch { h = { _parse_error: true }; }

  const hookName = h.hook_event_name || 'unknown';
  const tool = h.tool_name || '';
  let kind, status = 'info';
  switch (hookName) {
    case 'PreToolUse':       kind = 'tool.pre.' + (tool || 'unknown'); status = 'start'; break;
    case 'PostToolUse':      kind = 'tool.post.' + (tool || 'unknown');
                              status = (h.tool_response?.is_error || h.tool_response?.error) ? 'error' : 'success'; break;
    case 'UserPromptSubmit': kind = 'user_prompt'; status = 'start'; break;
    case 'Stop':             kind = 'session_stop'; status = 'success'; break;
    case 'SessionStart':     kind = 'session_start'; status = 'start'; break;
    default:                 kind = 'hook.' + hookName;
  }

  let summary = hookName + ' ' + tool;
  const ti = h.tool_input || {};
  if (tool === 'Bash' && ti.command) summary = hookName + ' Bash: ' + String(ti.command).slice(0, 200);
  else if (ti.file_path) summary = hookName + ' ' + tool + ': ' + ti.file_path;
  else if (typeof h.prompt === 'string') summary = 'prompt: ' + h.prompt.slice(0, 200);

  const event = {
    source: 'claude_code',
    kind,
    ref_id: h.session_id || undefined,
    status,
    summary: summary.slice(0, 500),
    payload: { cwd: h.cwd || '', session_id: h.session_id || '', hook: hookName, tool, tool_input: ti }
  };

  log('hook=' + hookName + ' tool=' + tool);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const r = await fetch(URL_BASE + '/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-event-bus-token': TOKEN },
      body: JSON.stringify(event),
      signal: ctrl.signal
    });
    clearTimeout(t);
    log('sent status=' + r.status + ' kind=' + kind);
  } catch (e) {
    log('send_err=' + (e?.message || e));
  }
  process.exit(0);
});

setTimeout(() => { log('timeout'); process.exit(0); }, 5000).unref();
