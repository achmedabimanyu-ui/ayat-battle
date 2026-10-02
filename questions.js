/* Pembuat soal: Susun, Sambung, Lanjutkan, Tebak surat. Tingkat: easy / medium / hard.
   Hard memakai pengecoh yang mirip (mutasyabihat) dan kartu jebakan di Susun. */
window.Questions = (() => {
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const MAX_CARD = 7, MAX_PROMPT = 10;
  const LV = {
    easy:   { opts:2, chunks:3, auto:true,  th:.55 },
    medium: { opts:3, chunks:4, auto:true,  th:.68 },
    hard:   { opts:4, chunks:5, auto:false, th:.8, decoy:true }
  };

  function chunk(words, maxK){
    const n = words.length;
    let k = Math.min(maxK, Math.max(2, Math.ceil(n / 3)));
    k = Math.min(k, n);
    const base = Math.floor(n / k), extra = n % k, out = [];
    let i = 0;
    for (let c = 0; c < k; c++){ const size = base + (c < extra ? 1 : 0); out.push(words.slice(i, i + size).join(" ")); i += size; }
    return out;
  }
  const headW = w => w.slice(0, MAX_CARD);
  const head = w => w.length > MAX_CARD ? headW(w).join(" ") + " ..." : w.join(" ");
  const tail = w => w.length > MAX_PROMPT ? "... " + w.slice(-MAX_PROMPT).join(" ") : w.join(" ");
  const front = w => w.length > MAX_PROMPT + 2 ? w.slice(0, MAX_PROMPT).join(" ") + " ..." : w.join(" ");
  const halves = w => { const m = Math.ceil(w.length / 2); return [w.slice(0, m), w.slice(m)]; };

  function prefer(pool, maxWords, need){
    const short = pool.filter(x => x.w.length <= maxWords);
    return short.length >= Math.min(need, 4) ? short : pool;
  }

  // pilih pengecoh sesuai level. cands: [{t, n, s}]
  function pickWrong(cands, ans, L, homeSurah){
    const seen = new Set([ans.t]);
    let list = cands.filter(c => !seen.has(c.t) && seen.add(c.t));
    if (L === LV.hard){
      list = list.map(c => [c, Quran.sim(ans.n, c.n)]).sort((a, b) => b[1] - a[1]).map(a => a[0]);
    } else if (L === LV.medium){
      list = shuffle(list).sort((a, b) => (b.s === homeSurah) - (a.s === homeSurah));
    } else {
      list = shuffle(list).filter(c => Quran.sim(ans.n, c.n) < .55).sort((a, b) => (a.s === homeSurah) - (b.s === homeSurah));
    }
    return list.slice(0, L.opts - 1).map(c => c.t);
  }

  function build(mode, verses, rounds, names, level = "medium"){
    const L = LV[level] || LV.medium;
    const ayahs = verses.map(v => { const w = Quran.words(v.t); return { ...v, w, n:Quran.norm(v.t), name:names[v.s] }; });
    const byKey = new Map(ayahs.map(x => [`${x.s}:${x.a}`, x]));
    const nextOf = x => byKey.get(`${x.s}:${x.a + 1}`);
    const opt = t => ({ t, n:Quran.norm(t) });

    let pool;
    if (mode === "susun") pool = prefer(ayahs.filter(x => x.w.length >= 2), level === "easy" ? 9 : 15, rounds);
    else if (mode === "sambung") pool = prefer(ayahs.filter(x => x.w.length >= 3), 14, rounds);
    else if (mode === "tebak") pool = prefer(ayahs.filter(x => x.w.length >= 2), 14, rounds);
    else pool = prefer(ayahs.filter(nextOf), 14, rounds);
    if (!pool.length) return [];

    const picks = [];
    while (picks.length < rounds) picks.push(...shuffle(pool));
    picks.length = rounds;

    return picks.map(x => {
      const label = `${x.name}, ayat ${x.a}`;
      const auto = L.auto ? [x.s, x.a] : null;

      if (mode === "susun"){
        const parts = chunk(x.w, L.chunks);
        let cards = parts.slice();
        if (L.decoy){
          // kartu jebakan dari ayat yang paling mirip
          const twin = ayahs.filter(o => o !== x && o.w.length >= 2)
            .map(o => [o, Quran.sim(x.n, o.n)]).sort((a, b) => b[1] - a[1])[0]?.[0];
          const fake = twin && shuffle(chunk(twin.w, L.chunks)).find(p => !parts.includes(p));
          if (fake) cards.push(fake);
        }
        return { label, prompt:null, slots:parts, cards:shuffle(cards), playStart:auto, playEnd:[x.s, x.a],
                 hint:[x.s, x.a], voice:x.t, th:L.th };
      }

      if (mode === "sambung"){
        const [first, second] = halves(x.w);
        const ans = opt(head(second));
        const cands = pool.filter(o => o !== x).map(o => ({ ...opt(head(halves(o.w)[1])), s:o.s }));
        return { label, prompt:tail(first) + " ...", slots:[ans.t], cards:shuffle([ans.t, ...pickWrong(cands, ans, L, x.s)]),
                 playStart:null, playEnd:[x.s, x.a], hint:[x.s, x.a], voice:headW(second).join(" "), th:L.th };
      }

      if (mode === "tebak"){
        const answer = names[x.s];
        const all = Object.keys(names).map(Number);
        let wrong;
        if (L === LV.hard){
          // surat yang memuat ayat mirip, lalu surat tetangga
          const twins = ayahs.filter(o => o.s !== x.s).map(o => [o.s, Quran.sim(x.n, o.n)])
            .filter(a => a[1] > .45).sort((a, b) => b[1] - a[1]).map(a => a[0]);
          wrong = [...twins, x.s - 1, x.s + 1, x.s - 2, x.s + 2, ...shuffle(all)];
        } else if (L === LV.medium){
          const inPool = [...new Set(ayahs.map(o => o.s))];
          wrong = [...shuffle(inPool), x.s + 1, x.s - 1, ...shuffle(all)];
        } else {
          wrong = shuffle(all).filter(s => Math.abs(s - x.s) > 5);
        }
        wrong = [...new Set(wrong)].filter(s => s !== x.s && names[s]).slice(0, L.opts - 1).map(s => names[s]);
        return { label:"Ayat ini dari surat apa?", prompt:front(x.w), slots:[answer], cards:shuffle([answer, ...wrong]),
                 playStart:auto, playEnd:[x.s, x.a], hint:[x.s, x.a], latin:true, reveal:label, th:L.th };
      }

      const nx = nextOf(x), ans = opt(head(nx.w));
      const cands = ayahs.filter(o => o !== nx && o !== x).map(o => ({ ...opt(head(o.w)), s:o.s }));
      return { label:`${label}, lanjutannya?`, prompt:tail(x.w), slots:[ans.t], cards:shuffle([ans.t, ...pickWrong(cands, ans, L, x.s)]),
               playStart:auto, playEnd:[nx.s, nx.a], hint:[x.s, x.a], voice:headW(nx.w).join(" "), th:L.th };
    });
  }

  return { build, LV };
})();

// satu pintu untuk semua jenis soal
Questions.make = async o => {
  if (o.mode === "hijaiyah") return Hijaiyah.build(o);
  const verses = await Quran.load(o.pick);
  return Questions.build(o.mode, verses, +o.rounds, o.names, o.level);
};
