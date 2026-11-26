import {z} from 'zod';
import {presets,reactions,type ChatMessage} from '../../../packages/shared/experience';
import {type Env,type Member,statement as q} from './env';
import {limit} from './auth';
import {chatPreferences} from './experience';
import type {GameState} from '../../../packages/shared/types';
async function access(env:Env,g:GameState){
if(!g.black)throw Error('Chat opens when your opponent joins.');
const blocked=await q(env,'SELECT 1 FROM user_blocks WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)',g.white,g.black,g.black,g.white).first();
const permissions=(await q(env,'SELECT * FROM chat_permissions WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)',g.white,g.black,g.black,g.white).all<any>()).results;
const prefs=await Promise.all([chatPreferences(env,g.white),chatPreferences(env,g.black)]);
const eligible=!blocked&&!permissions.some(p=>p.muted)&&prefs.every((p,i)=>p.visibility!=='nobody'&&(p.visibility!=='friends'||permissions.filter(x=>x.friend).length===2)&&(p.visibility!=='requests'||permissions.some(x=>x.user_id===(i===0?g.white:g.black)&&x.accepted)));
return {eligible,prefs,blocked:!!blocked,permissions};
}
export async function chatEvent(env:Env,g:GameState,u:Member,event:string,input:unknown,sockets:WebSocket[]){
const a=await access(env,g);
const historySql='SELECT m.id,m.game_id AS gameId,m.sender_id AS senderId,u.username AS senderName,m.kind,m.text,m.created AS createdAt,m.client_id AS clientMessageId FROM chat_messages m JOIN users u ON u.id=m.sender_id';
if(event==='chat:history')return {eligible:a.eligible,blocked:a.blocked,permissions:a.permissions,messages:a.eligible?(await q(env,historySql+' WHERE m.game_id=? AND m.created>? ORDER BY m.created DESC LIMIT 100',g.id,Date.now()-30*86400000).all<ChatMessage>()).results.reverse():[]};
if(!a.eligible)throw Error('Chat is restricted by a player’s privacy, mute or block settings.');
const p=z.object({clientMessageId:z.string().uuid(),text:z.string().trim().max(500).optional(),presetId:z.string().optional(),reactionId:z.string().optional()}).parse(input);
const existing=await q(env,historySql+' WHERE m.game_id=? AND m.sender_id=? AND m.client_id=?',g.id,u.id,p.clientMessageId).first<ChatMessage>();if(existing)return existing;
await limit(env,'chat:'+g.id+':'+u.id,6,10000);
let text='',kind:ChatMessage['kind']='text';
if(event==='chat:quick'){text=presets.find(x=>x.id===p.presetId)?.text||'';kind='quick';}
else if(event==='chat:reaction'){text=reactions.find(x=>x[0]===p.reactionId)?.[1]||'';kind='reaction';if(a.prefs.some(x=>!x.reactions))throw Error('Reactions are hidden by a player.');}
else if(event==='chat:send')text=p.text||'';else throw Error('Unsupported chat event.');
if(!text||/[\u0000-\u0008\u000B-\u001F\u202A-\u202E]/u.test(text))throw Error('Enter a valid message.');
if(/https?:|www\.|javascript:|data:|\b[\w-]+\.(com|net|org|io|dev)\b/i.test(text))throw Error('Links are not allowed in match chat.');
if(a.prefs.some(x=>x.filter)&&/\b(fuck|shit|bitch)\b/i.test(text))throw Error('Please keep match chat respectful.');
if(await q(env,'SELECT 1 FROM chat_messages WHERE game_id=? AND sender_id=? AND text=? AND created>?',g.id,u.id,text,Date.now()-10000).first())throw Error('Please avoid repeating the same message.');
const m:ChatMessage={id:crypto.randomUUID(),gameId:g.id,senderId:u.id,senderName:u.username,kind,text,createdAt:Date.now(),clientMessageId:p.clientMessageId};
await q(env,'INSERT INTO chat_messages VALUES(?,?,?,?,?,?,?)',m.id,g.id,u.id,m.clientMessageId,kind,text,m.createdAt).run();
for(const ws of sockets){const attachment=ws.deserializeAttachment() as {user:string};if([g.white,g.black].includes(attachment?.user)){try{ws.send(JSON.stringify({event:'chat:message',value:m}));}catch{}}}
return m;
}
