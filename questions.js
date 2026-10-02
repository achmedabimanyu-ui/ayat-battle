/* Pembuat soal: Susun, Sambung, Lanjutkan */
window.Questions = (() => {
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const uniq = a => [...new Set(a)];

  function chunk(words){
    const n = words.length;
    let k = Math.min(5, Math.max(2, Math.ceil(n / 3)));
    k = Math.min(k, n);
    const base = Math.floor(n / k), extra = n % k, out = [];
    let i = 0;
    for (let c = 0; c < k; c++){ const size = base + (c < extra ? 1 : 0); out.push(words.slice(i, i + size).join(" ")); i += size; }
    return out;
  }
  const halves = w => { const m = Math.ceil(w.length / 2); return [w.slice(0, m).join(" "), w.slice(m).join(" ")]; };

  function build(mode, data, rounds, names){
    const ayahs = [];
    for (const [s, list] of Object.entries(data)) list.forEach((t, i) => ayahs.push({ s:+s, a:i + 1, t, w:Quran.words(t), name:names[s] }));

    let pool;
    if (mode === "susun") pool = ayahs.filter(x => x.w.length >= 2);
    else if (mode === "sambung") pool = ayahs.filter(x => x.w.length >= 3);
    else pool = ayahs.filter(x => data[x.s][x.a]);           // punya ayat sesudahnya
    if (!pool.length) return [];

    const picks = [];
    while (picks.length < rounds) picks.push(...shuffle(pool));
    picks.length = rounds;

    return picks.map(x => {
      const label = `${x.name}, ayat ${x.a}`;
      if (mode === "susun"){
        const parts = chunk(x.w);
        return { label, prompt:null, slots:parts, cards:shuffle(parts), playStart:[x.s, x.a], playEnd:[x.s, x.a] };
      }
      if (mode === "sambung"){
        const [first, second] = halves(x.w);
        const others = shuffle(uniq(pool.filter(o => o !== x).map(o => halves(o.w)[1]).filter(t => t !== second)));
        return { label, prompt:first + " ...", slots:[second], cards:shuffle([second, ...others.slice(0, 2)]),
                 playStart:null, playEnd:[x.s, x.a], hint:[x.s, x.a] };
      }
      const next = data[x.s][x.a];
      const same = ayahs.filter(o => o.s === x.s && o.t !== next && o.t !== x.t).map(o => o.t);
      const other = ayahs.filter(o => o.s !== x.s && o.t !== next).map(o => o.t);
      const wrong = uniq([...shuffle(same), ...shuffle(other)]).slice(0, 2);
      return { label:`${label}, lanjutannya?`, prompt:x.t, slots:[next], cards:shuffle([next, ...wrong]),
               playStart:[x.s, x.a], playEnd:[x.s, x.a + 1], hint:[x.s, x.a] };
    });
  }

  return { build };
})();
