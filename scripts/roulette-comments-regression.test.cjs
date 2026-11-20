const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const comments=fs.readFileSync(path.join(__dirname,'../komi-comments.js'),'utf8');

test('roulette mood picker remains connected to real playable catalog',()=>{
  for(const option of ['all','short','top','fantasy','comedy','romance','action'])
    assert.match(html,new RegExp('<option value="'+option+'">'));
  assert.match(html,/id="komiRouletteMood"/);
  assert.match(app,/getElementById\('komiRouletteMood'\)/);
  assert.match(app,/komiRandomPlayableAnime\(animeList\)/);
  assert.match(app,/allPlayable\.filter\(item =>/);
  assert.match(app,/allPlayable\.length \? 'По этому фильтру/);
});

test('comment timecodes are plain DOM nodes and do not access cross-origin players',()=>{
  assert.match(comments,/function appendTimecodes\(target, body\)/);
  assert.match(comments,/document\.createTextNode\(text\.slice\(/);
  assert.match(comments,/appendSpoilerAware\(body, item\.body\)/);
  assert.match(comments,/appendTimecodes\(target, source\.slice\(/);
  assert.match(comments,/button\.setAttribute\('aria-pressed', String\(revealed\)\)/);
  assert.match(comments,/modal\.querySelector\('#watchModalContent video'\)/);
  assert.match(comments,/Number\.isFinite\(video\.duration\)/);
  assert.match(comments,/video\.currentTime = seconds/);
  assert.doesNotMatch(comments,/body\.innerHTML\s*=/);
});
