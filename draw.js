/* Papan tulis huruf + pencocok bentuk sederhana (tanpa server).
   Tulisan anak dibandingkan dengan bentuk huruf asli dan huruf-huruf yang mirip. */
window.Draw = (() => {
  const N = 48;
  const FONTS = ['"Noto Naskh Arabic"', '"Amiri Quran"', "Tahoma", "Arial", "sans-serif"];

  // ubah kanvas menjadi grid N x N (dipotong ke area tinta, rasio dijaga)
  function toGrid(src){
    const w = src.width, h = src.height, d = src.getContext("2d").getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      if (d[(y * w + x) * 4 + 3] > 40){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = (N - 6) / Math.max(bw, bh);
    const c = document.createElement("canvas"); c.width = c.height = N;
    const g = c.getContext("2d");
    g.drawImage(src, x0, y0, bw, bh, (N - bw * s) / 2, (N - bh * s) / 2, bw * s, bh * s);
    const e = g.getImageData(0, 0, N, N).data, out = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) out[i] = e[i * 4 + 3] > 60 ? 1 : 0;
    return out;
  }
  function dilate(a, r){
    const o = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
      if (!a[y * N + x]) continue;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < N && Y < N && dx * dx + dy * dy <= r * r) o[Y * N + X] = 1;
      }
    }
    return o;
  }
  const count = a => a.reduce((s, v) => s + v, 0);
  function overlap(a, b){ let n = 0; for (let i = 0; i < a.length; i++) if (a[i] && b[i]) n++; return n; }

  const tcache = {};
  function templates(ch){
    if (tcache[ch]) return tcache[ch];
    return tcache[ch] = FONTS.map(f => {
      const c = document.createElement("canvas"); c.width = c.height = 260;
      const g = c.getContext("2d"); g.fillStyle = "#000"; g.font = `160px ${f}`;
      g.textAlign = "center"; g.textBaseline = "middle"; g.direction = "rtl";
      g.fillText(ch, 130, 140);
      return toGrid(c);
    }).filter(Boolean);
  }
  function score(drawn, ch){
    const D = dilate(drawn, 3), dc = count(drawn);
    let best = 0;
    for (const t of templates(ch)){
      const T = dilate(t, 3);
      const P = overlap(drawn, T) / (dc || 1), R = overlap(t, D) / (count(t) || 1);
      const f = P + R ? 2 * P * R / (P + R) : 0;
      if (f > best) best = f;
    }
    return best;
  }

  // ---------- papan ----------
  function pad(parent, onCheck){
    const wrap = document.createElement("div"); wrap.className = "pad";
    wrap.innerHTML = `<div class="pad-area"><span class="pad-guide" dir="rtl"></span><canvas></canvas></div>
      <div class="pad-actions"><button class="chip pad-clear">Hapus</button><button class="plank wood pad-check">Cek</button></div>`;
    parent.appendChild(wrap);
    const cv = wrap.querySelector("canvas"), g = cv.getContext("2d"), guide = wrap.querySelector(".pad-guide");
    let drawing = false, last = null, ink = false;
    function size(){
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.lineCap = g.lineJoin = "round"; g.strokeStyle = "#2b1a0c"; g.lineWidth = Math.max(8, r.width * .05);
      ink = false;
    }
    const pos = e => { const r = cv.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; };
    cv.addEventListener("pointerdown", e => { e.stopPropagation(); cv.setPointerCapture(e.pointerId); drawing = true; last = pos(e);
      g.beginPath(); g.arc(last.x, last.y, g.lineWidth / 2, 0, 7); g.fillStyle = "#2b1a0c"; g.fill(); ink = true; });
    cv.addEventListener("pointermove", e => { if (!drawing) return; const p = pos(e);
      g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke(); last = p; });
    const end = () => { drawing = false; };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    wrap.querySelector(".pad-clear").onclick = () => api.clear();
    wrap.querySelector(".pad-check").onclick = () => onCheck(api);
    const api = {
      el:wrap,
      clear(){ g.clearRect(0, 0, cv.width, cv.height); ink = false; wrap.classList.remove("ok", "bad"); guide.classList.remove("show-answer"); },
      setGuide(ch, faint){ guide.textContent = ch || ""; guide.classList.toggle("faint", !!faint); guide.hidden = !ch; },
      showAnswer(ch){ guide.textContent = ch; guide.hidden = false; guide.classList.add("show-answer"); },
      get empty(){ return !ink; },
      // kembalikan { ok, best, score }
      judge(target, others, th){
        const grid = toGrid(cv);
        if (!grid || count(grid) < 12) return { ok:false, empty:true };
        const sT = score(grid, target);
        const rivals = others.map(ch => [ch, score(grid, ch)]).sort((a, b) => b[1] - a[1]);
        const top = rivals[0];
        const ok = sT >= th && (!top || sT >= top[1] - .015);
        return { ok, score:sT, best: top && top[1] > sT ? top[0] : target };
      },
      resize:size
    };
    requestAnimationFrame(size);
    return api;
  }

  return { pad };
})();
