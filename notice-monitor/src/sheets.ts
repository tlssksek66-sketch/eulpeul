import { Env, NoticeClassified } from './types';

// 서비스 계정 JWT 결 — Cloudflare Worker는 jose 라이브러리 결로 JWT 서명
import { SignJWT, importPKCS8 } from 'jose';

async function getAccessToken(env: Env): Promise<string> {
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const privateKey = await importPKCS8(credentials.private_key, 'RS256');

  const jwt = await new SignJWT({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const { access_token } = await tokenRes.json() as { access_token: string };
  return access_token;
}

export async function appendToSheets(notices: NoticeClassified[], env: Env): Promise<void> {
  if (notices.length === 0) return;

  const token = await getAccessToken(env);
  const range = 'NaverNoticeMonitor!A:K';

  const rows = notices.map(n => [
    n.date,
    n.title,
    n.noticeId,
    n.url,
    n.category,
    n.shokzImpact,
    n.salesValue,
    n.salesCategories.join(', '),
    n.summary,
    n.firstSeen,
    n.classifiedAt
  ]);

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEETS_ID}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    }
  );
}
