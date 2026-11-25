'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.KOMI_PLAYWRIGHT||'playwright');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const app=read('app-main.js'), source=app.slice(app.indexOf('function handleKomiHeaderSearchKeys'),app.indexOf('function handleInstantSearch'));
const css=read('home-discovery.css');
const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><style>${css}</style><div class="search-container">
<input id="searchInput" aria-label="Поиск аниме или пользователя" value="Стальной">
<div id="searchDropdown" class="active"><button class="search-dropdown-item">Стальной алхимик</button><button class="search-dropdown-item">Стальной алхимик: Братство</button><button class="komi-search-view-all">Все результаты</button></div></div>`;
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:780}});
   await page.setContent(html);
   await page.addScriptTag({content:`let submits=0,selected='';function closeSearchDropdown(){document.querySelector('#searchDropdown').classList.remove('active');}function submitKomiHeaderSearch(){submits++;} document.querySelectorAll('.search-dropdown-item').forEach(b=>b.addEventListener('click',()=>selected=b.textContent)); ${source}`});
   const input=page.getByRole('textbox',{name:'Поиск аниме или пользователя'});await input.focus();
   await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Стальной алхимик');
   await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Стальной алхимик: Братство');
   await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>selected),'Стальной алхимик: Братство');
   await page.keyboard.press('Escape');assert.equal(await input.evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.locator('#searchDropdown').evaluate(el=>el.classList.contains('active')),false);
   await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>submits),1);
   await page.close();
  }
  console.log('PASS keyboard suggestions and focus return in Chromium at 1280 and 390px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
