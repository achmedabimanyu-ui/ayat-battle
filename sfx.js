/* Efek suara game, dibuat langsung dengan Web Audio (tanpa file mp3) */
window.Sfx = (() => {
  let ac, master, on = true;
  function ctx(){
    if (!ac){
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = .35; master.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function tone(freq, start, dur, type = "triangle", vol = .5, slideTo){
    const a = ctx(), t = a.currentTime + start;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
  }
  const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319]; // tangga nada mayor, naik terus

  return {
    set enabled(v){ on = v; },
    // jawaban benar: "ting" dua nada
    correct(){ if (!on) return; tone(784, 0, .12, "sine", .45); tone(1175, .07, .22, "sine", .4); },
    // kombo: arpeggio yang makin tinggi dan makin panjang sesuai jumlah kombo
    combo(n){
      if (!on) return;
      const steps = Math.min(n + 1, 6), base = Math.min(n - 2, 3);
      for (let i = 0; i < steps; i++) tone(NOTES[base + i] , i * .06, .18, "square", .18);
      tone(NOTES[base + steps] * 2, steps * .06, .35, "sine", .35);
      if (n >= 4) tone(130, 0, .25, "sawtooth", .15, 260);       // dentuman di kombo besar
    },
    // salah: "dug" rendah yang lembut, tidak menakutkan
    wrong(){ if (!on) return; tone(220, 0, .18, "triangle", .4, 140); },
    // tembakan
    shot(){ if (!on) return; tone(900, 0, .08, "square", .12, 300); },
    // selesai: fanfare singkat
    finish(){ if (!on) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .12, i === 3 ? .6 : .14, "triangle", .4)); }
  };
})();
