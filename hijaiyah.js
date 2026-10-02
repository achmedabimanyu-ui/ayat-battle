/* Soal hijaiyah: huruf satuan, huruf sambung, berharakat, dan kata Al-Qur'an per tahap.
   Kata diambil dari API Quran.com (teks Utsmani + audio per kata), bukan diketik manual. */
window.Hijaiyah = (() => {
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.random() * a.length | 0];
  const OPTS = { easy:2, medium:3, hard:4 };
  const byCh = ch => HIJAIYAH.find(h => h.ch === ch);
  const rid = h => "h" + String(HIJAIYAH.indexOf(h)).padStart(2, "0");            // rekaman nama huruf
  const sid = (h, v) => rid(h).replace("h", "s") + "-" + v;                          // rekaman bunyi berharakat
  const rec = key => (window.Rec && Rec.has(key)) ? { rec:key } : null;
  const twinsOf = ch => (HIJ_MIRIP.find(g => g.includes(ch)) || []).filter(x => x !== ch);
  const clash = (a, b) => (a === "ح" && b === "ه") || (a === "ه" && b === "ح");   // nama "Ha" mirip

  // pengecoh huruf sesuai level
  function wrongLetters(ch, level, pool = HIJAIYAH.map(h => h.ch)){
    const n = OPTS[level] - 1;
    let list = shuffle(pool.filter(x => x !== ch && !clash(ch, x)));
    if (level === "hard") list = [...shuffle(twinsOf(ch)), ...list];
    if (level === "easy") list = list.filter(x => !twinsOf(ch).includes(x));
    return [...new Set(list)].slice(0, n);
  }

  // ---------- bunyi berharakat ----------
  const MARK = { a:"\u064E", i:"\u0650", u:"\u064F", an:"\u064B", in:"\u064D", un:"\u064C" };
  function syllable(h, v){
    let vowel = v;
    if (h.heavy && v[0] === "a") vowel = "o" + v.slice(1);   // huruf tebal dibaca "o": kho, ro, qo
    return (h.c || "") + vowel;
  }
  function glyph(h, v){
    const base = h.ch === "ء" ? "ء" : h.ch;
    if (v === "an" && !["ء","ة"].includes(base)) return base + MARK.an + (h.ch === "ا" ? "" : "ا");
    return base + MARK[v];
  }

  // ---------- bentuk sambung ----------
  const T = "\u0640";
  function forms(h){
    if (h.ch === "ء") return [];
    const f = [{ txt:T + h.ch, pos:"di akhir" }];
    if (h.joins) f.push({ txt:h.ch + T, pos:"di awal" }, { txt:T + h.ch + T, pos:"di tengah" });
    return f;
  }

  // ---------- kata Al-Qur'an ----------
  const WKEY = "ab_words_v2";
  let wcache = {};
  try { wcache = JSON.parse(localStorage.getItem(WKEY) || "{}"); } catch(e){}
  const wsave = () => { try { localStorage.setItem(WKEY, JSON.stringify(wcache)); } catch(e){} };

  async function fetchWords(kind, n){
    const out = []; let page = 1, total = 1;
    do {
      const r = await fetch(`https://api.quran.com/api/v4/verses/by_${kind}/${n}?words=true&word_fields=text_uthmani&per_page=50&page=${page}`);
      if (!r.ok) throw new Error("words " + r.status);
      const j = await r.json();
      total = j.pagination?.total_pages || 1;
      j.verses.forEach(v => v.words.forEach(w => {
        if (w.char_type_name !== "word" || !w.text_uthmani) return;
        const [vs, va] = v.verse_key.split(":").map(Number), p3 = n => String(n).padStart(3, "0");
        const own = w.position ? `wbw/${p3(vs)}_${p3(va)}_${p3(w.position)}.mp3` : "";
        out.push([w.text_uthmani, own || w.audio_url || "", w.transliteration?.text || "", v.verse_key]);
      }));
      page++;
    } while (page <= total && page < 40);
    return out;
  }
  async function loadWords(p){
    const all = [];
    for (const n of p.list){
      const key = `${p.by}:${n}`;
      if (!wcache[key]){
        try { wcache[key] = await fetchWords(p.by === "juz" ? "juz" : "chapter", n); }
        catch(e){
          // cadangan: kata dari teks ayat (tanpa audio per kata)
          const verses = await Quran.load({ by:p.by, list:[n] });
          wcache[key] = verses.flatMap(v => Quran.words(v.t).map(w => [w, "", "", `${v.s}:${v.a}`]));
        }
        wsave();
      }
      all.push(...wcache[key]);
    }
    const seen = new Set();
    return all.filter(w => !seen.has(w[0]) && seen.add(w[0]));
  }

  // ciri bacaan sebuah kata: 1 harakat, 2 tanwin, 3 mad, 4 sukun/alif lam, 5 tasydid & lainnya
  const LETTER = /[\u0621-\u064A\u0671]/;
  function featuresOf(word){
    const f = new Set([1]);
    if (/[\u0651\u06DF\u06E0\u06E2\u06E3\u06ED\u06EA-\u06EC\u0653\u06DC]/.test(word)) f.add(5);
    if (/[\u0652\u06E1\u0671]/.test(word)) f.add(4);
    if (/[\u0670\u06E5\u06E6]/.test(word)) f.add(3);
    if (/[\u064B-\u064D\u08F0-\u08F2]/.test(word)) f.add(2);
    const chars = [...word.replace(/[\u06D6-\u06DB\u06DD\u06DE\u06E9]/g, "")];
    chars.forEach((c, i) => {
      if (!LETTER.test(c)) return;
      let j = i + 1, marks = "";
      while (j < chars.length && !LETTER.test(chars[j])) marks += chars[j++];
      if (marks) return;
      const prev = chars.slice(0, i).join("");
      if ((c === "ا" || c === "ى") && /[\u064B\u08F0]\s*$/.test(prev)) return;   // alif penyangga tanwin
      if ("اويى".includes(c)) f.add(3);                    // huruf mad tanpa harakat
      else if (c !== "\u0671") f.add(5);                  // huruf tanpa tanda (idgham, dll)
    });
    return f;
  }
  const tahapOf = w => Math.max(...featuresOf(w));
  const letters = w => (w.match(/[\u0621-\u064A\u0671]/g) || []).length;
  const audioOf = a => !a ? null : a.startsWith("http") ? a : "https://audio.qurancdn.com/" + a;

  // ---------- pembuat soal ----------
  async function build(o){
    const level = o.level || "easy", rounds = +o.rounds || 10, n = OPTS[level];
    const write = o.control === "write", voice = o.control === "voice";
    const qs = [];

    if (o.materi === "huruf"){
      const pool = shuffle(HIJAIYAH);
      for (let i = 0; i < rounds; i++){
        const h = pool[i % pool.length];
        if (write){
          qs.push({ label:"Tulis huruf ini", prompt:h.name, promptClass:"big-latin", slots:[h.ch], cards:[],
                    playStart:rec(rid(h)), hint:rec(rid(h)),
                    write:{ target:h.ch, guide: level === "easy", show: level !== "hard", others:wrongLetters(h.ch, "hard") },
                    reveal:`${h.ch}  ${h.name}` });
          continue;
        }
        if (i % 2 === 0){
          qs.push({ label:"Mana huruf ini?", prompt:h.name, promptClass:"big-latin", slots:[h.ch],
                    playStart:rec(rid(h)), hint:rec(rid(h)),
                    cards:shuffle([h.ch, ...wrongLetters(h.ch, level)]), cardClass:"letter", reveal:`${h.name}` });
        } else {
          const names = wrongLetters(h.ch, level).map(c => byCh(c).name);
          qs.push({ label:"Apa nama huruf ini?", prompt:h.ch, promptClass:"big-hij", slots:[h.name], playEnd:rec(rid(h)),
                    cards:shuffle([h.name, ...names]), cardClass:"latin" });
        }
      }
      return qs;
    }

    if (o.materi === "sambung"){
      const items = shuffle(HIJAIYAH.flatMap(h => forms(h).map(f => ({ h, ...f }))));
      for (let i = 0; i < rounds; i++){
        const it = items[i % items.length];
        const base = { label:`Huruf apa ini? (${it.pos} kata)`, prompt:it.txt, promptClass:"big-hij", slots:[it.h.ch], reveal:`${it.h.ch}  ${it.h.name}`, playEnd:rec(rid(it.h)) };
        if (write) qs.push({ ...base, label:`Tulis huruf aslinya (${it.pos} kata)`, cards:[], write:{ target:it.h.ch, guide: level === "easy", show:true, others:wrongLetters(it.h.ch, "hard") } });
        else qs.push({ ...base, cards:shuffle([it.h.ch, ...wrongLetters(it.h.ch, level, HIJAIYAH.filter(x => x.ch !== "ء").map(x => x.ch))]), cardClass:"letter" });
      }
      return qs;
    }

    if (o.materi === "harakat"){
      const vowels = level === "easy" ? ["a","i","u"] : level === "medium" ? ["a","i","u","an","in","un"] : ["a","i","u","an","in","un"];
      const letterPool = HIJAIYAH.filter(h => h.ch !== "ء");
      for (let i = 0; i < rounds; i++){
        const h = pick(letterPool), v = pick(vowels), ans = { g:glyph(h, v), s:syllable(h, v) }, snd = rec(sid(h, v));
        let wrong;
        if (level === "hard"){
          const tw = twinsOf(h.ch).map(byCh).filter(Boolean);
          wrong = [...shuffle(vowels.filter(x => x !== v)).map(x => ({ g:glyph(h, x), s:syllable(h, x) })),
                   ...shuffle(tw).map(t => ({ g:glyph(t, v), s:syllable(t, v) }))];
          wrong = shuffle(wrong);
        } else if (level === "medium"){
          wrong = shuffle(vowels.filter(x => x !== v)).map(x => ({ g:glyph(h, x), s:syllable(h, x) }));
        } else {
          wrong = shuffle(letterPool.filter(x => x !== h && !twinsOf(h.ch).includes(x.ch))).map(t => ({ g:glyph(t, v), s:syllable(t, v) }));
        }
        const seen = new Set([ans.s]); wrong = wrong.filter(w => !seen.has(w.s) && seen.add(w.s)).slice(0, n - 1);
        if (i % 2 === 0)
          qs.push({ label:"Bagaimana bacaannya?", prompt:ans.g, promptClass:"big-hij", slots:[ans.s],
                    cards:shuffle([ans.s, ...wrong.map(w => w.s)]), cardClass:"latin", playEnd:snd });
        else
          qs.push({ label: snd ? "Dengarkan, mana bacaannya?" : `Mana yang dibaca "${ans.s}"?`, prompt:ans.s, promptClass:"big-latin", slots:[ans.g],
                    cards:shuffle([ans.g, ...wrong.map(w => w.g)]), cardClass:"letter", playStart:snd, hint:snd, playEnd:snd });
      }
      return qs;
    }

    // ---- kata Al-Qur'an ----
    const words = await loadWords(o.pick);
    const tahap = +o.tahap || 1;
    const maxLen = level === "easy" ? 4 : level === "medium" ? 6 : 99;
    const enriched = words.map(w => {
      const f = featuresOf(w[0]);
      return { t:w[0], audio:audioOf(w[1]), tr:w[2], key:w[3], f, tahap:Math.max(...f), len:letters(w[0]), n:Quran.norm(w[0]) };
    }).filter(w => w.len >= 2);
    // utamakan kata yang MEMUAT materi tahap ini dan tidak memuat materi tahap di atasnya
    const hasNew = w => tahap === 1 || w.f.has(tahap);
    const tries = [
      w => w.tahap <= tahap && hasNew(w) && w.len <= maxLen,
      w => w.tahap <= tahap && hasNew(w),
      w => hasNew(w) && w.tahap <= tahap + 1,
      w => w.tahap <= tahap
    ];
    let pool = [];
    for (const t of tries){ pool = enriched.filter(t); if (pool.length >= 4) break; }
    if (pool.length < 2) return [];
    const order = []; while (order.length < rounds) order.push(...shuffle(pool)); order.length = rounds;

    return order.map(w => {
      let cands = pool.filter(x => x.t !== w.t);
      if (level === "hard") cands = cands.map(x => [x, Quran.sim(w.n, x.n)]).sort((a, b) => b[1] - a[1]).map(a => a[0]);
      else if (level === "easy") cands = shuffle(cands).filter(x => Quran.sim(w.n, x.n) < .5);
      else cands = shuffle(cands);
      const wrong = [...new Set(cands.map(x => x.t))].slice(0, n - 1);
      const reveal = `${w.tr ? w.tr + "  " : ""}(QS ${w.key})`;
      if (voice) return { label:"Baca kata ini", prompt:w.t, promptClass:"big-ar", slots:[w.t], cards:[], voice:w.t, th:{ easy:.55, medium:.68, hard:.8 }[level],
                          playEnd:w.audio ? { url:w.audio } : null, hint:w.audio ? { url:w.audio } : null, reveal };
      if (w.audio) return { label:"Dengarkan, lalu pilih kata yang dibaca", prompt:"Tekan Dengar untuk mengulang", slots:[w.t],
                            cards:shuffle([w.t, ...wrong]), cardClass:"word", playStart:{ url:w.audio }, playEnd:{ url:w.audio }, hint:{ url:w.audio }, reveal };
      return { label:"Cari kata yang sama", prompt:w.t, promptClass:"big-ar", slots:[w.t], cards:shuffle([w.t, ...wrong]), cardClass:"word", reveal };
    });
  }

  return { build, tahapOf, featuresOf, syllable, glyph, rid, sid };
})();
