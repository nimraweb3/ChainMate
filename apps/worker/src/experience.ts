import { Hono } from 'hono';
import { z } from 'zod';
import {appearanceSchema,chatPrefsSchema,defaultChatPreferences,squareContrast} from '../../../packages/shared/experience';
import { type AppEnv, type Env, statement as q } from './env';
import {requireUser,limit,audit} from './auth';
export const experience=new Hono<AppEnv>();
export async function chatPreferences(env:Env,id:string){const row=await q(env,'SELECT chat FROM user_experience WHERE user_id=?',id).first<{chat:string}>();return row?.chat?chatPrefsSchema.parse(JSON.parse(row.chat)):defaultChatPreferences;}
experience.get('/experience',async c=>{const u=requireUser(c);const r=await q(c.env,'SELECT * FROM user_experience WHERE user_id=?',u.id).first<any>();return c.json({appearance:r?.appearance?JSON.parse(r.appearance):null,chat:r?.chat?JSON.parse(r.chat):defaultChatPreferences,progress:r?JSON.parse(r.progress):[]});});
experience.patch('/experience',async c=>{const u=requireUser(c);const p=z.object({appearance:appearanceSchema.optional(),chat:chatPrefsSchema.optional(),lesson:z.enum(['k','q','r','b','n','p']).optional()}).parse(await c.req.json());
if(p.appearance?.customColors && squareContrast(p.appearance.customLightSquare,p.appearance.customDarkSquare)<1.25)throw Error('Choose more distinct square colors.');
await q(c.env,'INSERT OR IGNORE INTO user_experience(user_id,updated) VALUES(?,?)',u.id,Date.now()).run();
if(p.appearance)await q(c.env,'UPDATE user_experience SET appearance=?,updated=? WHERE user_id=?',JSON.stringify(p.appearance),Date.now(),u.id).run();
if(p.chat)await q(c.env,'UPDATE user_experience SET chat=?,updated=? WHERE user_id=?',JSON.stringify(p.chat),Date.now(),u.id).run();
if(p.lesson)await q(c.env,"UPDATE user_experience SET progress=json_insert(progress,'$[#]',?),updated=? WHERE user_id=? AND NOT EXISTS(SELECT 1 FROM json_each(progress) WHERE value=?)",p.lesson,Date.now(),u.id,p.lesson).run();
return c.json({ok:true});});
experience.post('/chat/control',async c=>{const u=requireUser(c);await limit(c.env,'chat-control:'+u.id,30,60000);const p=z.object({gameId:z.string().max(100),action:z.enum(['block','unblock','mute','unmute','accept','friend','unfriend','report']),messageId:z.string().optional(),reason:z.string().trim().min(3).max(500).optional()}).parse(await c.req.json());
const g=await q(c.env,'SELECT white,black FROM games WHERE id=?',p.gameId).first<{white:string;black:string}>();if(!g||![g.white,g.black].includes(u.id))throw Error('Not a participant.');const target=g.white===u.id?g.black:g.white;if(!target)throw Error('Opponent has not joined.');
if(p.action==='report'){if(!p.reason)throw Error('Describe the issue.');if(p.messageId&&!await q(c.env,'SELECT 1 FROM chat_messages WHERE id=? AND game_id=? AND sender_id=?',p.messageId,p.gameId,target).first())throw Error('Message unavailable.');await q(c.env,'INSERT INTO chat_reports(id,reporter,target_id,message_id,reason,created) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),u.id,target,p.messageId||null,p.reason,Date.now()).run();await audit(c.env,u.id,'chat_report_submitted');}
else if(p.action==='block')await q(c.env,'INSERT OR IGNORE INTO user_blocks VALUES(?,?,?)',u.id,target,Date.now()).run();
else if(p.action==='unblock')await q(c.env,'DELETE FROM user_blocks WHERE user_id=? AND target_id=?',u.id,target).run();
else {await q(c.env,'INSERT OR IGNORE INTO chat_permissions(user_id,target_id) VALUES(?,?)',u.id,target).run();const column=p.action.includes('friend')?'friend':p.action.includes('mute')?'muted':'accepted';await q(c.env,`UPDATE chat_permissions SET ${column}=? WHERE user_id=? AND target_id=?`,['unfriend','unmute'].includes(p.action)?0:1,u.id,target).run();}
return c.json({ok:true});});
