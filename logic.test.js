const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./logic.js');
const record = (bed, wake, done = false) => ({ bed, wake, done });

test('자정, 같은 날, 분 단위 수면 및 잘못된 입력', () => {
  assert.equal(H.sleepMinutes('23:30', '07:15'), 465);
  assert.equal(H.sleepMinutes('01:00', '06:00'), 300);
  assert.equal(H.sleepMinutes('08:00', '08:00'), null);
  assert.equal(H.sleepMinutes('24:00', '07:00'), null);
  assert.equal(H.sleepMinutes('', '07:00'), null);
  assert.equal(H.sleepMinutes(undefined, '07:00'), null);
});
test('월말·연말·윤년의 날짜와 7일 범위', () => {
  assert.equal(H.shiftDay('2026-01-01', -1), '2025-12-31');
  assert.equal(H.shiftDay('2024-03-01', -1), '2024-02-29');
  assert.deepEqual(H.weekDays('2026-11-24'), ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24']);
});
test('추천 경계와 시험·방학 모드', () => {
  assert.equal(H.recommendation(null, []), null);
  assert.equal(H.recommendation(record('01:00', '06:00'), []).minutes, 5);
  assert.equal(H.recommendation(record('00:00', '06:00'), []).minutes, 10);
  assert.equal(H.recommendation(record('23:00', '07:00'), []).minutes, 15);
  assert.equal(H.recommendation(record('23:00', '07:00'), [], 'exam').minutes, 10);
  assert.equal(H.recommendation(record('23:00', '07:00'), [], 'vacation').minutes, 20);
  assert.equal(H.recommendation(record('01:00', '06:00'), [], 'vacation').minutes, 5);
});
test('규칙성은 기록 부족 시 제외하고 자정 전후 편차를 올바르게 계산', () => {
  assert.deepEqual(H.condition(record('23:00', '07:00'), []), { score: 100, regularity: false });
  const prior = [record('23:50', '07:50'), record('23:50', '07:50')];
  const score = H.condition(record('00:10', '08:10'), prior);
  assert.equal(score.regularity, true);
  assert.equal(score.score, 98);
  assert.equal(H.condition(record('23:00', '07:00'), [record('20:00', '04:00'), record('20:00', '04:00')]).score, 80);
});
test('오늘 미완료여도 어제까지 스트릭을 보존하고 중간 공백에서 종료', () => {
  const records = { '2026-11-23': record('23:00', '07:00', true), '2026-11-22': record('23:00', '07:00', true), '2026-11-20': record('23:00', '07:00', true) };
  assert.equal(H.streak(records, '2026-11-24'), 2);
  records['2026-11-24'] = record('23:00', '07:00', true);
  assert.equal(H.streak(records, '2026-11-24'), 3);
  assert.equal(H.streak({}, '2026-11-24'), 0);
});
test('평균에서 미기록 제외, 달성률은 7일 기준, 범위 밖·미래 기록 제외', () => {
  const records = { '2026-11-24': record('23:00', '07:00', true), '2026-11-23': record('00:00', '06:00'), '2026-11-17': record('22:00', '08:00', true), '2026-11-25': record('22:00', '08:00', true) };
  const report = H.report(records, '2026-11-24');
  assert.equal(report.average, 420);
  assert.equal(report.logged, 2);
  assert.equal(report.rate, 14);
  assert.equal(report.completed, 1);
  assert.equal(H.report({}, '2026-11-24').average, null);
});
test('수면별 달성률 비교는 각 그룹에 두 기록 이상 있을 때만 제공', () => {
  const records = { '2026-11-24': record('23:00', '07:00', true), '2026-11-23': record('23:00', '07:00', true), '2026-11-22': record('01:00', '06:00'), '2026-11-21': record('01:00', '06:00', true) };
  assert.match(H.report(records, '2026-11-24').relationship, /100%.*50%/);
  delete records['2026-11-21'];
  assert.match(H.report(records, '2026-11-24').relationship, /각각 2일 이상/);
});
