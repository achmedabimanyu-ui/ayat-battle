/* Arena uji gestur (Tahap 2).
   Latihan memakai angka Arab supaya bisa menguji jepit, tembak, dan sentuh.
   Di Tahap 3 kartu angka ini diganti potongan ayat. */
window.Arena = (() => {
  const $ = s => document.querySelector(s);
  const DIGITS = ["١","٢","٣","٤","٥"];
  const COLORS = { L:"#f6a531", R:"#5aa9ff", T:"#f6a531" };

  let opt, cards = [], slots = [], raf = 0, score = {}, target = 0, touch = {}, ctx, W, H, dpr;

  function msg(title, text, retry){
    $("#arenaMsg").hidden = !title;
    if (!title) return;
    $("#msgTitle").textContent = title; $("#msgText").textContent = text;
    $("#msgBtn").hidden = !retry;
  }

  function resize(){
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    const c = $("#fx"); c.width = W * dpr; c.height = H * dpr;
    ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setScore(id, add){
    score[id] = (score[id] || 0) + add;
    const two = opt.play === "duel-local";
    $("#hudP1 b").textContent = two ? (score.L || 0) : Object.values(score).reduce((a, b) => a + b, 0);
    $("#hudP2 b").textContent = score.R || 0;
  }
  const status = t => { $("#hudStatus b").textContent = t; };

  function newRound(){
    $("#cards").innerHTML = ""; $("#slots").innerHTML = "";
    const shoot = opt.control === "shoot";
    slots = shoot ? [] : DIGITS.map(d => {
      const el = document.createElement("div"); el.className = "slot"; el.textContent = d;
      $("#slots").appendChild(el); return { el, value:d, done:false };
    });
    cards = DIGITS.slice().sort(() => Math.random() - .5).map((d, i) => {
      const el = document.createElement("div"); el.className = "card"; el.textContent = d;
      $("#cards").appendChild(el);
      const c = { el, value:d, x: 40 + Math.random() * (W - 180), y: H * .4 + Math.random() * (H * .45 - 80),
                  vx:(Math.random() - .5) * 1.4, vy:(Math.random() - .5) * 1.4, held:null, done:false, w:0, h:0 };
      c.w = el.offsetWidth; c.h = el.offsetHeight; return c;
    });
    if (shoot){ target = 0; status(`Tembak ${DIGITS[0]}`); }
    else status("Jepit dan susun");
  }

  const hit = (c, x, y, pad = 14) => !c.done && x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad;
  const cardAt = (x, y) => cards.slice().reverse().find(c => !c.held && hit(c, x, y));

  function slotAt(c){
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    return slots.find(s => { const r = s.el.getBoundingClientRect();
      return cx > r.left - 20 && cx < r.right + 20 && cy > r.top - 30 && cy < r.bottom + 30; });
  }

  function drop(c, who){
    c.held = null; c.el.classList.remove("held");
    const s = slotAt(c);
    slots.forEach(x => x.el.classList.remove("near"));
    if (!s) return;
    if (s.value === c.value && !s.done){
      s.done = true; s.el.classList.add("ok"); c.done = true; c.el.classList.add("pop");
      setScore(who, 10);
      if (slots.every(x => x.done)){ status("Hebat!"); setTimeout(newRound, 1200); }
    } else {
      c.el.classList.remove("wrong"); void c.el.offsetWidth; c.el.classList.add("wrong");
      c.vy = 3;
    }
  }

  function shoot(x, y, who){
    const c = cardAt(x, y);
    ctx.beginPath(); ctx.fillStyle = "rgba(255,230,120,.8)"; ctx.arc(x, y, 30, 0, 7); ctx.fill();
    if (!c) return;
    if (c.value === DIGITS[target]){
      c.done = true; c.el.classList.add("pop"); setScore(who, 10); target++;
      if (target >= DIGITS.length){ status("Hebat!"); setTimeout(newRound, 1200); }
      else status(`Tembak ${DIGITS[target]}`);
    } else { c.el.classList.remove("wrong"); void c.el.offsetWidth; c.el.classList.add("wrong"); }
  }

  // Satu "pointer" (tangan atau jari di layar) diproses sama
  function handle(p){
    const held = cards.find(c => c.held === p.id);
    if (opt.control === "shoot"){ if (p.shot) shoot(p.x, p.y, p.id); return; }
    if (p.pinching){
      if (!held){ const c = cardAt(p.x, p.y); if (c){ c.held = p.id; c.el.classList.add("held"); } }
      else {
        held.x = p.x - held.w / 2; held.y = p.y - held.h / 2; held.vx = held.vy = 0;
        const s = slotAt(held); slots.forEach(x => x.el.classList.toggle("near", x === s));
      }
    } else if (held) drop(held, p.id);
  }

  function loop(){
    raf = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, W, H);
    let pointers;
    if (opt.control === "touch") pointers = Object.values(touch);
    else {
      pointers = Gesture.read(W, H);
      if (opt.play !== "duel-local") pointers.forEach(p => p.id = p.id === "R" ? "R" : "L");
      pointers.forEach(p => Gesture.drawHand(ctx, p, COLORS[p.id]));
    }
    // tangan yang hilang dari kamera melepaskan kartunya
    cards.forEach(c => { if (c.held && !pointers.some(p => p.id === c.held)) drop(c, c.held); });
    pointers.forEach(handle);
    touch = Object.fromEntries(Object.entries(touch).filter(([, t]) => t.pinching).map(([k, t]) => [k, { ...t, shot:false }]));

    const top = 170;
    cards.forEach(c => {
      if (c.done) return;
      if (!c.held){
        c.x += c.vx; c.y += c.vy; c.vy *= .99; c.vx *= .995;
        if (Math.abs(c.vx) < .3) c.vx += (Math.random() - .5) * .3;
        if (Math.abs(c.vy) < .3) c.vy += (Math.random() - .5) * .3;
        if (c.x < 8 || c.x > W - c.w - 8) c.vx *= -1;
        if (c.y < top || c.y > H - c.h - 12) c.vy *= -1;
        c.x = Math.max(8, Math.min(W - c.w - 8, c.x)); c.y = Math.max(top, Math.min(H - c.h - 12, c.y));
      }
      c.el.classList.toggle("hover", !c.held && pointers.some(p => hit(c, p.x, p.y)));
      c.el.style.transform = `translate(${c.x}px,${c.y}px)`;
    });
  }

  // input sentuh / mouse
  function onDown(e){
    const shootMode = opt.control === "shoot";
    touch[e.pointerId] = { id:"T", x:e.clientX, y:e.clientY, pinching:!shootMode, shot:shootMode };
    if (opt.play === "duel-local") touch[e.pointerId].id = e.clientX < W / 2 ? "L" : "R";
  }
  function onMove(e){ const t = touch[e.pointerId]; if (t){ t.x = e.clientX; t.y = e.clientY; } }
  function onUp(e){ const t = touch[e.pointerId]; if (t) t.pinching = false; }

  async function start(options){
    opt = options; score = {}; touch = {};
    resize(); addEventListener("resize", resize);
    $("#hudP2").hidden = opt.play !== "duel-local";
    $("#hudP1 small").textContent = opt.play === "duel-local" ? "Pemain 1" : (opt.name || "Poin");
    setScore("L", 0);
    const a = $("#arena");
    a.addEventListener("pointerdown", onDown); a.addEventListener("pointermove", onMove);
    a.addEventListener("pointerup", onUp); a.addEventListener("pointercancel", onUp);
    $("#cam").style.display = "";

    if (opt.control === "touch" || opt.forceTouch){
      opt.control = opt.control === "shoot" ? "shoot" : "touch";
      $("#cam").style.display = "none"; msg(); newRound(); loop(); return;
    }
    try {
      msg("Menyalakan kamera", "Izinkan akses kamera saat browser bertanya. Memuat pendeteksi tangan, tunggu sebentar.");
      await Gesture.start($("#cam"), { numHands: opt.play === "duel-local" ? 2 : 1 });
      msg(); newRound(); loop();
    } catch(e){
      const denied = e.name === "NotAllowedError";
      msg("Kamera tidak bisa dipakai",
        denied ? "Akses kamera ditolak. Ketuk ikon gembok di samping alamat web, izinkan Kamera, lalu coba lagi."
               : "Kamera tidak ditemukan atau koneksi lambat. Pastikan kamera tidak dipakai aplikasi lain, lalu coba lagi.", true);
    }
  }

  function stop(){
    cancelAnimationFrame(raf); Gesture.stop(); removeEventListener("resize", resize);
    const a = $("#arena");
    a.removeEventListener("pointerdown", onDown); a.removeEventListener("pointermove", onMove);
    a.removeEventListener("pointerup", onUp); a.removeEventListener("pointercancel", onUp);
  }

  return { start, stop };
})();
