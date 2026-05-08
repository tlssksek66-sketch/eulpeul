import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    if (m[1].startsWith('#')) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[FATAL] env ${name} not set. Copy .env.example → .env`);
    process.exit(2);
  }
  return v;
}

export function outputDir() {
  const custom = process.env.OUTPUT_DIR;
  const dir = custom && custom.trim() ? path.resolve(custom) : path.join(ROOT, 'output');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function inventoryDir() {
  const dir = path.join(ROOT, 'inventory');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`[WRITE] ${filePath} (${fs.statSync(filePath).size} bytes)`);
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function latestFile(dir, prefix) {
  if (!fs.existsSync(dir)) return null;
  const matches = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).sort();
  return matches.length ? path.join(dir, matches[matches.length - 1]) : null;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
    else positional.push(a);
  }
  return { flags, positional };
}

export async function pLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await fn(items[i], i) };
      } catch (err) {
        results[i] = { ok: false, error: err?.message || String(err) };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
