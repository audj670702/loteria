// La voz acompaña el estado recibido; nunca avanza el canto ni marca el cartón.
export function createPregonero({synth,Utterance,onChange=()=>{},defaultEnabled=true,recordedVoice=null,schedule=setTimeout,unschedule=clearTimeout}={}){
  const nativeSupported=!!synth&&typeof synth.speak==='function'&&typeof Utterance==='function';
  const supported=nativeSupported||!!recordedVoice;
  let enabled=defaultEnabled,unlocked=false,gameId=null,lastId=null,lastName='',ready=false,phase='',paused=false,visible=true,stale=false,serial=0,speaking='',error='',utterance=null,startTimer=null,nativeActive=false;
  function cancel(){serial++;speaking='';if(startTimer!==null){unschedule(startTimer);startTimer=null;}utterance=null;recordedVoice?.cancel();if(nativeSupported&&(nativeActive||!recordedVoice))synth.cancel();nativeActive=false;}
  function status(){return !supported?'Este navegador no ofrece voz. Puedes seguir el canto en pantalla.':error||(!enabled?'Activa el audio para escuchar las figuras.':!unlocked?'Audio activado · toca la pantalla para habilitar la voz en este dispositivo.':!visible?'Audio en espera mientras la app está oculta.':stale?'Audio en espera de sincronización.':['FINALIZADA','CANCELADA'].includes(phase)?'Partida cerrada · audio detenido.':!ready?'Audio en espera del inicio de la partida.':paused?'Pregonero en pausa.':speaking?'Anunciando: '+speaking:'Audio activado · esperando la siguiente figura.');}
  function snapshot(){return {supported,enabled,blocked:!!error,canRepeat:supported&&enabled&&ready&&!!lastName&&visible&&!stale, status:status()};}
  function publish(){onChange(snapshot());}
  function speak(text){
    if(!supported||!enabled||!unlocked||!visible||stale||!text)return;
    cancel();const version=serial;
    const useRecording=recordedVoice?.has(text);if(!useRecording&&!nativeSupported)return;
    const u=useRecording?{}:new Utterance(text);utterance=u;nativeActive=!useRecording;u.lang='es-MX';u.rate=.95;u.pitch=1;u.volume=1;
    const voices=synth?.getVoices?.()||[];
    const spanish=voices.filter(v=>/^es(?:-|$)/i.test(v.lang));
    u.voice=spanish.find(v=>/^es-MX$/i.test(v.lang)&&v.localService)||spanish.find(v=>/^es-MX$/i.test(v.lang))||spanish.find(v=>v.localService)||spanish[0]||null;
    u.onstart=()=>{if(version!==serial)return;if(startTimer!==null){unschedule(startTimer);startTimer=null;}error='';speaking=text;publish();};
    u.onend=()=>{if(version!==serial)return;if(startTimer!==null){unschedule(startTimer);startTimer=null;}utterance=null;speaking='';publish();};
    u.onerror=()=>{if(version!==serial)return;cancel();unlocked=false;error='No se pudo reproducir la voz. Pulsa Activar audio para reintentar y revisa el volumen de tu dispositivo.';publish();};
    startTimer=schedule(()=>{if(version!==serial)return;cancel();unlocked=false;error='La voz no arrancó. Toca Reactivar voz para volver a intentarlo.';publish();},useRecording?15000:3500);
    try{if(useRecording)recordedVoice.speak(text,{onstart:u.onstart,onend:u.onend,onerror:u.onerror});else{synth.resume?.();synth.speak(u);}}catch{u.onerror();}publish();
  }
  return {
    snapshot,
    unlock(){if(!supported||!enabled||unlocked)return;unlocked=true;error='';if(recordedVoice){recordedVoice.unlock().then(()=>{if(enabled&&ready&&lastName)speak(lastName);publish();}).catch(()=>{unlocked=false;error='Toca Reactivar voz para habilitar el audio integrado.';publish();});}else speak(ready&&lastName?lastName:'Pregonero activado.');publish();},
    reactivate(){if(!supported)return;enabled=true;unlocked=false;this.unlock();},
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
    toggle(){if(!supported)return;unlocked=true;error='';enabled=!enabled;if(!enabled)cancel();else if(ready&&lastName&&visible&&!stale)speak(lastName);else if(!recordedVoice)speak('Pregonero activado.');publish();},
    repeat(){if(snapshot().canRepeat)speak(lastName);},
    reset(){cancel();enabled=defaultEnabled;gameId=null;lastId=null;lastName='';ready=false;phase='';error='';publish();},
    suspend(){visible=false;cancel();publish();}
  };
}
