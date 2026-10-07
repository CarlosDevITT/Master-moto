# Master Motos

Catálogo de aplicações de motos com busca, filtros, cadastro, classificação comercial, notas e exportação de aplicações.

## Executar

Com Node.js instalado, execute `npm run dev` e abra <http://localhost:4173>. O aplicativo usa hospedagem estática e o Supabase para contas e dados. O SDK já está incluído no projeto; `npm ci` instala ferramentas de teste e reconstrução. Confira [o guia do Supabase](docs/SUPABASE.md) antes de publicar.

## Dados

- A base inicial contém 464 motos, em `js/data.js`, extraídas de `Data/MASTER_MOTOS_v6.xlsx`.
- Cadastros, exclusões, classificações, notas, precificação e preferências são salvos **individualmente por conta** no Supabase, com cópia local e sincronização automática entre dispositivos.
- A aba Produtos importados foi retirada. Os arquivos de origem continuam preservados no repositório.
- A busca combina termos em qualquer ordem (ex.: `Honda 250 2020`) e considera marca, modelo, cilindrada, motor e ano de aplicação.
- Notas podem ser exportadas e importadas em JSON. O catálogo filtrado pode ser exportado em CSV.
- **Restaurar base** substitui os cadastros e notas da conta pela planilha original, após confirmação; a alteração também é sincronizada.

Para atualizar a base de motos a partir da planilha, execute `./tools/extract-data.ps1` no PowerShell. Para conferir uma extração sem sobrescrever a base, use `./tools/extract-data.ps1 -ExportPath ./arquivo-temporario.js`.

## Ferramentas do Catálogo

- **Backup completo** baixa um JSON com motos, notas, classificações comerciais, notas de componentes, filtros favoritos, colunas, visualização, tema e preferências de precificação. Ele inclui toda a base, mesmo quando a busca mostra apenas algumas motos. Backups antigos sem precificação preservam as preferências atuais da calculadora.
- **Restaurar backup** permite escolher esse JSON e conferir as quantidades antes de confirmar. Dados inválidos e IDs duplicados são recusados. A base atual é substituída; a versão anterior fica disponível em **Recuperar base anterior**, inclusive após recarregar. Você também pode baixar um backup atual antes da confirmação. Essa recuperação acompanha a conta e não substitui a cópia exportada.
- **Colunas** permite ocultar informações da tabela. Modelo, seleção e ações permanecem disponíveis. Use **Mostrar todas** para retornar à tabela completa.
- **Salvar filtro** guarda busca, filtros, ordenação e quantidade por página. Escolha um nome de até 60 caracteres. Salvar novamente com o mesmo nome atualiza o favorito. Escolha um favorito na lista para reaplicá-lo ou use **Remover favorito**.
- **Tabela / Cartões** muda a visualização mantendo busca, paginação e seleção. Sem preferência manual, o celular usa cartões automaticamente. Cada cartão oferece seleção, edição, notas e classificação de curva.
- **Editar selecionados** aparece na barra de seleção. Selecione motos na tabela ou nos cartões, inclusive em páginas diferentes, e altere categoria, perfil, faixa ou curva. **Manter atual** preserva o campo; as opções automáticas removem apenas os ajustes manuais de perfil/faixa. Fechar ou cancelar não modifica os registros.

Preferências e filtros favoritos permanecem no navegador após recarregar. As gravações de restauração e edição em lote verificam todas as partes antes de atualizar a tela e tentam reverter os dados se uma gravação falhar. Exporte um backup para manter uma cópia fora do navegador.

## Curva ABC do catálogo e anúncios

A aba **Curva ABC do catálogo** abre na sua base de motos. Avalie cada moto em **1 a 5 estrelas** no catálogo, nos cartões, no cadastro ou no próprio painel. **4–5 estrelas = A; 3 estrelas = B; 1–2 estrelas = C**. Sem avaliação fica pendente; classificações manuais antigas são preservadas até você atribuir estrelas ou limpar a curva. As avaliações são salvas automaticamente no navegador, recuperadas após recarregar e incluídas no backup completo. O painel mostra quantidades por curva, busca, filtro, paginação e exportação das avaliações.

Na opção **Brasil · referência Fenabrave**, o painel usa o relatório público da Fenabrave, com 77 modelos/famílias publicados nos rankings por segmento de setembro de 2026. A amostra cobre 93,55% dos emplacamentos nacionais acumulados no ano. A curva usa o volume **da amostra publicada**, não o total de peças vendidas no Mercado Livre nem a frota em circulação: A até atingir 80%, B até atingir 95%, C restante. O modelo que cruza o limite permanece na faixa anterior. Filtros não alteram essas classificações.

