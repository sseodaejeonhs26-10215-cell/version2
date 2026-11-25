(() => {
  'use strict';
  const H = window.HaruFit;
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'harufit-v1';
  const defaults = { mode: 'normal', reminders: false, bedReminder: '23:00', exerciseReminder: '18:00' };
  let state = { records: {}, settings: { ...defaults }, notified: {} };
  let today = H.dayKey(), toastTimer;
  const modes = { normal: '평소', exam: '시험 기간', vacation: '방학' };
  const durationText = minutes => {
    const rounded = Math.round(minutes);
    return `${Math.floor(rounded / 60)}시간${rounded % 60 ? ` ${rounded % 60}분` : ''}`;
  };
  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid data');
      for (const [day, record] of Object.entries(saved.records || {})) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(day) && H.shiftDay(day, 0) === day && day <= today && record && H.sleepMinutes(record.bed, record.wake) !== null) {
          state.records[day] = { bed: record.bed, wake: record.wake, done: record.done === true, completedPlan: typeof record.completedPlan === 'string' ? record.completedPlan : '' };
        }
      }
      const settings = saved.settings || {};
      state.settings = {
        mode: Object.hasOwn(modes, settings.mode) ? settings.mode : 'normal',
        reminders: settings.reminders === true,
        bedReminder: Number.isFinite(H.minuteOfDay(settings.bedReminder)) ? settings.bedReminder : defaults.bedReminder,
        exerciseReminder: Number.isFinite(H.minuteOfDay(settings.exerciseReminder)) ? settings.exerciseReminder : defaults.exerciseReminder
      };
      state.notified = Object.fromEntries(Object.entries(saved.notified || {}).filter(([key, value]) => key.startsWith(today) && value === true));
    } catch {
      toast('저장된 기록을 읽을 수 없어 빈 화면으로 시작했어요. 기존 데이터는 새로 저장하기 전까지 유지돼요.');
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      toast('브라우저 저장 공간을 사용할 수 없어요. 현재 기록은 새로고침하면 사라질 수 있어요.');
      return false;
    }
  }
  function previousRecords(day) {
    return Array.from({ length: 6 }, (_, i) => state.records[H.shiftDay(day, -i - 1)]).filter(Boolean);
  }
  function planForToday() { return H.recommendation(state.records[today], previousRecords(today), state.settings.mode); }
  function previewSleep() {
    const duration = H.sleepMinutes($('bedtime').value, $('waketime').value);
    $('sleep-preview').textContent = duration === null ? '취침·기상 시간을 서로 다르게 입력해 주세요.' : `총 ${durationText(duration)} 수면`;
  }
  function selectRecord(day) {
    $('record-date').value = day;
    const record = state.records[day];
    $('bedtime').value = record?.bed || '23:00';
    $('waketime').value = record?.wake || '07:00';
    previewSleep();
  }
  function render() {
    const record = state.records[today], plan = planForToday();
    $('today-date').textContent = new Date(`${today}T12:00:00`).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    $('record-date').max = today;
    $('mode-badge').textContent = `${modes[state.settings.mode]} 모드`;
    $('sleep-stat').textContent = record ? durationText(H.sleepMinutes(record.bed, record.wake)) : '기록 전';
    $('condition-stat').textContent = plan ? `${plan.score}점 / 100` : '기록 전';
    $('condition-detail').textContent = !plan ? '수면을 기록하면 표시돼요' : plan.regularity ? '수면 시간 + 최근 수면 규칙성' : '수면 시간 기준 · 규칙성 기록 수집 중';
    $('streak-stat').textContent = H.streak(state.records, today);
    $('exercise-type').textContent = plan?.type || '나에게 맞는 운동';
    $('exercise-minutes').textContent = plan?.minutes ?? '—';
    $('exercise-reason').textContent = record ? `지난밤 ${durationText(H.sleepMinutes(record.bed, record.wake))} 수면 · 오늘은 작은 실천부터.` : '지난밤 수면을 기록하면 오늘의 운동을 제안해요.';
    $('exercise-detail').textContent = record?.done ? `오늘 완료한 운동: ${record.completedPlan || '운동 완료'}` : plan?.detail || '기록은 간단하게, 실천은 부담 없이.';
    const complete = $('complete-button');
    complete.disabled = !plan;
    complete.textContent = record?.done ? '✓ 오늘 운동 완료! · 다시 누르면 취소' : plan ? '오늘의 운동 완료하기' : '수면을 먼저 기록해 주세요';
    complete.classList.toggle('done', record?.done === true);
    renderWeek();
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.settings.mode)));
    $('mode-description').textContent = { normal: '수면과 규칙성에 따라 5~15분의 작은 목표를 제안해요.', exam: '공부로 바쁜 시기에는 운동 목표를 최대 10분으로 줄여요.', vacation: '8시간 이상 자고 컨디션 점수가 80점 이상이면 5분 더 움직여요.' }[state.settings.mode];
    $('reminders-enabled').checked = state.settings.reminders;
    $('bed-reminder').value = state.settings.bedReminder;
    $('exercise-reminder').value = state.settings.exerciseReminder;
    renderNotificationStatus();
  }
  function renderWeek() {
    const report = H.report(state.records, today);
    const dateLabel = day => `${Number(day.slice(5, 7))}.${Number(day.slice(8))}`;
    $('week-range').textContent = `최근 7일 · ${dateLabel(report.days[0])} – ${dateLabel(today)}`;
    $('sleep-chart').replaceChildren();
    const scale = Math.max(720, ...report.days.map(day => state.records[day] ? H.sleepMinutes(state.records[day].bed, state.records[day].wake) : 0));
    $('sleep-chart').style.setProperty('--sleep-guide', `${32 + 480 / scale * 115}px`);
    const labels = [];
    for (const day of report.days) {
      const record = state.records[day];
      const minutes = record ? H.sleepMinutes(record.bed, record.wake) : null;
      const label = `${dateLabel(day)} 수면 ${minutes === null ? '미기록' : durationText(minutes)}, 운동 ${record?.done ? '완료' : '미완료'}`;
      labels.push(label);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chart-day${day === today ? ' today' : ''}`;
      button.setAttribute('aria-label', `${label}. 기록 수정`);
      button.title = label;
      const track = document.createElement('span');
      track.className = 'bar-track';
      const value = document.createElement('span');
      value.className = 'bar-value';
      value.textContent = minutes === null ? '—' : `${Math.round(minutes / 60 * 10) / 10}h`;
      const bar = document.createElement('span');
      bar.className = 'bar';
      bar.style.height = `${minutes === null ? 3 : Math.max(3, minutes / scale * 115)}px`;
      track.append(value, bar);
      const caption = document.createElement('span');
      caption.className = 'day-label';
      caption.textContent = `${day === today ? '오늘' : dateLabel(day)} ${record?.done ? '✓' : ''}`;
      button.append(track, caption);
      button.addEventListener('click', () => {
        selectRecord(day);
        $('sleep-form').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        $('record-date').focus({ preventScroll: true });
      });
      $('sleep-chart').append(button);
    }
    // 개별 날짜 버튼을 보조 기술에서도 탐색할 수 있게 그래프 설명은 별도로 제공해요.
    $('sleep-chart').setAttribute('role', 'group');
    $('sleep-chart').setAttribute('aria-label', `최근 7일 수면 및 운동 기록. ${labels.join('. ')}`);
    $('average-sleep').textContent = report.average === null ? '기록 전' : durationText(report.average);
    $('completion-rate').textContent = `${report.rate}%`;
    $('report-tip').textContent = report.logged === 0 ? '아직 기록이 없어요. 지난밤의 수면부터 남겨볼까요?' : `수면 ${report.logged}일 기록 · 운동 ${report.completed}/7일 완료. ${report.average < 480 ? '오늘은 잠자리에 조금 일찍 들어보세요.' : '충분한 수면과 작은 실천을 이어가 보세요.'}`;
    $('sleep-relationship').textContent = report.relationship;
  }
  function renderNotificationStatus() {
    const supported = 'Notification' in window && window.isSecureContext;
    $('notification-button').disabled = !supported || Notification.permission === 'granted';
    $('notification-status').textContent = !supported ? '이 환경에서는 화면 안 알림을 사용해요. 브라우저 알림은 localhost 또는 HTTPS에서 지원돼요.' : Notification.permission === 'granted' ? '브라우저 알림 허용됨 · 알림 켜기도 선택해 주세요.' : Notification.permission === 'denied' ? '브라우저에서 알림이 차단되어 있어요. 사이트 권한 설정에서 변경할 수 있어요.' : '권한을 허용하지 않아도 화면 안에서 알려드려요.';
  }
  function remind(key, message) {
    const id = `${today}-${key}`;
    if (state.notified[id]) return;
    state.notified[id] = true;
    save();
    $('reminder-message').textContent = message;
    $('reminder-banner').hidden = false;
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('하루핏', { body: message, tag: id }); } catch { /* 화면 안 알림은 그대로 제공해요. */ }
    }
  }
  function tick() {
    const now = new Date(), currentDay = H.dayKey(now);
    if (currentDay !== today) {
      const wasToday = $('record-date').value === today;
      today = currentDay;
      state.notified = {};
      if (wasToday) selectRecord(today);
      render();
    }
    if (!state.settings.reminders) return;
    const minute = now.getHours() * 60 + now.getMinutes();
    const near = target => (minute - target + 1440) % 1440 < 2;
    if (near(H.minuteOfDay(state.settings.bedReminder))) remind('bed', '잠자리에 들 준비를 해볼까요? 오늘도 수고했어요.');
    const exerciseTime = H.minuteOfDay(state.settings.exerciseReminder);
    if (!state.records[today]?.done && near(exerciseTime)) remind('exercise', planForToday() ? '오늘의 작은 운동을 시작해 볼까요?' : '수면을 기록하고 오늘의 작은 운동을 확인해 보세요.');
    // 실제 첫 운동 알림을 받은 뒤에만 재알림을 보냅니다. 자정을 넘는 경우에는 보내지 않아요.
    if (exerciseTime + 30 < 1440 && !state.records[today]?.done && state.notified[`${today}-exercise`] && near(exerciseTime + 30)) remind('retry', '아직 운동 전이라면, 가볍게 몸을 풀어보세요. 피곤하면 쉬어도 좋아요.');
  }

  load();
  selectRecord(today);
  render();
  $('bedtime').addEventListener('input', previewSleep);
  $('waketime').addEventListener('input', previewSleep);
  $('record-date').addEventListener('change', () => selectRecord($('record-date').value));
  $('sleep-form').addEventListener('submit', event => {
    event.preventDefault();
    const day = $('record-date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || H.shiftDay(day, 0) !== day || day > today) return toast('오늘 또는 지난 날짜를 선택해 주세요.');
    const bed = $('bedtime').value, wake = $('waketime').value;
    if (H.sleepMinutes(bed, wake) === null) return toast('취침·기상 시간을 서로 다르게 입력해 주세요.');
    state.records[day] = { ...state.records[day], bed, wake };
    const persisted = save();
    render();
    if (persisted) toast(`${day === today ? '지난밤' : day} 수면 기록을 저장했어요.`);
  });
  $('complete-button').addEventListener('click', () => {
    const record = state.records[today], plan = planForToday();
    if (!record || !plan) return;
    record.done = !record.done;
    record.completedPlan = record.done ? `${plan.type} ${plan.minutes}분` : '';
    const persisted = save();
    render();
    if (persisted) toast(record.done ? '오늘의 작은 실천 완료! 수고했어요.' : '운동 완료 표시를 취소했어요.');
  });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    state.settings.mode = button.dataset.mode;
    save();
    render();
  }));
  $('reminders-enabled').addEventListener('change', () => {
    state.settings.reminders = $('reminders-enabled').checked;
    const persisted = save();
    if (!state.settings.reminders) $('reminder-banner').hidden = true;
    if (persisted) toast(state.settings.reminders ? '알림을 켰어요. 설정한 시각에 이 페이지를 열어 두세요.' : '알림을 껐어요.');
    tick();
  });
  [['bed-reminder', 'bedReminder'], ['exercise-reminder', 'exerciseReminder']].forEach(([id, key]) => {
    $(id).addEventListener('change', () => {
      if (!Number.isFinite(H.minuteOfDay($(id).value))) { $(id).value = state.settings[key]; return; }
      state.settings[key] = $(id).value;
      save();
      tick();
    });
  });
  $('notification-button').addEventListener('click', async () => {
    if (!('Notification' in window)) return;
    try { await Notification.requestPermission(); } catch { toast('브라우저 알림을 사용할 수 없어 화면 안에서 알려드려요.'); }
    renderNotificationStatus();
  });
  $('dismiss-reminder').addEventListener('click', () => { $('reminder-banner').hidden = true; });
  // 다른 탭에서 변경한 기록도 새로고침 없이 반영해요.
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    state = { records: {}, settings: { ...defaults }, notified: {} };
    load();
    selectRecord($('record-date').value || today);
    render();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  setInterval(tick, 15000);
  tick();
})();
