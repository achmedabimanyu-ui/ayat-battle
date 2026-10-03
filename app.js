(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // ---------- STATE (tersimpan di browser) ----------
  const defaults = { name:"", qari:"Husary_128kbps", time:"30", rounds:"10", sound:true, level:"easy", materi:"huruf", tahap:1, bgm:"1", duelQ:"diff",
                     surahs:[112,113,114], mode:"susun", control:"touch", play:"solo" };
  let S = { ...defaults };
  try { S = { ...defaults, ...JSON.parse(localStorage.getItem("ayatBattle") || "{}") }; } catch(e){}
  const save = () => { try { localStorage.setItem("ayatBattle", JSON.stringify(S)); } catch(e){} };

  // ---------- SOUND (suara klik kayu, tanpa file) ----------
  let actx;
  function knock(freq = 220){
    if (!S.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(freq, actx.currentTime);
      o.frequency.exponentialRampToValueAtTime(freq/2, actx.currentTime + .12);
      g.gain.setValueAtTime(.25, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, actx.currentTime + .15);
      o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + .16);
    } catch(e){}
  }
  document.addEventListener("pointerdown", e => { if (e.target.closest("button")) knock(); });

  function renderSoundBtn(){
    $("#btnSound use").setAttribute("href", S.sound ? "#i-sound" : "#i-mute");
    $("#btnSound").setAttribute("aria-label", S.sound ? "Matikan suara" : "Nyalakan suara");
  }
  $("#btnSound").onclick = () => { S.sound = !S.sound; save(); renderSoundBtn(); bgmSync(); };

  // ---------- NAVIGATION ----------
  const bgmOK = () => S.sound && S.bgm === "1";
  let current = "home";
  function bgmSync(){ if (bgmOK() && current !== "arena") Bgm.start(); else Bgm.stop(); }
  document.addEventListener("pointerdown", () => bgmSync(), { once:true });
  function go(id){
    current = id; bgmSync();
    $$(".screen").forEach(s => s.classList.toggle("active", s.id === id));
    window.scrollTo(0,0);
  }
  $$("[data-go]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.play){ S.play = b.dataset.play; save(); $("#setupTitle").textContent = PLAY_TITLES[S.play]; validate(); }
    go(b.dataset.go);
  }));

  // ---------- PILIH BACAAN (per surat / per juz) ----------
  S.pickBy ||= "surah"; S.juzs ||= [];
  const grid = $("#surahGrid"), jgrid = $("#juzGrid");
  grid.innerHTML = SURAHS.map(s =>
    `<button class="surah" data-no="${s.no}" aria-pressed="false"><span class="no">${s.no}</span><b>${s.name}</b><small>${s.ayat} ayat</small></button>`
  ).join("");
  jgrid.innerHTML = JUZ_START.map(([s, a], i) =>
    `<button class="surah" data-juz="${i + 1}" aria-pressed="false"><span class="no">${i + 1}</span><b>Juz ${i + 1}</b><small>Mulai ${SURAHS[s - 1].name} ${a}</small></button>`
  ).join("");

  function renderPick(){
    $$(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.by === S.pickBy));
    $("#bySurah").hidden = S.pickBy !== "surah"; $("#byJuz").hidden = S.pickBy !== "juz";
    grid.querySelectorAll(".surah").forEach(b => b.setAttribute("aria-pressed", S.surahs.includes(+b.dataset.no)));
    jgrid.querySelectorAll(".surah").forEach(b => b.setAttribute("aria-pressed", S.juzs.includes(+b.dataset.juz)));
    if (S.pickBy === "surah"){
      const ayat = S.surahs.reduce((t, n) => t + SURAHS[n - 1].ayat, 0);
      $("#pickCount").textContent = S.surahs.length ? `${S.surahs.length} surat dipilih, ${ayat} ayat` : "Belum ada surat dipilih";
    } else $("#pickCount").textContent = S.juzs.length ? `${S.juzs.length} juz dipilih` : "Belum ada juz dipilih";
    validate();
  }
  $$(".tab").forEach(t => t.onclick = () => { S.pickBy = t.dataset.by; save(); renderPick(); });
  grid.addEventListener("click", e => {
    const b = e.target.closest(".surah"); if (!b) return;
    const no = +b.dataset.no;
    S.surahs = S.surahs.includes(no) ? S.surahs.filter(n => n !== no) : [...S.surahs, no];
    save(); renderPick();
  });
  jgrid.addEventListener("click", e => {
    const b = e.target.closest(".surah"); if (!b) return;
    const n = +b.dataset.juz;
    S.juzs = S.juzs.includes(n) ? S.juzs.filter(x => x !== n) : [...S.juzs, n];
    save(); renderPick();
  });
  $("#surahSearch").oninput = e => {
    const q = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "");
    grid.querySelectorAll(".surah").forEach(b => {
      const s = SURAHS[b.dataset.no - 1];
      b.hidden = q && !(s.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(q) || String(s.no) === q);
    });
  };
  $("#pickAmma").onclick = () => { S.surahs = [...new Set([...S.surahs, ...SURAHS.filter(s => s.no >= 78).map(s => s.no)])]; save(); renderPick(); };
  $("#pickNone").onclick = () => { S.surahs = []; save(); renderPick(); };
  $("#juzNone").onclick = () => { S.juzs = []; save(); renderPick(); };
  const pick = () => S.pickBy === "juz"
    ? { by:"juz", list:S.juzs.slice().sort((a, b) => a - b) }
    : { by:"surah", list:S.surahs.slice().sort((a, b) => a - b) };

  // ---------- OPTION GROUPS ----------
  function optionGroup(el, list, key){
    el.innerHTML = list.map(o =>
      `<button class="opt" data-id="${o.id}" aria-pressed="false"><svg viewBox="0 0 48 48"><use href="#${o.icon}"/></svg><div><b>${o.name}</b><small>${o.desc}</small></div></button>`
    ).join("");
    const render = () => el.querySelectorAll(".opt").forEach(b => b.setAttribute("aria-pressed", b.dataset.id === S[key]));
    el.addEventListener("click", e => {
      const b = e.target.closest(".opt"); if (!b) return;
      S[key] = b.dataset.id; save(); render(); validate();
    });
    render();
  }
  optionGroup($("#modeOpts"), MODES, "mode");
  optionGroup($("#materiOpts"), MATERI, "materi");
  optionGroup($("#duelOpts"), [
    { id:"diff", icon:"i-quiz", name:"Soal berbeda", desc:"Diacak untuk tiap pemain, tidak bisa mencontek" },
    { id:"same", icon:"i-link", name:"Soal sama", desc:"Kedua pemain mendapat soal yang sama" }
  ], "duelQ");
  $("#tahapSel").innerHTML = TAHAP.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
  $("#tahapSel").value = S.tahap;
  $("#tahapSel").onchange = e => { S.tahap = +e.target.value; save(); };
  const hijNoPick = () => S.mode === "hijaiyah" && ["huruf", "sambung", "harakat"].includes(S.materi);
  optionGroup($("#ctrlOpts"), CONTROLS, "control");

  // ---------- VALIDATION ----------
  function validate(){
    let msg = "";
    $("#hijPanel").hidden = S.mode !== "hijaiyah";
    $("#duelPanel").hidden = S.play === "solo";
    $("#tahapField").hidden = S.materi !== "kata";
    if (!hijNoPick() && !pick().list.length) msg = S.pickBy === "juz" ? "Pilih minimal satu juz." : "Pilih minimal satu surat.";
    else if (S.control === "write" && !(S.mode === "hijaiyah" && ["huruf", "sambung"].includes(S.materi))) msg = "Cara main Tulis untuk Hijaiyah: huruf satuan atau huruf sambung.";
    else if (S.control === "voice" && S.mode === "hijaiyah" && S.materi !== "kata") msg = "Jawab dengan suara di Hijaiyah hanya untuk materi Kata Al-Qur'an.";
    else if (S.control === "voice" && S.play === "duel-local") msg = "Jawab dengan suara hanya untuk main sendiri atau duel online, karena satu mikrofon tidak bisa membedakan dua pemain.";
    else if (S.control === "voice" && !Voice.supported) msg = "Jawab dengan suara butuh Google Chrome di laptop atau HP Android.";
    $("#startHint").textContent = msg;
    $("#btnStart").disabled = !!msg;
  }

  const gameOpts = () => ({
    control:S.control, play:S.play, name:S.name, mode:S.mode, qari:S.qari, sound:S.sound,
    time:S.time, rounds:S.rounds, pick:pick(), level:S.level, materi:S.materi, tahap:S.tahap, diffQ:S.duelQ === "diff",
    names:Object.fromEntries(SURAHS.map(s => [s.no, s.name])),
    onExit:() => go("home")
  });
  $("#btnStart").onclick = () => {
    if (S.play === "duel-online"){ openLobby(); return; }
    go("arena"); Arena.start(gameOpts());
  };

  // ---------- DUEL ONLINE ----------
  const lobbyHint = t => { $("#lobbyHint").textContent = t; };
  function openLobby(){
    $("#lobbyName").value = S.name; $("#joinCode").value = "";
    $("#lobbyChoose").hidden = false; $("#lobbyRoom").hidden = true; lobbyHint("");
    if (!Online.ready()) lobbyHint("Duel online belum diaktifkan. Isi file config.js dengan data Supabase.");
    go("lobby");
  }
  function lobbyName(){
    const n = $("#lobbyName").value.trim();
    if (!n){ lobbyHint("Tulis namamu dulu."); return null; }
    S.name = n; save(); return n;
  }
  function renderPlayers(list){
    const host = list.find(p => p.role === "host"), guest = list.find(p => p.role === "guest");
    $("#players").innerHTML =
      `<div class="player"><span class="dot"></span>${host ? host.name : "Pembuat room keluar"}</div>` +
      (guest ? `<div class="player p2"><span class="dot"></span>${guest.name}</div>`
             : `<div class="player p2 wait"><span class="dot"></span>Menunggu lawan bergabung</div>`);
    const isHost = Online.role === "host";
    $("#btnDuel").hidden = !(isHost && guest);
    $("#roomNote").textContent = isHost
      ? (guest ? "Lawan sudah masuk. Tekan Mulai duel." : "Bagikan kode ini ke lawan.")
      : "Tunggu pembuat room menekan Mulai duel.";
    const other = list.find(p => p.id !== Online.me?.id);
    if (other) oppName = other.name;
    if (inGame && !other) Arena.setOpponent({ done:true });
  }
  let oppName = "Lawan", inGame = false;
  Online.on("players", renderPlayers);
  Online.on("progress", p => Arena.setOpponent(p));
  Online.on("start", p => beginDuel(p));

  function showRoom(code){
    $("#roomCode").textContent = code;
    $("#lobbyChoose").hidden = true; $("#lobbyRoom").hidden = false;
    renderPlayers(Online.players());
  }
  $("#btnCreate").onclick = async () => {
    const n = lobbyName(); if (!n || !Online.ready()) return;
    if (!hijNoPick() && !pick().list.length){ lobbyHint("Pilih surat atau juz dulu di layar sebelumnya."); return; }
    lobbyHint("Membuat room...");
    try { showRoom(await Online.create(n)); lobbyHint(""); }
    catch(e){ lobbyHint("Gagal terhubung. Periksa internet dan isi config.js."); }
  };
  $("#btnJoin").onclick = async () => {
    const n = lobbyName(); if (!n || !Online.ready()) return;
    const code = $("#joinCode").value.trim();
    if (!/^\d{4}$/.test(code)){ lobbyHint("Kode room terdiri dari 4 angka."); return; }
    lobbyHint("Masuk ke room...");
    try { await Online.join(code, n); showRoom(code); lobbyHint(""); }
    catch(e){ lobbyHint(e.message === "NO_ROOM" ? "Room tidak ditemukan. Cek kodenya." : e.message === "FULL" ? "Room sudah penuh." : "Gagal terhubung. Periksa internet."); }
  };
  $("#btnDuel").onclick = async () => {
    $("#btnDuel").disabled = true;
    $("#roomNote").textContent = "Menyiapkan soal...";
    try {
      const o = gameOpts();
      await Rec.init();
      const questions = await Questions.make(o);
      if (!questions.length) throw new Error();
      const questions2 = o.diffQ ? await Questions.make(o) : null;
      const payload = { questions, questions2, mode:o.mode, materi:o.materi, level:o.level, time:o.time, startAt:Date.now() + 3500 };
      await Online.start(payload);
      beginDuel(payload);
    } catch(e){ $("#roomNote").textContent = "Soal gagal disiapkan. Periksa internet atau pilihan surat."; }
    $("#btnDuel").disabled = false;
  };
  function beginDuel(p){
    let n = 3; const cd = $("#countdown"); const tick = () => { cd.classList.remove("tick"); void cd.offsetWidth; cd.classList.add("tick"); };
    cd.textContent = n; cd.hidden = false; tick();
    const t = setInterval(() => {
      n--; if (n > 0){ cd.textContent = n; tick(); }
      else {
        clearInterval(t); cd.hidden = true; inGame = true; go("arena");
        const host = Online.role === "host", other = p.questions2 || p.questions;
        Arena.start({ ...gameOpts(), play:"duel-online", mode:p.mode, materi:p.materi || gameOpts().materi, level:p.level || gameOpts().level, time:p.time,
          questions: host ? p.questions : other, questionsOpp: host ? other : p.questions,
          online:true, oppName, onProgress:x => Online.progress(x),
          onExit:() => { inGame = false; Online.leave(); go("home"); } });
      }
    }, 1000);
  }
  $("#lobbyBack").onclick = () => { Online.leave(); go("setup"); };
  $("#arenaBack").onclick = () => {
    Arena.stop();
    if (inGame){ inGame = false; Online.leave(); go("home"); } else go("setup");
  };

  // ---------- STUDIO SUARA ----------
  const ST = { tab:"huruf", vowel:"a", i:1 };
  const VOWELS = [["a","Fathah"],["i","Kasrah"],["u","Dhammah"],["an","Fathatain"],["in","Kasratain"],["un","Dhammatain"]];
  const stItems = () => HIJAIYAH.filter(h => ST.tab === "huruf" || h.ch !== "ء");
  const stKey = h => ST.tab === "huruf" ? Hijaiyah.rid(h) : Hijaiyah.sid(h, ST.vowel);
  const stShow = h => ST.tab === "huruf" ? { big:h.ch, lat:h.name } : { big:Hijaiyah.glyph(h, ST.vowel), lat:Hijaiyah.syllable(h, ST.vowel) };
  const recAudio = new Audio();
  async function openStudio(){
    await Rec.init();
    go("studio"); renderStudio();
  }
  function renderStudio(){
    $$("#studio .tab").forEach(t => t.setAttribute("aria-selected", t.dataset.st === ST.tab));
    $("#stVowels").innerHTML = ST.tab === "harakat"
      ? VOWELS.map(([v, n]) => `<button class="chip${v === ST.vowel ? " on" : ""}" data-v="${v}">${n}</button>`).join("") : "";
    const items = stItems();
    ST.i = Math.min(ST.i, items.length - 1);
    $("#recGrid").innerHTML = items.map((h, i) => {
      const k = stKey(h), d = stShow(h);
      const st = Rec.isLocal(k) ? "local" : Rec.isRepo(k) ? "repo" : "";
      return `<button class="surah rec-item ${st}${i === ST.i ? " cur" : ""}" data-i="${i}"><span class="ri-ar" dir="rtl">${d.big}</span><small>${d.lat}</small></button>`;
    }).join("");
    const h = items[ST.i], d = stShow(h);
    $("#recBig").textContent = d.big; $("#recLatin").textContent = d.lat;
    const total = items.length, done = items.filter(x => Rec.has(stKey(x))).length;
    $("#recCount").textContent = `${done} dari ${total} sudah direkam`;
    $("#recPlay").disabled = $("#recDel").disabled = !Rec.has(stKey(h));
  }
  $$("#studio .tab").forEach(t => t.onclick = () => { ST.tab = t.dataset.st; ST.i = 0; renderStudio(); });
  $("#stVowels").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; ST.vowel = b.dataset.v; renderStudio(); };
  $("#recGrid").onclick = e => { const b = e.target.closest(".rec-item"); if (!b) return; ST.i = +b.dataset.i; renderStudio(); };
  $("#recNext").onclick = () => { ST.i = (ST.i + 1) % stItems().length; renderStudio(); };
  $("#recPlay").onclick = () => { const u = Rec.url(stKey(stItems()[ST.i])); if (u){ recAudio.src = u; recAudio.play().catch(() => {}); } };
  $("#recDel").onclick = async () => { await Rec.del(stKey(stItems()[ST.i])); renderStudio(); };
  let recording = false;
  $("#recBtn").onclick = async () => {
    if (recording){ Rec.stopRec(); return; }
    const h = stItems()[ST.i], key = stKey(h);
    try {
      recording = true; $("#recBtn").classList.add("on");
      $("#recStatus").textContent = "Merekam... bacakan sekarang. Tekan lagi untuk berhenti.";
      const blob = await Rec.record(3000);
      recording = false; $("#recBtn").classList.remove("on");
      if (blob.size < 1500){ $("#recStatus").textContent = "Rekaman terlalu pendek, coba lagi."; return; }
      await Rec.save(key, blob);
      $("#recStatus").textContent = `Tersimpan: ${stShow(h).lat}`;
      recAudio.src = Rec.url(key); recAudio.play().catch(() => {});
      if ($("#recAuto").checked) ST.i = (ST.i + 1) % stItems().length;
      renderStudio();
    } catch(e){
      recording = false; $("#recBtn").classList.remove("on");
      $("#recStatus").textContent = e.name === "NotAllowedError"
        ? "Izin mikrofon ditolak. Ketuk ikon gembok di samping alamat web, izinkan Mikrofon."
        : "Mikrofon tidak bisa dipakai di perangkat ini.";
    }
  };
  $("#recExport").onclick = async () => {
    $("#recExport").disabled = true; $("#recExport").textContent = "Menyiapkan...";
    try { await Rec.exportZip(); } catch(e){ alert("Gagal membuat file. Periksa internet lalu coba lagi."); }
    $("#recExport").disabled = false; $("#recExport").textContent = "Unduh folder audio";
  };
  // ---- potong audio ----
  const CUT = { buf:null, segs:[] };
  const cutAudio = new Audio();
  function playSeg(seg){
    if (!CUT.buf) return;
    cutAudio.src = URL.createObjectURL(Rec.clip(CUT.buf, seg)); cutAudio.play().catch(() => {});
  }
  function analyze(){
    if (!CUT.buf) return;
    CUT.segs = Rec.segments(CUT.buf, { sens:+$("#cutSens").value, minGap:+$("#cutGap").value });
    renderCut();
  }
  function renderCut(){
    const items = stItems(), start = ST.i;
    const need = items.length - start;
    $("#cutStatus").textContent = CUT.segs.length
      ? `Ditemukan ${CUT.segs.length} potongan. Dibutuhkan ${need} untuk ${ST.tab === "huruf" ? "huruf" : "harakat ini"} mulai dari ${stShow(items[start]).lat}.` +
        (CUT.segs.length > need ? " Buang potongan yang bukan bacaan (misalnya salam pembuka)." : CUT.segs.length < need ? " Kalau ada bacaan yang menyatu, naikkan kepekaan atau pilih jeda pendek." : " Jumlahnya pas.")
      : "Tidak ada potongan yang terdeteksi. Coba naikkan kepekaan.";
    // gelombang + tanda potongan
    const cv = $("#cutWave"); cv.hidden = false;
    const w = cv.width = cv.clientWidth * (devicePixelRatio || 1), h = cv.height, g = cv.getContext("2d");
    const d = CUT.buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / w));
    g.clearRect(0, 0, w, h);
    CUT.segs.forEach((sg, i) => {
      g.fillStyle = i % 2 ? "rgba(169,184,74,.45)" : "rgba(246,198,74,.5)";
      g.fillRect(sg.start / CUT.buf.duration * w, 0, (sg.end - sg.start) / CUT.buf.duration * w, h);
    });
    g.fillStyle = "#4a2a12";
    for (let x = 0; x < w; x++){ let m = 0; for (let j = 0; j < step; j++) m = Math.max(m, Math.abs(d[x * step + j] || 0)); g.fillRect(x, h / 2 - m * h / 2, 1, Math.max(1, m * h)); }
    $("#cutList").innerHTML = CUT.segs.map((sg, i) => {
      const it = items[start + i];
      return `<div class="cut-row${it ? "" : " extra"}"><b class="cut-to" dir="rtl">${it ? stShow(it).big : "-"}</b>
        <span>${it ? stShow(it).lat : "tidak dipakai"} <small>${sg.start.toFixed(1)} - ${sg.end.toFixed(1)} dtk</small></span>
        <button class="chip" data-a="play" data-i="${i}">Putar</button>
        <button class="chip" data-a="drop" data-i="${i}">Buang</button>
        ${i < CUT.segs.length - 1 ? `<button class="chip" data-a="merge" data-i="${i}">Gabung</button>` : ""}</div>`;
    }).join("");
    $("#cutSaveWrap").hidden = !CUT.segs.length;
  }
  $("#cutFile").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    $("#cutStatus").textContent = "Membaca file...";
    try { CUT.buf = await Rec.decode(f); analyze(); }
    catch(err){ $("#cutStatus").textContent = "File tidak bisa dibaca. Gunakan MP3, M4A, WAV, atau OGG."; }
    e.target.value = "";
  };
  $("#cutSens").oninput = analyze; $("#cutGap").onchange = analyze;
  $("#cutList").onclick = e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const i = +b.dataset.i;
    if (b.dataset.a === "play") playSeg(CUT.segs[i]);
    if (b.dataset.a === "drop"){ CUT.segs.splice(i, 1); renderCut(); }
    if (b.dataset.a === "merge"){ CUT.segs[i].end = CUT.segs[i + 1].end; CUT.segs.splice(i + 1, 1); renderCut(); }
  };
  $("#cutSave").onclick = async () => {
    const items = stItems(); let n = 0;
    for (let i = 0; i < CUT.segs.length && ST.i + i < items.length; i++){
      await Rec.save(stKey(items[ST.i + i]), Rec.clip(CUT.buf, CUT.segs[i])); n++;
    }
    $("#cutStatus").textContent = `${n} potongan tersimpan. Dengarkan beberapa di daftar huruf di atas untuk memastikan.`;
    CUT.buf = null; CUT.segs = []; $("#cutList").innerHTML = ""; $("#cutWave").hidden = true; $("#cutSaveWrap").hidden = true;
    renderStudio();
  };
  // daftar ikut berubah kalau huruf awal / tab diganti
  const _rs = renderStudio;
  renderStudio = function(){ _rs(); if (CUT.buf) renderCut(); };

  $("#openStudio").onclick = () => { $("#settings").hidden = true; openStudio(); };
  $("#recHintLink").onclick = e => { e.preventDefault(); openStudio(); };
  // hentikan mikrofon saat keluar dari studio
  $$("#studio [data-go]").forEach(b => b.addEventListener("click", () => Rec.release()));

  // ---------- SETTINGS ----------
  $("#setQari").innerHTML = QARIS.map(q => `<option value="${q.id}">${q.name}</option>`).join("");
  const modal = $("#settings");
  $$("[data-open='settings']").forEach(b => b.onclick = () => {
    $("#setName").value = S.name; $("#setQari").value = S.qari;
    $("#setTime").value = S.time; $("#setRounds").value = S.rounds;
    $("#setLevel").value = S.level; levelNote(); $("#setBgm").value = S.bgm;
    modal.hidden = false; $("#setName").focus();
  });
  const close = () => { modal.hidden = true; };
  const levelNote = () => { $("#levelNote").textContent = LEVELS[$("#setLevel").value].desc; };
  $("#setLevel").onchange = levelNote;
  modal.querySelector("[data-close]").onclick = close;
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) close(); });
  $("#saveSettings").onclick = () => {
    S.name = $("#setName").value.trim(); S.qari = $("#setQari").value;
    S.time = $("#setTime").value; S.rounds = $("#setRounds").value; S.level = $("#setLevel").value; S.bgm = $("#setBgm").value; bgmSync();
    save(); close();
  };

  renderSoundBtn(); renderPick();
})();
