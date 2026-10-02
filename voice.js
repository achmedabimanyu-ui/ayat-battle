/* Pengenal suara (Web Speech API). Didukung Chrome laptop/Android, butuh internet. */
window.Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, want = false, lang = "ar-SA", onText = null, onState = null, held = false;

  function make(){
    rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 3; rec.lang = lang;
    rec.onresult = e => {
      if (held) return;
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + " ";
      const last = e.results[e.results.length - 1];
      const alts = [...last].map(a => a.transcript);
      onText?.({ text:text.trim(), alts, final:last.isFinal });
    };
    rec.onerror = e => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed"){ want = false; onState?.("denied"); }
      else if (e.error === "network") onState?.("network");
    };
    rec.onend = () => {
      if (!want) return onState?.("off");
      rec.lang = lang;
      setTimeout(() => { if (want) try { rec.start(); } catch(e){} }, 120);
    };
    rec.onstart = () => onState?.(held ? "hold" : "on");
  }
  const restart = () => { try { rec?.abort(); } catch(e){} };   // onend memulai lagi dengan hasil kosong

  return {
    supported: !!SR,
    start(l, textCb, stateCb){
      lang = l; onText = textCb; onState = stateCb; want = true; held = false;
      if (rec){ rec.onend = null; try { rec.abort(); } catch(e){} }
      make(); try { rec.start(); } catch(e){}
    },
    reset(l){ if (l) lang = l; restart(); },
    hold(v){ held = v; onState?.(v ? "hold" : "on"); if (!v) restart(); },
    stop(){ want = false; held = false; if (rec){ rec.onend = null; try { rec.abort(); } catch(e){} } rec = null; },
    get active(){ return want; }
  };
})();
