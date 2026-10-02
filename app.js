(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // ---------- STATE (tersimpan di browser) ----------
  const defaults = { name:"", qari:"Husary_128kbps", time:"30", rounds:"10", sound:true,
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
  $("#btnSound").onclick = () => { S.sound = !S.sound; save(); renderSoundBtn(); };

  // ---------- NAVIGATION ----------
  function go(id){
    $$(".screen").forEach(s => s.classList.toggle("active", s.id === id));
    window.scrollTo(0,0);
  }
  $$("[data-go]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.play){ S.play = b.dataset.play; save(); $("#setupTitle").textContent = PLAY_TITLES[S.play]; validate(); }
    go(b.dataset.go);
  }));

  // ---------- SURAH PICKER ----------
  const grid = $("#surahGrid");
  grid.innerHTML = SURAHS.map(s =>
    `<button class="surah" data-no="${s.no}" aria-pressed="false"><span class="no">${s.no}</span><b>${s.name}</b><small>${s.ayat} ayat</small></button>`
  ).join("");
  function renderSurahs(){
    $$(".surah").forEach(b => b.setAttribute("aria-pressed", S.surahs.includes(+b.dataset.no)));
    $("#pickCount").textContent = `${S.surahs.length} surat dipilih`;
    validate();
  }
  grid.addEventListener("click", e => {
    const b = e.target.closest(".surah"); if (!b) return;
    const no = +b.dataset.no;
    S.surahs = S.surahs.includes(no) ? S.surahs.filter(n => n !== no) : [...S.surahs, no];
    save(); renderSurahs();
  });
  $("#pickAll").onclick = () => { S.surahs = SURAHS.map(s => s.no); save(); renderSurahs(); };
  $("#pickNone").onclick = () => { S.surahs = []; save(); renderSurahs(); };

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
  optionGroup($("#ctrlOpts"), CONTROLS, "control");

  // ---------- VALIDATION ----------
  function validate(){
    let msg = "";
    if (!S.surahs.length) msg = "Pilih minimal satu surat.";
    else if (S.mode === "lanjutkan" && S.surahs.every(n => SURAHS.find(s => s.no === n).ayat < 2)) msg = "Surat yang dipilih terlalu pendek.";
    else if (S.play === "duel-local" && S.control === "touch") msg = "";
    $("#startHint").textContent = msg;
    $("#btnStart").disabled = !!msg;
  }

  const gameOpts = () => ({
    control:S.control, play:S.play, name:S.name, mode:S.mode, qari:S.qari, sound:S.sound,
    time:S.time, rounds:S.rounds, surahs:S.surahs.slice().sort((a, b) => a - b),
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
    if (!S.surahs.length){ lobbyHint("Pilih surat dulu di layar sebelumnya."); return; }
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
      const data = await Quran.load(o.surahs);
      const questions = Questions.build(o.mode, data, +o.rounds, o.names);
      if (!questions.length) throw new Error();
      const payload = { questions, mode:o.mode, time:o.time, startAt:Date.now() + 3500 };
      await Online.start(payload);
      beginDuel(payload);
    } catch(e){ $("#roomNote").textContent = "Soal gagal disiapkan. Periksa internet atau pilihan surat."; }
    $("#btnDuel").disabled = false;
  };
  function beginDuel(p){
    let n = 3; const cd = $("#countdown"); cd.textContent = n; cd.hidden = false;
    const t = setInterval(() => {
      n--; if (n > 0) cd.textContent = n;
      else {
        clearInterval(t); cd.hidden = true; inGame = true; go("arena");
        Arena.start({ ...gameOpts(), play:"duel-online", mode:p.mode, time:p.time, questions:p.questions,
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
  $("#creditLink").onclick = e => e.preventDefault();

  // ---------- SETTINGS ----------
  $("#setQari").innerHTML = QARIS.map(q => `<option value="${q.id}">${q.name}</option>`).join("");
  const modal = $("#settings");
  $$("[data-open='settings']").forEach(b => b.onclick = () => {
    $("#setName").value = S.name; $("#setQari").value = S.qari;
    $("#setTime").value = S.time; $("#setRounds").value = S.rounds;
    modal.hidden = false; $("#setName").focus();
  });
  const close = () => { modal.hidden = true; };
  modal.querySelector("[data-close]").onclick = close;
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) close(); });
  $("#saveSettings").onclick = () => {
    S.name = $("#setName").value.trim(); S.qari = $("#setQari").value;
    S.time = $("#setTime").value; S.rounds = $("#setRounds").value;
    save(); close();
  };

  renderSoundBtn(); renderSurahs();
})();
