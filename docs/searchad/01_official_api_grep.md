# SHOKZ — NAVER SearchAd 공식 API grep (D 트랙 Step 1)

생성일: 2026-05-10
조사 환경: Linux VM (/home/user/eulpeul), `claude/naver-searchad-api-integration-L82Lk`
원래 저장 요청 경로: `/c/Users/dudvu/SHOKZ_official_API_grep.md` (이 세션에서는 `/c/...` 마운트 불가 → `/tmp/`로 우회)

---

## 1. API Base / Auth

- **Base URL**: `https://api.searchad.naver.com`
- **인증 헤더 4종**:
  - `X-API-KEY`        : 발급받은 access license
  - `X-Customer`       : customerId (광고주 식별자, 일부 SDK는 `X-Customer-Id`)
  - `X-Timestamp`      : Unix epoch **밀리초** (예: `1715337600000`)
  - `X-Signature`      : HMAC-SHA256 서명 (아래 알고리즘)

### 1.1 Signature 알고리즘 (정설)

```
signing_string = `${X-Timestamp}.${HTTP_METHOD_UPPERCASE}.${URI_PATH_NO_QUERY}`
                  // 예) "1715337600000.GET./ncc/adgroups/grp-a001-01-...."
key            = secret_key  // ⚠️ 일부 구현은 base64 decode, 다른 구현은 raw 문자열 사용 — 워커 현행 구현 확인 필요
mac            = HMAC_SHA256(key, signing_string)
X-Signature    = base64( mac )   // 다수 SDK 사용
                  // ⚠️ 일부 Python 샘플은 hexdigest를 반환 — 이는 잘못된 구현으로 추정 (Invalid Signature 빈발)
```

#### 함정
- `URI_PATH`에 **쿼리스트링 포함 금지**. `?nccAdgroupId=...`는 빼고 path만 서명.
- `X-Timestamp`는 **밀리초**. 초 단위로 보내면 `Invalid Timestamp`.
- `X-Signature`는 **base64**가 정설. hex로 보내면 `Invalid Signature` (Issue #1029 케이스).
- `secret_key` base64 디코드 여부는 **공식 Java SDK의 RestClient 구현체 확인 필요**. (워커 sign 함수와 일치해야 함)

---

## 2. nccCriterion API 지원 영역

### 2.1 공식 Java sample 기준 endpoint 인덱스 (`AdManagementSample.java`)

| Method | Path | 비고 |
|---|---|---|
| GET | `/ncc/campaigns` | |
| GET | `/ncc/channels` | |
| GET | `/ncc/adgroups?nccCampaignId={...}` | |
| GET | `/ncc/ads?nccAdgroupId={...}` | |
| GET | `/ncc/ads/{adId}` | |
| GET | `/ncc/keywords?nccAdgroupId={...}` | |
| GET | `/ncc/ad-extensions?ownerId={...}` | |
| **GET** | **`/ncc/adgroups/{adgroupId}/targets`** | ⭐ **타겟팅 조회 — sample 내 유일한 타겟팅 엔드포인트** |
| POST | `/ncc/channels` | |
| POST | `/ncc/adgroups` | |
| POST | `/ncc/ads` | |
| POST | `/ncc/keywords?nccAdgroupId={...}` | |
| POST | `/ncc/ad-extensions` | |
| PUT | `/ncc/campaigns/{campaignId}?fields={...}` | |
| PUT | `/ncc/adgroups/{adgroupId}?fields={...}` | |
| PUT | `/ncc/ads/{adId}?fields={...}` | |
| PUT | `/ncc/ads?ids={...}&targetAdgroupId={...}&userLock={...}` | bulk |
| PUT | `/ncc/keywords?field={...}` | |
| PUT | `/ncc/keywords/{keywordId}` | |
| PUT | `/ncc/ad-extensions/{adExtensionId}?fields={...}` | |
| DELETE | `/ncc/ads/{adId}` | |
| DELETE | `/ncc/ad-extensions/{adExtensionId}` | |

### 2.2 사용자가 호출 의도한 `/ncc/criterion?nccAdgroupId={AG}&type=AG` 검증

- **공식 Java sample(AdManagementSample.java)에는 `/ncc/criterion` endpoint가 없다.**
- 공식 docs(naver.github.io/searchad-apidoc) WebFetch는 **403** (UA 차단), GitHub raw로 wiki/docs 직접 검증 필요.
- 가설 3가지:
  1. **`/ncc/criterion`은 신규 타겟팅 API** — 공식 docs에는 있는데 Java sample이 미반영. ads.naver.com 신플랫폼용으로 추가됐을 가능성. (2022-07-21 공지에 "타게팅 관리방식 변경" 명시)
  2. **사용자 Worker가 `/ncc/adgroups/{id}/targets` 응답을 `/ncc/criterion` 라우트로 래핑** 했을 가능성. → Worker 코드 확인 필요.
  3. **신플랫폼 다른 호스트** (ads.naver.com 또는 그 백엔드 API) 의 별도 endpoint일 가능성. base host 자체가 다를 수 있음.

→ Step 2 (워커 코드)에서 어느 가설이 맞는지 90%는 판가름.

### 2.3 bidWeight / AGE / DEMOGRAPHIC / REGION / GENDER

- Java sample 코드에는 **이 키워드 0건**.
- 공식 docs / model 클래스 (Adgroup.java, Target.java 등)는 별도 추출 필요.
- 2022-07-21 공지 — `reportTp: CRITERION` 보고서 추가됨 (stat API). 이는 **타겟팅이 criterion 단위로 조회/관리됨을 강하게 시사**. 즉 "criterion = adgroup에 붙는 타겟팅 한 줄(성별/연령/지역/디바이스 등)" 모델일 가능성.

### 2.4 알려진 변경/공지

- 2022-07-21: 타게팅 관리방식 변경 → 신규 대용량 보고서 (`reportTp: CRITERION`) 추가
- 2021-03-17: Release Note (별도 검토 미완)

---

## 3. 다음 단계 게이트 (사용자 결정 필요)

이 Linux VM에서는:

- ❌ Worker 코드 (`/c/Users/dudvu/shokz-apps-script`) 직접 접근 불가
- ❌ `/c/...` 경로에 산출물 저장 불가
- ❌ `naver.github.io/searchad-apidoc` WebFetch (403)
- ✅ `github.com/naver/searchad-apidoc/...` raw 파일 fetch 가능
- ✅ `https://api.searchad.naver.com` 직접 호출 가능 (자격증명만 있으면)

따라서 Step 2~4 진행 전 사용자 입력 필요:
1. Worker 코드 위치 — GitHub URL or 인라인 paste
2. 테스트 자격증명 (X-API-KEY, X-Customer, secret_key) — 또는 Worker 내부 secret을 통한 프록시 호출만 사용
3. 테스트용 AG (광고그룹 ID)

---

## 4. 출처

- Search AD API doc index: http://naver.github.io/searchad-apidoc/
- naver/searchad-apidoc repo: https://github.com/naver/searchad-apidoc
- Java sample (AdManagement): https://github.com/naver/searchad-apidoc/blob/master/java-sample/src/main/java/com/naver/searchad/api/sample/AdManagementSample.java
- 타게팅 관리방식 변경 공지: http://naver.github.io/searchad-apidoc/notice/2022/07/21/notice1/
- HMAC 검증 사례 (Issue #1029): https://github.com/naver/searchad-apidoc/issues/1029
- 3rd-party Ruby gem 참고: https://github.com/forward3d/naver-searchad-api
