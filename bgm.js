/* Suara latar suasana alam (angin gurun lembut + kicau burung), dibuat langsung di browser.
   Tanpa alat musik. Hanya di menu, otomatis hilang saat permainan (karena ada bacaan Al-Qur'an). */
window.Bgm = (() => {
  let ac, master, nodes = [], birdT = 0, on = false;
  const VOL = .05;

  function noiseBuffer(){
    const len = ac.sampleRate * 4, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++){ const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }  // brown noise
    return b;
  }
  function lfo(freq, depth, target, base){
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq; g.gain.value = depth; o.connect(g).connect(target);
    if (base != null) target.value = base;
    o.start(); nodes.push(o);
  }
  function bird(){
    if (!on) return;
    const t0 = ac.currentTime, n = 2 + Math.random() * 3 | 0, pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (pan){ pan.pan.value = Math.random() * 1.6 - .8; pan.connect(master); }
    const base = 2200 + Math.random() * 1400;
    for (let i = 0; i < n; i++){
      const o = ac.createOscillator(), g = ac.createGain(), t = t0 + i * (.11 + Math.random() * .05);
      o.type = "sine"; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * .3), t + .07);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .015); g.gain.exponentialRampToValueAtTime(.001, t + .09);
      o.connect(g).connect(pan || master); o.start(t); o.stop(t + .1);
    }
    birdT = setTimeout(bird, 4000 + Math.random() * 7000);
  }

  function build(){
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    // angin
    const src = ac.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = .7;
    const wg = ac.createGain(); wg.gain.value = .55;
    src.connect(bp).connect(wg).connect(master); src.start(); nodes.push(src);
    lfo(.06, 180, bp.frequency, 420);           // desir naik-turun
    lfo(.09, .25, wg.gain, .55);                // hembusan
    // dengung hangat sangat pelan (bukan melodi)
    [110, 164.8].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.value = .045 - i * .015;
      o.connect(g).connect(master); o.start(); nodes.push(o);
      lfo(.05 + i * .03, .015, g.gain, g.gain.value);
    });
  }

  return {
    start(){
      try {
        if (!ac){ ac = new (window.AudioContext || window.webkitAudioContext)(); build(); }
        if (ac.state === "suspended") ac.resume();
        if (on) return; on = true;
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setTargetAtTime(VOL, ac.currentTime, 1.2);
        clearTimeout(birdT); birdT = setTimeout(bird, 2500);
      } catch(e){}
    },
    stop(){
      try {
        on = false; clearTimeout(birdT);
        if (ac) master.gain.setTargetAtTime(0, ac.currentTime, .3);
      } catch(e){}
    },
    get playing(){ return on; }
  };
})();
