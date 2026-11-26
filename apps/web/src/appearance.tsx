import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {appearanceSchema,defaultAppearance,type Appearance} from '../../../packages/shared/experience';
import {api,useAuth} from './lib';
function read(key:string){try{return appearanceSchema.parse(JSON.parse(localStorage.getItem(key)||'null'));}catch{return null;}}
function store(key:string,p:Appearance){try{localStorage.setItem(key,JSON.stringify(p));}catch{/* Preferences remain usable for this session. */}}
const Context=createContext<{appearance:Appearance;apply:(p:Appearance)=>Promise<void>;error:string;guest:Appearance|null;loaded:boolean}>({appearance:defaultAppearance,apply:async()=>{},error:'',guest:null,loaded:false});
export function AppearanceProvider({children}:{children:ReactNode}){
 const {user,loading}=useAuth();const [appearance,set]=useState(()=>read('cm-appearance-guest')||defaultAppearance),[error,setError]=useState(''),[guest,setGuest]=useState<Appearance|null>(null),[loaded,setLoaded]=useState(false);const owner=useRef(user?.id);owner.current=user?.id;const queue=useRef(Promise.resolve());
 useEffect(()=>{if(loading)return;let alive=true;setLoaded(false);setError('');if(!user){set(read('cm-appearance-guest')||defaultAppearance);setGuest(null);setLoaded(true);return;}const cached=read('cm-appearance-'+user.id);set(cached||defaultAppearance);api('/experience').then(r=>{if(!alive)return;const p=r.appearance?appearanceSchema.parse(r.appearance):defaultAppearance;set(p);store('cm-appearance-'+user.id,p);const local=read('cm-appearance-guest');setGuest(local&&JSON.stringify(local)!==JSON.stringify(p)?local:null);setLoaded(true);}).catch(e=>{if(alive){setError(e.message);setLoaded(true);}});return()=>{alive=false;};},[user?.id,loading]);
 async function apply(p:Appearance){const next=appearanceSchema.parse(p);set(next);setError('');const id=user?.id;store(id?'cm-appearance-'+id:'cm-appearance-guest',next);if(id){queue.current=queue.current.catch(()=>{}).then(async()=>{try{await api('/experience',{appearance:next},'PATCH');if(owner.current===id)setError('');}catch(e){if(owner.current===id)setError('Applied on this device. Account save failed: '+(e as Error).message);throw e;}});await queue.current;}}
 return <Context.Provider value={{appearance,apply,error,guest,loaded}}>{children}</Context.Provider>;
}
export const useAppearance=()=>useContext(Context);
