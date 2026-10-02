/* Arena permainan Ayat Battle (Tahap 3) */
window.Arena = (() => {
  const $ = s => document.querySelector(s);
  const COLORS = { L:"#f6a531", R:"#5aa9ff", T:"#f6a531" };

  let opt, qs = [], qi = 0, q, cards = [], slots = [], raf = 0, timerId = 0, timeLeft = 0, busy = false;
  let score = {}, streak = {}, touch = {}, ctx, W, H, audio = new Audio(), alive = false;

  // ---------- util tampilan ----------
  function msg(title, html, b1, b2){
    $("#arenaMsg").hidden = !title;
    if (!title) return;
    $("#msgTitle").textContent = title; $("#msgText").innerHTML = html;
    $("#msgBtn").hidden = !b1; if (b1) $("#msgBtn").textContent = b1;
    $("#msgBtn2").hidden = !b2; if (b2) $("#msgBtn2").textContent = b2;
  }
  function resize(){
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    const c = $("#fx"); c.width = W * dpr; c.height = H * dpr;
    ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const two = () => opt.play === "duel-local";
  function renderScore(){
    $("#hudP1 b").textContent = two() ? (score.L || 0) : Object.values(score).reduce((a, b) => a + b, 0);
    $("#hudP2 b").textContent = score.R || 0;
  }
  function floater(x, y, text, color){
    const el = document.createElement("div"); el.className = "floater"; el.textContent = text;
    el.style.left = x + "px"; el.style.top = y + "px"; el.style.color = color;
    $("#floaters").appendChild(el); setTimeout(() => el.remove(), 900);
  }
  function play(ref){
    if (!ref || !opt.sound) return;
    audio.pause(); audio.src = Quran.audioUrl(opt.qari, ref[0], ref[1]);
    audio.play().catch(() => {});
  }
  const fontFor = t => t.length > 60 ? 20 : t.length > 38 ? 24 : t.length > 22 ? 28 : 34;

  // ---------- soal ----------
  function showQuestion(){
    q = qs[qi]; busy = false;
    $("#cards").innerHTML = ""; $("#slots").innerHTML = "";
    $("#hudStatus b").textContent = `${qi + 1}/${qs.length}`;
    $("#promptLabel").textContent = q.label;
    $("#prompt").hidden = false;
    $("#promptText").textContent = q.prompt || "Susun potongan ayat sesuai urutan";
    $("#promptText").classList.toggle("ar", !!q.prompt);
    $("#btnListen").hidden = !(q.hint || q.playStart);

    const single = q.slots.length === 1;
    slots = q.slots.map(t => {
      const el = document.createElement("div"); el.className = "slot" + (single ? " wide" : "");
      el.textContent = single ? "Taruh jawaban di sini" : "";
      $("#slots").appendChild(el); return { el, value:t, done:false };
    });
    if (opt.control === "shoot") slots.forEach((s, i) => s.el.classList.toggle("next", i === 0));

    const stageBottom = $("#stage").getBoundingClientRect().bottom + 12;
    cards = q.cards.map(t => {
      const el = document.createElement("div"); el.className = "card"; el.textContent = t;
      el.style.fontSize = fontFor(t) + "px";
      $("#cards").appendChild(el);
      const c = { el, value:t, held:null, done:false, w:el.offsetWidth, h:el.offsetHeight };
      c.x = 10 + Math.random() * Math.max(1, W - c.w - 20);
      c.y = stageBottom + Math.random() * Math.max(1, H - stageBottom - c.h - 20);
      c.vx = (Math.random() - .5) * 1.2; c.vy = (Math.random() - .5) * 1.2;
      return c;
    });
    play(q.playStart);
    startTimer();
  }

  function startTimer(){
    clearInterval(timerId);
    const total = +opt.time;
    $("#hudTime").hidden = !total;
    if (!total) return;
    timeLeft = total; $("#hudTime b").textContent = timeLeft;
    timerId = setInterval(() => {
      timeLeft--; $("#hudTime b").textContent = Math.max(0, timeLeft);
      $("#hudTime").classList.toggle("low", timeLeft <= 5);
      if (timeLeft <= 0){ clearInterval(timerId); reveal(); }
    }, 1000);
  }

  function fill(slot){
    slot.done = true; slot.el.classList.add("ok"); slot.el.classList.remove("next", "near");
    slot.el.textContent = slot.value; slot.el.style.fontSize = Math.min(30, fontFor(slot.value)) + "px";
  }

  function reveal(){
    if (busy) return; busy = true;
    slots.forEach(s => { if (!s.done){ fill(s); s.el.classList.add("missed"); } });
    cards.forEach(c => c.el.classList.add("pop"));
    Object.keys(streak).forEach(k => streak[k] = 0);
    play(q.playEnd);
    setTimeout(next, 2800);
  }

  function complete(who, at){
    busy = true; clearInterval(timerId);
    const total = +opt.time;
    const bonus = total ? Math.round(5 * Math.max(0, timeLeft) / total) : 0;
    if (bonus){ score[who] = (score[who] || 0) + bonus; floater(at.x, at.y - 40, `Cepat +${bonus}`, COLORS[who]); renderScore(); }
    play(q.playEnd);
    setTimeout(next, 2600);
  }

  function next(){
    qi++;
    if (qi >= qs.length) return finish();
    showQuestion();
  }

  function finish(){
    clearInterval(timerId); busy = true;
    const p1 = two() ? (score.L || 0) : Object.values(score).reduce((a, b) => a + b, 0), p2 = score.R || 0;
    let html;
    if (two()){
      const w = p1 === p2 ? "Seri, dua-duanya hebat" : p1 > p2 ? "Pemain 1 menang" : "Pemain 2 menang";
      html = `<p class="result-big">${w}</p><div class="duel-score"><span class="p1">${p1}</span><span class="vs">lawan</span><span class="p2">${p2}</span></div>`;
    } else {
      html = `<p class="result-big">${opt.name ? opt.name + ", poinmu" : "Poinmu"}</p><div class="duel-score"><span class="p1">${p1}</span></div>`;
    }
    msg("Selesai", html + `<p>Barakallahu fiik. Terus murajaah, ya.</p>`, "Main lagi", "Menu");
    $("#msgBtn").onclick = () => { stop(); start(opt); };
    $("#msgBtn2").onclick = () => { stop(); opt.onExit(); };
  }

  // ---------- interaksi ----------
  const hit = (c, x, y, pad = 14) => !c.done && x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad;
  const cardAt = (x, y) => cards.slice().reverse().find(c => !c.held && hit(c, x, y));
  function slotAt(c){
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    return slots.find(s => { const r = s.el.getBoundingClientRect();
      return !s.done && cx > r.left - 24 && cx < r.right + 24 && cy > r.top - 34 && cy < r.bottom + 34; });
  }
  function shake(c){ c.el.classList.remove("wrong"); void c.el.offsetWidth; c.el.classList.add("wrong"); }

  function correct(c, slot, who){
    fill(slot); c.done = true; c.el.classList.add("pop");
    streak[who] = (streak[who] || 0) + 1;
    const base = slots.length > 1 ? 5 : 10;
    const combo = Math.min(streak[who] - 1, 3) * 2;
    score[who] = (score[who] || 0) + base + combo;
    floater(c.x + c.w / 2, c.y, combo ? `+${base} kombo +${combo}` : `+${base}`, COLORS[who]);
    renderScore();
    if (opt.control === "shoot"){ const n = slots.find(s => !s.done); if (n) n.el.classList.add("next"); }
    if (slots.every(s => s.done)) complete(who, { x:c.x + c.w / 2, y:c.y });
  }
  function wrong(c, who){ shake(c); streak[who] = 0; c.vy = 3; }

  function drop(c, who){
    c.held = null; c.el.classList.remove("held");
    slots.forEach(s => s.el.classList.remove("near"));
    if (busy) return;
    const s = slotAt(c);
    if (!s) return;
    // susun: harus kotak yang sesuai urutan; pilihan: satu kotak jawaban
    if (s.value === c.value) correct(c, s, who); else wrong(c, who);
  }

  function shoot(x, y, who){
    ctx.beginPath(); ctx.fillStyle = "rgba(255,230,120,.85)"; ctx.arc(x, y, 30, 0, 7); ctx.fill();
    if (busy) return;
    const c = cardAt(x, y); if (!c) return;
    const target = slots.find(s => !s.done);
    if (target && target.value === c.value) correct(c, target, who); else wrong(c, who);
  }

  function handle(p){
    if (opt.control === "shoot"){ if (p.shot) shoot(p.x, p.y, p.id); return; }
    const held = cards.find(c => c.held === p.id);
    if (p.pinching && !busy){
      if (!held){ const c = cardAt(p.x, p.y); if (c){ c.held = p.id; c.el.classList.add("held"); } }
      else {
        held.x = p.x - held.w / 2; held.y = p.y - held.h / 2; held.vx = held.vy = 0;
        const s = slotAt(held); slots.forEach(x => x.el.classList.toggle("near", x === s));
      }
    } else if (held) drop(held, p.id);
  }

  function loop(){
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, W, H);
    let pointers;
    if (opt.control === "touch" || opt.noCam) pointers = Object.values(touch);
    else {
      pointers = Gesture.read(W, H);
      if (!two()) pointers.forEach(p => p.id = "L");
      pointers.forEach(p => Gesture.drawHand(ctx, p, COLORS[p.id]));
      Object.values(touch).forEach(t => pointers.push(t));   // mouse tetap bisa dipakai guru
    }
    cards.forEach(c => { if (c.held && !pointers.some(p => p.id === c.held)) drop(c, c.held); });
    pointers.forEach(handle);
    touch = Object.fromEntries(Object.entries(touch).filter(([, t]) => t.pinching).map(([k, t]) => [k, { ...t, shot:false }]));

    const top = $("#stage").getBoundingClientRect().bottom + 8;
    cards.forEach(c => {
      if (c.done) return;
      if (!c.held){
        c.x += c.vx; c.y += c.vy; c.vy *= .99; c.vx *= .995;
        if (Math.abs(c.vx) < .25) c.vx += (Math.random() - .5) * .25;
        if (Math.abs(c.vy) < .25) c.vy += (Math.random() - .5) * .25;
        if (c.x < 6 || c.x > W - c.w - 6) c.vx *= -1;
        if (c.y < top || c.y > H - c.h - 10) c.vy *= -1;
        c.x = Math.max(6, Math.min(W - c.w - 6, c.x)); c.y = Math.max(top, Math.min(H - c.h - 10, c.y));
      }
      c.el.classList.toggle("hover", !c.held && pointers.some(p => hit(c, p.x, p.y)));
      c.el.style.transform = `translate(${c.x}px,${c.y}px)`;
    });
  }

  function onDown(e){
    if (e.target.closest("button")) return;
    const s = opt.control === "shoot";
    touch[e.pointerId] = { id: two() ? (e.clientX < W / 2 ? "L" : "R") : "L", x:e.clientX, y:e.clientY, pinching:!s, shot:s };
  }
  function onMove(e){ const t = touch[e.pointerId]; if (t){ t.x = e.clientX; t.y = e.clientY; } }
  function onUp(e){ const t = touch[e.pointerId]; if (t) t.pinching = false; }

  // ---------- mulai / berhenti ----------
  async function start(options){
    opt = options; score = {}; streak = {}; touch = {}; qi = 0; alive = true;
    resize(); addEventListener("resize", resize);
    $("#hudP2").hidden = !two();
    $("#hudP1 small").textContent = two() ? "Pemain 1" : (opt.name || "Poin");
    renderScore();
    $("#prompt").hidden = true; $("#cards").innerHTML = ""; $("#slots").innerHTML = "";
    const a = $("#arena");
    a.addEventListener("pointerdown", onDown); a.addEventListener("pointermove", onMove);
    a.addEventListener("pointerup", onUp); a.addEventListener("pointercancel", onUp);
    $("#btnListen").onclick = () => play(q?.hint || q?.playStart);
    $("#cam").style.display = opt.control === "touch" ? "none" : "";

    try {
      msg("Memuat ayat", "<p>Mengambil teks ayat. Pertama kali butuh internet, berikutnya lebih cepat.</p>");
      const data = await Quran.load(opt.surahs);
      qs = Questions.build(opt.mode, data, +opt.rounds, opt.names);
      if (!qs.length) throw Object.assign(new Error(), { name:"NO_Q" });
    } catch(e){
      msg("Ayat belum bisa dimuat", e.name === "NO_Q"
        ? "<p>Surat yang dipilih tidak cukup untuk permainan ini. Tambah surat lain atau ganti permainan.</p>"
        : "<p>Periksa koneksi internet, lalu coba lagi.</p>", "Coba lagi", "Menu");
      $("#msgBtn").onclick = () => { stop(); start(opt); };
      $("#msgBtn2").onclick = () => { stop(); opt.onExit(); };
      return;
    }

    if (opt.control !== "touch"){
      try {
        msg("Menyalakan kamera", "<p>Izinkan akses kamera saat browser bertanya. Memuat pendeteksi tangan, tunggu sebentar.</p>");
        await Gesture.start($("#cam"), { numHands: two() ? 2 : 1 });
      } catch(e){
        const denied = e.name === "NotAllowedError";
        msg("Kamera tidak bisa dipakai",
          `<p>${denied ? "Akses kamera ditolak. Ketuk ikon gembok di samping alamat web, izinkan Kamera, lalu coba lagi."
                       : "Kamera tidak ditemukan. Pastikan tidak sedang dipakai aplikasi lain."}</p><p>Atau main dengan sentuh dan mouse.</p>`,
          "Coba lagi", "Main dengan sentuh");
        $("#msgBtn").onclick = () => { stop(); start(opt); };
        $("#msgBtn2").onclick = () => { stop(); start({ ...opt, control: opt.control === "shoot" ? "shoot" : "touch", noCam:true }); };
        return;
      }
    }
    if (!alive) return;
    msg(); showQuestion(); loop();
  }

  function stop(){
    alive = false; cancelAnimationFrame(raf); clearInterval(timerId);
    audio.pause(); Gesture.stop(); removeEventListener("resize", resize);
    const a = $("#arena");
    a.removeEventListener("pointerdown", onDown); a.removeEventListener("pointermove", onMove);
    a.removeEventListener("pointerup", onUp); a.removeEventListener("pointercancel", onUp);
  }

  return { start, stop };
})();
