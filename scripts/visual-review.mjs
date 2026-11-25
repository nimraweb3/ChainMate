import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
await fs.mkdir('.local/review', {recursive:true});
const browser = await chromium.launch();
const page = await browser.newPage();
const failures=[];
page.on('pageerror', e=>failures.push(e.message));
for (const width of [320,390,768,1024,1440,1920]) {
  await page.setViewportSize({width,height:width<600?844:1000});
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.final-move').scrollIntoViewIfNeeded();
  await page.locator('.live-preview').scrollIntoViewIfNeeded();
  await page.getByLabel('Keyboard move').waitFor();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`.local/review/home-${width}.png`,fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow) failures.push(`Home overflows at ${width}`);
}
for (const width of [390,1440]) {
 await page.setViewportSize({width,height:1000});
 for(const [name,path] of [['play','/play'],['bots','/play/bot'],['arena','/arena'],['wallet','/arena?connect=1'],['login','/login'],['leaderboard','/leaderboard'],['game','/game/bot?bot=ethereum']]){
  await page.goto('http://127.0.0.1:5173'+path);
  await page.locator('.loading').waitFor({state:'hidden'});
  await page.evaluate(()=>document.fonts.ready);
  if(name==='game') await page.getByLabel('Keyboard move').waitFor();
  await page.screenshot({path:`.local/review/${name}-${width}.png`,fullPage:true});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) failures.push(`${name} overflows at ${width}`);
 }
}
console.log(JSON.stringify({failures},null,2));
await browser.close();
if(failures.length)process.exitCode=1;
