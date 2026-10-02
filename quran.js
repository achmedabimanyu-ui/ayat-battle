/* Teks Utsmani dari API resmi (Quran.com, cadangan alquran.cloud). Tidak ada yang diketik manual.
   Disimpan di browser per ayat ("surat:ayat"), jadi tidak dobel walau dimuat per surat maupun per juz. */
window.Quran = (() => {
  const KEY = "ab_quran_v2";
  let store = { v:{}, s:{}, j:{} };            // v: ayat, s: surat yang lengkap, j: juz yang lengkap
  try { store = { ...store, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch(e){}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch(e){ /* penyimpanan penuh: tetap jalan tanpa cache */ } };

  const stripBasmalah = (s, a, t) =>
    (a === 1 && s !== 1 && s !== 9 && t.startsWith("بِسْمِ")) ? t.split(/\s+/).slice(4).join(" ") : t;

  async function qc(param){
    const r = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?${param}`);
    if (!r.ok) throw new Error("qc " + r.status);
    return (await r.json()).verses.map(v => { const [s, a] = v.verse_key.split(":").map(Number); return { s, a, t:v.text_uthmani.trim() }; });
  }
  async function aqSurah(no){
    const r = await fetch(`https://api.alquran.cloud/v1/surah/${no}/quran-uthmani`);
    if (!r.ok) throw new Error("aq " + r.status);
    return (await r.json()).data.ayahs.map(x => ({ s:no, a:x.numberInSurah, t:stripBasmalah(no, x.numberInSurah, x.text.trim()) }));
  }
  async function aqJuz(n){
    const r = await fetch(`https://api.alquran.cloud/v1/juz/${n}/quran-uthmani`);
    if (!r.ok) throw new Error("aq " + r.status);
    return (await r.json()).data.ayahs.map(x => ({ s:x.surah.number, a:x.numberInSurah, t:stripBasmalah(x.surah.number, x.numberInSurah, x.text.trim()) }));
  }
  const save = list => list.forEach(x => { store.v[`${x.s}:${x.a}`] = x.t; });

  // pick = { by:"surah"|"juz", list:[...] }  ->  [{s,a,t}] urut mushaf
  async function load(pick){
    const keys = [];
    for (const n of pick.list){
      if (pick.by === "juz"){
        if (!store.j[n]){
          let list; try { list = await qc(`juz_number=${n}`); } catch(e){ list = await aqJuz(n); }
          save(list); store.j[n] = list.map(x => `${x.s}:${x.a}`);
        }
        keys.push(...store.j[n]);
      } else {
        const total = SURAHS[n - 1].ayat;
        if (!store.s[n]){
          let list; try { list = await qc(`chapter_number=${n}`); } catch(e){ list = await aqSurah(n); }
          save(list); store.s[n] = 1;
        }
        for (let a = 1; a <= total; a++) keys.push(`${n}:${a}`);
      }
    }
    persist();
    const seen = new Set();
    return keys.filter(k => store.v[k] && !seen.has(k) && seen.add(k))
      .map(k => { const [s, a] = k.split(":").map(Number); return { s, a, t:store.v[k] }; })
      .sort((x, y) => x.s - y.s || x.a - y.a);
  }

  // Pecah ayat menjadi kata; tanda waqaf yang berdiri sendiri digabung ke kata sebelumnya
  function words(text){
    const out = [];
    text.split(/\s+/).filter(Boolean).forEach(w => {
      if (/[\u0621-\u064A\u0671-\u06D3]/.test(w) || !out.length) out.push(w);
      else out[out.length - 1] += " " + w;
    });
    return out;
  }

  const pad = n => String(n).padStart(3, "0");
  const audioUrl = (qari, s, a) => `https://everyayah.com/data/${qari}/${pad(s)}${pad(a)}.mp3`;

  return { load, words, audioUrl };
})();
