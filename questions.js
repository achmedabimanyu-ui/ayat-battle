/* Pembuat soal: Susun, Sambung, Lanjutkan.
   Ayat panjang dipotong supaya kartu tetap nyaman dijepit atau ditembak. */
window.Questions = (() => {
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const uniq = a => [...new Set(a)];
  const MAX_CARD = 7;     // kata maksimal di satu kartu pilihan
  const MAX_PROMPT = 10;  // kata maksimal yang ditampilkan sebagai soal

  function chunk(words){
    const n = words.length;
    let k = Math.min(5, Math.max(2, Math.ceil(n / 3)));
    k = Math.min(k, n);
    const base = Math.floor(n / k), extra = n % k, out = [];
    let i = 0;
    for (let c = 0; c < k; c++){ const size = base + (c < extra ? 1 : 0); out.push(words.slice(i, i + size).join(" ")); i += size; }
    return out;
  }
  const head = w => w.length > MAX_CARD ? w.slice(0, MAX_CARD).join(" ") + " ..." : w.join(" ");
  const tail = w => w.length > MAX_PROMPT ? "... " + w.slice(-MAX_PROMPT).join(" ") : w.join(" ");
  const halves = w => { const m = Math.ceil(w.length / 2); return [w.slice(0, m), w.slice(m)]; };

  // pilih yang pendek dulu kalau stoknya cukup
  function prefer(pool, maxWords, need){
    const short = pool.filter(x => x.w.length <= maxWords);
    return short.length >= Math.min(need, 4) ? short : pool;
  }

  function build(mode, verses, rounds, names){
    const ayahs = verses.map(v => ({ ...v, w:Quran.words(v.t), name:names[v.s] }));
    const byKey = new Map(ayahs.map(x => [`${x.s}:${x.a}`, x]));
    const nextOf = x => byKey.get(`${x.s}:${x.a + 1}`);

    let pool;
    if (mode === "susun") pool = prefer(ayahs.filter(x => x.w.length >= 2), 15, rounds);
    else if (mode === "sambung") pool = prefer(ayahs.filter(x => x.w.length >= 3), 14, rounds);
    else pool = prefer(ayahs.filter(nextOf), 14, rounds);
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
        let [first, second] = halves(x.w);
        const answer = head(second);
        const others = shuffle(uniq(pool.filter(o => o !== x).map(o => head(halves(o.w)[1])).filter(t => t !== answer)));
        return { label, prompt:tail(first) + " ...", slots:[answer], cards:shuffle([answer, ...others.slice(0, 2)]),
                 playStart:null, playEnd:[x.s, x.a], hint:[x.s, x.a] };
      }
      const nx = nextOf(x), answer = head(nx.w);
      const same = ayahs.filter(o => o.s === x.s && o !== nx && o !== x).map(o => head(o.w));
      const other = ayahs.filter(o => o.s !== x.s).map(o => head(o.w));
      const wrong = uniq([...shuffle(same), ...shuffle(other)]).filter(t => t !== answer).slice(0, 2);
      return { label:`${label}, lanjutannya?`, prompt:tail(x.w), slots:[answer], cards:shuffle([answer, ...wrong]),
               playStart:[x.s, x.a], playEnd:[nx.s, nx.a], hint:[x.s, x.a] };
    });
  }

  return { build };
})();
