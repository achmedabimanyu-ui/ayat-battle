/* Rekaman suara guru untuk huruf & huruf berharakat.
   Disimpan di perangkat (IndexedDB). Bisa diekspor menjadi folder "audio" untuk diunggah ke GitHub,
   supaya semua perangkat santri ikut mendengar. */
window.Rec = (() => {
  const DB = "ab_rec", STORE = "clips";
  let db = null, local = new Map(), repo = {}, urls = new Map(), ready = null;

  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = (mode, fn) => new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), st = t.objectStore(STORE), out = fn(st);
    t.oncomplete = () => res(out?.result); t.onerror = () => rej(t.error);
  });

  async function init(){
    if (ready) return ready;
    return ready = (async () => {
      try {
        db = await open();
        const keys = await tx("readonly", st => st.getAllKeys());
        const vals = await tx("readonly", st => st.getAll());
        keys.forEach((k, i) => local.set(k, vals[i]));
      } catch(e){ console.warn("rec db", e); }
      try {
        const r = await fetch("audio/manifest.json", { cache:"no-cache" });
        if (r.ok) repo = await r.json();
      } catch(e){}
    })();
  }

  const extOf = type => /mp4|aac|m4a/.test(type) ? "m4a" : /ogg/.test(type) ? "ogg" : "webm";
  const has = key => local.has(key) || !!repo[key];
  function url(key){
    if (local.has(key)){
      if (!urls.has(key)) urls.set(key, URL.createObjectURL(local.get(key)));
      return urls.get(key);
    }
    return repo[key] ? `audio/${key}.${repo[key]}` : null;
  }
  async function save(key, blob){
    await tx("readwrite", st => st.put(blob, key));
    local.set(key, blob);
    if (urls.has(key)){ URL.revokeObjectURL(urls.get(key)); urls.delete(key); }
  }
  async function del(key){
    await tx("readwrite", st => st.delete(key));
    local.delete(key);
    if (urls.has(key)){ URL.revokeObjectURL(urls.get(key)); urls.delete(key); }
  }

  // ---- perekam ----
  let stream = null, mr = null;
  async function record(maxMs = 3000){
    stream ||= await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true } });
    const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || "";
    mr = new MediaRecorder(stream, type ? { mimeType:type } : undefined);
    const chunks = [];
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(res => { mr.onstop = () => res(new Blob(chunks, { type:mr.mimeType || type || "audio/webm" })); });
    mr.start();
    const t = setTimeout(() => stopRec(), maxMs);
    const blob = await done; clearTimeout(t);
    return blob;
  }
  function stopRec(){ if (mr && mr.state === "recording") mr.stop(); }
  function release(){ stream?.getTracks().forEach(t => t.stop()); stream = null; }

  // ---- ekspor folder audio (zip) ----
  async function exportZip(){
    if (!window.JSZip){
      await new Promise((res, rej) => { const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    const zip = new JSZip(), dir = zip.folder("audio"), manifest = { ...repo };
    for (const [k, b] of local){ const e = extOf(b.type); dir.file(`${k}.${e}`, b); manifest[k] = e; }
    // rekaman lama dari repo ikut dimasukkan supaya manifest lengkap
    for (const [k, e] of Object.entries(repo)){
      if (local.has(k)) continue;
      try { const r = await fetch(`audio/${k}.${e}`); if (r.ok) dir.file(`${k}.${e}`, await r.blob()); } catch(err){}
    }
    dir.file("manifest.json", JSON.stringify(manifest));
    const blob = await zip.generateAsync({ type:"blob" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "audio-ayat-battle.zip"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  return { init, has, url, save, del, record, stopRec, release, exportZip,
           get count(){ return new Set([...local.keys(), ...Object.keys(repo)]).size; },
           isLocal:k => local.has(k), isRepo:k => !!repo[k] };
})();
