/* Arena Ayat Battle: papan per pemain (layar terbagi untuk duel) */
window.Arena = (() => {
  const $ = s => document.querySelector(s);
  const COLORS = { L:"#f6a531", R:"#5aa9ff" };
  const DWELL = 1000;                         // tahan bidikan 1 detik = tembak otomatis
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.appendChild(e); return e; };
  const fontFor = t => t.length > 60 ? 20 : t.length > 38 ? 24 : t.length > 22 ? 28 : 34;

  let opt, qs = [], boards = [], ghost = null, raf = 0, ctx, W, H, alive = false, touch = {}, paused = false;
  const audio = new Audio();
  const voiceMode = () => opt.control === "voice";
  let owner = null;                                   // papan yang sedang memutar suara
  const busyAudio = () => !audio.paused && !audio.ended && audio.currentTime < (audio.duration || 99);
  function play(ref, who, auto){
    try {
      if (!ref || !opt.sound) return;
      // duel satu layar: suara otomatis tidak boleh memotong suara milik papan lain
      if (auto && opt.play === "duel-local" && busyAudio() && owner && owner !== who) return;
      owner?.listen?.classList.remove("playing");
      owner = who || null;
      owner?.listen?.classList.add("playing");
      if (ref.tts){                                   // huruf berharakat: suara bawaan perangkat
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(ref.tts); u.lang = "ar-SA"; u.rate = .7;
        const v = speechSynthesis.getVoices().find(x => x.lang?.startsWith("ar")); if (v) u.voice = v;
        speechSynthesis.speak(u); return;
      }
      const src = ref.rec ? Rec.url(ref.rec) : ref.url || Quran.audioUrl(opt.qari, ref[0], ref[1]);
      if (!src) return;
      audio.pause(); audio.src = src;
      if (voiceMode() && Voice.active) Voice.hold(true);
      audio.play().catch(() => { if (voiceMode()) Voice.hold(false); });
    } catch(e){}
  }
  audio.addEventListener("ended", () => owner?.listen?.classList.remove("playing"));
  audio.addEventListener("error", () => owner?.listen?.classList.remove("playing"));
  audio.onended = audio.onerror = () => { if (opt && voiceMode() && Voice.active) setTimeout(() => Voice.hold(false), 250); };
  const safely = fn => { try { fn(); } catch(e){ console.warn(e); } };

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
      if (!ghost){
        this.btnNext = el("button", "next-btn", hud, "Lewati");
        this.btnNext.onclick = () => this.manualNext();
      }
      this.stage = el("div", "stage", this.root);
      this.prompt = el("div", "prompt", this.stage);
      const ph = el("div", "prompt-head", this.prompt);
      this.pLabel = el("span", "", ph);
      if (!ghost){
        const b = el("button", "listen", ph);
        b.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-sound"/></svg>Dengar';
        b.onclick = () => play(this.q?.hint || this.q?.playStart || this.q?.playEnd, this);
        this.listen = b;
      }
      this.pText = el("p", "", this.prompt); this.pText.dir = "rtl";
      this.slotWrap = el("div", "slots", this.stage); this.slotWrap.dir = "rtl";
      this.layer = el("div", "layer", this.root);
      this.wait = null;
      if (!ghost && opt.control === "write"){
        this.pad = Draw.pad(this.root, p => this.checkWrite(p));
      }
      if (!ghost && voiceMode()){
        this.vbar = el("div", "voice-bar", this.root);
        this.vMic = el("div", "mic", this.vbar); this.vMic.innerHTML = '<svg viewBox="0 0 48 48"><use href="#i-mic"/></svg>';
        const tx = el("div", "vtext", this.vbar);
        this.vState = el("small", "", tx, "Menyiapkan mikrofon");
        this.vHeard = el("p", "", tx, ""); this.vHeard.dir = "auto";
      }
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
      clearInterval(this.timer); clearTimeout(this.advT);
      this.qi = qi; this.q = qs[qi]; this.busy = false; this.dwell = {};
      if (this.btnNext){ this.btnNext.textContent = "Lewati"; this.btnNext.classList.remove("ready"); }
      const q = this.q;
      this.layer.innerHTML = ""; this.slotWrap.innerHTML = "";
      this.pLabel.textContent = q.label;
      if (this.listen) this.listen.hidden = !(q.hint || q.playStart || (q.playEnd && !q.write));
      this.pText.textContent = q.prompt || "Susun potongan ayat sesuai urutan";
      this.pText.className = q.promptClass || (q.prompt ? "ar" : "");
      this.pText.dir = q.promptClass === "big-latin" ? "ltr" : "rtl";
      const single = q.slots.length === 1;
      this.slots = q.slots.map((t, i) => {
        const e = el("div", "slot" + (single ? " wide" : ""), this.slotWrap, single ? (q.write ? "Tulis di papan" : voiceMode() ? "Baca dengan suara" : "Taruh jawaban di sini") : "");
        if (opt.control === "shoot" && i === 0 && !this.ghost) e.classList.add("next");
        return { el:e, value:t, done:false };
      });
      const top = this.top();
      this.cards = q.cards.map(t => {
        const lat = q.latin || q.cardClass === "latin";
        const e = el("div", "card" + (this.ghost ? " ghost-card" : "") + (lat ? " latin" : "") + (q.cardClass ? " " + q.cardClass : ""), this.layer, t);
        e.style.fontSize = Math.round((lat ? 26 : q.cardClass === "letter" ? 52 : q.cardClass === "word" ? 40 : fontFor(t)) * this.scale) + "px";
        if (voiceMode() && !q.latin && !this.ghost) e.hidden = true;   // mode suara: jawab dengan membaca
        const c = { el:e, value:t, held:null, done:false, w:e.offsetWidth, h:e.offsetHeight };
        c.x = 8 + Math.random() * Math.max(1, this.w - c.w - 16);
        c.y = top + Math.random() * Math.max(1, H - top - c.h - 16);
        c.vx = (Math.random() - .5) * 1.1; c.vy = (Math.random() - .5) * 1.1;
        c.el.style.transform = `translate(${c.x}px,${c.y}px)`;
        return c;
      });
      this.render();
      if (this.ghost) return;
      if (this.pad){
        // taruh papan tepat di bawah kotak soal
        requestAnimationFrame(() => {
          const r = this.stage.getBoundingClientRect();
          const room = innerHeight - r.bottom - 90;                   // sisa tinggi untuk papan + tombol
          this.pad.el.style.setProperty("--pad-top", Math.round(r.bottom + 12) + "px");
          this.pad.el.style.width = Math.round(Math.max(170, Math.min(380, this.w * .9, room))) + "px";
          this.pad.resize();
        });
        this.pad.clear(); this.pad.resize();
        const w = q.write || {};
        this.pad.setGuide(w.guide ? w.target : "", true);
        if (w.show && !w.guide && q.promptClass === "big-latin") this.pText.textContent = `${q.prompt}  ${w.target}`;
      }
      if (voiceMode()){
        Voice.reset(q.latin ? "id-ID" : "ar-SA");
        this.vHeard.textContent = "";
        this.voiceState(Voice.active ? "on" : "off");
        if (q.prompt) play(q.playStart, this, true);   // susun: jangan bocorkan jawaban lewat audio
      } else play(q.playStart, this, true);
      this.startTimer();
    }
    startTimer(){
      const total = +opt.time; if (!total) return;
      this.timeLeft = total; this.hTime.textContent = total; this.hT.classList.remove("low");
      this.timer = setInterval(() => {
        if (paused) return;
        this.timeLeft--; this.hTime.textContent = Math.max(0, this.timeLeft);
        this.hT.classList.toggle("low", this.timeLeft <= 5);
        if (this.timeLeft <= 0){ clearInterval(this.timer); this.reveal(); }
      }, 1000);
    }
    fill(s){
      s.done = true; s.el.classList.add("ok"); s.el.classList.remove("next", "near");
      s.el.textContent = s.value;
      if (this.q?.latin || this.q?.cardClass === "latin"){ s.el.classList.add("latin"); s.el.style.fontSize = Math.round(24 * this.scale) + "px"; }
      else if (this.q?.cardClass === "letter" || this.q?.write){ s.el.classList.add("hij"); s.el.style.fontSize = Math.round(44 * this.scale) + "px"; }
      else s.el.style.fontSize = Math.round(Math.min(30, fontFor(s.value)) * this.scale) + "px";
    }
    confetti(n = 36){
      const box = el("div", "confetti", this.root);
      const cols = ["#f6c64a", "#a9b84a", "#b6402c", "#5aa9ff", "#fde7bf", "#f6a531"];
      for (let i = 0; i < n; i++){
        const c = el("i", "", box);
        c.style.left = Math.random() * 100 + "%"; c.style.background = cols[i % cols.length];
        c.style.setProperty("--x", (Math.random() - .5) * 160 + "px");
        c.style.setProperty("--r", (Math.random() * 900 - 450) + "deg");
        c.style.setProperty("--d", (1.2 + Math.random() * .9) + "s");
        c.style.animationDelay = Math.random() * .25 + "s";
      }
      setTimeout(() => box.remove(), 2600);
    }
    floater(x, y, text){
      const f = el("div", "floater", this.layer, text);
      f.style.left = x + "px"; f.style.top = y + "px"; f.style.color = this.color;
      setTimeout(() => f.remove(), 900);
    }
    // satu-satunya jalan pindah soal: dijadwalkan sekali, aman dari dobel
    goNext(delay){
      clearTimeout(this.advT);
      const at = this.qi;
      if (this.btnNext){ this.btnNext.textContent = "Lanjut"; this.btnNext.classList.add("ready"); }
      const go = () => { if (!alive || this.qi !== at || this.finished) return; if (paused){ this.advT = setTimeout(go, 300); return; } this.next(); };
      this.advT = setTimeout(go, delay);
    }
    manualNext(){
      if (this.finished) return;
      if (this.busy){ clearTimeout(this.advT); this.next(); }   // sudah dijawab: langsung lanjut
      else { this.reveal(1200); }                                // belum: tunjukkan jawaban lalu lanjut
    }
    reveal(delay = 2800){
      if (this.busy) return; this.busy = true; clearInterval(this.timer);
      this.slots.forEach(s => { if (!s.done){ this.fill(s); s.el.classList.add("missed"); } });
      if (this.q.reveal) this.pLabel.textContent = this.q.reveal;
      if (this.pad && this.q.write) this.pad.showAnswer(this.q.write.target);
      this.cards.forEach(c => c.el.classList.add("pop"));
      this.streak = 0;
      this.goNext(delay);
      play(this.q.playEnd, this, true);
    }
    correct(c, s){
      this.fill(s); c.done = true; c.el.classList.add("pop");
      this.streak++;
      const base = this.slots.length > 1 && !voiceMode() ? 5 : 10, combo = Math.min(this.streak - 1, 3) * 2;
      this.score += base + combo;
      const done = this.slots.every(x => x.done);
      let bonus = 0;
      if (done && this.q.reveal) this.pLabel.textContent = this.q.reveal;
      this.hWho.classList.remove("bump"); void this.hWho.offsetWidth; this.hWho.classList.add("bump");
      if (done){
        this.busy = true; clearInterval(this.timer);
        const total = +opt.time; bonus = total ? Math.round(5 * Math.max(0, this.timeLeft) / total) : 0;
        this.score += bonus;
        this.goNext(2600);                                       // dijadwalkan dulu, efek belakangan
      }
      this.render();
      safely(() => {
        this.floater(c.x + c.w / 2, c.y, combo ? `+${base} kombo +${combo}` : `+${base}`);
        if (bonus) this.floater(c.x + c.w / 2, c.y - 40, `Cepat +${bonus}`);
        if (this.streak >= 2){
          Sfx.combo(this.streak);
          const k = el("div", "combo-pop", this.root, `Kombo x${this.streak}`);
          k.style.color = this.color; if (this.streak >= 4) k.classList.add("big");
          setTimeout(() => k.remove(), 1100);
        } else Sfx.correct();
        if (opt.control === "shoot" && !done){ const n = this.slots.find(x => !x.done); if (n) n.el.classList.add("next"); }
        if (done){ play(this.q.playEnd, this, true); this.confetti(); }
      });
    }
    wrong(c){ Sfx.wrong(); c.el.classList.remove("wrong"); void c.el.offsetWidth; c.el.classList.add("wrong"); this.streak = 0; c.vy = 3; }
    next(){
      if (!alive || this.finished) return;
      clearTimeout(this.advT);
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
    // ---- jawab dengan suara ----
    voiceState(st){
      if (!this.vbar) return;
      const t = { on:"Silakan baca jawabannya", hold:"Dengarkan dulu", off:"Mikrofon mati", denied:"Izin mikrofon ditolak",
                  network:"Butuh internet untuk mengenali suara" }[st] || "";
      this.vState.textContent = this.busy && st === "on" ? "Benar" : t;
      this.vbar.classList.toggle("listening", st === "on"); this.vbar.classList.toggle("hold", st === "hold");
    }
    onVoice({ text, alts, final }){
      if (this.ghost || this.busy || this.finished) return;
      this.vHeard.textContent = text;
      const q = this.q, heard = [text, ...alts];
      if (q.latin){
        let best = null;
        for (const h of heard) for (const c of q.cards){ const v = Quran.simLatin(h, c); if (!best || v > best.v) best = { v, c }; }
        if (best && best.v >= Math.min(q.th, .7)){
          if (best.c === q.slots[0]) this.correctVoice(); else if (final){ this.voiceWrong(); }
        } else if (final && text) this.voiceWrong();
        return;
      }
      const target = Quran.norm(q.voice || q.slots.join(" "));
      const r = Math.max(...heard.map(h => Quran.recall(target, Quran.norm(h))));
      if (r >= q.th) this.correctVoice();
      else if (final && text.split(/\s+/).length >= 2) this.voiceWrong(r);
    }
    voiceWrong(r){
      this.streak = 0; Sfx.wrong();
      this.vState.textContent = r > .4 ? "Hampir, coba baca lagi" : "Belum tepat, coba lagi";
      this.vbar.classList.remove("shake"); void this.vbar.offsetWidth; this.vbar.classList.add("shake");
      Voice.reset();
    }
    checkWrite(p){
      if (this.busy || this.finished) return;
      const w = this.q.write; if (!w) return;
      const th = { easy:.5, medium:.56, hard:.62 }[opt.level] || .56;
      const r = p.judge(w.target, w.others || [], th);
      if (r.empty){ p.el.classList.remove("bad"); void p.el.offsetWidth; p.el.classList.add("bad"); return; }
      if (r.ok){ p.el.classList.add("ok"); p.showAnswer(w.target); this.correctVoice(); }
      else {
        this.streak = 0; Sfx.wrong();
        p.el.classList.remove("bad"); void p.el.offsetWidth; p.el.classList.add("bad");
        p.showAnswer(w.target);
        setTimeout(() => { if (!this.busy && this.q.write === w){ p.clear(); p.setGuide(w.guide ? w.target : "", true); } }, 1400);
      }
    }
    correctVoice(){
      const fake = { x:this.w / 2 - 40, y:H * .55, w:80, h:0, el:document.createElement("div") };
      const left = this.slots.filter(s => !s.done);
      left.slice(0, -1).forEach(s => this.fill(s));
      this.correct(fake, left[left.length - 1]);
      this.vState.textContent = "Benar";
    }
    destroy(){ clearInterval(this.timer); clearTimeout(this.advT); this.root.remove(); }
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
    [...boards, ghost].filter(Boolean).forEach(b => safely(() => b.confetti(70)));
    msg("Selesai", html + "<p>Barakallahu fiik. Terus murajaah, ya.</p>", opt.online ? null : "Main lagi", "Menu");
    $("#msgBtn").onclick = () => { stop(); start(opt); };
    $("#msgBtn2").onclick = () => { stop(); opt.onExit(); };
  }

  let lastSend = 0, lastPointers = [];
  function loop(){
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (paused) return;
    ctx.clearRect(0, 0, W, H);
    let pointers = [];
    if (!opt.noCam && opt.control !== "touch"){
      pointers = Gesture.read(W, H);
      pointers.forEach(p => { if (!local2()) p.id = "L"; Gesture.drawHand(ctx, p, COLORS[p.id]); });
    }
    pointers.push(...Object.values(touch));
    // bagi pointer ke papan sesuai posisi
    boards.forEach(b => safely(() => {
      const mine = pointers.filter(p => !local2() || (p.x >= b.x && p.x < b.x + b.w))
        .map(p => ({ ...p, x:p.x - b.x, fx:p.fx != null ? p.fx - b.x : null }));
      b.update(mine);
      if (b === boards[0]) lastPointers = mine;
      // penjaga: semua kotak sudah terisi tapi belum pindah soal
      if (!b.finished && b.slots.length && b.slots.every(x => x.done) && !b.busy){ b.busy = true; b.goNext(1500); }
    }));
    touch = Object.fromEntries(Object.entries(touch).filter(([, t]) => t.pinching).map(([k, t]) => [k, { ...t, shot:false }]));
    if (opt.online && performance.now() - lastSend > 100){
      lastSend = performance.now(); opt.onProgress?.(boards[0].snapshot(lastPointers));
    }
  }

  function onDown(e){
    if (paused || e.target.closest("button, .pad, .pause-ov")) return;
    const s = opt.control === "shoot";
    touch[e.pointerId] = { id:"T" + e.pointerId, x:e.clientX, y:e.clientY, pinching:!s, shot:s };
  }
  function onMove(e){ const t = touch[e.pointerId]; if (t){ t.x = e.clientX; t.y = e.clientY; } }
  function onUp(e){ const t = touch[e.pointerId]; if (t) t.pinching = false; }

  async function start(options){
    opt = options; alive = true; touch = {}; Sfx.enabled = opt.sound !== false;
    paused = false;
    safely(() => {
      ensurePauseUI();
      $("#pauseOv").hidden = true;
      $("#arenaPause").onclick = togglePause; $("#btnResume").onclick = () => setPaused(false);
      $("#btnPauseMenu").onclick = () => { setPaused(false); stop(); opt.onExit(); };
    });
    $("#boards").innerHTML = ""; boards = []; ghost = null;
    const a = $("#arena");
    a.addEventListener("pointerdown", onDown); a.addEventListener("pointermove", onMove);
    a.addEventListener("pointerup", onUp); a.addEventListener("pointercancel", onUp);
    addEventListener("resize", resize);
    const noCam = ["touch", "voice", "write"].includes(opt.control) || opt.noCam;
    $("#cam").style.display = noCam ? "none" : "";
    a.classList.toggle("nocam", noCam);

    try {
      msg("Memuat ayat", "<p>Mengambil teks ayat. Surat atau juz yang baru pertama kali dipilih butuh internet dan sedikit lebih lama.</p>");
      if (window.Rec) await Rec.init();
      if (opt.questions) qs = opt.questions;
      else qs = await Questions.make(opt);
      if (!qs.length) throw Object.assign(new Error(), { name:"NO_Q" });
    } catch(e){
      msg("Ayat belum bisa dimuat", e.name === "NO_Q"
        ? "<p>Surat yang dipilih tidak cukup untuk permainan ini. Tambah surat lain atau ganti permainan.</p>"
        : "<p>Periksa koneksi internet, lalu coba lagi.</p>", "Coba lagi", "Menu");
      $("#msgBtn").onclick = () => { stop(); start(opt); };
      $("#msgBtn2").onclick = () => { stop(); opt.onExit(); };
      return;
    }

    if (voiceMode() && !Voice.supported){
      msg("Jawab suara belum didukung", "<p>Browser ini belum bisa mengenali suara. Pakai Google Chrome di laptop atau HP Android, lalu coba lagi.</p>", null, "Menu");
      $("#msgBtn2").onclick = () => { stop(); opt.onExit(); };
      return;
    }
    if (!["touch", "voice", "write"].includes(opt.control) && !opt.noCam){
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
    if (voiceMode()){
      Voice.start("ar-SA", r => boards[0]?.onVoice(r), st => {
        boards[0]?.voiceState(st);
        if (st === "denied") msg("Mikrofon tidak bisa dipakai", "<p>Izin mikrofon ditolak. Ketuk ikon gembok di samping alamat web, izinkan Mikrofon, lalu coba lagi.</p>", "Coba lagi", "Menu");
      });
      $("#msgBtn").onclick = () => { stop(); start(opt); };
      $("#msgBtn2").onclick = () => { stop(); opt.onExit(); };
    }
    boards.forEach(b => b.show(0));
    if (ghost){ ghost.show(0); if (pendingOpp) ghost.applySnapshot(pendingOpp); }
    loop();
  }

  // buat tombol & jendela jeda kalau index.html belum memilikinya (mis. versi lama masih di cache)
  function ensurePauseUI(){
    const arena = $("#arena");
    if (!$("#arenaPause")){
      const b = el("button", "round sm arena-pause", arena); b.id = "arenaPause"; b.setAttribute("aria-label", "Jeda");
      b.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-pause"/></svg>';
    }
    if (!document.getElementById("i-pause")){
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      defs.setAttribute("width", "0"); defs.setAttribute("height", "0"); defs.style.position = "absolute";
      defs.innerHTML = '<symbol id="i-pause" viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/></symbol>' +
        '<symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></symbol>';
      document.body.appendChild(defs);
    }
    if (!$("#pauseOv")){
      const ov = el("div", "pause-ov", arena); ov.id = "pauseOv"; ov.hidden = true;
      ov.innerHTML = '<div class="modal-card"><h2 class="board">Jeda</h2><p class="pause-note" id="pauseNote"></p>' +
        '<div class="msg-actions"><button class="plank wood" id="btnResume">Lanjutkan</button><button class="plank stone" id="btnPauseMenu">Menu</button></div></div>';
    }
  }
  function setPaused(v){
    ensurePauseUI();
    if (!alive || $("#arenaMsg").hidden === false) v = false;
    paused = v;
    $("#pauseOv").hidden = !v;
    $("#arenaPause use").setAttribute("href", v ? "#i-play" : "#i-pause");
    $("#arenaPause").setAttribute("aria-label", v ? "Lanjutkan" : "Jeda");
    $("#pauseNote").textContent = opt?.online ? "Permainanmu dijeda. Lawan tetap bisa bermain, jadi jangan terlalu lama." : "Permainan dihentikan sementara. Waktu tidak berjalan.";
    if (v){ audio.pause(); try { speechSynthesis.cancel(); } catch(e){} if (Voice.active) Voice.hold(true); touch = {}; }
    else if (voiceMode() && Voice.active) Voice.hold(false);
  }
  const togglePause = () => setPaused(!paused);
  addEventListener("keydown", e => {
    if (!alive || !$("#arena").classList.contains("active")) return;
    if (e.key === "p" || e.key === "P" || (e.key === "Escape" && paused)) togglePause();
  });

  let pendingOpp = null;
  function setOpponent(p){
    if (!ghost){ pendingOpp = p; return; }
    if (p.done && p.qi == null){ ghost.applySnapshot({ f:true }); }
    else ghost.applySnapshot(p);
    checkEnd();
  }

  function stop(){
    alive = false; paused = false; const pov = $("#pauseOv"); if (pov) pov.hidden = true; cancelAnimationFrame(raf); audio.pause(); Gesture.stop(); Voice.stop(); pendingOpp = null;
    boards.forEach(b => b.destroy()); ghost?.destroy(); boards = []; ghost = null;
    removeEventListener("resize", resize);
    const a = $("#arena");
    a.removeEventListener("pointerdown", onDown); a.removeEventListener("pointermove", onMove);
    a.removeEventListener("pointerup", onUp); a.removeEventListener("pointercancel", onUp);
  }

  return { start, stop, setOpponent, pause:setPaused };
})();
