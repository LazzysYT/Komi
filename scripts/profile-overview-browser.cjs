'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.KOMI_PLAYWRIGHT||'playwright');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=['komi.production.css','profile-premium-mono.css','profile-studio.css'].map(read).join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  for(const width of [1280,900,390,320]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.setContent(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="background:#09090b;color:white"><section id="profile" class="komi-profile-studio komi-profile-premium-mono" data-profile-user="owner"></section>`);
   await page.addScriptTag({content:'window.userFavorites={owner:{}};window.userProfiles={};window.komiAchievements=()=>({achievements:[]});'+read('profile-premium.js')});
   const apply=async owner=>page.evaluate(isMe=>{
     const root=document.getElementById('profile');
     root.innerHTML=KomiProfileUI.navigation('overview',1,12,0,isMe,isMe)+KomiProfileUI.content({username:'owner',isMe,activityOwner:'owner-a',canSeeProfileActivity:true,section:'overview',statsCounts:{Смотрю:1,'В планах':2,Просмотрено:6,Отложено:3,Брошено:0},topGenres:[['Психологическое',6],['Фэнтези',3]],myFriends:[],profileAnimeById:new Map()});
   },owner);
   await apply(true);
   const result=await page.evaluate(()=>{
    const q=s=>document.querySelector(s).getBoundingClientRect();
    const lists=q('.profile-stats-widget'),genres=q('.profile-genres-widget');
    const rows=[...document.querySelectorAll('.profile-list-shortcut')].map(b=>b.getBoundingClientRect());
    return {wide:Math.abs(lists.top-genres.top)<3,rows:rows.every((row,i)=>i===0||row.top>=rows[i-1].bottom),doc:document.documentElement.scrollWidth,first:rows[0].height};
   });
   assert.equal(result.wide,width>1050,JSON.stringify(result));
   assert.ok(result.rows&&result.doc<=width+1,JSON.stringify({width,...result}));
   if(width<=767)assert.ok(result.first>=44);
   await page.getByRole('button',{name:/Отложено: 3/}).focus();
   assert.equal(await page.getByRole('button',{name:/Отложено: 3/}).evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.getByRole('heading',{name:'Топ избранного'}).isVisible(),true);
   assert.equal(await page.getByRole('button',{name:'Задания и награды'}).isVisible(),true);
   await apply(false);
   assert.equal(await page.locator('[data-profile-week-owner]').count(),0);
   await page.close();
  }
  console.log('PASS profile overview layout at 1280, 900, 390, 320px; old shortcuts and owner visibility preserved');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
