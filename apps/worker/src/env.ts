import type { User } from '../../../packages/shared/types';
export interface Env {
 DB: D1Database; MEDIA:R2Bucket; ROOMS:DurableObjectNamespace; LOBBY:DurableObjectNamespace; ASSETS:Fetcher;
 ENVIRONMENT:string; CHAIN_ID:string; RPC_URL:string; ESCROW_ADDRESS?:string; TOKEN_ADDRESS?:string; RESULT_SIGNER_KEY?:string;
 EMAIL_API_KEY?:string; EMAIL_FROM?:string; BASE_RPC_URL?:string; BASE_SEPOLIA_RPC_URL?:string; INDEX_START_BLOCK?:string;
 MAINNET_FINANCIAL_ENABLED:string;
}
export type Member=User & {email?:string;password?:string;display_name:string;country:string;avatar:string|null;banner:string|null;private:number;wallet_public:number;email_verified:number;settings:string;deleted:number};
export type AppEnv={Bindings:Env;Variables:{user:Member|null;sessionHash:string}};
export const statement=(env:Env,sql:string,...args:unknown[])=>env.DB.prepare(sql).bind(...args);
export const room=(env:Env,id:string)=>env.ROOMS.get(env.ROOMS.idFromName(id));
export const lobby=(env:Env)=>env.LOBBY.get(env.LOBBY.idFromName('coordinator-v1'));
export async function internal(stub:DurableObjectStub,path:string,body:unknown){const r=await stub.fetch('https://internal'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data:any=await r.json();if(!r.ok)throw Error(data.error||'Request failed.');return data;}
