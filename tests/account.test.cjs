const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');
const config={enabled:true,url:'https://project.supabase.co',publishableKey:'sb_publishable_test'};
const A={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',email:'a@example.com'};
function mock(initial=null,row=null){
 let current=initial,callback;const calls=[];
 const session=()=>current?{user:current,access_token:'token-'+current.id}:null;
 const query=result=>({select(){return this;},eq(){return this;},maybeSingle(){return this;},setHeader(name,value){calls.push(['header',name,value]);return this;},then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}});
 const client={calls,auth:{
  onAuthStateChange(fn){callback=fn;},getSession:async()=>({data:{session:session()},error:null}),getUser:async()=>({data:{user:current},error:null}),
  signInWithPassword:async data=>{calls.push(['login',data]);current=A;return {data:{session:session()},error:null};},
  signUp:async data=>{calls.push(['register',data]);return {data:{session:null},error:null};},
  resetPasswordForEmail:async(...args)=>{calls.push(['reset',...args]);return {error:null};},
  updateUser:async data=>{calls.push(['update',data]);return {error:null};},
  signOut:async()=>{current=null;callback('SIGNED_OUT',null);return {error:null};}
 },from:()=>query({data:row,error:null}),rpc:(fn,args)=>{calls.push(['save',args]);row={payload:args.p_payload,revision:args.p_expected_revision+1};return query({data:row,error:null});},event:(event,user)=>callback(event,user?{user}:null)};
 return client;
}
async function fixture(client=mock(),actualApp=false,url='https://site.example/Master-moto/'){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/navigation/.test(e.message))errors.push(e);});
 const dom=new JSDOM(html,{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.TextDecoder=TextDecoder;w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async file=>{const data=fs.readFileSync(path.join(root,file==='Data/market-sales.json'?'tests/fixtures/market-september-2026.json':file));return {ok:true,status:200,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};};
 w.localStorage.setItem('master-motos-records-v1','[{"id":"guest-secret"}]');
 w.eval(fs.readFileSync(path.join(root,'js/cloud-engine.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'js/account.js'),'utf8').replace('window.MMAccountReady=window.MMAccount.init(window.MM_SUPABASE_CONFIG);',''));
 let loads=0;const loadApp=async()=>{loads++;if(actualApp){for(const file of w.MMAccount.scripts){const s=w.document.createElement('script');s.textContent=fs.readFileSync(path.join(root,'js',file),'utf8');w.document.body.append(s);}}else{w.MMCatalogTools={snapshot:()=>({records:[],notes:{},profiles:{},guide:{},pricing:{},brands:{schemaVersion:1,items:[]},preferences:{},favorites:[],theme:'light'})};}};
 const state=await w.MMAccount.init(config,{loadApp,createClient:()=>client});
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
 return {w,doc:w.document,client,state,loads:()=>loads,errors,settle,close(){state.sync?.stop();dom.window.close();}};
}
function fill(a,id,value){a.doc.getElementById(id).value=value;}
async function submit(a){a.doc.getElementById('accountForm').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await a.settle();}
test('Visitante vê login e não carrega dados privados nem scripts da aplicação',async()=>{
 const a=await fixture();try{assert.equal(a.loads(),0);assert.equal(a.w.MMStorage,undefined);assert.ok(a.doc.body.classList.contains('auth-blocked'));assert.equal(a.doc.getElementById('accountGate').hidden,false);}finally{a.close();}
});
test('SDK compilado inicia a tela de login sem dependência de CDN nem acesso anônimo ao banco',async()=>{
 const dom=new JSDOM('<body><div class="app-shell"><div class="topbar"></div><div class="sidebar-foot"><span></span></div></div></body>',{url:'https://site.example/',runScripts:'dangerously'});
 const w=dom.window;let fetches=0;w.fetch=async()=>{fetches++;throw Error('Requisição inesperada');};
 try{for(const file of ['cloud-engine.js','vendor/supabase.js'])w.eval(fs.readFileSync(path.join(root,'js',file),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'js/account.js'),'utf8').replace('window.MMAccountReady=window.MMAccount.init(window.MM_SUPABASE_CONFIG);',''));
  const state=await w.MMAccount.init(config,{loadApp:async()=>assert.fail('Visitante não carrega aplicativo')});
  assert.ok(state.client);assert.equal(fetches,0);assert.equal(w.document.getElementById('accountGate').hidden,false);state.client.auth.stopAutoRefresh();
 }finally{dom.window.close();}
});
test('Cadastro valida confirmação e aguarda verificação do e-mail sem abrir catálogo',async()=>{
 const a=await fixture();try{a.doc.getElementById('accountRegister').click();fill(a,'accountEmail','new@example.com');fill(a,'accountPassword','abcdefgh');fill(a,'accountConfirm','diferente');await submit(a);assert.equal(a.client.calls.length,0);assert.match(a.doc.getElementById('accountMessage').textContent,/iguais/);
 fill(a,'accountConfirm','abcdefgh');await submit(a);assert.equal(a.client.calls[0][0],'register');assert.equal(a.client.calls[0][1].options.emailRedirectTo,'https://site.example/Master-moto/');assert.match(a.doc.getElementById('accountMessage').textContent,/confirmar/);assert.equal(a.loads(),0);
 }finally{a.close();}
});
test('Login inicia somente dados da conta e fixa o token correto no envio',async()=>{
 const a=await fixture();try{fill(a,'accountEmail',A.email);fill(a,'accountPassword','abcdefgh');await submit(a);assert.equal(a.loads(),1);assert.equal(a.doc.getElementById('accountGate').hidden,true);assert.equal(a.doc.getElementById('accountIdentity').textContent,A.email);assert.equal(a.state.store.getItem('master-motos-records-v1'),'[]');assert.equal(a.w.localStorage.getItem('master-motos-records-v1'),'[{"id":"guest-secret"}]');
 await a.state.sync.flush();const saved=a.client.calls.find(c=>c[0]==='save');assert.ok(saved);assert.ok(!JSON.stringify(saved).includes('guest-secret'));assert.ok(!JSON.stringify(saved).includes('access_token'));assert.ok(a.client.calls.some(c=>c[0]==='header'&&c[2]==='Bearer token-'+A.id));
 }finally{a.close();}
});
test('Recuperação envia link e define senha antes de carregar a conta',async()=>{
 const a=await fixture();try{a.doc.getElementById('accountForgot').click();fill(a,'accountEmail',A.email);await submit(a);const call=a.client.calls.find(c=>c[0]==='reset');assert.equal(call[2].redirectTo,'https://site.example/Master-moto/?auth=recovery');assert.equal(a.loads(),0);}finally{a.close();}
 const b=await fixture(mock(A),false,'https://site.example/Master-moto/?auth=recovery');try{assert.equal(b.loads(),0);fill(b,'accountPassword','novaSenha123');fill(b,'accountConfirm','novaSenha123');await submit(b);assert.ok(b.client.calls.some(c=>c[0]==='update'));assert.equal(b.loads(),1);}finally{b.close();}
});
test('Mudança de conta oculta a aplicação imediatamente e bloqueia gravações',async()=>{
 const a=await fixture(mock(A));try{a.client.event('SIGNED_IN',{id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'});assert.ok(a.doc.body.classList.contains('auth-blocked'));assert.throws(()=>a.state.store.setItem('mm_theme_v1','dark'));}finally{a.close();}
});
test('Aplicação completa hidrata preferências e notas da nuvem antes da inicialização',async()=>{
 const values={'master-motos-records-v1':'[]','master-motos-notes-v1':'{"private-note":{"body":"conta A"}}','mm_theme_v1':'dark'};
 const a=await fixture(mock(A,{payload:{schemaVersion:1,values},revision:4}),true);try{await a.settle();assert.deepEqual(a.errors,[]);assert.ok(a.doc.body.classList.contains('dark-mode'));assert.equal(a.w.MMCatalogTools.snapshot().records.length,0);assert.equal(a.state.store.meta().revision,4);await a.state.sync.flush();assert.ok(!JSON.stringify(a.client.calls.find(c=>c[0]==='save')).includes('guest-secret'));}finally{a.close();}
});
