(function(root) {
  const keys = ['master-motos-records-v1','master-motos-notes-v1','master-motos-notes-v1-backup','master-motos-perfil-v1','mm_guia_notes_v1','master-motos-pricing-v1','master-motos-brands-v1','mm-catalog-preferences-v1','mm-catalog-favorites-v1','mm-catalog-before-restore-v1','mm_theme_v1'];
  function validate(payload) {
    if (!payload || payload.schemaVersion !== 1 || !payload.values || typeof payload.values !== 'object' || Array.isArray(payload.values) || JSON.stringify(payload).length > 10485760) throw Error('Dados da conta inválidos.');
    for (const [key,value] of Object.entries(payload.values)) {
      if (!keys.includes(key) || (value !== null && typeof value !== 'string')) throw Error('Dados da conta inválidos.');
      if (value != null && key !== 'mm_theme_v1') JSON.parse(value);
      if (key === 'mm_theme_v1' && value != null && !['light','dark'].includes(value)) throw Error('Tema inválido.');
    }
    return {schemaVersion:1, values:Object.fromEntries(keys.map(key=>[key,payload.values[key] ?? null]))};
  }
  function createStore(raw, scope, onChange = () => {}) {
    if (!/^[a-z0-9]+:[a-f0-9-]{36}$/i.test(scope)) throw Error('Conta inválida.');
    const prefix = `mm-user:${scope}:`, metaKey = prefix + 'sync-meta';
    let blocked = false;
    const physical = key => keys.includes(key) ? prefix + key : key;
    const meta = () => { const saved = JSON.parse(raw.getItem(metaKey) || 'null'); return saved || {revision:0,generation:0,dirty:false,initialized:false}; };
    function write(key,value) {
      if (blocked) throw Error('Recarregue a conta antes de editar.');
      if (!keys.includes(key)) { value === null ? raw.removeItem(key) : raw.setItem(key,String(value)); return; }
      const old = raw.getItem(physical(key)), before = raw.getItem(metaKey), next = value === null ? null : String(value);
      if (old === next) return;
      try {
        value === null ? raw.removeItem(physical(key)) : raw.setItem(physical(key),next);
        const status = meta(); status.dirty=true; status.generation++; raw.setItem(metaKey,JSON.stringify(status));
      } catch(error) {
        try { old === null ? raw.removeItem(physical(key)) : raw.setItem(physical(key),old); before === null ? raw.removeItem(metaKey) : raw.setItem(metaKey,before); } catch {}
        throw error;
      }
      onChange();
    }
    const snapshot = () => ({schemaVersion:1,values:Object.fromEntries(keys.map(key=>[key,raw.getItem(physical(key))]))});
    function hydrate(payload,revision) {
      const clean=validate(payload), entries=keys.map(key=>[physical(key),clean.values[key]]);
      entries.push([metaKey,JSON.stringify({revision,generation:0,dirty:false,initialized:true})]);
      const before=entries.map(([key])=>[key,raw.getItem(key)]);
      try { entries.forEach(([key,value])=>value===null ? raw.removeItem(key) : raw.setItem(key,value)); }
      catch(error) { before.forEach(([key,value])=>{try {value===null ? raw.removeItem(key) : raw.setItem(key,value);}catch{}}); throw error; }
    }
    return { getItem:key=>raw.getItem(physical(key)), setItem:(key,value)=>write(key,value), removeItem:key=>write(key,null), snapshot, hydrate, meta,
      setMeta:value=>raw.setItem(metaKey,JSON.stringify(value)), block:()=>{blocked=true;}, prefix };
  }
  function createSync({store,remote,onStatus=()=>{},delay=1200}) {
    let timer, running=null, conflict=null, stopped=false, ready=false;
    const status = (kind, message) => onStatus({kind,message});
    async function initialize() {
      const local = store.meta();
      try {
        const row=await remote.read(); const revision=row?.revision || 0;
        if (row) validate(row.payload);
        if (local.initialized && local.dirty) {
          if (local.revision !== revision) { conflict=row || {revision:0,payload:{schemaVersion:1,values:{}}}; status('conflict','Há outra versão dos seus dados na nuvem. Escolha qual manter.'); }
          else status('pending','Alterações locais aguardando sincronização.');
        } else {store.hydrate(row?.payload || {schemaVersion:1,values:{}},revision);status('saved','Dados e preferências sincronizados.');}
        ready=true; return true;
      } catch(error) {
        if (!local.initialized) throw error;
        ready=true; status('offline','Sem acesso à nuvem. Os dados desta conta continuam salvos neste dispositivo.'); return true;
      }
    }
    function schedule() { if (!ready || stopped || conflict) return; clearTimeout(timer); status('pending','Salvo neste dispositivo · sincronizando...'); timer=setTimeout(()=>flush(),delay); }
    async function flush() {
      clearTimeout(timer);
      if (running) { await running; if (store.meta().dirty && !conflict && !stopped) return flush(); return !store.meta().dirty; }
      if (!ready || stopped || conflict) return false;
      const meta=store.meta(); if (!meta.dirty) return true;
      let payload;try {payload=validate(store.snapshot());}catch {status('invalid','Não foi possível enviar dados inválidos. Baixe uma cópia e revise as alterações.');return false;}
      status('saving','Sincronizando sua conta...');
      running=(async()=>{
        try {
          const result=await remote.save(payload,meta.revision);
          const current=store.meta();
          store.setMeta({...current,revision:result.revision,dirty:current.generation!==meta.generation,initialized:true});
          status(current.generation===meta.generation ? 'saved':'pending',current.generation===meta.generation ? 'Dados e preferências sincronizados.':'Novas alterações aguardando sincronização.');
          return true;
        } catch(error) {
          if (error.code==='P0001' && /workspace_conflict/.test(error.message)) { conflict={}; status('conflict','Outra sessão atualizou sua conta. Resolva a diferença antes de sincronizar.'); }
          else status('offline','Não foi possível sincronizar. Alterações preservadas neste dispositivo.');
          return false;
        } finally { running=null; }
      })();
      const success=await running;
      if(success && store.meta().dirty) schedule(); return success && !store.meta().dirty;
    }
    async function check() {
      if(stopped || conflict || running) return;
      if(store.meta().dirty) return flush();
      try { const row=await remote.read(); if((row?.revision||0)!==store.meta().revision) { conflict=row || {}; status('conflict','Sua conta foi atualizada em outro dispositivo. Escolha a versão para continuar.'); }else status('saved','Dados e preferências sincronizados.'); }
      catch { status('offline','Sem conexão com a nuvem. Seus dados locais estão preservados.'); }
    }
    async function resolve(choice) {
      if(running) await running;
      const row=await remote.read(), revision=row?.revision||0;
      if(choice==='cloud') { store.hydrate(row?.payload || {schemaVersion:1,values:{}},revision); conflict=null; return true; }
      if(choice!=='local') throw Error('Opção inválida.');
      const current=store.meta(); store.setMeta({...current,revision,dirty:true}); conflict=null; return flush();
    }
    return {initialize,schedule,flush,check,resolve,start(){ready=true;if(store.meta().dirty)schedule();},stop(){stopped=true;clearTimeout(timer);},hasConflict:()=>Boolean(conflict)};
  }
  const api={keys,validate,createStore,createSync};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else root.MMCloudEngine=api;
})(typeof window==='undefined'?globalThis:window);
