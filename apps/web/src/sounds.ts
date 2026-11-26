import type {Appearance} from '../../../packages/shared/experience';
let audio:AudioContext|undefined,unlocked=false;
export function unlockAudio(){try{audio??=new AudioContext();void audio.resume();unlocked=true;}catch{}}
export function tone(kind:string,p:Appearance){if(!unlocked||!p.soundEnabled||!audio||audio.state!=='running'||p.soundVolume===0)return;const frequencies:Record<string,number[]>={move:[440],capture:[320,480],castle:[380,510],check:[600,450],end:[510,390,300],start:[350,500],chat:[720],reaction:[650,810],warning:[260,260]};
 const notes=p.reducedFeedback?[440]:(frequencies[kind]||[440]);notes.forEach((f,i)=>{const a=audio!,o=a.createOscillator(),g=a.createGain(),at=a.currentTime+i*.09;o.type='sine';o.frequency.value=f;o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(.07*p.soundVolume,at);g.gain.exponentialRampToValueAtTime(.001,at+.1);o.start(at);o.stop(at+.11);});}
