/**
 * SHOKZ_WebApp.doPost.patch.js
 * 기존 SHOKZ_WebApp.js 의 doPost(e) 함수 내부, action 분기 영역에
 * 아래 4개 블록을 그대로 추가하면 된다.
 *
 * 위치: 다른 `if (action === '...') { ... return ... }` 블록들 옆.
 * 전제: body = JSON.parse(e.postData.contents) 파싱이 위에서 이미 됐다고 가정.
 *
 * 작성일: 2026-04-30
 */

if (action === 'bridge_append') {
  const result = bridgeAppend(
    body.from,
    body.to,
    body.type,
    body.topic,
    body.body,
    body.session_id || null
  );
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

if (action === 'bridge_read') {
  const result = bridgeRead(
    body.target,
    body.limit || 10,
    body.status || 'pending'
  );
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, messages: result }))
    .setMimeType(ContentService.MimeType.JSON);
}

if (action === 'bridge_close') {
  const result = bridgeClose(body.timestamp);
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

if (action === 'bridge_session') {
  const result = bridgeReadBySession(body.session_id);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, messages: result }))
    .setMimeType(ContentService.MimeType.JSON);
}
