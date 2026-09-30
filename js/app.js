/* スクワット伸び計算機: 画面の処理（フォーム・描画・保存・共有） */
(function () {
  'use strict';
  const SQ = window.SQ;
  const D = SQ.DATA;

  const STORAGE_KEY = 'squatgoal:v1';

  const form = document.getElementById('calc-form');
  const errorBox = document.getElementById('form-error');
  const maxField = document.getElementById('max-field');
  const repsField = document.getElementById('reps-field');
  const estOut = document.getElementById('est-out');
  const resultSection = document.getElementById('result');
  const summaryMeta = document.getElementById('summary-meta');
  const bigRange = document.getElementById('big-range');
  const rateLine = document.getElementById('rate-line');
  const chartBox = document.getElementById('chart-box');
  const verdictBox = document.getElementById('verdict');
  const studyList = document.getElementById('study-list');
  const tabsEl = document.getElementById('week-tabs');
  const panelsEl = document.getElementById('week-panels');
  const shareBtn = document.getElementById('share-btn');
  const printBtn = document.getElementById('print-btn');
  const shareBox = document.getElementById('share-box');
  const shareInput = document.getElementById('share-url');
  const shareStatus = document.getElementById('share-status');

  let currentInput = null;

  // ---- 小さな DOM ヘルパー（文字列は必ず textContent として入れる） ----
  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(k => {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    children.flat(Infinity).forEach(c => {
      if (c == null || c === false) return;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return node;
  }

  const kg = x => (Math.round(x * 10) / 10).toString();
  const kg0 = x => Math.round(x).toString();
  const pct1 = x => (Math.round(x * 10) / 10).toFixed(1);
  const cite = (anchor, text) => h('a', { class: 'cite-chip', href: 'evidence.html#' + anchor, text: text || '根拠' });

  // ---- フォームの状態 ----
  function readForm() {
    const e = form.elements;
    return {
      bw: e.bw.value,
      mode: e.mode.value,
      max: e.max.value,
      liftW: e.liftW.value,
      liftR: e.liftR.value,
      weeks: e.weeks.value,
      target: e.target.value,
      freq: e.freq.value
    };
  }

  function setRadio(name, value) {
    const match = Array.from(form.querySelectorAll('input[name="' + name + '"]')).find(i => i.value === String(value));
    if (match) match.checked = true;
  }

  function applyState(s) {
    if (!s || typeof s !== 'object') return;
    const e = form.elements;
    ['bw', 'max', 'liftW', 'liftR', 'target'].forEach(k => { if (s[k] != null) e[k].value = s[k]; });
    if (s.weeks != null) e.weeks.value = String(s.weeks);
    if (s.mode) setRadio('mode', s.mode);
    if (s.freq) setRadio('freq', s.freq);
    syncMode();
  }

  function currentMax(s) {
    if (s.mode === 'reps') return SQ.estimate1RM(s.liftW, s.liftR);
    const m = Number(s.max);
    return m > 0 ? m : null;
  }

  function syncMode() {
    const reps = form.elements.mode.value === 'reps';
    maxField.hidden = reps;
    repsField.hidden = !reps;
    const est = SQ.estimate1RM(form.elements.liftW.value, form.elements.liftR.value);
    estOut.textContent = reps && est ? '推定MAX：' + kg(est) + 'kg' : '';
  }

  // ---- 保存（使えないブラウザでも動くように try/catch で囲む） ----
  function save(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* 保存できなくても続行 */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ---- URL での共有 ----
  function toParams(n) {
    const p = new URLSearchParams();
    p.set('bw', kg(n.bw));
    p.set('m', kg(n.max));
    p.set('wk', String(n.weeks));
    p.set('f', String(n.freq));
    if (n.target) p.set('t', kg(n.target));
    return p;
  }
  function fromParams(search) {
    const p = new URLSearchParams(search);
    if (!p.has('m')) return null;
    return {
      bw: p.get('bw') || '',
      mode: 'max',
      max: p.get('m') || '',
      weeks: p.get('wk') || String(D.defaultWeeks),
      target: p.get('t') || '',
      freq: p.get('f') || '3'
    };
  }
  const baseUrl = () => location.href.split(/[?#]/)[0];
  function updateUrl(n) {
    try { history.replaceState(null, '', '?' + toParams(n).toString()); } catch (e) { /* file:// などで失敗しても続行 */ }
  }

  // ---- 描画: 予測 ----
  function renderPrediction(prog) {
    const n = prog.input;
    const p = prog.pred;
    summaryMeta.textContent = '今のMAX ' + kg(n.max) + 'kg・体重 ' + kg(n.bw) + 'kg（体重の' + p.ratio.toFixed(2) + '倍）・' + n.weeks + '週間';
    bigRange.replaceChildren(
      h('span', { class: 'big-label', text: n.weeks + '週間後の予想MAX' }),
      h('span', { class: 'big-num', text: kg0(p.lowMax) + '〜' + kg0(p.highMax) + 'kg' }),
      h('span', { class: 'big-gain', text: '+' + kg0(p.lowGain) + '〜' + kg0(p.highGain) + 'kg（+' + pct1(p.lowPct) + '〜' + pct1(p.highPct) + '%）' })
    );
    const notes = [
      h('li', null, '体重の' + p.ratio.toFixed(2) + '倍の人は、研究では1週あたり約' + pct1(p.rates.low) + '〜' + pct1(p.rates.high) + '%伸びています。今のMAXが体重に比べて軽いほど、速く伸びます。', cite('rate'))
    ];
    if (n.weeks > D.fullRateWeeks) notes.push(h('li', null, (D.fullRateWeeks + 1) + '週目からは、研究が少ないため半分のペースで控えめに計算しています。', cite('long')));
    notes.push(h('li', null, 'MAXを測り慣れていない人は、測るだけで数%上がることがあります。予測の伸びには、その分も含まれます。', cite('practice')));
    notes.push(h('li', null, '下半身の筋力の伸びに男女差は見られなかったため、性別は計算に使っていません。', cite('sex')));
    rateLine.replaceChildren(...notes);
    chartBox.replaceChildren(SQ.chart.bandChart(p, n.target));
  }

  // ---- 描画: 目標の判定 ----
  function renderVerdict(prog) {
    const n = prog.input;
    const p = prog.pred;
    if (!n.target) {
      verdictBox.hidden = true;
      return;
    }
    const v = SQ.verdict(p, n.target);
    const need = SQ.weeksNeeded(n.max, n.bw, n.target);
    const titles = {
      likely: '届く見込みが高い目標です',
      possible: '研究の範囲内の目標です',
      beyond: n.weeks + '週間では届きにくい目標です'
    };
    const lines = [];
    if (v === 'likely') {
      lines.push('+' + kg(n.target) + 'kgは、研究で見られた控えめなペースでも' + n.weeks + '週間で届く伸びです。');
    } else if (v === 'possible') {
      lines.push('+' + kg(n.target) + 'kgは、研究で見られた速いペースなら' + n.weeks + '週間で届きます。控えめなペースだと' + (need.slowest ? '約' + need.slowest + '週' : '1年以上') + 'かかります。');
    } else {
      lines.push('研究で見られた速いペースでも、' + n.weeks + '週間の伸びは+' + kg0(p.highGain) + 'kgまでです。');
      if (need.fastest) {
        lines.push('+' + kg(n.target) + 'kgには、速いペースで約' + need.fastest + '週、控えめなペースで約' + (need.slowest ? need.slowest + '週' : '1年以上') + 'が目安です。' + (need.slowest == null || need.slowest > D.maxWeeks ? '16週より先は研究が少ないため、あくまで目安です。' : ''));
      } else {
        lines.push('1年以上かかる見込みです。大会に出ている人の記録でも、スクワットの伸びは1年で最大20〜25kgでした。');
      }
      lines.push(n.weeks + '週間なら、+' + kg0(p.lowGain) + '〜' + kg0(p.highGain) + 'kgが現実的な目標です。');
    }
    verdictBox.className = 'verdict verdict-' + v;
    verdictBox.replaceChildren(
      h('p', { class: 'verdict-title', text: titles[v] }),
      ...lines.map(t => h('p', { text: t })),
      h('p', { class: 'verdict-cite' }, cite('rate', '判定のもとになった研究'), v === 'beyond' ? cite('long', '長い期間の伸び') : null)
    );
    verdictBox.hidden = false;
  }

  // ---- 描画: 近い研究 ----
  function renderStudies(prog) {
    const n = prog.input;
    const near = SQ.nearestStudies(prog.pred.ratio, 3);
    studyList.replaceChildren(...near.map(s => {
      const r = D.refs[s.ref];
      const gainText = s.pre != null ? '+' + kg(s.gain) + 'kg（+' + pct1(s.pct) + '%）' : '+' + pct1(s.pct) + '%' + (s.gainKg ? '（+' + kg(s.gainKg) + 'kg）' : '');
      const yours = n.max * SQ.gainPct(n.weeks, s.perWeek) / 100;
      return h('li', { class: 'study' },
        h('div', { class: 'study-top' },
          h('span', { class: 'study-ratio', text: '体重の' + (s.approxRatio ? '約' : '') + s.ratio.toFixed(2) + '倍' }),
          h('a', { class: 'study-ref', href: 'https://doi.org/' + r.doi, rel: 'noopener', text: r.short })
        ),
        h('p', { class: 'study-who', text: s.who + (s.group ? '（' + s.group + '）' : '') + '・' + s.how }),
        h('p', { class: 'study-result', text: s.weeks + '週間で' + gainText + ' → 1週あたり+' + pct1(s.perWeek) + '%' }),
        h('p', { class: 'study-yours', text: 'この伸び方をあなたの' + n.weeks + '週間に当てはめると、約+' + kg0(yours) + 'kg' })
      );
    }));
  }

  // ---- 描画: メニュー ----
  function rirText(rir) {
    return rir >= 5 ? 'たっぷり残す（あと5回以上）' : 'あと' + rir + '回できる余力を残す';
  }

  function renderDay(d) {
    if (d.type === 'test') {
      return h('article', { class: 'day day-test' },
        h('h4', { class: 'day-title' }, d.name + '　' + d.label, h('span', { class: 'badge badge-test', text: '測定' })),
        h('p', { class: 'day-lead', text: '軽めの確認の日から2〜3日あけて行います。1本ごとに5分ほど休みます。' }),
        h('ol', { class: 'test-steps' },
          d.warmup.map(w => h('li', null, h('span', { class: 'ts-weight', text: kg(w.weight) + 'kg × ' + w.reps + '回' }), h('span', { class: 'ts-note', text: 'ウォームアップ' }))),
          d.attempts.map((a, i) => h('li', { class: 'is-attempt' }, h('span', { class: 'ts-weight', text: (i + 1) + '本目 ' + kg(a.weight) + 'kg × 1回' }), h('span', { class: 'ts-note', text: a.note })))
        ),
        h('p', { class: 'test-next', text: '1本目が楽に挙がったら2本目へ。きつかったら、そこで終わりにします。' })
      );
    }
    return h('article', { class: 'day' },
      h('h4', { class: 'day-title' }, d.name + '　' + d.label),
      h('ul', { class: 'ex-list' },
        h('li', { class: 'ex' + (d.type === 'light' || d.type === 'opener' ? ' is-light' : '') },
          h('div', { class: 'ex-top' }, h('span', { text: 'バックスクワット' })),
          h('div', { class: 'ex-load' },
            h('span', { class: 'ex-weight' }, kg(d.weight), h('small', { text: 'kg' })),
            h('span', { class: 'ex-sets', text: d.sets + 'セット × ' + d.reps + '回' })
          ),
          h('div', { class: 'ex-meta' },
            h('span', { text: '余力 ' + rirText(d.rir) }),
            h('span', { text: '休憩 ' + d.rest }),
            h('span', { text: '今のMAXの' + Math.round(d.pctOfMax * 100) + '%' })
          )
        )
      )
    );
  }

  function renderWeek(w, i) {
    const isTest = w.phase === 'test';
    const panel = h('section', {
      class: 'week-panel',
      role: 'tabpanel',
      id: 'panel-w' + w.week,
      'aria-labelledby': 'tab-w' + w.week,
      tabindex: '0',
      hidden: i !== 0
    });
    panel.append(
      h('div', { class: 'week-head' },
        h('h3', null, '第' + w.week + '週', h('span', { class: 'badge' + (isTest ? ' badge-test' : ''), text: w.phaseName })),
        h('p', { class: 'week-note', text: w.note + (isTest ? '' : '重さは、控えめな予測でこの週までに伸びたMAX（' + kg(w.projMax) + 'kg）から計算した目安です。') })
      ),
      h('div', { class: 'days' }, w.days.map(renderDay))
    );
    return panel;
  }

  function renderMenu(prog) {
    tabsEl.replaceChildren(...prog.weeks.map((w, i) => {
      const isTest = w.phase === 'test';
      return h('button', {
        type: 'button',
        role: 'tab',
        id: 'tab-w' + w.week,
        'aria-controls': 'panel-w' + w.week,
        'aria-selected': i === 0 ? 'true' : 'false',
        tabindex: i === 0 ? '0' : '-1',
        class: 'tab' + (isTest ? ' is-test' : ''),
        onclick: () => selectWeek(i, false)
      },
      h('span', { text: w.week + '週' }),
      h('span', { class: 'tab-tag', text: w.phaseName }));
    }));
    panelsEl.replaceChildren(...prog.weeks.map(renderWeek));
  }

  function selectWeek(index, focus) {
    const tabs = Array.from(tabsEl.children);
    const panels = Array.from(panelsEl.children);
    tabs.forEach((t, i) => {
      const on = i === index;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p, i) => { p.hidden = i !== index; });
    const tab = tabs[index];
    if (tab) {
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  tabsEl.addEventListener('keydown', e => {
    const tabs = Array.from(tabsEl.children);
    const cur = tabs.indexOf(document.activeElement);
    if (cur < 0) return;
    let next = null;
    if (e.key === 'ArrowRight') next = (cur + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (cur - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next == null) return;
    e.preventDefault();
    selectWeek(next, true);
  });

  // ---- 計算 ----
  function calculate(scroll) {
    const s = readForm();
    const n = SQ.normalizeInput({ max: currentMax(s), bw: s.bw, weeks: s.weeks, freq: s.freq, target: s.target });
    const errors = SQ.validate(n);
    if (errors.length) {
      errorBox.replaceChildren(...errors.map(t => h('span', { class: 'error-line', text: t })));
      errorBox.hidden = false;
      return false;
    }
    errorBox.hidden = true;
    const prog = SQ.buildProgram(n);
    currentInput = prog.input;
    renderPrediction(prog);
    renderVerdict(prog);
    renderStudies(prog);
    renderMenu(prog);
    resultSection.hidden = false;
    shareBox.hidden = true;
    save(s);
    updateUrl(prog.input);
    if (scroll) resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    calculate(true);
  });
  form.addEventListener('change', e => { if (e.target.name === 'mode') syncMode(); });
  form.addEventListener('input', e => { if (e.target.name === 'liftW' || e.target.name === 'liftR') syncMode(); });

  shareBtn.addEventListener('click', async () => {
    if (!currentInput) return;
    const url = baseUrl() + '?' + toParams(currentInput).toString();
    shareInput.value = url;
    shareBox.hidden = false;
    try {
      await navigator.clipboard.writeText(url);
      shareStatus.textContent = 'リンクをコピーしました。開くと同じ結果が表示されます。';
    } catch (e) {
      shareInput.focus();
      shareInput.select();
      shareStatus.textContent = 'リンクを選択しました。コピーして共有してください。';
    }
  });

  printBtn.addEventListener('click', () => window.print());

  // ---- 起動時: URL のパラメータ → 前回の入力 の順で復元 ----
  const fromUrl = fromParams(location.search);
  const initial = fromUrl || load();
  if (initial) {
    applyState(initial);
    // BIG3 メニューメーカーから MAX だけ渡されたときは、体重の入力を待つ
    if (initial.bw) calculate(false);
    else form.elements.bw.focus();
  } else {
    syncMode();
  }
})();
