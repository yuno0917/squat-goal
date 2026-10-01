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
  const programLink = document.getElementById('program-link');
  const shareBtn = document.getElementById('share-btn');
  const shareBox = document.getElementById('share-box');
  const shareInput = document.getElementById('share-url');
  const shareStatus = document.getElementById('share-status');

  let current = null;

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
    return { bw: e.bw.value, mode: e.mode.value, max: e.max.value, liftW: e.liftW.value, liftR: e.liftR.value, weeks: e.weeks.value, target: e.target.value };
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
      target: p.get('t') || ''
    };
  }
  const baseUrl = () => location.href.split(/[?#]/)[0];
  function updateUrl(n) {
    try { history.replaceState(null, '', '?' + toParams(n).toString()); } catch (e) { /* file:// などで失敗しても続行 */ }
  }

  // ---- 描画: 予測 ----
  function renderPrediction(n, p) {
    summaryMeta.textContent = 'MAX ' + kg(n.max) + 'kg・体重 ' + kg(n.bw) + 'kg（' + p.ratio.toFixed(2) + '倍）・' + n.weeks + '週間';
    bigRange.replaceChildren(
      h('span', { class: 'big-label', text: n.weeks + '週間後の予想MAX' }),
      h('span', { class: 'big-num', text: kg0(p.lowMax) + '〜' + kg0(p.highMax) + 'kg' }),
      h('span', { class: 'big-gain', text: '+' + kg0(p.lowGain) + '〜' + kg0(p.highGain) + 'kg（+' + pct1(p.lowPct) + '〜' + pct1(p.highPct) + '%）' })
    );
    const line = [
      '帯は、研究で見られた伸びの幅です。体重の' + p.ratio.toFixed(2) + '倍の人は、1週あたり約' + pct1(p.rates.low) + '〜' + pct1(p.rates.high) + '%伸びていました。', cite('rate')
    ];
    if (n.weeks > D.fullRateWeeks) line.push(' ' + (D.fullRateWeeks + 1) + '週目からは、研究が少ないため半分のペースで計算しています。', cite('long'));
    rateLine.replaceChildren(...line);
    chartBox.replaceChildren(SQ.chart.bandChart(p, n.target));
  }

  // ---- 描画: 目標の判定 ----
  function renderVerdict(n, p) {
    if (!n.target) {
      verdictBox.hidden = true;
      return;
    }
    const v = SQ.verdict(p, n.target);
    const need = SQ.weeksNeeded(n.max, n.bw, n.target);
    const slow = need.slowest ? '約' + need.slowest + '週' : '1年以上';
    const titles = { likely: '届く見込みが高い目標です', possible: '研究の範囲内の目標です', beyond: n.weeks + '週間では届きにくい目標です' };
    let text;
    if (v === 'likely') {
      text = '控えめなペースでも、' + n.weeks + '週間で+' + kg(n.target) + 'kgに届きます。';
    } else if (v === 'possible') {
      text = '速いペースなら' + n.weeks + '週間で届きます。控えめなペースだと' + slow + 'かかります。';
    } else if (need.fastest) {
      text = '速いペースでも' + n.weeks + '週間では+' + kg0(p.highGain) + 'kgまでです。+' + kg(n.target) + 'kgには、約' + need.fastest + '週〜' + (need.slowest ? need.slowest + '週' : '1年以上') + 'かかる見込みです。';
    } else {
      text = '1年以上かかる見込みです。大会に出ている人でも、スクワットの伸びは1年で最大20〜25kgでした。';
    }
    verdictBox.className = 'verdict verdict-' + v;
    verdictBox.replaceChildren(h('p', { class: 'verdict-title', text: titles[v] }), h('p', { text: text }));
    verdictBox.hidden = false;
  }

  // ---- 描画: 近い研究 ----
  function renderStudies(n, p) {
    const near = SQ.nearestStudies(p.ratio, 3);
    studyList.replaceChildren(...near.map(s => {
      const r = D.refs[s.ref];
      const yours = n.max * SQ.gainPct(n.weeks, s.perWeek) / 100;
      return h('li', { class: 'study' },
        h('div', { class: 'study-top' },
          h('span', { class: 'study-ratio', text: '体重の' + (s.approxRatio ? '約' : '') + s.ratio.toFixed(2) + '倍の人' }),
          h('a', { class: 'study-ref', href: 'https://doi.org/' + r.doi, rel: 'noopener', text: r.short })
        ),
        h('p', { class: 'study-result', text: s.weeks + '週間で+' + pct1(s.pct) + '%' },
          ' ', h('span', { class: 'study-yours', text: '→ あなたなら約+' + kg0(yours) + 'kg' }))
      );
    }));
  }

  // スクワット プログラムメーカーへのリンク（MAX・体重・週数を引き継ぐ）
  function updateProgramLink(n) {
    const p = new URLSearchParams();
    p.set('m', kg(n.max));
    p.set('bw', kg(n.bw));
    if ([4, 6, 8, 10, 12].indexOf(n.weeks) >= 0) p.set('wk', String(n.weeks));
    programLink.href = '/squat-program/?' + p.toString();
  }

  // ---- 計算 ----
  function calculate(scroll) {
    const s = readForm();
    const n = SQ.normalizeInput({ max: currentMax(s), bw: s.bw, weeks: s.weeks, target: s.target });
    const errors = SQ.validate(n);
    if (errors.length) {
      errorBox.replaceChildren(...errors.map(t => h('span', { class: 'error-line', text: t })));
      errorBox.hidden = false;
      return false;
    }
    errorBox.hidden = true;
    const p = SQ.predict(n.max, n.bw, n.weeks);
    current = n;
    renderPrediction(n, p);
    renderVerdict(n, p);
    renderStudies(n, p);
    updateProgramLink(n);
    resultSection.hidden = false;
    shareBox.hidden = true;
    save(s);
    updateUrl(n);
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
    if (!current) return;
    const url = baseUrl() + '?' + toParams(current).toString();
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
