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

  $("#btnStart").onclick = () => {
    go("arena");
    Arena.start({ control:S.control, play:S.play, name:S.name });
  };
  $("#arenaBack").onclick = () => { Arena.stop(); go("setup"); };
  $("#msgBtn").onclick = () => { Arena.stop(); Arena.start({ control:S.control, play:S.play, name:S.name }); };
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
