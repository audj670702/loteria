import {soundEngine} from './audio-engine.js?v=voz-12';
// Efectos locales: nunca determinan el resultado ni avanzan el canto.
export function createEffects({makeAudio,unlockAudio,onBlocked=()=>{}}={}){
  const nativeEngine=!makeAudio;makeAudio=makeAudio||((src)=>soundEngine.clip(src));unlockAudio=unlockAudio||(nativeEngine?()=>soundEngine.unlock():()=>Promise.resolve());
  const audio={start:makeAudio('./assets/inicia_partida.mp3'),near:makeAudio('./assets/carta_final.mp3'),end:makeAudio('./assets/partida_terminada.mp3')};
  audio.near.loop=false;for(const a of Object.values(audio))a.preload='auto';
  let enabled=true,unlocked=false,near=false,nearPlayed=false,ended=false,currentGame='',hidden=false,allowed=true,epoch=0,pendingEnd=false,priming=false,pendingStart=false,started=false,phase='',fresh=true,inCourse=false;
  function halt(a){a.pause();a.currentTime=0;}
  function play(a){if(!enabled||!unlocked||hidden||!allowed)return;try{const p=a.play();p?.catch(()=>onBlocked());}catch{onBlocked();}}
  function reconcile(){if(near&&enabled&&allowed&&!hidden&&unlocked){if(!nearPlayed){nearPlayed=true;play(audio.near);}}else halt(audio.near);}
  function startIfReady(){if(pendingStart&&!started&&enabled&&unlocked&&!hidden&&allowed&&fresh&&inCourse){pendingStart=false;started=true;play(audio.start);}}
  function unlock(){if(unlocked||priming)return;priming=true;const run=++epoch;
    Promise.resolve(unlockAudio()).then(()=>{if(run!==epoch)return;unlocked=true;priming=false;startIfReady();reconcile();if(pendingEnd){pendingEnd=false;play(audio.end);}}).catch(()=>{if(run===epoch){priming=false;unlocked=false;onBlocked();}});
  }
  return {
    unlock,
    setEnabled(value){enabled=!!value;if(!enabled){pendingEnd=false;}if(!enabled)for(const a of Object.values(audio))halt(a);startIfReady();reconcile();},
    sync(state,{outdated=false,hidden:isHidden=false,allowed:isAllowed=true}={}){
      if(state?.id!==currentGame){for(const a of Object.values(audio))halt(a);currentGame=state?.id||'';nearPlayed=false;ended=false;pendingEnd=false;pendingStart=false;started=false;phase='';}
      const previousPhase=phase;phase=state?.estado||'';
      if(phase==='EN_CURSO'&&!started&&(previousPhase==='BORRADOR'||!previousPhase&&state.cantadas.length===0))pendingStart=true;
      else if(phase!=='EN_CURSO'||state.cantadas.length>0)pendingStart=false;
      hidden=isHidden;allowed=isAllowed;fresh=!outdated;inCourse=phase==='EN_CURSO'&&!state?.canto?.pausado;if(!fresh||hidden||!inCourse)halt(audio.start);startIfReady();
      const count=state?.carton?.filter(id=>state.cantadas.includes(id)).length||0;
      near=state?.estado==='EN_CURSO'&&count===15&&!state.canto?.pausado&&!outdated;
      reconcile();
      const finish=state?.estado==='FINALIZADA'&&state.cierre?.motivo==='GANADOR_DIGITAL'&&state.ganadores?.length>0;
      if(finish&&!outdated&&!ended){ended=true;halt(audio.start);halt(audio.near);if(!unlocked&&!hidden&&allowed&&enabled)pendingEnd=true;else play(audio.end);}
    },
    suspend(){hidden=true;for(const a of Object.values(audio))halt(a);},
    reset(){epoch++;priming=false;for(const a of Object.values(audio)){halt(a);a.volume=1;}near=false;nearPlayed=false;ended=false;pendingEnd=false;pendingStart=false;started=false;phase='';currentGame='';},
  };
}
