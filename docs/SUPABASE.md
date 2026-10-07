# Contas e sincronização do Master Motos

A integração está ligada ao projeto **Master-moto**, referência `lmpddosseahxfoknuwif`. A migração `supabase/migrations/20261007145641_individual_user_workspaces.sql` já foi aplicada nesse projeto. Não reaplique o SQL manualmente: ele cria a tabela e as políticas que já existem.

## Antes de publicar

1. No [Supabase — configuração de URLs](https://supabase.com/dashboard/project/lmpddosseahxfoknuwif/auth/url-configuration), confira o **Site URL** e os **Redirect URLs**. A configuração remota não pôde ser consultada ou modificada pelo conector disponível.
2. Para o endereço público atual, use `https://carlosdevitt.github.io/Master-moto/` como Site URL. Autorize esse endereço e `https://carlosdevitt.github.io/Master-moto/?auth=recovery`. Para desenvolvimento, autorize `http://localhost:4173/` e `http://localhost:4173/?auth=recovery`. Se publicar na Vercel ou em domínio próprio, adicione o endereço efetivamente utilizado, incluindo o retorno de recuperação. Evite autorizações amplas em produção.
3. O login por e-mail e os cadastros estão habilitados; a confirmação do e-mail está ativa, conforme consulta ao serviço em 07/10/2026. Configure seu provedor de e-mail em [SMTP](https://supabase.com/dashboard/project/lmpddosseahxfoknuwif/auth/smtp) antes de abrir o cadastro ao público. O envio padrão do Supabase possui restrições; a entrega de mensagens não foi testada com uma conta real nesta implementação.
4. Publique os arquivos estáticos, incluindo `js/vendor/supabase.js`. Não é preciso servidor Node em produção. Para reconstruir o SDK local, execute `npm ci` e `npm run build:auth`.
5. Faça a verificação final com duas contas reais: cadastrar e confirmar o e-mail, entrar, alterar uma nota e a precificação, sair, entrar na outra conta e confirmar que os dados não se misturam. Na primeira conta, abra outro dispositivo e confira a recuperação das preferências. Teste também o link de recuperação e as opções de conflito entre dois dispositivos. Use o mesmo navegador que iniciou a solicitação para abrir o link: o fluxo PKCE depende do verificador salvo nesse navegador.

As alterações do aplicativo permanecem locais até a publicação. O banco está preparado, mas os e-mails e o fluxo completo em navegador real ainda precisam dessa verificação final.

## O que é salvo por usuário

- Catálogo completo, inclusive exclusões e catálogo vazio.
- Notas das motos, perfis e estrelas que determinam a curva ABC.
- Notas do guia de componentes.
- Produtos, custos, taxas, cenários e preferências de precificação.
- Painéis abertos/recolhidos e organização dos produtos na precificação.
- Colunas, paginação, densidade, cartões, filtros favoritos e tema.
- Cópias de recuperação utilizadas pelas notas e pela restauração de backups.

Os dados nacionais de emplacamento continuam sendo uma referência pública comum, atualizada pelo processo existente. Credenciais, tokens de sessão e senhas não entram no documento de preferências. Nome e e-mail da conta são administrados pelo Supabase Auth.

## Como funciona

`js/supabase-config.js` contém a URL e a chave **publishable**, destinada ao navegador. Não insira chaves secretas ou `service_role` nesse arquivo. O SDK é compilado localmente a partir da versão fixada no arquivo de dependências.

`js/account.js` exibe login, cadastro, recuperação de senha e controles da conta. Os scripts da aplicação carregam depois da confirmação da sessão no servidor e da recuperação dos dados individuais. Se a conta mudar em outra aba, a aplicação é ocultada e suas gravações são bloqueadas até a recarga.

`js/cloud-engine.js` fornece um armazenamento separado por projeto e identificador de usuário. O aplicativo grava primeiro nesse armazenamento e envia as alterações automaticamente para `public.mm_user_workspaces`. O indicador distingue salvamento local, envio, sucesso, falta de conexão e conflito. Um envio interrompido mantém alterações pendentes no dispositivo, para a mesma conta. A entrada inicial exige uma sessão verificada pelo servidor; não há login offline.

A sincronização usa revisão e comparação de versões pela função `public.mm_save_workspace`. Se outro dispositivo salvou primeiro, o aplicativo pede uma escolha: baixar uma cópia, usar a nuvem ou enviar a versão local. A escolha de uma versão substitui a outra; não há mesclagem automática. Mudanças em outra aba do mesmo navegador exigem recarga para evitar que uma tela antiga grave sobre os dados atuais. O documento de cada conta tem limite de 10 MiB no banco; limites de armazenamento do navegador podem ser menores.

## Dados anteriores ao login

Os dados antigos deste navegador permanecem preservados, sem associação automática à primeira conta que entrar. A opção **Importar dados anteriores deste navegador** identifica a conta de destino e pede confirmação. Ela baixa uma cópia dos dados atuais da conta antes da substituição. A origem local permanece guardada. Para importar dados de outro dispositivo, use o backup completo existente no catálogo.

## Segurança e verificação

A tabela possui RLS ativo e políticas de leitura, inclusão e alteração limitadas a `(select auth.uid()) = user_id`. A atualização valida tanto a linha anterior quanto o proprietário da nova linha. A função de gravação usa as permissões do usuário chamador, com busca de esquema fixada; visitantes não podem executá-la nem consultar a tabela.

Na validação remota, duas identidades temporárias, dentro de uma transação revertida, confirmaram leitura isolada, bloqueio de escrita na conta alheia e recusa de revisão desatualizada. Nenhuma conta de teste permaneceu no banco. A consulta REST sem sessão retornou 401. Os consultores de segurança e desempenho do Supabase não apontaram alertas após a migração.

`npm test` inclui testes de login, cadastro, recuperação, inicialização da aplicação após hidratação, troca de conta, isolamento local, falhas de armazenamento e conexão, mudanças durante um envio e conflitos entre dispositivos. Esses testes de interface usam DOM simulado e serviço de autenticação simulado; não confirmam envio real de e-mails. `npm run check` verifica sintaxe e recursos estáticos.

Referências: [redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
