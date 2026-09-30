/* スクワット伸び計算機: グラフ（SVG） */
(function (root) {
  'use strict';
  const SQ = root.SQ = root.SQ || {};
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(k => node.setAttribute(k, String(attrs[k])));
    if (text != null) node.textContent = text;
    return node;
  }

  function niceStep(range, maxTicks) {
    const steps = [0.25, 0.5, 1, 2.5, 5, 10, 20, 25, 50];
    return steps.find(s => range / s <= maxTicks) || 100;
  }

  const fmt = x => (Math.round(x * 10) / 10).toString();

  // 予測の幅（週ごとの下限と上限）と、目標の線
  function bandChart(pred, target) {
    const W = 640, H = 296, L = 52, R = 22, T = 38, B = 38;
    const n = pred.weeks;
    const goal = target ? pred.max + target : null;
    const top = Math.max(pred.highMax, goal || 0);
    const step = niceStep((top - pred.max) * 1.15 || 5, 5);
    const yMin = Math.floor(pred.max / step) * step;
    const yMax = Math.ceil((top + step * 0.3) / step) * step;
    const x = w => L + (W - L - R) * w / n;
    const y = v => T + (H - T - B) * (1 - (v - yMin) / (yMax - yMin));

    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img' });
    const label = n + '週間後の予想MAXは' + fmt(pred.lowMax) + 'kgから' + fmt(pred.highMax) + 'kg' + (goal ? '、目標は' + fmt(goal) + 'kg' : '');
    svg.setAttribute('aria-label', label);

    for (let v = yMin; v <= yMax + 1e-9; v += step) {
      svg.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }));
      svg.append(el('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, fmt(v)));
    }
    const every = n <= 8 ? 1 : 2;
    for (let w = 0; w <= n; w++) {
      if (w % every !== 0 && w !== n) continue;
      const last = w === n;
      svg.append(el('text', { x: last ? x(w) + 10 : x(w), y: H - B + 22, 'text-anchor': last ? 'end' : 'middle', class: 'tick' }, last ? w + '週' : String(w)));
    }
    svg.append(el('text', { x: 4, y: 20, class: 'axis' }, 'kg'));

    const up = pred.curve.map(p => x(p.week) + ',' + y(p.high));
    const down = pred.curve.slice().reverse().map(p => x(p.week) + ',' + y(p.low));
    svg.append(el('polygon', { points: up.concat(down).join(' '), class: 'band' }));
    svg.append(el('polyline', { points: pred.curve.map(p => x(p.week) + ',' + y(p.high)).join(' '), class: 'line' }));
    svg.append(el('polyline', { points: pred.curve.map(p => x(p.week) + ',' + y(p.low)).join(' '), class: 'line' }));

    if (goal) {
      const gy = y(goal);
      svg.append(el('line', { x1: L, x2: W - R, y1: gy, y2: gy, class: 'target' }));
      svg.append(el('text', { x: L + 6, y: gy - 6, class: 'target-label' }, '目標 ' + fmt(goal) + 'kg'));
    }
    svg.append(el('circle', { cx: x(0), cy: y(pred.max), r: 5, class: 'dot-now' }));
    svg.append(el('text', { x: x(n) - 6, y: y(pred.highMax) - 8, 'text-anchor': 'end', class: 'end-label' }, String(Math.round(pred.highMax))));
    svg.append(el('text', { x: x(n) - 6, y: y(pred.lowMax) + 18, 'text-anchor': 'end', class: 'end-label' }, String(Math.round(pred.lowMax))));
    return svg;
  }

  // 研究の点（体重比 × 1週あたりの伸び）と、計算に使う幅
  function scatterChart(you) {
    const D = SQ.DATA;
    const W = 640, H = 350, L = 56, R = 22, T = 40, B = 62;
    const xMin = 0.8, xMax = 2.2, yMin = 0, yMax = 4;
    const x = v => L + (W - L - R) * (v - xMin) / (xMax - xMin);
    const y = v => T + (H - T - B) * (1 - (v - yMin) / (yMax - yMin));
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': '研究のグループごとの、体重比と1週あたりの伸び' });

    for (let v = yMin; v <= yMax; v += 1) {
      svg.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }));
      svg.append(el('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, v + '%'));
    }
    for (let v = 1.0; v <= 2.2 + 1e-9; v += 0.2) {
      svg.append(el('text', { x: x(v), y: H - B + 22, 'text-anchor': 'middle', class: 'tick' }, v.toFixed(1)));
    }
    svg.append(el('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, 'スクワットのMAX ÷ 体重'));
    svg.append(el('text', { x: 4, y: 20, class: 'axis' }, '1週あたりの伸び'));

    const xs = [];
    for (let v = xMin; v <= xMax + 1e-9; v += 0.05) xs.push(Math.round(v * 100) / 100);
    const up = xs.map(v => x(v) + ',' + y(SQ.ratesFor(v).high));
    const down = xs.slice().reverse().map(v => x(v) + ',' + y(SQ.ratesFor(v).low));
    svg.append(el('polygon', { points: up.concat(down).join(' '), class: 'band' }));

    D.studies.forEach((s, i) => {
      const pw = SQ.studyRate(s).perWeek;
      const g = el('g', { class: 'pt' });
      g.append(el('title', null, (i + 1) + '. ' + D.refs[s.ref].short + ' ' + s.who + (s.group ? '（' + s.group + '）' : '') + '：1週あたり' + pw.toFixed(1) + '%'));
      g.append(el('circle', { cx: x(s.ratio), cy: y(pw), r: 9, class: 'dot' }));
      g.append(el('text', { x: x(s.ratio), y: y(pw) + 4, 'text-anchor': 'middle', class: 'dot-num' }, String(i + 1)));
      svg.append(g);
    });

    if (you && you.ratio > 0) {
      const r = Math.min(xMax, Math.max(xMin, you.ratio));
      svg.append(el('line', { x1: x(r), x2: x(r), y1: T, y2: H - B, class: 'you' }));
      svg.append(el('text', { x: x(r) + 6, y: T + 14, class: 'you-label' }, 'あなた'));
    }
    return svg;
  }

  SQ.chart = { bandChart, scatterChart };
})(typeof window !== 'undefined' ? window : globalThis);