O painel mostra fonte, período, cobertura, acumulado, mês atual, variação mensal e lacunas no catálogo. A correspondência com aplicações usa nomes exatos e equivalências revisadas em `js/market-engine.js`; cilindradas parecidas não são confundidas. Essa referência nacional não atribui curvas às motos sem avaliação no catálogo. Avaliações e ajustes comerciais não alteram a curva do relatório nacional.


### Atualização automática

- O navegador verifica `Data/market-sales.json` ao abrir, ao voltar à página após seis horas e a cada seis horas com o site ativo. Mantém o último ranking válido para falhas de conexão e informa período antigo ou falha de atualização.
- `.github/workflows/market-data.yml` consulta a página oficial diariamente às 09h UTC, baixa o relatório mais recente e atualiza o JSON apenas após conferir os oito segmentos, posições consecutivas, todas as linhas reconhecidas, totais e duplicações. Segmentos incompletos são recusados; Touring só pode ter menos de dez modelos quando representa o segmento inteiro. Mudanças no formato da fonte geram falha sem substituir a base anterior. O workflow precisa estar na branch padrão do GitHub com Actions e permissão de escrita habilitados. A hospedagem existente foi identificada como GitHub Pages pelos registros de execução do repositório. Após salvar novos dados, o workflow solicita explicitamente uma publicação do Pages; também tenta novamente quando a última publicação concluída não corresponde ao commit atual. Isso evita depender de um push do robô para iniciar outra execução. As alterações deste workflow estão locais e ainda precisam ser enviadas à branch padrão; sua execução modificada não foi validada remotamente.
- Para atualizar manualmente: instale `pypdf==6.10.0` e execute `python tools/update-market.py`. Para repetir a extração de um PDF oficial local: `python tools/update-market.py --pdf caminho.pdf --period AAAA-MM`. Períodos anteriores ao salvo são recusados.

O catálogo ocupa mais largura e não limita a altura da lista. Exibe 50 motos por padrão e oferece 100 por página, com preferência salva na conta, sincronizada e incluída no backup completo.

## Precificação

A aba **Precificação** segue o tema claro/escuro do site e compara ML Premium, ML Clássico, e-commerce 6x, e-commerce 3x e loja. Os dois exemplos iniciais foram adaptados do HTML fornecido; suas taxas são exemplos editáveis, não tarifas oficiais atualizadas.

**Conferir taxas de um preço conhecido** é o primeiro painel, antes dos produtos, e abre por padrão. Fechar ou abrir o painel mantém a preferência salva.

1. Preencha **custo, frete, imposto e lucro desejado** no produto. Os cinco preços e lucros aparecem enquanto você digita, sem botão para calcular. Frete, embalagem e outros custos vazios contam como zero.
2. Use os atalhos de lucro (0%, 10%, 15%, 20%, 25%) ou informe outro percentual. Enter avança para o próximo campo. **Novo produto** já posiciona o cursor no custo.
3. Embalagem, taxas por canal e cenários extras ficam recolhidos; abra somente quando precisar. O cenário escolhido sincroniza imposto e lucro entre os campos rápidos e a comparação. A margem é percentual do preço de venda, não acréscimo sobre o custo.
4. As alterações válidas são salvas automaticamente neste navegador; **Salvar preferências** grava imediatamente. Um produto incompleto preserva seus últimos valores válidos sem impedir a gravação dos outros produtos. O aviso identifica o produto e o campo pendente; **Revisar campo pendente** abre o painel e posiciona o cursor para corrigir. Recarregar recupera as simulações, faixas e taxas.
5. **Exportar/Importar preferências** permite guardar ou transferir um JSON. **Exportar preços CSV** leva todas as comparações para uma planilha. O backup completo do catálogo também inclui a precificação.

A organização também é salva: produtos expandidos/recolhidos, preferências gerais, custos extras, comissões, cenários e detalhes de cada preço. **Expandir todos/Recolher todos** organiza os produtos em um clique. Mesmo com um campo de custo inválido, recolher um painel guarda sua posição e preserva os últimos valores válidos. Backups antigos permanecem compatíveis. Backup, exportações e salvamento manual ficam agrupados em **Backup e exportação**.

O preço é `(custos + tarifa fixa do canal) / (1 - (comissão + taxa operacional + imposto + margem) / 100)`, arredondado para cima ao próximo centavo, real inteiro ou final ,99. Uma soma igual ou superior a 100% não gera preço. O ajuste negativo da loja representa um crédito percentual, conforme o arquivo de origem; configure zero quando esse crédito não existir na sua operação. A conferência de um preço conhecido calcula cada taxa isoladamente, sem somá-la às simulações.

Os dados e a organização da precificação são guardados por conta e sincronizados automaticamente no Supabase. O indicador da conta informa quando há alterações apenas neste dispositivo. Exporte um backup antes de limpar o navegador se houver envios pendentes. O arquivo HTML original não foi alterado.

