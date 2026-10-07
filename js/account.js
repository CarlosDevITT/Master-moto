/* Login and account lifecycle. Application scripts load only after account hydration. */
window.MMAccount = (() => {
  const scripts=['shared.js','data.js','guide-data.js','perfil-data.js','perfil.js','app.js','pricing-engine.js','pricing.js','market-engine.js','market.js','catalog-tools.js','catalog-abc.js','accessibility.js'];
  const loadScript = file => new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='js/'+file;script.onload=resolve;script.onerror=()=>reject(Error('Não foi possível carregar o aplicativo.'));document.body.append(script);});
  async function loadApp(){ for(const file of scripts) await loadScript(file); }
  async function init(config, dependencies={}) {
    const appLoader=dependencies.loadApp || loadApp, raw=dependencies.storage || localStorage;
    document.body.classList.add('auth-blocked');
    document.body.insertAdjacentHTML('beforeend', `<section id="accountGate" class="account-gate"><aside class="account-intro" aria-label="Master Motos"><p class="eyebrow">MASTER MOTOS · GESTÃO DE APLICAÇÕES</p><h2>Sua operação.<br><span>Bem organizada.</span></h2><p>Encontre aplicações, organize o catálogo e calcule seus preços em um espaço feito para o dia a dia.</p><div class="account-intro-list"><span>Catálogo inteligente</span><span>Precificação rápida</span><span>Preferências por conta</span></div></aside><div class="account-card"><div class="account-brand"><img src="assets/brand-mark.svg" width="34" height="34" alt=""></div><p class="eyebrow">MASTER MOTOS</p><h1 id="accountTitle">Entrar na sua conta</h1><p id="accountIntro">Seu catálogo e suas preferências, em qualquer dispositivo.</p><form id="accountForm"><label id="accountNameLabel" hidden>Nome<input id="accountName" autocomplete="name" maxlength="100"></label><label id="accountEmailLabel">E-mail<input id="accountEmail" type="email" autocomplete="email" required maxlength="254"></label><label id="accountPasswordLabel">Senha<input id="accountPassword" type="password" autocomplete="current-password" required></label><label id="accountConfirmLabel" hidden>Confirmar senha<input id="accountConfirm" type="password" autocomplete="new-password"></label><button class="primary-btn" id="accountSubmit">Entrar</button></form><p id="accountMessage" role="status" aria-live="polite"></p><div class="account-links"><button id="accountLogin" type="button">Já tenho conta</button><button id="accountRegister" type="button">Criar conta</button><button id="accountForgot" type="button">Esqueci minha senha</button><button id="accountRetry" type="button" hidden>Tentar novamente</button></div></div></section>`);
    const q=id=>document.getElementById(id), gate=q('accountGate');
    let client, store, sync, user=null, loaded=false, appStarted=false, lastStatus=null, mounting=null, allowSync=false, changedAccount=false, recovery=new URL(location.href).searchParams.get('auth')==='recovery', mode='login', busy=false, poll;
    function message(text){q('accountMessage').textContent=text;}
    function setMode(next){
      mode=next;
      const password=next!=='forgot', confirm=next==='register'||next==='recovery';
      q('accountTitle').textContent={login:'Entrar na sua conta',register:'Criar sua conta',forgot:'Recuperar acesso',recovery:'Definir nova senha'}[next];
      q('accountIntro').textContent=next==='forgot'?'Enviaremos um link para redefinir sua senha.':next==='recovery'?'Escolha uma senha com pelo menos 8 caracteres.':'Seu catálogo e suas preferências, em qualquer dispositivo.';
      q('accountNameLabel').hidden=next!=='register';q('accountEmailLabel').hidden=next==='recovery';q('accountEmail').required=next!=='recovery';
      q('accountPasswordLabel').hidden=!password;q('accountPassword').required=password;q('accountPassword').minLength=confirm?8:1;q('accountPassword').autocomplete=confirm?'new-password':'current-password';
      q('accountConfirmLabel').hidden=!confirm;q('accountConfirm').required=confirm;
      q('accountSubmit').textContent={login:'Entrar',register:'Criar conta',forgot:'Enviar link de recuperação',recovery:'Salvar nova senha'}[next];
      ['accountLogin','accountRegister','accountForgot'].forEach(id=>q(id).hidden=next==='recovery');
      q('accountLogin').hidden=next==='login'||next==='recovery';q('accountRegister').hidden=next==='register'||next==='recovery';q('accountForgot').hidden=next==='forgot'||next==='recovery';
      q('accountPassword').value=q('accountConfirm').value='';message('');
    }
    const redirect=()=>location.origin+location.pathname;
    function errorMessage(error){
      if(error?.code==='invalid_credentials')return 'E-mail ou senha incorretos.';
      if(error?.code==='email_not_confirmed')return 'Confirme o e-mail enviado para sua conta antes de entrar.';
      if(error?.status===429)return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
      if(error?.code==='weak_password')return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.';
      return 'Não foi possível concluir. Confira sua conexão e tente novamente.';
    }
    function cloudStatus(state){
      lastStatus=state; if(!q('accountSyncStatus'))return;
      q('accountSyncStatus').textContent=state.message;q('accountSyncStatus').dataset.kind=state.kind;
      q('accountConflict').hidden=state.kind!=='conflict';
    }
    function downloadLocal(){
      window.MMPricing?.save(); const snapshot=window.MMCatalogTools?.snapshot(); if(!snapshot)return;
      const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'})), link=document.createElement('a');link.href=url;link.download='master-motos-copia-local.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    async function mount(session){
      if(mounting)return mounting;
      mounting=(async()=>{
        const verified=await client.auth.getUser(); if(verified.error||!verified.data.user)throw verified.error||Error('Sessão inválida.');
        user=verified.data.user;
        if(loaded){ if(store.scopeUser!==user.id)location.reload(); return; }
        const scope=config.url.split('//')[1].split('.')[0]+':'+user.id;
        store=MMCloudEngine.createStore(raw,scope,()=>{if(allowSync)sync?.schedule();});store.scopeUser=user.id;
        async function authorized(query){
          const session=await client.auth.getSession();
          if(changedAccount||session.error||session.data.session?.user.id!==user.id)throw Error('A conta mudou.');
          // Pin the verified account token, including when another tab changes sessions.
          return await query.setHeader('Authorization','Bearer '+session.data.session.access_token);
        }
        const remote={
          async read(){const result=await authorized(client.from('mm_user_workspaces').select('payload,revision,updated_at').eq('user_id',user.id).maybeSingle());if(result.error)throw result.error;return result.data;},
          async save(payload,revision){const result=await authorized(client.rpc('mm_save_workspace',{p_payload:payload,p_expected_revision:revision}));if(result.error)throw result.error;return result.data;}
        };
        sync=MMCloudEngine.createSync({store,remote,onStatus:cloudStatus});await sync.initialize();
        if(changedAccount)throw Error('A conta mudou durante o carregamento.');
        window.MMStorage=store; appStarted=true; await appLoader(); if(changedAccount)throw Error('A conta mudou durante o carregamento.'); loaded=true;
        const data=window.MMCatalogTools.snapshot();
        const defaults={'master-motos-records-v1':data.records,'master-motos-notes-v1':data.notes,'master-motos-perfil-v1':data.profiles,'mm_guia_notes_v1':data.guide,'master-motos-pricing-v1':data.pricing,'mm-catalog-preferences-v1':data.preferences,'mm-catalog-favorites-v1':data.favorites,'mm_theme_v1':data.theme};
        for(const [key,value] of Object.entries(defaults))if(store.getItem(key)===null)store.setItem(key,key==='mm_theme_v1'?value:JSON.stringify(value));
        document.querySelector('.topbar').insertAdjacentHTML('afterend', `<section class="account-session"><div class="account-session-meta"><strong id="accountIdentity"></strong><p id="accountSyncStatus" role="status" aria-live="polite">Dados carregados da sua conta.</p></div><div class="account-session-actions"><button class="subtle-btn" id="accountSync">Sincronizar</button><button class="subtle-btn" id="accountLogout">Sair</button><button class="subtle-btn" id="accountImportLocal" hidden>Importar dados anteriores deste navegador</button></div><div id="accountConflict" hidden><p>Há versões diferentes. Baixe uma cópia antes de escolher.</p><button class="subtle-btn" id="accountBackup">Baixar cópia local</button><button class="subtle-btn" id="accountUseCloud">Usar versão da nuvem</button><button class="subtle-btn" id="accountUseLocal">Enviar versão deste dispositivo</button></div></section>`);
        if(lastStatus)cloudStatus(lastStatus);
        q('accountIdentity').textContent=user.email || 'Minha conta';
        document.querySelector('.sidebar-foot > span').textContent='Conta individual · Supabase';
        q('accountSync').addEventListener('click',()=>sync.hasConflict()?cloudStatus({kind:'conflict',message:'Escolha qual versão manter.'}):sync.check());
        q('accountBackup').addEventListener('click',downloadLocal);
        q('accountUseCloud').addEventListener('click',async()=>{if(!confirm('Usar os dados da nuvem e substituir a cópia local desta conta? Baixe uma cópia se precisar preservar alterações.'))return;try{await sync.resolve('cloud');location.reload();}catch{cloudStatus({kind:'offline',message:'Não foi possível carregar a nuvem. Seus dados locais foram preservados.'});}});
        q('accountUseLocal').addEventListener('click',async()=>{if(!confirm('Enviar os dados deste dispositivo e substituir a versão da nuvem da sua conta?'))return;try{await sync.resolve('local');}catch{cloudStatus({kind:'offline',message:'Não foi possível enviar. Seus dados locais foram preservados.'});}});
        q('accountLogout').addEventListener('click',async()=>{
          const shell=document.querySelector('.app-shell');shell.inert=true;
          try{window.MMPricing?.save();const saved=await sync.flush();if(!saved&&!confirm('Há alterações apenas neste dispositivo. Sair agora? Elas continuarão guardadas para esta conta.'))return;const result=await client.auth.signOut({scope:'local'});if(result.error)throw result.error;store.block();sync.stop();document.body.classList.add('auth-blocked');location.reload();}
          catch{cloudStatus({kind:'offline',message:'Não foi possível sair. Confira sua conexão e tente novamente.'});}finally{shell.inert=false;}
        });
        const legacy=()=>({schemaVersion:1,values:Object.fromEntries(MMCloudEngine.keys.map(key=>[key,raw.getItem(key)]))});
        q('accountImportLocal').hidden=!MMCloudEngine.keys.some(key=>raw.getItem(key)!==null);
        q('accountImportLocal').addEventListener('click',async()=>{
          if(sync.hasConflict()){cloudStatus({kind:'conflict',message:'Resolva as versões antes de importar dados.'});return;}
          try{const payload=MMCloudEngine.validate(legacy());const count=JSON.parse(payload.values['master-motos-records-v1']||'[]').length;
            if(!confirm(`Importar ${count} motos e as preferências anteriores deste navegador para ${user.email}? Isso substitui os dados desta conta; a origem local será preservada.`))return;
            downloadLocal();if(!window.MMStore.commit(Object.entries(payload.values)))return;await sync.flush();location.reload();
          }catch{cloudStatus({kind:'offline',message:'Não foi possível importar. Confira o arquivo local ou baixe um backup.'});}
        });
        window.addEventListener('storage',event=>{if(event.key?.startsWith(store.prefix)&&!event.key.endsWith('sync-meta')){store.block();sync.stop();document.body.classList.add('auth-blocked');gate.hidden=false;message('Os dados mudaram em outra aba. Recarregue esta página para continuar.');q('accountForm').hidden=true;q('accountRetry').hidden=false;q('accountRetry').textContent='Recarregar página';}});
        window.addEventListener('online',()=>sync.check());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync.check();});
        poll=setInterval(()=>{if(document.visibilityState==='visible')sync.check();},60000);
        window.addEventListener('pagehide',()=>{clearInterval(poll);sync.flush();});
        allowSync=true;gate.hidden=true;document.body.classList.remove('auth-blocked');
        if(sync.hasConflict())cloudStatus({kind:'conflict',message:'Outra versão foi salva na nuvem. Escolha qual manter.'});else sync.start();
      })();
      try{await mounting;}finally{mounting=null;}
    }
    async function resume(){
      message('Verificando sua conta...');
      try{const result=await client.auth.getSession();if(result.error)throw result.error;if(!result.data.session){setMode('login');return;}if(recovery){setMode('recovery');return;}await mount(result.data.session);}
      catch{message('Não foi possível carregar sua conta. Confira a conexão e tente novamente.');q('accountRetry').hidden=false;}
    }
    if(config?.enabled===false){await appLoader();gate.hidden=true;document.body.classList.remove('auth-blocked');return {local:true};}
    if(!config?.url?.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/)||!config?.publishableKey?.startsWith('sb_publishable_')){message('A conexão da conta ainda não foi configurada.');q('accountSubmit').disabled=true;return {configured:false};}
    const factory=dependencies.createClient || SupabaseSDK.createClient;
    client=factory(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'},global:{fetch:(input,options={})=>fetch(input,{...options,signal:options.signal||AbortSignal.timeout(20000)})}});
    client.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){recovery=true;setMode('recovery');gate.hidden=false;document.body.classList.add('auth-blocked');}
      if(user&&(event==='SIGNED_OUT'||session?.user?.id&&session.user.id!==user.id)){changedAccount=true;store?.block();sync?.stop();document.body.classList.add('auth-blocked');setTimeout(()=>location.reload(),0);}
    });
    q('accountLogin').addEventListener('click',()=>{if(!busy)setMode('login');});q('accountRegister').addEventListener('click',()=>{if(!busy)setMode('register');});q('accountForgot').addEventListener('click',()=>{if(!busy)setMode('forgot');});q('accountRetry').addEventListener('click',()=>appStarted?location.reload():resume());
    q('accountForm').addEventListener('submit',async event=>{
      event.preventDefault();if(busy||!q('accountForm').reportValidity())return;
      if((mode==='register'||mode==='recovery')&&q('accountPassword').value.length<8){message('Use uma senha com pelo menos 8 caracteres.');return;}
      if((mode==='register'||mode==='recovery')&&q('accountPassword').value!==q('accountConfirm').value){message('As senhas precisam ser iguais.');return;}
      busy=true;q('accountSubmit').disabled=true;message('Aguarde...');
      try{
        const email=q('accountEmail').value.trim(),password=q('accountPassword').value;let result;
        if(mode==='forgot'){result=await client.auth.resetPasswordForEmail(email,{redirectTo:redirect()+'?auth=recovery'});if(result.error)throw result.error;message('Se houver uma conta para esse e-mail, você receberá o link de recuperação.');return;}
        if(mode==='recovery'){result=await client.auth.updateUser({password});if(result.error)throw result.error;recovery=false;history.replaceState(null,'',location.pathname);await resume();return;}
        if(mode==='register'){result=await client.auth.signUp({email,password,options:{emailRedirectTo:redirect(),data:{display_name:q('accountName').value.trim()}}});if(result.error)throw result.error;if(!result.data.session){setMode('login');message('Confira seu e-mail para confirmar o cadastro e depois entre na sua conta.');return;}}
        else{result=await client.auth.signInWithPassword({email,password});if(result.error)throw result.error;}
        q('accountPassword').value=q('accountConfirm').value='';await mount(result.data.session);
      }catch(error){message(errorMessage(error));}finally{busy=false;q('accountSubmit').disabled=false;}
    });
    await resume();return {client,get store(){return store;},get sync(){return sync;},get user(){return user;}};
  }
  return {init,scripts};
})();
window.MMAccountReady=window.MMAccount.init(window.MM_SUPABASE_CONFIG);
