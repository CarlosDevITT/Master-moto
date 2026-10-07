const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../js/cloud-engine.js');
const A='project:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',B='project:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const KEY='master-motos-records-v1';
function memory(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
function payload(records=[]){return {schemaVersion:1,values:{[KEY]:JSON.stringify(records)}};}
function remote(){let row=null;return {async read(){return row;},async save(p,r){if(r!==(row?.revision||0))throw {code:'P0001',message:'workspace_conflict'};row={payload:p,revision:r+1};return row;},get row(){return row;}};}
test('Contas, dados legados e sessões permanecem separados no mesmo navegador',()=>{
 const raw=memory();raw.setItem(KEY,'["legado"]');raw.setItem('sb-project-auth-token','sessao');
 const a=E.createStore(raw,A),b=E.createStore(raw,B);a.hydrate(payload(['A']),1);b.hydrate(payload(['B']),1);
 a.setItem(KEY,'["A alterado"]');assert.equal(b.getItem(KEY),'["B"]');assert.equal(raw.getItem(KEY),'["legado"]');
 assert.equal(E.createStore(raw,A).getItem(KEY),'["A alterado"]');assert.ok(!JSON.stringify(a.snapshot()).includes('sessao'));
 assert.throws(()=>E.validate({schemaVersion:1,values:{'sb-project-auth-token':'segredo'}}));a.block();assert.throws(()=>a.setItem(KEY,'[]'));
});
test('Falha de hidratação restaura todos os dados e a revisão anteriores',()=>{
 const raw=memory(),s=E.createStore(raw,A);s.hydrate(payload(['antes']),3);const set=raw.setItem;
 let fail=true;raw.setItem=(k,v)=>{if(fail&&k.endsWith('mm_theme_v1')){fail=false;throw Error('quota');}set(k,v);};
 assert.throws(()=>s.hydrate({schemaVersion:1,values:{[KEY]:'["depois"]',mm_theme_v1:'dark'}},4));
 assert.equal(s.getItem(KEY),'["antes"]');assert.equal(s.meta().revision,3);
});
test('Alterações offline sobrevivem à recarga e sincronizam quando a conexão volta',async()=>{
 const raw=memory(),r=remote(),s=E.createStore(raw,A),sync=E.createSync({store:s,remote:r});await sync.initialize();s.setItem(KEY,'["novo"]');
 const save=r.save;r.save=async()=>{throw Error('offline');};assert.equal(await sync.flush(),false);assert.equal(s.meta().dirty,true);sync.stop();
 const recovered=E.createStore(raw,A),next=E.createSync({store:recovered,remote:r});await next.initialize();assert.equal(recovered.getItem(KEY),'["novo"]');r.save=save;assert.equal(await next.flush(),true);assert.equal(r.row.payload.values[KEY],'["novo"]');next.stop();
});
test('Dois dispositivos não sobrescrevem versões mais recentes sem escolha explícita',async()=>{
 const r=remote(),a=E.createStore(memory(),A),b=E.createStore(memory(),A),sa=E.createSync({store:a,remote:r}),sb=E.createSync({store:b,remote:r});
 await sa.initialize();await sb.initialize();a.setItem(KEY,'["A"]');await sa.flush();b.setItem(KEY,'["B"]');assert.equal(await sb.flush(),false);assert.equal(sb.hasConflict(),true);assert.equal(r.row.payload.values[KEY],'["A"]');
 await sb.resolve('local');assert.equal(r.row.payload.values[KEY],'["B"]');await sa.check();assert.equal(sa.hasConflict(),true);await sa.resolve('cloud');assert.equal(a.getItem(KEY),'["B"]');sa.stop();sb.stop();
});
test('Uma edição durante envio não é marcada como já sincronizada',async()=>{
 const s=E.createStore(memory(),A);let release;const r={read:async()=>null,save:()=>new Promise(resolve=>release=resolve)};
 const sync=E.createSync({store:s,remote:r,delay:100000});await sync.initialize();s.setItem(KEY,'["primeira"]');const sending=sync.flush();s.setItem(KEY,'["segunda"]');release({revision:1});
 assert.equal(await sending,false);assert.equal(s.meta().dirty,true);assert.equal(s.getItem(KEY),'["segunda"]');assert.equal(s.meta().revision,1);sync.stop();
});
test('Conteúdo inválido não é enviado e uma conta nova não cai nos dados legados após falha',async()=>{
 const raw=memory();raw.setItem(KEY,'["legado"]');const s=E.createStore(raw,A);const bad=E.createSync({store:s,remote:{read:async()=>{throw Error('offline');}}});await assert.rejects(bad.initialize());assert.equal(s.getItem(KEY),null);
 const r=remote(),sync=E.createSync({store:s,remote:r});await sync.initialize();s.setItem(KEY,'JSON invalido');assert.equal(await sync.flush(),false);assert.equal(r.row,null);assert.equal(s.meta().dirty,true);sync.stop();
});
