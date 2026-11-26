import { z } from 'zod';
export const boardThemes = [
  ['pearl','Pearl Classic','#F2F0EC','#A9A8A4','Classic'],
  ['walnut','Ivory & Walnut','#F0D9B5','#B58863','Classic'],
  ['marble','Royal Marble','#EAE9E5','#777A7C','Luxury'],
  ['obsidian','Obsidian','#BFC3C2','#303637','Luxury'],
  ['forest','Forest Club','#EEEED2','#769656','Nature'],
  ['sage','Sage Mist','#DEE8DA','#8AA99A','Nature'],
  ['ocean','Ocean Glass','#DCEAF0','#608CA1','Modern'],
  ['midnight','Midnight Navy','#A9B9CC','#283C54','Modern'],
  ['rosewood','Rosewood','#E8CDBB','#975C55','Classic'],
  ['sandstone','Sandstone','#F0E7D5','#B49B79','Minimal'],
  ['copper','Copper Club','#ECD7BC','#A16D54','Luxury'],
  ['lavender','Lavender Smoke','#EAE4F1','#9787B4','Experimental'],
  ['sakura','Sakura','#F7E6EA','#C68C9D','Experimental'],
  ['arctic','Arctic','#EBF4F6','#88AEBB','Modern'],
  ['cyber','Cyber Arena','#C8D6DB','#294E5C','Experimental'],
  ['mono','Monochrome','#EEEEEE','#626262','Minimal'],
].map(([id,name,light,dark,category])=>({id,name,light,dark,category}));
export const pieceSets = [ ['staunton','Classic Staunton'],['pearl','Pearl Sculpture'],['minimal','Modern Minimal'],['metal','Royal Metallic'],['wood','Wooden Heritage'],['neo','Neo Chess'],['glass','Glass Atelier'],['cyber','Cyber Pieces'] ].map(([id,name])=>({id,name}));
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const appearanceSchema = z.object({
  boardThemeId:z.string().refine(v=>boardThemes.some(t=>t.id===v)).default('pearl'),
  pieceSetId:z.string().refine(v=>pieceSets.some(t=>t.id===v)).default('pearl'),
  customColors:z.boolean().default(false), customLightSquare:hex.default('#F2F0EC'),customDarkSquare:hex.default('#A9A8A4'),
  highlightColor:hex.default('#78b9d9'),selectionColor:hex.default('#50a9d0'),legalColor:hex.default('#25566c'),
  showCoordinates:z.boolean().default(true),showLegalMoves:z.boolean().default(true),highlightLastMove:z.boolean().default(true),highlightCheck:z.boolean().default(true),
  animationSpeed:z.enum(['off','fast','normal','smooth']).default('normal'),
  soundEnabled:z.boolean().default(true),soundVolume:z.number().min(0).max(1).default(.35),reducedFeedback:z.boolean().default(false),
  boardOrientation:z.enum(['auto','white','black']).default('auto'),border:z.enum(['soft','slim','none']).default('soft'),texture:z.boolean().default(false),background:z.enum(['mist','charcoal','sand']).default('mist'),highContrast:z.boolean().default(false),
});
export type Appearance = z.infer<typeof appearanceSchema>;
export const defaultAppearance=appearanceSchema.parse({});
export const quickMessages = {
  sportsmanship:['Good luck!','Have fun!','Nice move!','Well played!','Good game!','Thanks for playing!'],
  friendly:['Hello!','Hey there!','Ready?',"Let’s play!",'That was close!','Nice comeback!','This is intense!','You got me!','One more game?'],
  coordination:['One moment, please.',"I’m reconnecting.",'Can we rematch?','Thanks for the game.'],
};
export const presets=Object.entries(quickMessages).flatMap(([category,items])=>items.map((text,i)=>({id:category+'-'+i,text,category})));
export const reactions=[['smile','😊'],['think','🤔'],['clap','👏'],['handshake','🤝'],['wow','😮'],['laugh','😄'],['heart','❤️'],['celebrate','🎉'],['thumbs','👍'],['chess','♟️']];
export const chatPrefsSchema=z.object({visibility:z.enum(['everyone','friends','requests','nobody']).default('everyone'),reactions:z.boolean().default(true),notifications:z.boolean().default(true),filter:z.boolean().default(true),favorites:z.array(z.string().refine(v=>presets.some(p=>p.id===v))).max(8).default([])});
export type ChatPreferences=z.infer<typeof chatPrefsSchema>;
export const defaultChatPreferences=chatPrefsSchema.parse({});
export interface ChatMessage {id:string;gameId:string;senderId:string;senderName:string;kind:'text'|'quick'|'reaction';text:string;createdAt:number;clientMessageId:string;}
export function squareContrast(a:string,b:string){const lum=(s:string)=>{const c=[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
