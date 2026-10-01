/* スクワット伸び計算機: 計算（DOM に触れない純粋な関数） */
(function (root) {
  'use strict';
  const SQ = root.SQ = root.SQ || {};
  const D = SQ.DATA;

  const EPS = 1e-9;

  // 重量 × 回数から MAX を推定する（Epley の式、回数は10回まで）
  function estimate1RM(weight, reps) {
    const w = Number(weight);
    let r = Math.round(Number(reps));
    if (!(w > 0) || !(r >= 1)) return null;
    if (r > 10) r = 10;
    if (r === 1) return w;
    return Math.round(w * (1 + r / 30) * 100) / 100;
  }

  // 体重比から、1週あたりの伸び（%）の幅を求める
  function ratesFor(ratio) {
    if (!(ratio > 0)) return null;
    const a = D.anchors;
    const first = a[0];
    const last = a[a.length - 1];
    if (ratio <= first.ratio) return { low: first.low, high: first.high };
    if (ratio >= last.ratio) return { low: last.low, high: last.high };
    for (let i = 0; i < a.length - 1; i++) {
      const p = a[i];
      const q = a[i + 1];
      if (ratio <= q.ratio) {
        const t = (ratio - p.ratio) / (q.ratio - p.ratio);
        return { low: p.low + (q.low - p.low) * t, high: p.high + (q.high - p.high) * t };
      }
    }
    return null;
  }

  // weeks 週間の伸び（%）。8週までは rate のまま、9週目からは半分のペース。
  function gainPct(weeks, rate) {
    const full = Math.min(weeks, D.fullRateWeeks);
    const late = Math.max(0, weeks - D.fullRateWeeks);
    return rate * full + rate * D.lateFactor * late;
  }

  // 研究のグループの伸び（%）と1週あたりの伸び
  function studyRate(s) {
    const pct = s.pct != null ? s.pct : s.gain / s.pre * 100;
    return { pct, perWeek: pct / s.weeks };
  }

  // 研究のグループの伸びが、同じ体重比・同じ週数の予測の幅に入るか
  function studyPosition(s) {
    const r = ratesFor(s.ratio);
    const pct = studyRate(s).pct;
    if (pct < gainPct(s.weeks, r.low) - EPS) return 'below';
    if (pct > gainPct(s.weeks, r.high) + EPS) return 'above';
    return 'inside';
  }

  // 研究の点のうち、幅の中に入るものの数
  function bandCoverage() {
    const inside = D.studies.filter(s => studyPosition(s) === 'inside').length;
    return { inside, total: D.studies.length };
  }

  function predict(max, bw, weeks) {
    const ratio = max / bw;
    const rates = ratesFor(ratio);
    const lowPct = gainPct(weeks, rates.low);
    const highPct = gainPct(weeks, rates.high);
    const curve = [];
    for (let w = 0; w <= weeks; w++) {
      curve.push({
        week: w,
        low: max * (1 + gainPct(w, rates.low) / 100),
        high: max * (1 + gainPct(w, rates.high) / 100)
      });
    }
    return {
      max, bw, weeks, ratio, rates, lowPct, highPct,
      lowGain: max * lowPct / 100,
      highGain: max * highPct / 100,
      lowMax: max * (1 + lowPct / 100),
      highMax: max * (1 + highPct / 100),
      curve
    };
  }

  // 目標の伸び（kg）に届くまでの週数。速いペースと控えめなペース。
  function weeksNeeded(max, bw, targetGain) {
    const rates = ratesFor(max / bw);
    const find = rate => {
      for (let w = 1; w <= D.searchWeeks; w++) {
        if (max * gainPct(w, rate) / 100 >= targetGain - EPS) return w;
      }
      return null;
    };
    return { fastest: find(rates.high), slowest: find(rates.low) };
  }

  // likely: 控えめなペースでも届く / possible: 研究の範囲内 / beyond: 範囲の外
  function verdict(pred, targetGain) {
    if (!(targetGain > 0)) return null;
    if (targetGain <= pred.lowGain + EPS) return 'likely';
    if (targetGain <= pred.highGain + EPS) return 'possible';
    return 'beyond';
  }

  // 体重比が近い研究を、同じ論文が重ならないように選ぶ
  function nearestStudies(ratio, n) {
    const limit = n || 3;
    const sorted = D.studies
      .map(s => ({ s, d: Math.abs(s.ratio - ratio) }))
      .sort((a, b) => a.d - b.d || a.s.ratio - b.s.ratio);
    const seen = new Set();
    const out = [];
    for (const x of sorted) {
      if (seen.has(x.s.ref)) continue;
      seen.add(x.s.ref);
      out.push(Object.assign({}, x.s, studyRate(x.s)));
      if (out.length >= limit) break;
    }
    return out;
  }

  function normalizeInput(input) {
    const i = input || {};
    const num = v => (v === '' || v == null ? NaN : Number(v));
    const max = num(i.max);
    const bw = num(i.bw);
    let weeks = Math.round(num(i.weeks));
    if (!(weeks >= D.minWeeks && weeks <= D.maxWeeks)) weeks = D.defaultWeeks;
    const t = num(i.target);
    const target = t > 0 && t <= 200 ? t : null;
    return { max, bw, weeks, target };
  }

  // 入力の誤り（空なら問題なし）
  function validate(input) {
    const errors = [];
    if (!(input.bw >= 30 && input.bw <= 200)) errors.push('体重を30〜200kgの範囲で入れてください。');
    if (!(input.max >= 20 && input.max <= 400)) errors.push('スクワットのMAXを20〜400kgの範囲で入れてください。');
    return errors;
  }

  Object.assign(SQ, {
    estimate1RM, ratesFor, gainPct, studyRate, studyPosition, bandCoverage, predict, weeksNeeded, verdict,
    nearestStudies, normalizeInput, validate
  });
})(typeof window !== 'undefined' ? window : globalThis);
