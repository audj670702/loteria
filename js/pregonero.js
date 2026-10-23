// La voz acompaña el estado recibido; nunca avanza el canto ni marca el cartón.
export function createPregonero({synth,Utterance,onChange=()=>{},defaultEnabled=true}={}){
  const supported=!!synth&&typeof synth.speak==='function'&&typeof Utterance==='function';
  let enabled=defaultEnabled,unlocked=false,gameId=null,lastId=null,lastName='',ready=false,phase='',paused=false,visible=true,stale=false,serial=0,speaking='',error='';
  function cancel(){serial++;speaking='';if(supported)synth.cancel();}
  function status(){return !supported?'Este navegador no ofrece voz. Puedes seguir el canto en pantalla.':error||(!enabled?'Activa el audio para escuchar las figuras.':!unlocked?'Audio activado · toca la pantalla para habilitar la voz en este dispositivo.':!visible?'Audio en espera mientras la app está oculta.':stale?'Audio en espera de sincronización.':['FINALIZADA','CANCELADA'].includes(phase)?'Partida cerrada · audio detenido.':!ready?'Audio en espera del inicio de la partida.':paused?'Pregonero en pausa.':speaking?'Anunciando: '+speaking:'Audio activado · esperando la siguiente figura.');}
  function snapshot(){return {supported,enabled,canRepeat:supported&&enabled&&ready&&!!lastName&&visible&&!stale, status:status()};}
  function publish(){onChange(snapshot());}
  function speak(text){
    if(!supported||!enabled||!unlocked||!visible||stale||!text)return;
    cancel();const version=serial;
    const u=new Utterance(text);u.lang='es-MX';u.rate=.95;u.pitch=1;u.volume=1;
    const voices=synth.getVoices?.()||[];
    const spanish=voices.filter(v=>/^es(?:-|$)/i.test(v.lang));
    u.voice=spanish.find(v=>/^es-MX$/i.test(v.lang)&&v.localService)||spanish.find(v=>/^es-MX$/i.test(v.lang))||spanish.find(v=>v.localService)||spanish[0]||null;
    u.onstart=()=>{if(version!==serial)return;speaking=text;publish();};
    u.onend=()=>{if(version!==serial)return;speaking='';publish();};
    u.onerror=()=>{if(version!==serial)return;cancel();enabled=false;error='No se pudo reproducir la voz. Pulsa Activar audio para reintentar y revisa el volumen de tu dispositivo.';publish();};
    try{synth.speak(u);}catch{u.onerror();}publish();
  }
  return {
    snapshot,
    unlock(){if(!supported||!enabled||unlocked)return;unlocked=true;
      // El navegador exige un gesto: cebar la voz sin anuncio audible ni cambio de preferencia.
      const silent=new Utterance('.');silent.volume=0;silent.lang='es-MX';try{synth.speak(silent);}catch{unlocked=false;}publish();
    },
    sync(state,{hidden=false,outdated=false}={}){
      const id=state?.id||null,latest=state?.cantadas?.at(-1)||null;
      const changed=gameId!==null&&gameId===id&&latest!==lastId;
      const name=state?.figuras?.find(f=>f.id===latest)?.nombre||'';
      gameId=id;lastId=latest;lastName=name;visible=!hidden;stale=outdated;
      phase=state?.estado||'';ready=phase==='EN_CURSO';paused=state?.canto?.pausado===true;
      if(!ready||paused||!visible||stale)cancel();
      else if(changed&&name)speak(name); // Si hubo varios cantos durante una desconexión, anuncia sólo el actual.
      publish();
    },
    toggle(){if(!supported)return;unlocked=true;error='';enabled=!enabled;if(!enabled)cancel();else if(ready&&lastName&&visible&&!stale)speak(lastName);else speak('Pregonero activado.');publish();},
    repeat(){if(snapshot().canRepeat)speak(lastName);},
    reset(){cancel();enabled=defaultEnabled;gameId=null;lastId=null;lastName='';ready=false;phase='';error='';publish();},
    suspend(){visible=false;cancel();publish();}
  };
}
