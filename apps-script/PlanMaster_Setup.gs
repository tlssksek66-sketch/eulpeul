/**
 * PlanMaster_Setup.gs
 * ────────────────────────────────────────────────────────
 * 플랜 마스터 Google Sheets 7개 시트 자동 생성
 * 대상 Spreadsheet: 1dh136rPwOINlQbZHz09B93aCm3_2vFkernXIhtUa_l0
 * (기존 10시트 Looker DataHub 유지, 옆에 추가)
 * ────────────────────────────────────────────────────────
 */

var SPREADSHEET_ID = '1dh136rPwOINlQbZHz09B93aCm3_2vFkernXIhtUa_l0';

/**
 * 메인 실행: 시트 7개 일괄 생성
 */
function setupPlanMasterSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  _createCampaignSettingsSheet(ss);
  _createPhaseScheduleSheet(ss);
  _createCreativeRollingSheet(ss);
  _createKPISheet(ss);
  _createChangeLogSheet(ss);
  _createEngineSettingsSheet(ss);
  _createMonthlyBudgetSummarySheet(ss);

  SpreadsheetApp.flush();
  Logger.log('PlanMaster 시트 7개 생성 완료');
}


// ──────────────────────────────────────────────
// 시트 1: 캠페인 설정
// ──────────────────────────────────────────────
function _createCampaignSettingsSheet(ss) {
  var sheet = _getOrCreateSheet(ss, '캠페인 설정');
  var headers = [
    '캠페인ID', '캠페인명', '구분', '유형', '일예산(₩,VAT포함)',
    '월예산(₩,VAT포함)', '입찰MIN(₩)', '입찰MAX(₩)', 'ROAS목표(%)',
    '소진율목표(%)', '상태', '비고'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  var data = [
    ['(공유예산ID)', 'SA 쇼핑검색 기존SKU', 'SA', '전환', 1540000, '=E2*30', 2000, 3000, 1200, 64, 'ON', '공유예산₩240만(VAT포함) 상한, 소진율64%'],
    ['(SP05)', 'SA #SP05 쇼핑검색 OpenFit Pro T010', 'SA', '전환', 681796, '=E3*30', 2000, 3000, 227, '', 'ON', '5캠페인, 4/1 ON'],
    ['(계약형)', 'SA MO 신제품검색 4그룹×3주', 'SA', '인지+전환', 585200, '=E4*18', '', '', 11, '', '예정', '04.13~30, 96KW'],
    ['(ADV ID)', 'GFA ADVoost 쇼핑', 'GFA', '전환', 1600000, '=E5*30', '', '', 845, '', 'ON', '예열>버스트>감액'],
    ['(카탈 ID)', 'GFA 카탈로그', 'GFA', '전환', 600000, '=E6*30', '', '', 456, '', 'ON', '리타게팅'],
    ['(ADV소재 ID)', 'GFA 전환_ADV소재', 'GFA', '전환', 66667, '=E7*30', '', '', 411, '', 'ON', 'CAP ₩6.7만(VAT포함)'],
    ['-', 'GFA 전환_오픈런프로2', 'GFA', '전환', 0, 0, '', '', '', '', 'OFF', '신제품 대체'],
    ['(T010트래픽)', 'GFA 트래픽_T010', 'GFA', '브랜딩', 360000, '=E9*7', '', '', 718, '', 'ON→OFF', '04.01~07만, 이후 OFF'],
    ['(T010전환)', 'GFA 전환_T010', 'GFA', '전환', 166667, '=E10*30', '', '', 308, '', 'ON', '학습→안정'],
    ['(쇼핑프로모션ID)', 'GFA 쇼핑프로모션_T010', 'GFA', '전환', 100000, '=E11*30', '', '', 738, '', 'ON', '예열→라이브→상시'],
    ['(라이브ID)', 'GFA 전환_라이브', 'GFA', '전환', 500000, '=E12*4', '', '', 3525, '', '예정', '04.17~20 4일만'],
    ['-', 'GFA ADVoost CBT', 'GFA', '전환', 0, 0, '', '', '', '', 'OFF', '예산 절감'],
    ['(NOSP)', 'NOSP (무상)', 'NPAY', '보장형', '', 10000000, '', '', '', '', '예정', '04.13~30, 유상 미포함']
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);

  // 서식
  sheet.getRange(2, 5, data.length, 2).setNumberFormat('#,##0');
  sheet.getRange(2, 7, data.length, 2).setNumberFormat('#,##0');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  // 데이터 검증: 상태 드롭다운
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['ON', 'OFF', '보호', '예정', 'ON→OFF'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 11, 50, 1).setDataValidation(statusRule);

  Logger.log('시트 생성 완료: 캠페인 설정');
}


// ──────────────────────────────────────────────
// 시트 2: Phase 스케줄
// ──────────────────────────────────────────────
function _createPhaseScheduleSheet(ss) {
  var sheet = _getOrCreateSheet(ss, 'Phase 스케줄');
  var headers = [
    'Phase', '시작일', '종료일', '일수',
    'SA일예산(₩,VAT포함)', 'GFA일예산(₩,VAT포함)',
    'ON캠페인', 'OFF캠페인', '소재Phase', 'ADVoost패턴', '비고'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  var data = [
    ['P0 예열', '2025-03-27', '2025-03-30', 4, '3월예산', '트래픽₩36만+쇼핑프로모션₩10만', '트래픽_T010, 쇼핑프로모션_T010', 'SP05 OFF대기', '알림받기', '3월예산', '검수+에셋'],
    ['P0-D D-DAY', '2025-03-31', '2025-03-31', 1, '₩350만(VAT포함)', '₩380만(VAT포함)', '전캠페인ON', '오픈런프로2OFF, CBTOFF', 'PhaseA→B→C', '3월MAX', '핫it슈19:00~20:30'],
    ['P1 론칭', '2025-04-01', '2025-04-07', 7, 1540000, 'ADV₩160+카탈₩60+트래픽₩36+전환₩17+쇼핑프로모션₩10', '전체유지', '-', 'PhaseD상시', '복원', '4/7트래픽OFF'],
    ['P2 안정', '2025-04-08', '2025-04-12', 5, 1540000, 'ADV₩160+카탈₩60+전환₩17+쇼핑프로모션₩10', '유지', '트래픽OFF', 'PhaseD A/B', '정상', '학습완료목표'],
    ['P2-1 검색', '2025-04-13', '2025-04-16', 4, '₩154만+검색₩59만(VAT포함)', '+NOSP ON', 'MO신제품검색ON, NOSPON', '-', '+신제품검색소재', '정상', 'PA4/15체크'],
    ['P3 예열②', '2025-04-17', '2025-04-19', 3, '₩154만+검색₩59만(VAT포함)', '+라이브₩50만(VAT포함)', '전환_라이브ON, SPB동영상ON', '-', '라이브예열', '예열증액', 'D-3'],
    ['P3-D 라이브②', '2025-04-20', '2025-04-20', 1, '₩154만+검색₩59만(VAT포함)', 'ADV MAX', '유지(변경금지)', '-', 'PhaseB→C', '버스트MAX', '4/20라이브'],
    ['P4 후반', '2025-04-21', '2025-04-30', 10, '₩154만+검색₩59만(VAT포함)', '상시수준', '유지', '전환_라이브OFF, SPB동영상OFF', 'PhaseD상시', '감액→정상', '이벤트종료대비']
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);

  sheet.getRange(2, 2, data.length, 2).setNumberFormat('yyyy-mm-dd');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  Logger.log('시트 생성 완료: Phase 스케줄');
}


// ──────────────────────────────────────────────
// 시트 3: 소재 롤링 스케줄
// ──────────────────────────────────────────────
function _createCreativeRollingSheet(ss) {
  var sheet = _getOrCreateSheet(ss, '소재 롤링 스케줄');
  var headers = [
    '기간', 'Phase', '쇼핑프로모션 소재', 'GFA전환+트래픽+ADV',
    'ADV카피', 'ADV랜딩', 'SA확장소재', 'SPB동영상', '배지'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  var data = [
    ['03.27~03.30', 'P0 예열', '알림받기(검수중)', '기존소재유지', '3월카피', '3월랜딩', '기존', '-', '-'],
    ['03.31', 'P0-D D-DAY', 'PhaseA→B→C교체', '신소재투입', 'T010론칭카피', 'T010LP', 'T010확장소재추가', '-', '핫it슈배지'],
    ['04.01~04.07', 'P1 론칭', 'PhaseD상시', '트래픽+전환병행', '론칭카피', 'T010LP', 'T010+기존병행', '-', '신제품배지'],
    ['04.08~04.12', 'P2 안정', 'PhaseD A/B', '전환집중', 'A/B테스트', 'T010LP', '성과기반최적화', '-', '-'],
    ['04.13~04.16', 'P2-1 검색', '+신제품검색소재', '+MO검색소재', '검색연동카피', 'T010LP+검색LP', '+검색KW소재', '-', '검색배지'],
    ['04.17~04.19', 'P3 예열②', '라이브예열소재', '+라이브예열', '라이브예고카피', '라이브LP', '라이브KW추가', 'SPB동영상ON', '라이브예고배지'],
    ['04.20', 'P3-D 라이브②', 'PhaseB→C교체', 'ADV MAX', '라이브MAX카피', '라이브LP', '라이브KW집중', 'SPB동영상MAX', '라이브LIVE배지'],
    ['04.21~04.25', 'P4 후반(전)', 'PhaseD상시복귀', '감액정상화', '상시카피', 'T010LP', '상시최적화', 'SPB동영상OFF', '-'],
    ['04.26~04.28', 'P4 후반(중)', '유지', '유지', '유지', '유지', '유지', '-', '-'],
    ['04.29~04.30', 'P4 후반(후)', '마감준비', '예산소진관리', '마감카피', 'T010LP', '마감최적화', '-', '-']
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  Logger.log('시트 생성 완료: 소재 롤링 스케줄');
}


// ──────────────────────────────────────────────
// 시트 4: KPI 목표 vs 실적
// ──────────────────────────────────────────────
function _createKPISheet(ss) {
  var sheet = _getOrCreateSheet(ss, 'KPI 목표 vs 실적');
  var headers = [
    '날짜', 'Phase',
    '목표SA소진(₩,VAT포함)', '목표GFA소진(₩,VAT포함)', '목표전환수',
    '실적SA소진(₩,VAT포함)', '실적GFA소진(₩,VAT포함)', '실적전환수', '실적SA매출(₩)',
    'SA달성률(%)', 'GFA달성률(%)', '전환달성률(%)', '이탈여부(±20%)', '비고'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  // 3/27~4/30 일별 35행 생성
  var startDate = new Date(2025, 2, 27); // 2025-03-27
  var endDate = new Date(2025, 3, 30);   // 2025-04-30
  var rows = [];
  var rowIdx = 2;

  for (var d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    var dateStr = Utilities.formatDate(new Date(d), 'Asia/Seoul', 'yyyy-MM-dd');
    var phase = _getPhaseForDate(new Date(d));

    // F~I열은 엔진이 매일 09:00 자동 기입 (빈칸)
    // J~M열은 수식 자동 계산
    var saAchFormula = '=IF(F' + rowIdx + '="","",F' + rowIdx + '/C' + rowIdx + '*100)';
    var gfaAchFormula = '=IF(G' + rowIdx + '="","",G' + rowIdx + '/D' + rowIdx + '*100)';
    var convAchFormula = '=IF(H' + rowIdx + '="","",H' + rowIdx + '/E' + rowIdx + '*100)';
    var driftFormula = '=IF(OR(J' + rowIdx + '="",K' + rowIdx + '=""),"",IF(OR(ABS(J' + rowIdx + '-100)>20,ABS(K' + rowIdx + '-100)>20),"⚠️이탈","정상"))';

    rows.push([
      dateStr, phase,
      '', '', '',         // 목표 (수동 또는 Phase 기반 자동)
      '', '', '', '',     // 실적 (엔진 자동 기입)
      saAchFormula, gfaAchFormula, convAchFormula, driftFormula, ''
    ]);
    rowIdx++;
  }
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  // 목표 SA/GFA 소진 자동 세팅 (캠페인 설정 시트 참조)
  _fillKPITargets(sheet, rows.length);

  sheet.getRange(2, 3, rows.length, 7).setNumberFormat('#,##0');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  // 조건부 서식: 이탈 시 빨간 배경
  var driftRange = sheet.getRange(2, 13, rows.length, 1);
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('이탈')
    .setBackground('#FFCCCC')
    .setRanges([driftRange])
    .build();
  sheet.setConditionalFormatRules([rule]);

  Logger.log('시트 생성 완료: KPI 목표 vs 실적');
}


function _fillKPITargets(sheet, rowCount) {
  // Phase별 목표 일예산을 KPI 시트에 세팅
  var phaseTargets = {
    'P0 예열':       { sa: 1540000, gfa: 460000 },
    'P0-D D-DAY':    { sa: 3500000, gfa: 3800000 },
    'P1 론칭':       { sa: 1540000, gfa: 2830000 },
    'P2 안정':       { sa: 1540000, gfa: 2470000 },
    'P2-1 검색':     { sa: 2130000, gfa: 2470000 },
    'P3 예열②':      { sa: 2130000, gfa: 2970000 },
    'P3-D 라이브②':  { sa: 2130000, gfa: 2970000 },
    'P4 후반':       { sa: 2130000, gfa: 2470000 }
  };

  for (var i = 0; i < rowCount; i++) {
    var phase = sheet.getRange(i + 2, 2).getValue();
    var target = phaseTargets[phase];
    if (target) {
      sheet.getRange(i + 2, 3).setValue(target.sa);
      sheet.getRange(i + 2, 4).setValue(target.gfa);
    }
  }
}


function _getPhaseForDate(date) {
  var phases = [
    { name: 'P0 예열', start: new Date(2025, 2, 27), end: new Date(2025, 2, 30) },
    { name: 'P0-D D-DAY', start: new Date(2025, 2, 31), end: new Date(2025, 2, 31) },
    { name: 'P1 론칭', start: new Date(2025, 3, 1), end: new Date(2025, 3, 7) },
    { name: 'P2 안정', start: new Date(2025, 3, 8), end: new Date(2025, 3, 12) },
    { name: 'P2-1 검색', start: new Date(2025, 3, 13), end: new Date(2025, 3, 16) },
    { name: 'P3 예열②', start: new Date(2025, 3, 17), end: new Date(2025, 3, 19) },
    { name: 'P3-D 라이브②', start: new Date(2025, 3, 20), end: new Date(2025, 3, 20) },
    { name: 'P4 후반', start: new Date(2025, 3, 21), end: new Date(2025, 3, 30) }
  ];
  for (var i = 0; i < phases.length; i++) {
    if (date >= phases[i].start && date <= phases[i].end) {
      return phases[i].name;
    }
  }
  return '';
}


// ──────────────────────────────────────────────
// 시트 5: 변경 이력
// ──────────────────────────────────────────────
function _createChangeLogSheet(ss) {
  var sheet = _getOrCreateSheet(ss, '변경 이력');
  var headers = [
    '시각', '변경자', '유형', '대상', '변경전', '변경후', '근거', '상태'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  // 상태 드롭다운
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['적용완료', '대기중', '거부됨', '자동실행'], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 8, 500, 1).setDataValidation(statusRule);

  Logger.log('시트 생성 완료: 변경 이력');
}


// ──────────────────────────────────────────────
// 시트 6: 엔진 설정
// ──────────────────────────────────────────────
function _createEngineSettingsSheet(ss) {
  var sheet = _getOrCreateSheet(ss, '엔진 설정');
  var headers = ['설정명', '값', '설명'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  var data = [
    ['사전알림_분', 30, '엔진 변경 전 Slack 예고 시간(분)'],
    ['이탈기준_퍼센트', 20, '플랜 대비 ±N% 벗어나면 이탈 감지'],
    ['자동실행_승인불요', 'TRUE', '30분 내 응답 없으면 자동 실행'],
    ['우선순위1', '파트너직접', '긴급 오버라이드'],
    ['우선순위2', '샥즈요청', '파트너가 플랜 마스터 수정'],
    ['우선순위3', '엔진자동', '성과 기반 자동 조정'],
    ['우선순위4', '스케줄', 'Phase 전환 자동 실행'],
    ['SP00_PROTECTED', 'TRUE', 'SP00 벌크캠페인 엔진 제외'],
    ['SLACK_CHANNEL', 'D0866GYA3M1', 'Slack DM 채널 ID'],
    ['SLACK_USER', 'U0866KJ8UMQ', 'Slack 사용자 ID'],
    ['SA_CUSTOMER_ID', '4244324', '네이버 SA CustomerID'],
    ['WORKER_URL', 'naver-sa-proxy.eupeul.workers.dev', 'Cloudflare Worker URL'],
    ['BID_CHANGE_CAP_PCT', 10, '입찰 단일 변경 상한(±%)'],
    ['BUDGET_CHANGE_CAP_PCT', 15, '예산 단일 변경 상한(±%)'],
    ['BID_GLOBAL_MIN', 100, '입찰 최저(₩, VAT포함)'],
    ['BID_GLOBAL_MAX', 3000, '입찰 최고(₩, VAT포함)']
  ];
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  Logger.log('시트 생성 완료: 엔진 설정');
}


// ──────────────────────────────────────────────
// 시트 7: 월간 예산 요약
// ──────────────────────────────────────────────
function _createMonthlyBudgetSummarySheet(ss) {
  var sheet = _getOrCreateSheet(ss, '월간 예산 요약');
  var headers = [
    '구분', '캠페인명', '월예산(₩,VAT포함)', '누적소진(₩,VAT포함)',
    '잔여(₩)', '소진률(%)', '예상월말소진(₩)', '예상잔여(₩)', '상태'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  // 캠페인 설정 시트 참조 수식 (동적)
  // 이 시트는 매일 09:00 KPI 자동 채움 시 함께 갱신됨
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  Logger.log('시트 생성 완료: 월간 예산 요약');
}


// ──────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────
function _getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) {
    sheet.clear();
    Logger.log('기존 시트 초기화: ' + name);
  } else {
    sheet = ss.insertSheet(name);
    Logger.log('새 시트 생성: ' + name);
  }
  return sheet;
}

function _styleHeader(sheet, colCount) {
  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange.setBackground('#1a73e8');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  headerRange.setWrap(true);
}
