/* Arena Ayat Battle: papan per pemain (layar terbagi untuk duel) */
window.Arena = (() => {
  const $ = s => document.querySelector(s);
  const COLORS = { L:"#f6a531", R:"#5aa9ff" };
  const DWELL = 1000;                         // tahan bidikan 1 detik = tembak otomatis
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.appendChild(e); return e; };
  const fontFor = t => t.length > 60 ? 20 : t.length > 38 ? 24 : t.length > 22 ? 28 : 34;

  let opt, qs = [], boards = [], ghost = null, raf = 0, ctx, W, H, alive = false, touch = {};
  const audio = new Audio();
  function play(ref, who){
    if (!ref || !opt.sound) return;
    audio.pause(); audio.src = Quran.audioUrl(opt.qari, ref[0], ref[1]); audio.play().catch(() => {});
  }

  // =================== PAPAN ===================
  class Board {
    constructor({ id, name, color, ghost = false }){
      Object.assign(this, { id, name, color, ghost, qi:-1, score:0, streak:0, finished:false, busy:true,
                            cards:[], slots:[], dwell:{}, timeLeft:0, timer:0 });
      this.root = el("div", "barea" + (id === "R" ? " p2" : "") + (ghost ? " ghost" : ""), $("#boards"));
      const hud = el("div", "bhud", this.root);
      this.hWho = el("div", "hud-box who", hud); this.hName = el("small", "", this.hWho, name); this.hScore = el("b", "", this.hWho, "0");
      const hq = el("div", "hud-box", hud); el("small", "", hq, "Soal"); this.hQ = el("b", "", hq, "-");
      this.hT = el("div", "hud-box", hud); el("small", "", this.hT, "Waktu"); this.hTime = el("b", "", this.hT, "-");
      this.hT.hidden = !+opt.time;
      this.stage = el("div", "stage", this.root);
      this.prompt = el("div", "prompt", this.stage);
      const ph = el("div", "prompt-head", this.prompt);
      this.pLabel = el("span", "", ph);
      if (!ghost){
        const b = el("button", "listen", ph);
        b.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-sound"/></svg>Dengar';
        b.onclick = () => play(this.q?.hint || this.q?.playStart);
      }
      this.pText = el("p", "", this.prompt); this.pText.dir = "rtl";
      this.slotWrap = el("div", "slots", this.stage); this.slotWrap.dir = "rtl";
      this.layer = el("div", "layer", this.root);
      this.wait = null;
    }
    layout(x, w){
      Object.assign(this, { x, w, h:H });
      this.root.style.left = x + "px"; this.root.style.width = w + "px";
      this.root.classList.toggle("narrow", w < 760);
    }
    get scale(){ return this.w < 760 ? .78 : 1; }
    top(){ return this.stage.getBoundingClientRect().bottom + 8; }
    render(){
      this.hScore.textContent = this.score;
      this.hQ.textContent = this.finished ? "Selesai" : `${Math.min(this.qi + 1, qs.length)}/${qs.length}`;
    }

    show(qi){
      clearInterval(this.timer);
      this.qi = qi; this.q = qs[qi]; this.busy = false; this.dwell = {};
      const q = this.q;
      this.layer.innerHTML = ""; this.slotWrap.innerHTML = "";
      this.pLabel.textContent = q.label;
      this.pText.textContent = q.prompt || "Susun potongan ayat sesuai urutan";
      this.pText.className = q.prompt ? "ar" : "";
      const single = q.slots.length === 1;
      this.slots = q.slots.map((t, i) => {
        const e = el("div", "slot" + (single ? " wide" : ""), this.slotWrap, single ? "Taruh jawaban di sini" : "");
        if (opt.control === "shoot" && i === 0 && !this.ghost) e.classList.add("next");
        return { el:e, value:t, done:false };
      });
      const top = this.top();
      this.cards = q.cards.map(t => {
        const e = el("div", "card" + (this.ghost ? " ghost-card" : ""), this.layer, t);
        e.style.fontSize = Math.round(fontFor(t) * this.scale) + "px";
        const c = { el:e, value:t, held:null, done:false, w:e.offsetWidth, h:e.offsetHeight };
        c.x = 8 + Math.random() * Math.max(1, this.w - c.w - 16);
        c.y = top + Math.random() * Math.max(1, H - top - c.h - 16);
        c.vx = (Math.random() - .5) * 1.1; c.vy = (Math.random() - .5) * 1.1;
        c.el.style.transform = `translate(${c.x}px,${c.y}px)`;
        return c;
      });
      this.render();
      if (this.ghost) return;
      play(q.playStart);
      this.startTimer();
    }
    startTimer(){
      const total = +opt.time; if (!total) return;
      this.timeLeft = total; this.hTime.textContent = total; this.hT.classList.remove("low");
      this.timer = setInterval(() => {
        this.timeLeft--; this.hTime.textContent = Math.max(0, this.timeLeft);
        this.hT.classList.toggle("low", this.timeLeft <= 5);
        if (this.timeLeft <= 0){ clearInterval(this.timer); this.reveal(); }
      }, 1000);
    }
    fill(s){
      s.done = true; s.el.classList.add("ok"); s.el.classList.remove("next", "near");
      s.el.textContent = s.value; s.el.style.fontSize = Math.round(Math.min(30, fontFor(s.value)) * this.scale) + "px";
    }
    floater(x, y, text){
      const f = el("div", "floater", this.layer, text);
      f.style.left = x + "px"; f.style.top = y + "px"; f.style.color = this.color;
      setTimeout(() => f.remove(), 900);
    }
    reveal(){
      if (this.busy) return; this.busy = true;
      this.slots.forEach(s => { if (!s.done){ this.fill(s); s.el.classList.add("missed"); } });
      this.cards.forEach(c => c.el.classList.add("pop"));
      this.streak = 0; play(this.q.playEnd);
      setTimeout(() => this.next(), 2800);
    }
    correct(c, s){
      this.fill(s); c.done = true; c.el.classList.add("pop");
      this.streak++;
      const base = this.slots.length > 1 ? 5 : 10, combo = Math.min(this.streak - 1, 3) * 2;
      this.score += base + combo;
      this.floater(c.x + c.w / 2, c.y, combo ? `+${base} kombo +${combo}` : `+${base}`);
      if (this.streak >= 2){
        Sfx.combo(this.streak);
        const k = el("div", "combo-pop", this.root, `Kombo x${this.streak}`);
        k.style.color = this.color; if (this.streak >= 4) k.classList.add("big");
        setTimeout(() => k.remove(), 1100);
      } else Sfx.correct();
      if (opt.control === "shoot"){ const n = this.slots.find(x => !x.done); if (n) n.el.classList.add("next"); }
      if (this.slots.every(x => x.done)){
        this.busy = true; clearInterval(this.timer);
        const total = +opt.time, bonus = total ? Math.round(5 * Math.max(0, this.timeLeft) / total) : 0;
        if (bonus){ this.score += bonus; this.floater(c.x + c.w / 2, c.y - 40, `Cepat +${bonus}`); }
        play(this.q.playEnd);
        setTimeout(() => this.next(), 2600);
      }
      this.render();
    }
    wrong(c){ Sfx.wrong(); c.el.classList.remove("wrong"); void c.el.offsetWidth; c.el.classList.add("wrong"); this.streak = 0; c.vy = 3; }
    next(){
      if (!alive) return;
      if (this.qi + 1 >= qs.length){
        this.finished = true; this.busy = true; this.render();
        this.layer.innerHTML = ""; this.slotWrap.innerHTML = "";
        this.wait = el("div", "wait-note", this.root, "Selesai, menunggu lawan");
        checkEnd();
      } else this.show(this.qi + 1);
    }

    hit(c, x, y, pad){ return !c.done && x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad; }
    cardAt(x, y, pad = 14){ return this.cards.slice().reverse().find(c => !c.held && this.hit(c, x, y, pad)); }
    slotAt(c){
      const cx = c.x + c.w / 2 + this.x, cy = c.y + c.h / 2;
      return this.slots.find(s => { const r = s.el.getBoundingClientRect();
        return !s.done && cx > r.left - 24 && cx < r.right + 24 && cy > r.top - 34 && cy < r.bottom + 34; });
    }
    drop(c){
      c.held = null; c.el.classList.remove("held");
      this.slots.forEach(s => s.el.classList.remove("near"));
      if (this.busy) return;
      const s = this.slotAt(c); if (!s) return;
      s.value === c.value ? this.correct(c, s) : this.wrong(c);
    }
    shoot(x, y){
      if (this.busy) return;
      flash(x + this.x, y); Sfx.shot();
      const c = this.cardAt(x, y, 30); if (!c) return;
      const t = this.slots.find(s => !s.done);
      t && t.value === c.value ? this.correct(c, t) : this.wrong(c);
    }

    // pointers: koordinat lokal papan
    update(pointers){
      if (this.ghost || this.finished) return;
      this.cards.forEach(c => { if (c.held && !pointers.some(p => p.id === c.held)) this.drop(c); });
      for (const p of pointers){
        if (opt.control === "shoot"){
          if (p.shot){ this.shoot(p.fx ?? p.x, p.fy ?? p.y); this.dwell[p.id] = null; continue; }
          // tembak otomatis kalau bidikan ditahan di kartu
          if (p.hand && p.aiming && !this.busy){
            const c = this.cardAt(p.x, p.y, 24), d = this.dwell[p.id];
            if (!c) this.dwell[p.id] = null;
            else if (!d || d.c !== c) this.dwell[p.id] = { c, t:performance.now() };
            else {
              const prog = (performance.now() - d.t) / DWELL;
              ring(p.x + this.x, p.y, prog, this.color);
              if (prog >= 1){ this.dwell[p.id] = null; this.shoot(p.x, p.y); }
            }
          }
          continue;
        }
        const held = this.cards.find(c => c.held === p.id);
        if (p.pinching && !this.busy){
          if (!held){ const c = this.cardAt(p.x, p.y); if (c){ c.held = p.id; c.el.classList.add("held"); } }
          else {
            held.x = p.x - held.w / 2; held.y = p.y - held.h / 2; held.vx = held.vy = 0;
            const s = this.slotAt(held); this.slots.forEach(x => x.el.classList.toggle("near", x === s));
          }
        } else if (held) this.drop(held);
      }
      const top = this.top();
      for (const c of this.cards){
        if (c.done) continue;
        if (!c.held){
          c.x += c.vx; c.y += c.vy; c.vy *= .99; c.vx *= .995;
          if (Math.abs(c.vx) < .25) c.vx += (Math.random() - .5) * .25;
          if (Math.abs(c.vy) < .25) c.vy += (Math.random() - .5) * .25;
          if (c.x < 6 || c.x > this.w - c.w - 6) c.vx *= -1;
          if (c.y < top || c.y > H - c.h - 10) c.vy *= -1;
          c.x = Math.max(6, Math.min(this.w - c.w - 6, c.x)); c.y = Math.max(top, Math.min(H - c.h - 10, c.y));
        }
        c.el.classList.toggle("hover", !c.held && pointers.some(p => this.hit(c, p.x, p.y, opt.control === "shoot" ? 24 : 14)));
        c.el.style.transform = `translate(${c.x}px,${c.y}px)`;
      }
    }

    // ---- sinkron online ----
    snapshot(pointers){
      return { qi:this.qi, s:this.score, f:this.finished,
        c:this.cards.map(c => [+(c.x / this.w).toFixed(3), +(c.y / H).toFixed(3), c.done ? 1 : 0, c.held ? 1 : 0]),
        sl:this.slots.map(s => s.done ? 1 : 0),
        p:pointers.slice(0, 1).map(p => [+(p.x / this.w).toFixed(3), +(p.y / H).toFixed(3), p.pinching ? 1 : 0]) };
    }
    applySnapshot(sn){
      if (sn.f && !this.finished){
        this.finished = true; this.layer.innerHTML = ""; this.slotWrap.innerHTML = "";
        this.wait = el("div", "wait-note", this.root, `${this.name} selesai`);
      }
      this.score = sn.s ?? this.score;
      if (!this.finished && sn.qi != null && sn.qi !== this.qi && qs[sn.qi]) this.show(sn.qi);
      if (!this.finished){
        (sn.sl || []).forEach((d, i) => { const s = this.slots[i]; if (s && d && !s.done) this.fill(s); });
        (sn.c || []).forEach((v, i) => { const c = this.cards[i]; if (!c) return;
          c.x = v[0] * this.w; c.y = v[1] * H;
          c.el.style.transform = `translate(${c.x}px,${c.y}px)`;
          c.el.classList.toggle("held", !!v[3]);
          if (v[2] && !c.done){ c.done = true; c.el.classList.add("pop"); } });
        if (!this.cursor) this.cursor = el("div", "ghost-cursor", this.root);
        const p = (sn.p || [])[0];
        this.cursor.hidden = !p;
        if (p){ this.cursor.style.left = p[0] * this.w + "px"; this.cursor.style.top = p[1] * H + "px"; this.cursor.classList.toggle("pinch", !!p[2]); }
      }
      this.render();
    }
    destroy(){ clearInterval(this.timer); this.root.remove(); }
  }

  // =================== ARENA ===================
  function flash(x, y){ ctx.beginPath(); ctx.fillStyle = "rgba(255,230,120,.85)"; ctx.arc(x, y, 34, 0, 7); ctx.fill(); }
  function ring(x, y, prog, color){
    ctx.beginPath(); ctx.lineWidth = 6; ctx.strokeStyle = color;
    ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, prog)); ctx.stroke();
  }
  function msg(title, html, b1, b2){
    $("#arenaMsg").hidden = !title; if (!title) return;
    $("#msgTitle").textContent = title; $("#msgText").innerHTML = html;
    $("#msgBtn").hidden = !b1; if (b1) $("#msgBtn").textContent = b1;
    $("#msgBtn2").hidden = !b2; if (b2) $("#msgBtn2").textContent = b2;
  }
  function resize(){
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    const c = $("#fx"); c.width = W * dpr; c.height = H * dpr;
    ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const all = ghost ? [...boards, ghost] : boards;
    const w = W / all.length;
    all.forEach((b, i) => b.layout(i * w, w));
  }
  const local2 = () => opt.play === "duel-local";

  function checkEnd(){
    const me = boards[0];
    if (local2()){ if (!boards.every(b => b.finished)) return; }
    else if (opt.online){ if (!me.finished || !ghost.finished) return; }
    else if (!me.finished) return;
    let html;
    if (local2() || opt.online){
      const [a, b] = local2() ? boards : [me, ghost];
      const w = a.score === b.score ? "Seri, dua-duanya hebat" : a.score > b.score ? `${a.name} menang` : `${b.name} menang`;
      html = `<p class="result-big">${w}</p><div class="duel-score"><span class="p1">${a.score}</span><span class="vs">lawan</span><span class="p2">${b.score}</span></div>`;
    } else html = `<p class="result-big">${opt.name ? opt.name + ", poinmu" : "Poinmu"}</p><div class="duel-score"><span class="p1">${me.score}</span></div>`;
    Sfx.finish();
    msg("Selesai", html + "<p>Barakallahu fiik. Terus murajaah, ya.</p>", opt.online ? null : "Main lagi", "Menu");
    $("#msgBtn").onclick = () => { stop(); start(opt); };
    $("#msgBtn2").onclick = () => { stop(); opt.onExit(); };
  }

  let lastSend = 0, lastPointers = [];
  function loop(){
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, W, H);
    let pointers = [];
    if (!opt.noCam && opt.control !== "touch"){
      pointers = Gesture.read(W, H);
      pointers.forEach(p => { if (!local2()) p.id = "L"; Gesture.drawHand(ctx, p, COLORS[p.id]); });
    }
    pointers.push(...Object.values(touch));
    // bagi pointer ke papan sesuai posisi
    boards.forEach(b => {
      const mine = pointers.filter(p => !local2() || (p.x >= b.x && p.x < b.x + b.w))
        .map(p => ({ ...p, x:p.x - b.x, fx:p.fx != null ? p.fx - b.x : null }));
      b.update(mine);
      if (b === boards[0]) lastPointers = mine;
    });
    touch = Object.fromEntries(Object.entries(touch).filter(([, t]) => t.pinching).map(([k, t]) => [k, { ...t, shot:false }]));
    if (opt.online && performance.now() - lastSend > 100){
      lastSend = performance.now(); opt.onProgress?.(boards[0].snapshot(lastPointers));
    }
  }

  function onDown(e){
    if (e.target.closest("button")) return;
    const s = opt.control === "shoot";
    touch[e.pointerId] = { id:"T" + e.pointerId, x:e.clientX, y:e.clientY, pinching:!s, shot:s };
  }
  function onMove(e){ const t = touch[e.pointerId]; if (t){ t.x = e.clientX; t.y = e.clientY; } }
  function onUp(e){ const t = touch[e.pointerId]; if (t) t.pinching = false; }

  async function start(options){
    opt = options; alive = true; touch = {}; Sfx.enabled = opt.sound !== false;
    $("#boards").innerHTML = ""; boards = []; ghost = null;
    const a = $("#arena");
    a.addEventListener("pointerdown", onDown); a.addEventListener("pointermove", onMove);
    a.addEventListener("pointerup", onUp); a.addEventListener("pointercancel", onUp);
    addEventListener("resize", resize);
    $("#cam").style.display = opt.control === "touch" || opt.noCam ? "none" : "";

    try {
      msg("Memuat ayat", "<p>Mengambil teks ayat. Surat atau juz yang baru pertama kali dipilih butuh internet dan sedikit lebih lama.</p>");
      if (opt.questions) qs = opt.questions;
      else { const verses = await Quran.load(opt.pick); qs = Questions.build(opt.mode, verses, +opt.rounds, opt.names); }
      if (!qs.length) throw Object.assign(new Error(), { name:"NO_Q" });
    } catch(e){
      msg("Ayat belum bisa dimuat", e.name === "NO_Q"
        ? "<p>Surat yang dipilih tidak cukup untuk permainan ini. Tambah surat lain atau ganti permainan.</p>"
        : "<p>Periksa koneksi internet, lalu coba lagi.</p>", "Coba lagi", "Menu");
      $("#msgBtn").onclick = () => { stop(); start(opt); };
      $("#msgBtn2").onclick = () => { stop(); opt.onExit(); };
      return;
    }

    if (opt.control !== "touch" && !opt.noCam){
      try {
        msg("Menyalakan kamera", "<p>Izinkan akses kamera saat browser bertanya. Memuat pendeteksi tangan, tunggu sebentar.</p>");
        await Gesture.start($("#cam"), { numHands: local2() ? 2 : 1 });
      } catch(e){
        msg("Kamera tidak bisa dipakai",
          `<p>${e.name === "NotAllowedError" ? "Akses kamera ditolak. Ketuk ikon gembok di samping alamat web, izinkan Kamera, lalu coba lagi."
                                             : "Kamera tidak ditemukan. Pastikan tidak sedang dipakai aplikasi lain."}</p><p>Atau main dengan sentuh dan mouse.</p>`,
          "Coba lagi", "Main dengan sentuh");
        $("#msgBtn").onclick = () => { stop(); start(opt); };
        $("#msgBtn2").onclick = () => { stop(); start({ ...opt, noCam:true }); };
        return;
      }
    }
    if (!alive) return;

    if (local2()){
      boards = [new Board({ id:"L", name:"Pemain 1", color:COLORS.L }), new Board({ id:"R", name:"Pemain 2", color:COLORS.R })];
    } else {
      boards = [new Board({ id:"L", name:opt.name || "Kamu", color:COLORS.L })];
      if (opt.online) ghost = new Board({ id:"R", name:opt.oppName || "Lawan", color:COLORS.R, ghost:true });
    }
    resize();
    msg();
    boards.forEach(b => b.show(0));
    if (ghost){ ghost.show(0); if (pendingOpp) ghost.applySnapshot(pendingOpp); }
    loop();
  }

  let pendingOpp = null;
  function setOpponent(p){
    if (!ghost){ pendingOpp = p; return; }
    if (p.done && p.qi == null){ ghost.applySnapshot({ f:true }); }
    else ghost.applySnapshot(p);
    checkEnd();
  }

  function stop(){
    alive = false; cancelAnimationFrame(raf); audio.pause(); Gesture.stop(); pendingOpp = null;
    boards.forEach(b => b.destroy()); ghost?.destroy(); boards = []; ghost = null;
    removeEventListener("resize", resize);
    const a = $("#arena");
    a.removeEventListener("pointerdown", onDown); a.removeEventListener("pointermove", onMove);
    a.removeEventListener("pointerup", onUp); a.removeEventListener("pointercancel", onUp);
  }

  return { start, stop, setOpponent };
})();
