const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function handleAvatarFileUpload(');
const end=html.indexOf('        async function uploadAvatarToStorage(',start);
assert.ok(start>=0&&end>start);
const source=html.slice(start,end);

function fixture(){
 const feedback=[], reads=[];
 class FileReader {
  readAsDataURL(file){reads.push(file);}
 }
 const ctx=vm.createContext({
  currentUser:{authUserId:'user-uuid',username:'person'},
  FileReader,
  Image: class Image{},
  document:{createElement(){throw new Error('not decoding images in validation tests');}},
  komiStatusFeedback:message=>feedback.push(message),
  Number, Error
 });
 vm.runInContext('let avatarDraft = null;\n'+source,ctx);
 const run=file=>vm.runInContext('handleAvatarFileUpload({target:{files:[file]}})',ctx);
 return {ctx,run,feedback,reads};
}

test('uploaded avatar must use a supported image MIME type',()=>{
 const x=fixture();
 x.run({type:'image/svg+xml',size:1000});
 assert.equal(x.reads.length,0);
 assert.match(x.feedback.at(-1),/JPG, PNG/);
 assert.equal(vm.runInContext('avatarDraft',x.ctx),null);
});

test('oversized and empty images fail before expensive FileReader decode',()=>{
 const x=fixture();
 x.run({type:'image/png',size:9*1024*1024});
 x.run({type:'image/jpeg',size:0});
 assert.equal(x.reads.length,0);
 assert.match(x.feedback.at(-1),/8 МБ/);
});

test('acceptable image continues into JPEG resize pipeline',()=>{
 const x=fixture();
 x.run({type:'image/png',size:1024});
 assert.equal(x.reads.length,1);
 assert.equal(vm.runInContext('avatarDraft?.owner',x.ctx),'user-uuid');
});
