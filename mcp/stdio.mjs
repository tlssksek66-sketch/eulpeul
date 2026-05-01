#!/usr/bin/env node
/**
 * MCP stdio 서버 — 로컬 Claude Desktop / Claude Code 등록용
 *
 * 사용:
 *   1. .env 또는 셸에 VOYAGE_API_KEY 설정
 *   2. Claude Desktop config (claude_desktop_config.json):
 *      {
 *        "mcpServers": {
 *          "shokz-kb": {
 *            "command": "node",
 *            "args": ["/absolute/path/to/eulpeul/mcp/stdio.mjs"],
 *            "env": { "VOYAGE_API_KEY": "..." }
 *          }
 *        }
 *      }
 *
 * KB: 로컬 repo 의 assets/data/*.json 파일 직접 read.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, findTool } from './tools.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA = path.join(REPO_ROOT, 'assets/data');

function loadJson(p, fb) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; }
}

function loadKB() {
    return {
        insights: loadJson(path.join(DATA, 'insights.json'), { byUrl: {} }),
        roadmap: loadJson(path.join(DATA, 'roadmap.json'), {}),
        embeddings: loadJson(path.join(DATA, 'embeddings.json'), { byUrl: {} }),
        neighbors: loadJson(path.join(DATA, 'neighbors.json'), { byUrl: {} })
    };
}

const server = new Server(
    { name: 'shokz-kb', version: '0.1.0' },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const tool = findTool(name);
    if (!tool) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'unknown tool', name }) }], isError: true };
    }
    try {
        const kb = loadKB(); // 매 호출마다 fresh — 로컬 파일이라 부담 없음
        const env = { voyageApiKey: process.env.VOYAGE_API_KEY };
        const result = await tool.handler(kb, args || {}, env);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: err.message, tool: name }) }],
            isError: true
        };
    }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[shokz-kb mcp] stdio server ready.');
