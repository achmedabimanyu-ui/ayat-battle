/* Duel online lewat Supabase Realtime (broadcast + presence, tanpa tabel database) */
window.Online = (() => {
  let client = null, ch = null, me = null, role = null, code = null, handlers = {};
  const id = () => Math.random().toString(36).slice(2, 10);

  function ready(){
    const c = window.AB_CONFIG || {};
    if (!window.supabase || !c.SUPABASE_URL || c.SUPABASE_URL.includes("ISI-")) return false;
    client ||= window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_KEY);
    return true;
  }

  function players(){
    if (!ch) return [];
    return Object.values(ch.presenceState()).map(a => a[0]).sort((a, b) => a.t - b.t);
  }

  function connect(roomCode, name, asRole){
    return new Promise((resolve, reject) => {
      code = roomCode; role = asRole; me = { id:id(), name, role, t:Date.now() };
      ch = client.channel(`ayat-battle-${code}`, { config:{ broadcast:{ self:false }, presence:{ key:me.id } } });
      ch.on("presence", { event:"sync" }, () => handlers.players?.(players()));
      ch.on("broadcast", { event:"start" }, ({ payload }) => handlers.start?.(payload));
      ch.on("broadcast", { event:"progress" }, ({ payload }) => handlers.progress?.(payload));
      ch.subscribe(async status => {
        if (status === "SUBSCRIBED"){ await ch.track(me); resolve(); }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
      });
    });
  }

  async function create(name){
    const roomCode = String(1000 + Math.floor(Math.random() * 9000));
    await connect(roomCode, name, "host");
    return roomCode;
  }

  async function join(roomCode, name){
    await connect(roomCode, name, "guest");
    await new Promise(r => setTimeout(r, 900));          // tunggu daftar pemain tersinkron
    const list = players();
    if (!list.some(p => p.role === "host")){ await leave(); throw new Error("NO_ROOM"); }
    if (list.length > 2){ await leave(); throw new Error("FULL"); }
  }

  const send = (event, payload) => ch?.send({ type:"broadcast", event, payload });

  async function leave(){
    if (ch){ await ch.untrack().catch(() => {}); await client.removeChannel(ch).catch(() => {}); }
    ch = null; role = null; code = null;
  }

  return {
    ready, create, join, leave, players,
    on:(ev, fn) => { handlers[ev] = fn; },
    start:payload => send("start", payload),
    progress:payload => send("progress", { ...payload, from:me?.id }),
    get me(){ return me; }, get role(){ return role; }, get code(){ return code; }
  };
})();
