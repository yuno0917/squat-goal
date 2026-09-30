/* スクワット伸び計算機: データ（研究の数字と計算の設定） */
(function (root) {
  'use strict';
  const SQ = root.SQ = root.SQ || {};

  SQ.DATA = {
    // 入力の範囲
    minWeeks: 4,
    maxWeeks: 16,
    defaultWeeks: 8,
    // 伸びる速さ（1週あたり、始めのMAXに対する%）。
    // 体重比が1.0倍・1.5倍・2.0倍の3点で幅を決め、そのあいだは直線でつなぐ。
    // 1.0倍未満と2.0倍より上は、端の値をそのまま使う。
    anchors: [
      { ratio: 1.0, low: 2.0, high: 3.5 },
      { ratio: 1.5, low: 1.0, high: 2.0 },
      { ratio: 2.0, low: 0.5, high: 1.5 }
    ],
    // 研究の多くは6〜8週間。9週目からは半分のペースで控えめに計算する。
    fullRateWeeks: 8,
    lateFactor: 0.5,
    // 目標の週数を探す上限
    searchWeeks: 52,

    // グラフと「近い研究」に使う研究のグループ。
    // pre と gain があるものは kg、pct だけのものは論文の % を使う。
    studies: [
      { id: 'cholewa', ref: 'cholewa2018', who: '筋トレ未経験の女性', group: 'プラセボ群', ratio: 0.85, weeks: 8, pre: 57.2, gain: 16.7, how: '下半身の日を週2回。3セットを限界まで' },
      { id: 'wetmore-weak', ref: 'wetmore2020', who: '男性・体重比が低いグループ', group: '', ratio: 1.17, weeks: 11, pct: 25.9, how: '週3回のブロック型（筋持久力→最大筋力→追い込み→量を減らす）' },
      { id: 'schoenfeld-1', ref: 'schoenfeld2019', who: '筋トレ経験者の男性', group: '1種目1セット', ratio: 1.27, weeks: 8, pre: 104.5, gain: 18.9, how: '週3回・8〜12回を限界まで', approxRatio: true },
      { id: 'schoenfeld-5', ref: 'schoenfeld2019', who: '筋トレ経験者の男性', group: '1種目5セット', ratio: 1.29, weeks: 8, pre: 106.6, gain: 19.6, how: '週3回・8〜12回を限界まで', approxRatio: true },
      { id: 'schoenfeld-3', ref: 'schoenfeld2019', who: '筋トレ経験者の男性', group: '1種目3セット', ratio: 1.39, weeks: 8, pre: 114.9, gain: 13.6, how: '週3回・8〜12回を限界まで', approxRatio: true },
      { id: 'wetmore-mod', ref: 'wetmore2020', who: '男性・体重比が中くらいのグループ', group: '', ratio: 1.46, weeks: 11, pct: 18.2, how: '週3回のブロック型（筋持久力→最大筋力→追い込み→量を減らす）' },
      { id: 'helms-pct', ref: 'helms2018', who: '2年以上の経験者の男性', group: '%で重さを決めた群', ratio: 1.74, weeks: 8, pre: 139.2, gain: 13.9, how: '週3回・日ごとに回数を変える方式' },
      { id: 'helms-rpe', ref: 'helms2018', who: '2年以上の経験者の男性', group: 'きつさで重さを決めた群', ratio: 1.82, weeks: 8, pre: 143.7, gain: 17.1, how: '週3回・日ごとに回数を変える方式' },
      { id: 'travis-step', ref: 'travis2021', who: 'パワーリフティング選手', group: '最後に1週軽くした群', ratio: 1.94, weeks: 6, pre: 175.3, gain: 14.9, how: '追い込む週のあとに軽い週を入れて測定', approxRatio: true },
      { id: 'travis-exp', ref: 'travis2021', who: 'パワーリフティング選手', group: '3週かけて軽くした群', ratio: 1.94, weeks: 6, pre: 174.1, gain: 20.4, how: '追い込む週のあとに3週かけて量を減らして測定', approxRatio: true },
      { id: 'wetmore-strong', ref: 'wetmore2020', who: '男性・体重比が高いグループ', group: '', ratio: 1.96, weeks: 11, pct: 11.3, how: '週3回のブロック型（筋持久力→最大筋力→追い込み→量を減らす）' },
      { id: 'aube-12', ref: 'aube2022', who: '体重の2倍以上を挙げる経験者', group: '下半身 週12セット', ratio: 2.09, weeks: 8, pct: 11.3, gainKg: 18.3, how: '週2回' },
      { id: 'aube-18', ref: 'aube2022', who: '体重の2倍以上を挙げる経験者', group: '下半身 週18セット', ratio: 2.09, weeks: 8, pct: 16.2, gainKg: 25.5, how: '週2回' },
      { id: 'aube-24', ref: 'aube2022', who: '体重の2倍以上を挙げる経験者', group: '下半身 週24セット', ratio: 2.09, weeks: 8, pct: 5.4, gainKg: 9.5, how: '週2回' }
    ],

    // メニューの段階。回数と余力（あと何回できるか）から重さを決める。
    phases: {
      base: { name: '基礎', reps: [8], rir: [3, 2], sets: 3, note: '8回で、フォームを固めながら量をこなす段階です。' },
      strength: { name: '筋力', reps: [5], rir: [2, 1], sets: 3, note: '5回で、重さに慣れる段階です。MAXの80%を超える重さになります。' },
      peak: { name: '仕上げ', reps: [3, 2], rir: [2, 1], sets: 3, note: '3回と2回で、MAXに近い重さに体を慣らす段階です。' }
    },
    phaseShare: { base: 0.4, strength: 0.35 },

    // 日ごとの変化（重い日を基準に、回数と余力を変える）
    dayTypes: {
      heavy: { name: '重い日', repsAdd: 0, rirAdd: 0, sets: null },
      light: { name: '軽い日', repsAdd: 0, rirAdd: 6, sets: 2 },
      volume: { name: '回数の日', repsAdd: 3, rirAdd: 1, sets: 3 }
    },
    dayPlan: {
      2: ['heavy', 'volume'],
      3: ['heavy', 'light', 'volume']
    },

    rest: { heavy: '3〜5分', light: '2〜3分', volume: '3〜4分' },
    step: 2.5,
    bar: 20,

    // 測定の日のウォームアップ（1本目の重さに対する割合と回数）
    warmup: [
      { pct: 0.5, reps: 5 },
      { pct: 0.7, reps: 3 },
      { pct: 0.8, reps: 2 },
      { pct: 0.9, reps: 1 }
    ],

    refs: {
      kubo2019: { short: 'Kubo 2019', text: 'Kubo, K., Ikebukuro, T., & Yata, H. (2019). Effects of squat training with different depths on lower limb muscle volumes. European Journal of Applied Physiology, 119(9), 1933–1942.', doi: '10.1007/s00421-019-04181-y' },
      wetmore2020: { short: 'Wetmore 2020', text: 'Wetmore, A. B., Moquin, P. A., Carroll, K. M., Fry, A. C., Hornsby, W. G., & Stone, M. H. (2020). The effect of training status on adaptations to 11 weeks of block periodization training. Sports, 8(11), 145.', doi: '10.3390/sports8110145' },
      cholewa2018: { short: 'Cholewa 2018', text: 'Cholewa, J. M., Hudson, A., Cicholski, T., et al. (2018). The effects of chronic betaine supplementation on body composition and performance in collegiate females: A double-blind, randomized, placebo controlled trial. Journal of the International Society of Sports Nutrition, 15, 37.', doi: '10.1186/s12970-018-0243-x' },
      schoenfeld2019: { short: 'Schoenfeld 2019', text: 'Schoenfeld, B. J., Contreras, B., Krieger, J., et al. (2019). Resistance training volume enhances muscle hypertrophy but not strength in trained men. Medicine & Science in Sports & Exercise, 51(1), 94–103.', doi: '10.1249/MSS.0000000000001764' },
      helms2018: { short: 'Helms 2018', text: 'Helms, E. R., Byrnes, R. K., Cooke, D. M., et al. (2018). RPE vs. percentage 1RM loading in periodized programs matched for sets and repetitions. Frontiers in Physiology, 9, 247.', doi: '10.3389/fphys.2018.00247' },
      aube2022: { short: 'Aube 2022', text: 'Aube, D., Wadhi, T., Rauch, J., et al. (2022). Progressive resistance training volume: Effects on muscle thickness, mass, and strength adaptations in resistance-trained individuals. Journal of Strength and Conditioning Research, 36(3), 600–607.', doi: '10.1519/JSC.0000000000003524' },
      travis2021: { short: 'Travis 2021', text: 'Travis, S. K., Zwetsloot, K. A., Mujika, I., Stone, M. H., & Bazyler, C. D. (2021). Skeletal muscle adaptations and performance outcomes following a step and exponential taper in strength athletes. Frontiers in Physiology, 12, 735932.', doi: '10.3389/fphys.2021.735932' }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
