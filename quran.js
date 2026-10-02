/* Mengambil teks Utsmani dari API resmi (tidak diketik manual), lalu disimpan di browser. */
window.Quran = (() => {
  const KEY = "ab_quran_v1";
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch(e){}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch(e){} };

  async function fromQuranCom(no){
    const r = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${no}`);
    if (!r.ok) throw new Error("qc " + r.status);
    const j = await r.json();
    return j.verses.map(v => v.text_uthmani.trim());
  }
  async function fromAlquranCloud(no){
    const r = await fetch(`https://api.alquran.cloud/v1/surah/${no}/quran-uthmani`);
    if (!r.ok) throw new Error("aq " + r.status);
    const j = await r.json();
    return j.data.ayahs.map((a, i) => {
      let t = a.text.trim();
      // edisi ini menempelkan basmalah di ayat 1 (selain Al-Fatihah); dibuang
      if (i === 0 && no !== 1 && no !== 9 && t.startsWith("بِسْمِ")) t = t.split(/\s+/).slice(4).join(" ");
      return t;
    });
  }

  async function load(list){
    for (const no of list){
      if (cache[no]?.length) continue;
      try { cache[no] = await fromQuranCom(no); }
      catch(e){ cache[no] = await fromAlquranCloud(no); }
    }
    persist();
    return Object.fromEntries(list.map(no => [no, cache[no]]));
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
