/**
 * SHOKZ_ClaudeBridge.js
 * Claude Code ↔ 본 챗(Claude) 비동기 메시지 브릿지
 * 작성일: 2026-04-30
 *
 * 함수 4종:
 * 1. bridgeAppend  — 메시지 추가 (Slack 푸시 포함)
 * 2. bridgeRead    — 메시지 조회 (수신자 기준)
 * 3. bridgeClose   — 처리 완료 표시
 * 4. bridgeReadBySession — 세션 단위 조회
 */

const BRIDGE_TAB = 'Claude_Bridge';

function bridgeAppend(from, to, type, topic, body, sessionId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.openById(C.SPREADSHEET_ID);
    const ws = ss.getSheetByName(BRIDGE_TAB);

    if (!ws) {
      throw new Error('Tab not found: ' + BRIDGE_TAB);
    }

    const tz = 'Asia/Seoul';
    const timestamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');

    if (!sessionId) {
      sessionId = 'S' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');
    }

    ws.appendRow([
      timestamp,
      from,
      to,
      type,
      topic || 'general',
      body,
      'pending',
      sessionId
    ]);

    let slackSent = false;
    try {
      if (type === 'error') {
        const msg = '🚨 *Claude Bridge ERROR*\n' +
                    '> from: `' + from + '` → to: `' + to + '`\n' +
                    '> topic: `' + (topic || 'general') + '`\n' +
                    '> session: `' + sessionId + '`\n' +
                    '> timestamp: ' + timestamp + '\n\n' +
                    '```\n' + truncate_(body, 2000) + '\n```';
        sendSlackMessage(C.SLACK_DM, msg);
        slackSent = true;
      } else if (type === 'question' && from === 'claude_code') {
        const msg = '❓ *Claude Code → Claude 질문 도착*\n' +
                    '> topic: `' + (topic || 'general') + '`\n' +
                    '> session: `' + sessionId + '`\n' +
                    '> timestamp: ' + timestamp + '\n\n' +
                    truncate_(body, 1500) + '\n\n' +
                    '_본 챗 열어서 "Claude Bridge 확인해줘" 입력_';
        sendSlackMessage(C.SLACK_DM, msg);
        slackSent = true;
      } else if (type === 'answer' && to === 'claude_code') {
        const msg = '✅ *Claude → Claude Code 답변 도착*\n' +
                    '> topic: `' + (topic || 'general') + '`\n' +
                    '> session: `' + sessionId + '`\n\n' +
                    '_Claude Code에 "Bridge 답변 확인" 입력하면 재개 가능_';
        sendSlackMessage(C.SLACK_DM, msg);
        slackSent = true;
      }
    } catch (slackErr) {
      Logger.log('Slack push failed: ' + slackErr.toString());
    }

    return {
      ok: true,
      timestamp: timestamp,
      sessionId: sessionId,
      slackSent: slackSent
    };
  } finally {
    lock.releaseLock();
  }
}

function bridgeRead(target, limit, status) {
  limit = limit || 10;
  status = status || 'pending';

  const ss = SpreadsheetApp.openById(C.SPREADSHEET_ID);
  const ws = ss.getSheetByName(BRIDGE_TAB);
  if (!ws) return [];

  const lastRow = ws.getLastRow();
  if (lastRow < 2) return [];

  const data = ws.getRange(2, 1, lastRow - 1, 8).getValues();

  const filtered = data
    .map(function(row, idx) {
      return {
        rowIdx: idx + 2,
        timestamp: row[0],
        from: row[1],
        to: row[2],
        type: row[3],
        topic: row[4],
        body: row[5],
        status: row[6],
        sessionId: row[7]
      };
    })
    .filter(function(r) {
      return r.to === target && r.status === status;
    });

  filtered.sort(function(a, b) {
    if (a.timestamp > b.timestamp) return -1;
    if (a.timestamp < b.timestamp) return 1;
    return 0;
  });

  return filtered.slice(0, limit);
}

function bridgeClose(timestamp) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.openById(C.SPREADSHEET_ID);
    const ws = ss.getSheetByName(BRIDGE_TAB);
    if (!ws) return { ok: false, found: false };

    const lastRow = ws.getLastRow();
    if (lastRow < 2) return { ok: false, found: false };

    const data = ws.getRange(2, 1, lastRow - 1, 8).getValues();

    let found = false;
    for (let i = 0; i < data.length; i++) {
      const ts = data[i][0];
      const tsStr = (ts instanceof Date)
        ? Utilities.formatDate(ts, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')
        : String(ts);

      if (tsStr === timestamp) {
        ws.getRange(i + 2, 7).setValue('closed');
        found = true;
        break;
      }
    }

    return { ok: found, found: found };
  } finally {
    lock.releaseLock();
  }
}

function bridgeReadBySession(sessionId) {
  const ss = SpreadsheetApp.openById(C.SPREADSHEET_ID);
  const ws = ss.getSheetByName(BRIDGE_TAB);
  if (!ws) return [];

  const lastRow = ws.getLastRow();
  if (lastRow < 2) return [];

  const data = ws.getRange(2, 1, lastRow - 1, 8).getValues();

  const filtered = data
    .map(function(row) {
      return {
        timestamp: row[0],
        from: row[1],
        to: row[2],
        type: row[3],
        topic: row[4],
        body: row[5],
        status: row[6],
        sessionId: row[7]
      };
    })
    .filter(function(r) {
      return r.sessionId === sessionId;
    });

  filtered.sort(function(a, b) {
    if (a.timestamp < b.timestamp) return -1;
    if (a.timestamp > b.timestamp) return 1;
    return 0;
  });

  return filtered;
}

function truncate_(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '\n... [truncated]';
}
