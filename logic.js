/* 브라우저와 Node.js에서 함께 쓰는 계산 함수. 외부 라이브러리 없음. */
(function (root) {
  'use strict';
  const minuteOfDay = time => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  const sleepMinutes = (bed, wake) => {
    const start = minuteOfDay(bed), end = minuteOfDay(wake);
    return Number.isFinite(start + end) && start !== end ? (end - start + 1440) % 1440 : null;
  };
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const shiftDay = (key, amount) => {
    const date = new Date(`${key}T12:00:00`);
    date.setDate(date.getDate() + amount);
    return dayKey(date);
  };
  const weekDays = today => Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const clockDistance = (a, b) => {
    const diff = Math.abs(minuteOfDay(a) - minuteOfDay(b));
    return Math.min(diff, 1440 - diff);
  };
  function condition(record, previous) {
    const duration = sleepMinutes(record.bed, record.wake);
    if (duration === null) return null;
    const base = Math.min(duration / 480, 1);
    if (previous.length < 2) return { score: Math.round(base * 100), regularity: false };
    const deviation = previous.reduce((sum, r) => sum + (clockDistance(r.bed, record.bed) + clockDistance(r.wake, record.wake)) / 2, 0) / previous.length;
    return { score: Math.round(base * 80 + Math.max(0, 20 * (1 - deviation / 180))), regularity: true };
  }
  function recommendation(record, previous, mode = 'normal') {
    if (!record) return null;
    const result = condition(record, previous);
    if (!result) return null;
    const duration = sleepMinutes(record.bed, record.wake);
    let plan;
    if (duration < 360 || result.score < 60) plan = { type: '가벼운 스트레칭', minutes: 5, detail: '목, 어깨, 종아리를 천천히 풀어주세요. 피곤하면 쉬어도 좋아요.' };
    else if (duration < 480 || result.score < 80) plan = { type: '편안하게 걷기', minutes: 10, detail: '가까운 곳을 편안한 속도로 걸어보세요.' };
    else plan = { type: '가벼운 맨몸운동', minutes: 15, detail: '가볍게 몸을 풀고, 제자리 걷기와 벽 밀기를 해보세요.' };
    if (mode === 'exam') plan.minutes = Math.min(plan.minutes, 10);
    if (mode === 'vacation' && duration >= 480 && result.score >= 80) plan.minutes += 5;
    return { ...plan, ...result };
  }
  function streak(records, today) {
    let cursor = records[today]?.done ? today : shiftDay(today, -1), count = 0;
    while (records[cursor]?.done) { count++; cursor = shiftDay(cursor, -1); }
    return count;
  }
  function report(records, today) {
    const days = weekDays(today);
    const logged = days.filter(day => records[day] && sleepMinutes(records[day].bed, records[day].wake) !== null);
    const average = logged.length ? logged.reduce((sum, day) => sum + sleepMinutes(records[day].bed, records[day].wake), 0) / logged.length : null;
    const completed = days.filter(day => records[day]?.done).length;
    const rested = logged.filter(day => sleepMinutes(records[day].bed, records[day].wake) >= 480);
    const short = logged.filter(day => sleepMinutes(records[day].bed, records[day].wake) < 480);
    const rate = group => Math.round(group.filter(day => records[day].done).length / group.length * 100);
    return { days, logged: logged.length, average, completed, rate: Math.round(completed / 7 * 100), relationship: rested.length >= 2 && short.length >= 2 ? `8시간 이상 잔 날의 달성률 ${rate(rested)}%, 8시간 미만인 날 ${rate(short)}%. 개인 기록의 비교이며 원인과 결과를 뜻하지 않아요.` : '수면별 운동 달성률은 8시간 이상·미만 기록이 각각 2일 이상 쌓이면 비교해요.' };
  }
  const api = { minuteOfDay, sleepMinutes, dayKey, shiftDay, weekDays, condition, recommendation, streak, report };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HaruFit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
