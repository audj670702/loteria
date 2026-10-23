// Un único AudioContext para efectos internos; no crea elementos ni sesiones de reproductor.
export function createAudioEngine({Context=globalThis.AudioContext||globalThis.webkitAudioContext,fetcher=globalThis.fetch}={}){
  let context=null;const bytes=new Map(),buffers=new Map(),clips=new Set();
  function getContext(){if(!context||context.state==='closed'){if(typeof Context!=='function')throw new Error('Este navegador no ofrece audio integrado.');context=new Context({latencyHint:'interactive'});}return context;}
  function preload(src){if(!bytes.has(src)){const job=Promise.resolve().then(()=>fetcher(src)).then(r=>{if(!r.ok)throw new Error('No se pudo cargar el sonido.');return r.arrayBuffer();}).catch(error=>{bytes.delete(src);throw error;});bytes.set(src,job);}return bytes.get(src);}
  async function load(src){if(!buffers.has(src)){const job=preload(src).then(data=>getContext().decodeAudioData(data.slice(0))).catch(error=>{buffers.delete(src);throw error;});buffers.set(src,job);}return buffers.get(src);}
  async function unlock(){const ctx=getContext();if(ctx.state!=='running')await ctx.resume();if(ctx.state!=='running')throw new Error('Toca la pantalla para habilitar el audio.');}
  function clip(src){let volume=1,paused=true,serial=0,source=null,gain=null;const audio={src,loop:false,currentTime:0,
    get paused(){return paused;},get volume(){return volume;},set volume(value){volume=value;if(gain)gain.gain.value=value;},
    set preload(value){if(value==='auto')preload(src).catch(()=>{});},
    pause(){serial++;paused=true;if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();source=null;}if(gain){gain.disconnect();gain=null;}},
    async play({offset=0,duration,onStarted=()=>{}}={}){audio.pause();const run=serial;paused=false;try{const buffer=await load(src);if(run!==serial)return;const ctx=getContext();if(ctx.state!=='running')await ctx.resume();if(run!==serial)return;if(ctx.state!=='running')throw new Error('El audio necesita un toque en pantalla.');source=ctx.createBufferSource();gain=ctx.createGain();gain.gain.value=volume;source.buffer=buffer;source.loop=audio.loop;source.connect(gain);gain.connect(ctx.destination);source.onended=()=>{if(run===serial){audio.pause();audio.onended?.();}};if(duration===undefined)source.start(0,offset);else source.start(0,offset,duration);onStarted();}catch(error){if(run===serial){paused=true;throw error;}}},
  };clips.add(audio);return audio;}
  return {unlock,clip,preload,stop(){for(const c of clips)c.pause();}};
}
export const soundEngine=createAudioEngine();
