/* Engine gestur Ayat Battle
   - Kamera + MediaPipe HandLandmarker (jalan di browser, tidak ada data dikirim ke server)
   - Mengeluarkan "pointer" per tangan: posisi layar, sedang jepit atau tidak, dan event tembak
*/
window.Gesture = (() => {
  const VER = "0.10.14";
  const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
  const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

  let landmarker = null, video = null, stream = null, running = false, lastTs = -1;
  const memory = {}; // status per tangan (hysteresis & cooldown)

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  async function load(numHands){
    const { FilesetResolver, HandLandmarker } = await import(`${CDN}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    const opts = d => ({ baseOptions:{ modelAssetPath:MODEL, delegate:d }, runningMode:"VIDEO", numHands,
                         minHandDetectionConfidence:.6, minTrackingConfidence:.5 });
    try { return await HandLandmarker.createFromOptions(fileset, opts("GPU")); }
    catch(e){ return await HandLandmarker.createFromOptions(fileset, opts("CPU")); }
  }

  async function start(videoEl, { numHands = 1 } = {}){
    video = videoEl;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("NO_CAMERA_API");
    stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"user", width:{ideal:1280}, height:{ideal:720} }, audio:false });
    video.srcObject = stream;
    await video.play();
    if (!landmarker || landmarker._hands !== numHands){
      landmarker?.close?.();
      landmarker = await load(numHands);
      landmarker._hands = numHands;
    }
    running = true;
  }

  function stop(){
    running = false;
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    if (video) video.srcObject = null;
  }

  // Ubah koordinat video (0..1) ke piksel layar, memperhitungkan object-fit:cover dan cermin
  function toScreen(p, W, H){
    const vw = video.videoWidth, vh = video.videoHeight;
    const s = Math.max(W / vw, H / vh);
    const ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
    return { x: W - (p.x * vw * s + ox), y: p.y * vh * s + oy };
  }

  /* Baca satu frame. Mengembalikan array tangan:
     { id, x, y, pinching, shot, aiming, pts }  (pts = 21 titik dalam piksel layar)  */
  function read(W, H){
    if (!running || !landmarker || video.readyState < 2) return [];
    const ts = performance.now();
    if (ts <= lastTs) return [];
    lastTs = ts;
    const res = landmarker.detectForVideo(video, ts);
    const hands = [];
    (res.landmarks || []).forEach((lm, i) => {
      const pts = lm.map(p => toScreen(p, W, H));
      const size = dist(lm[0], lm[9]) || 1;                  // ukuran telapak, supaya jarak tidak tergantung jauh-dekat
      const d0 = i => dist(lm[i], lm[0]);
      const pinchD = dist(lm[4], lm[8]) / size;             // jempol ke telunjuk
      const thumbD = Math.min(dist(lm[4], lm[5]), dist(lm[4], lm[6])) / size; // jempol ke sisi telunjuk

      // id stabil: berdasarkan sisi layar (kiri/kanan) supaya cocok untuk duel satu layar
      const mid = (pts[0].x + pts[9].x) / 2;
      const id = res.landmarks.length > 1 ? (mid < W / 2 ? "L" : "R") : (mid < W / 2 ? "L" : "R");
      const m = memory[id] ||= { pinch:false, lastShot:0, sx:null, sy:null, th:[], hist:[] };

      // JEPIT dengan hysteresis (tidak berkedip-kedip)
      if (!m.pinch && pinchD < .32) m.pinch = true;
      else if (m.pinch && pinchD > .48) m.pinch = false;

      // BIDIK: telunjuk lurus, minimal satu dari jari tengah/manis menekuk (lebih longgar dari sebelumnya)
      const indexOut = d0(8) > d0(6) * 1.05;
      const curled = (d0(12) < d0(10) * 1.12) || (d0(16) < d0(14) * 1.12);
      const aiming = indexOut && curled && pinchD > .35;

      // TEMBAK adaptif: jempol turun cukup jauh dari posisi tertingginya dalam 0,4 detik terakhir
      let shot = false;
      if (aiming){
        m.th.push([ts, thumbD]); m.th = m.th.filter(x => ts - x[0] < 400);
        const peak = Math.max(...m.th.map(x => x[1]));
        if (peak - thumbD > .2 && thumbD < .5 && ts - m.lastShot > 380){ shot = true; m.lastShot = ts; m.th = []; }
      } else m.th = [];

      // Titik kendali: ujung telunjuk saat membidik, tengah jepitan saat menjepit. Diperhalus.
      const raw = aiming ? pts[8] : { x:(pts[4].x + pts[8].x) / 2, y:(pts[4].y + pts[8].y) / 2 };
      const k = aiming ? .35 : .45;
      m.sx = m.sx == null ? raw.x : m.sx + (raw.x - m.sx) * k;
      m.sy = m.sy == null ? raw.y : m.sy + (raw.y - m.sy) * k;
      m.hist.push([ts, m.sx, m.sy]); m.hist = m.hist.filter(x => ts - x[0] < 400);
      // posisi tembak = posisi bidikan ~150 ms sebelumnya (sebelum jempol menggeser tangan)
      const back = m.hist.find(x => ts - x[0] <= 150) || m.hist[m.hist.length - 1];

      hands.push({ id, x:m.sx, y:m.sy, pinching:m.pinch, shot, aiming, fx:back[1], fy:back[2], hand:true, pts });
    });
    return hands;
  }

  const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
                 [9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

  function drawHand(ctx, h, color){
    ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.fillStyle = "#fff";
    ctx.beginPath();
    BONES.forEach(([a,b]) => { ctx.moveTo(h.pts[a].x, h.pts[a].y); ctx.lineTo(h.pts[b].x, h.pts[b].y); });
    ctx.stroke();
    h.pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 7); ctx.fill(); });
    // kursor
    ctx.beginPath(); ctx.lineWidth = 4;
    if (h.aiming){
      ctx.arc(h.x, h.y, 22, 0, 7);
      ctx.moveTo(h.x - 32, h.y); ctx.lineTo(h.x - 12, h.y); ctx.moveTo(h.x + 12, h.y); ctx.lineTo(h.x + 32, h.y);
      ctx.moveTo(h.x, h.y - 32); ctx.lineTo(h.x, h.y - 12); ctx.moveTo(h.x, h.y + 12); ctx.lineTo(h.x, h.y + 32);
    } else ctx.arc(h.x, h.y, h.pinching ? 10 : 18, 0, 7);
    ctx.stroke();
  }

  return { start, stop, read, drawHand, get running(){ return running; } };
})();