## Verificação

O visual usa grafite e amarelo, com componentes consistentes no login, catálogo, notas, visão geral, painel ABC e precificação. `css/upgrade.css` concentra as cores, composição, espaçamentos e adaptações por tamanho de tela. O símbolo em `assets/brand-mark.svg` acompanha a identidade do favicon. Ícones de navegação usam SVG; a indicação da página atual também está disponível para leitores de tela. As fontes possuem alternativas locais quando a conexão com o serviço de fontes falha.

O símbolo da marca reúne uma ficha de catálogo e uma moto; o favicon usa a mesma composição. O botão ao lado do título da página recolhe ou expande o menu. Em computador e tablet, o modo recolhido mantém os ícones acessíveis; no celular, oculta a navegação até a próxima expansão. A preferência é salva na conta, sincronizada e incluída nos backups, preservando a escolha após recarregar. Se a gravação falhar, o menu mantém o estado anterior.

O upgrade visual foi conferido no Edge sem janela, carregando os arquivos locais com dados de demonstração. As cinco abas visíveis foram verificadas em 1440, 768 e 390 pixels, sem erros de JavaScript ou transbordamento horizontal da página. Login, tema escuro e formulário de cadastro também foram inspecionados. Essa conferência visual não utiliza contas reais nem verifica a entrega de e-mails.

`npm test` valida inicialização, navegação, busca, paginação, cadastro, classificação, notas, exclusão simples e em lote, persistência após recarga, filtros favoritos, colunas, cartões, backups, recuperação, edição em lote, cancelamento e falhas de armazenamento. `npm run check` verifica a sintaxe dos arquivos JavaScript e os recursos locais do HTML.

Os testes funcionais usam um DOM simulado e complementam a inspeção visual descrita acima. A prévia no navegador carregou arquivos locais com serviços de conta simulados; não houve teste de entrega de e-mails reais.

## Integrações

O projeto possui login, cadastro por e-mail, recuperação de senha e sincronização individual no Supabase **Master-moto**. A tabela, políticas de isolamento e função de gravação já foram criadas no projeto confirmado. Preferências, catálogo, estrelas, notas, favoritos, precificação e organização dos painéis acompanham a conta. Dados locais antigos só são importados mediante escolha explícita da conta de destino.

Consulte [o guia de ativação](docs/SUPABASE.md) para conferir os endereços dos e-mails e SMTP antes da publicação. A entrega real dos e-mails e a inspeção visual em navegador permanecem pendentes. Nenhuma publicação foi realizada nesta implementação. A integração com Bling permanece futura.

## Correções e facilidades da revisão

- Cadastro e exclusão gravam catálogo, notas, perfis e notas do guia juntos. Uma falha tenta restaurar os valores anteriores e mantém o formulário editável. Curvas individuais e em lote e notas de componentes só mudam na sessão após a gravação.
- **Ver aplicações** no ranking filtra pela família completa, incluindo equivalências revisadas; esse filtro pode ser salvo nos favoritos. Cartões identificam curvas automáticas e ajustes manuais.
- **Cadastrar** no ranking abre o formulário preenchido. CG 160 Fan (2025), Biz 125 (2025), Pop 110i ES (2025) e NXR 160 Bros (2026) têm referências do fabricante. Outros modelos exigem conferência de cilindrada, motor, categoria e anos. O cadastro não afirma compatibilidade universal de peças.
- Paginação e ordenação atualizam o catálogo sem refazer os painéis de notas e estatísticas. A precificação mantém entradas rápidas, comparação imediata e organização salva.
- CSVs do catálogo, preços e ranking compartilham a neutralização de fórmulas em campos de texto, incluindo espaços e sinais iniciais. Números negativos continuam números. Alguns importadores podem remover essa proteção; confira antes de reexportar.
- Execute `python -B tests/update_market_test.py` para testar extrações incompletas, linhas ilegíveis e valores mensais zero. Os testes exigem `pypdf==6.10.0`; o workflow instala essa versão antes de executá-los.

Referências dos modelos: [CG 160 2025](https://saladeimprensa.honda.com.br/releases/honda-cg-160-2025-nova-geracao-da-motocicleta-preferida-dos-brasileiros-traz-importantes), [Biz 125](https://saladeimprensa.honda.com.br/motocicletas/street/biz-125), [Pop 110i](https://saladeimprensa.honda.com.br/motocicletas/street/pop-110i) e [Bros 2026](https://prodsalaimp.honda.com.br/releases/honda-nxr-160-bros-2026-nova-cor-para-versao-cbs). A solicitação automática da publicação segue a [API oficial do GitHub Pages](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build).
