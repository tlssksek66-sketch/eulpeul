# apps-script — Claude Bridge 패치 산출물

이 디렉터리는 별도 Google Apps Script 프로젝트(`SHOKZ_*.js`)에 옮겨 적용할
패치 소스만 보관한다. 본 레포(Vite + React)에는 빌드/실행 의존이 없다.

## 파일

- `SHOKZ_ClaudeBridge.js` — GAS 프로젝트에 **신규 파일**로 추가
- `SHOKZ_WebApp.doPost.patch.js` — 기존 `SHOKZ_WebApp.js`의 `doPost(e)`
  내부 action 분기 옆에 4개 블록을 **수동으로 붙여넣기**

## 적용 전 체크리스트 (GAS 프로젝트 측에서 확인)

1. `Code.js`의 전역 `C` 객체에 다음 두 항목이 있는지
   - `SPREADSHEET_ID: '1dh136rPwOINlQbZHz09B93aCm3_2vFkernXIhtUa_l0'`
   - `SLACK_DM: 'D0866GYA3M1'`
2. `sendSlackMessage(channel, text)` 함수가 같은 프로젝트 안에 정의돼 있는지

위 항목이 없으면 푸시 전 보강 필요.

## 적용 후 작업

1. 스프레드시트(`1dh136rPwOINlQbZHz09B93aCm3_2vFkernXIhtUa_l0`)에
   `Claude_Bridge` 탭 신설.
   1행 헤더 8개:
   `timestamp | from | to | type | topic | body | status | session_id`
2. `clasp push` → WebApp **새 버전 배포**
3. 새 배포 URL로 검증 4종 (요청 메시지의 작업 6 그대로)

## 원본 스펙 대비 정상화한 오타 (3건)

원문에 마크다운 자동링크가 코드에 끼어 있어 정상 식별자로 복원했다.
스펙 문서(`Claude_Bridge_구축_v1.md` 등) 원본도 같이 고쳐두면 좋다.

| 위치 | 원문(깨짐) | 수정 |
|---|---|---|
| `bridgeRead` filter | `[r.to](http://r.to) === target` | `r.to === target` |
| `doPost` `bridge_append` | `[body.to](http://body.to)` | `body.to` |
| `doPost` `bridge_read` | `[body.target](http://body.target)` | `body.target` |
