import {VOICE_CUES} from './voice-cues.js?v=voz-12';
import {soundEngine} from './audio-engine.js?v=voz-12';
const key=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es');
export function createRecordedVoice({engine=soundEngine,cues=VOICE_CUES}={}){
  const clip=engine.clip(new URL('../assets/pregonero-tradicional-v1.m4a',import.meta.url).href);clip.preload='auto';
  return {has:text=>Object.hasOwn(cues,key(text)),unlock:()=>engine.unlock(),cancel:()=>clip.pause(),
    speak(text,{onstart=()=>{},onend=()=>{},onerror=()=>{}}={}){const cue=cues[key(text)];if(!cue){onerror();return;}clip.onended=onend;clip.play({...cue,onStarted:onstart}).catch(onerror);}
  };
}
