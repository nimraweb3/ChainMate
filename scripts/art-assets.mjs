import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
await mkdir('apps/web/public/art',{recursive:true});
for(const name of ['hero-knight','gallery']){
 await sharp(`assets/source/${name}.png`).resize({width:1920,withoutEnlargement:true}).webp({quality:88,effort:6}).toFile(`apps/web/public/art/${name}.webp`);
 await sharp(`assets/source/${name}.png`).resize({width:960,withoutEnlargement:true}).webp({quality:84,effort:6}).toFile(`apps/web/public/art/${name}-small.webp`);
}
const meta=await sharp('assets/source/hero-knight.png').metadata();
await sharp('assets/source/hero-knight.png').extract({left:Math.round(meta.width*.47),top:0,width:Math.floor(meta.width*.53),height:meta.height}).resize({width:800,withoutEnlargement:true}).webp({quality:87}).toFile('apps/web/public/art/hero-mobile.webp');
const trio=await sharp('assets/source/opponents.png').metadata();const width=Math.floor(trio.width/3);
for(const [i,name] of ['bitcoin','ethereum','solana'].entries())await sharp('assets/source/opponents.png').extract({left:i*width,top:0,width,height:trio.height}).resize({width:600,withoutEnlargement:true}).webp({quality:87}).toFile(`apps/web/public/art/${name}.webp`);
console.log('Optimized original artwork and responsive variants.');
