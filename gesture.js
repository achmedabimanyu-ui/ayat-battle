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
      const pinchD = dist(lm[4], lm[8]) / size;             // jempol ke telunjuk
      const thumbD = dist(lm[4], lm[5]) / size;             // jempol ke pangkal telunjuk (pistol jari)
      const indexOut = dist(lm[8], lm[0]) > dist(lm[6], lm[0]) * 1.1;
      const curled = dist(lm[12], lm[0]) < dist(lm[10], lm[0]) * 1.05;

      // id stabil: berdasarkan sisi layar (kiri/kanan) supaya cocok untuk duel satu layar
      const mid = (pts[0].x + pts[9].x) / 2;
      const id = res.landmarks.length > 1 ? (mid < W / 2 ? "L" : "R") : "L";
      const m = memory[id] ||= { pinch:false, cocked:false, lastShot:0, sx:null, sy:null };

      // JEPIT dengan hysteresis (tidak berkedip-kedip)
      if (!m.pinch && pinchD < .32) m.pinch = true;
      else if (m.pinch && pinchD > .48) m.pinch = false;

      // TEMBAK: telunjuk lurus, jari tengah menekuk, jempol tegak lalu ditekuk
      const aiming = indexOut && curled;
      let shot = false;
      if (aiming){
        if (thumbD > .55) m.cocked = true;
        else if (m.cocked && thumbD < .35 && ts - m.lastShot > 450){ shot = true; m.cocked = false; m.lastShot = ts; }
      } else m.cocked = false;

      // Titik kendali: tengah jepitan, atau ujung telunjuk saat membidik. Diperhalus.
      const raw = aiming ? pts[8] : { x:(pts[4].x + pts[8].x) / 2, y:(pts[4].y + pts[8].y) / 2 };
      const k = .45;
      m.sx = m.sx == null ? raw.x : m.sx + (raw.x - m.sx) * k;
      m.sy = m.sy == null ? raw.y : m.sy + (raw.y - m.sy) * k;

      hands.push({ id, x:m.sx, y:m.sy, pinching:m.pinch, shot, aiming, pts });
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
