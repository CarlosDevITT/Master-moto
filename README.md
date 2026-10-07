# Master Motos

Catálogo de aplicações de motos com busca, filtros, cadastro, classificação comercial, notas e exportação de aplicações.

## Executar

Com Node.js instalado, execute `npm run dev` e abra <http://localhost:4173>. O aplicativo é estático e não precisa de dependências para funcionar. Para instalar as dependências de teste, execute `npm ci`.

## Dados

- A base inicial contém 464 motos, em `js/data.js`, extraídas de `Data/MASTER_MOTOS_v6.xlsx`.
- Cadastros, exclusões, classificações, notas e preferência de tema são salvos **no navegador atual**. Não existe sincronização com outros dispositivos ou contas.
- A aba Produtos importados foi retirada. Os arquivos de origem continuam preservados no repositório.
- A busca combina termos em qualquer ordem (ex.: `Honda 250 2020`) e considera marca, modelo, cilindrada, motor e ano de aplicação.
- Notas podem ser exportadas e importadas em JSON. O catálogo filtrado e os títulos podem ser exportados em CSV.
- **Restaurar base** remove cadastros e notas locais e restaura a planilha original, após confirmação.

Para atualizar a base de motos a partir da planilha, execute `./tools/extract-data.ps1` no PowerShell. Para conferir uma extração sem sobrescrever a base, use `./tools/extract-data.ps1 -ExportPath ./arquivo-temporario.js`.

## Ferramentas do Catálogo

- **Backup completo** baixa um JSON com motos, notas, classificações comerciais, notas de componentes, filtros favoritos, colunas, visualização, tema e preferências de precificação. Ele inclui toda a base, mesmo quando a busca mostra apenas algumas motos. Backups antigos sem precificação preservam as preferências atuais da calculadora.
- **Restaurar backup** permite escolher esse JSON e conferir as quantidades antes de confirmar. Dados inválidos e IDs duplicados são recusados. A base atual é substituída; a versão anterior fica disponível em **Recuperar base anterior**, inclusive após recarregar. Você também pode baixar um backup atual antes da confirmação. Essa recuperação permanece no navegador e não substitui a cópia exportada.
- **Colunas** permite ocultar informações da tabela. Modelo, seleção e ações permanecem disponíveis. Use **Mostrar todas** para retornar à tabela completa.
- **Salvar filtro** guarda busca, filtros, ordenação e quantidade por página. Escolha um nome de até 60 caracteres. Salvar novamente com o mesmo nome atualiza o favorito. Escolha um favorito na lista para reaplicá-lo ou use **Remover favorito**.
- **Tabela / Cartões** muda a visualização mantendo busca, paginação e seleção. Sem preferência manual, o celular usa cartões automaticamente. Cada cartão oferece seleção, edição, notas e classificação de curva.
- **Editar selecionados** aparece na barra de seleção. Selecione motos na tabela ou nos cartões, inclusive em páginas diferentes, e altere categoria, perfil, faixa ou curva. **Manter atual** preserva o campo; as opções automáticas removem apenas os ajustes manuais de perfil/faixa. Fechar ou cancelar não modifica os registros.

Preferências e filtros favoritos permanecem no navegador após recarregar. As gravações de restauração e edição em lote verificam todas as partes antes de atualizar a tela e tentam reverter os dados se uma gravação falhar. Exporte um backup para manter uma cópia fora do navegador.

## Curva ABC Brasil e anúncios

A aba **Curva ABC Brasil** usa o relatório público da Fenabrave, com 77 modelos/famílias publicados nos rankings por segmento de setembro de 2026. A amostra cobre 93,55% dos emplacamentos nacionais acumulados no ano. A curva usa o volume **da amostra publicada**, não o total de peças vendidas no Mercado Livre nem a frota em circulação: A até atingir 80%, B até atingir 95%, C restante. O modelo que cruza o limite permanece na faixa anterior. Filtros não alteram essas classificações.

O painel mostra fonte, período, cobertura, acumulado, mês atual, variação mensal e lacunas no catálogo. A correspondência com aplicações usa nomes exatos e equivalências revisadas em `js/market-engine.js`; cilindradas parecidas não são confundidas. Modelos sem correspondência ficam sem curva automática. Ajustes manuais de curva têm prioridade; remover o ajuste retorna à curva automática quando disponível.

No **Gerador de títulos**, escolha **Curva A do mercado** ou **Ranking de mercado** e informe a peça. A lista é ordenada pelo volume nacional acumulado. Os títulos preservam os anos cadastrados, sem inventar adjetivos de qualidade. Títulos longos são sinalizados e não podem ser copiados/exportados até reduzir o nome da peça. Faixa de valor é um filtro de posicionamento comercial, não uma validação de compatibilidade física. Nenhum anúncio é publicado automaticamente.

### Atualização automática

- O navegador verifica `Data/market-sales.json` ao abrir, ao voltar à página após seis horas e a cada seis horas com o site ativo. Mantém o último ranking válido para falhas de conexão e informa período antigo ou falha de atualização.
- `.github/workflows/market-data.yml` consulta a página oficial diariamente às 09h UTC, baixa o relatório mais recente e atualiza o JSON apenas após conferir tabelas, totais e duplicações. Mudanças no formato da fonte geram falha sem substituir a base anterior. O workflow precisa estar na branch padrão do GitHub com Actions e permissão de escrita habilitados. Ele está preparado localmente; não foi publicado/ativado nesta revisão. A hospedagem precisa publicar os commits de dados para o navegador receber novos períodos.
- Para atualizar manualmente: instale `pypdf==6.10.0` e execute `python tools/update-market.py`. Para repetir a extração de um PDF oficial local: `python tools/update-market.py --pdf caminho.pdf --period AAAA-MM`. Períodos anteriores ao salvo são recusados.

O catálogo ocupa mais largura e não limita a altura da lista. Exibe 50 motos por padrão e oferece 100 por página, com preferência salva no navegador e incluída no backup completo.

## Precificação

A aba **Precificação** segue o tema claro/escuro do site e compara ML Premium, ML Clássico, e-commerce 6x, e-commerce 3x e loja. Os dois exemplos iniciais foram adaptados do HTML fornecido; suas taxas são exemplos editáveis, não tarifas oficiais atualizadas.

1. Preencha **custo, frete, imposto e lucro desejado** no produto. Os cinco preços e lucros aparecem enquanto você digita, sem botão para calcular. Frete, embalagem e outros custos vazios contam como zero.
2. Use os atalhos de lucro (0%, 10%, 15%, 20%, 25%) ou informe outro percentual. Enter avança para o próximo campo. **Novo produto** já posiciona o cursor no custo.
3. Embalagem, taxas por canal e cenários extras ficam recolhidos; abra somente quando precisar. O cenário escolhido sincroniza imposto e lucro entre os campos rápidos e a comparação. A margem é percentual do preço de venda, não acréscimo sobre o custo.
4. As alterações válidas são salvas automaticamente neste navegador; **Salvar preferências** grava imediatamente. Valores inválidos exibem erro e preservam o último salvamento válido. Recarregar recupera as simulações, faixas e taxas.
5. **Exportar/Importar preferências** permite guardar ou transferir um JSON. **Exportar preços CSV** leva todas as comparações para uma planilha. O backup completo do catálogo também inclui a precificação.

A organização também é salva: produtos expandidos/recolhidos, preferências gerais, custos extras, comissões, cenários e detalhes de cada preço. **Expandir todos/Recolher todos** organiza os produtos em um clique. Mesmo com um campo de custo inválido, recolher um painel guarda sua posição e preserva os últimos valores válidos. Backups antigos permanecem compatíveis. Backup, exportações e salvamento manual ficam agrupados em **Backup e exportação**.

O preço é `(custos + tarifa fixa do canal) / (1 - (comissão + taxa operacional + imposto + margem) / 100)`, arredondado para cima ao próximo centavo, real inteiro ou final ,99. Uma soma igual ou superior a 100% não gera preço. O ajuste negativo da loja representa um crédito percentual, conforme o arquivo de origem; configure zero quando esse crédito não existir na sua operação. A conferência de um preço conhecido calcula cada taxa isoladamente, sem somá-la às simulações.

Os dados permanecem no navegador atual, sem sincronização entre dispositivos. Exporte as preferências antes de limpar os dados do navegador. O arquivo HTML original não foi alterado.

## Verificação

`npm test` valida inicialização, navegação, busca, paginação, cadastro, classificação, notas, exclusão simples e em lote, persistência após recarga, filtros favoritos, colunas, cartões, backups, recuperação, edição em lote, cancelamento e falhas de armazenamento. `npm run check` verifica a sintaxe dos arquivos JavaScript e os recursos locais do HTML.

Os testes usam um DOM simulado; não substituem a inspeção visual em um navegador real. A tentativa de abrir a prévia no navegador conectado nesta revisão não conseguiu acessar o servidor local.

## Integrações

O repositório não contém integração com Supabase, autenticação ou servidor de aplicação. Os projetos Supabase disponíveis no conector não foram identificados como pertencentes ao Master Motos. A consulta Vercel não encontrou projeto ligado ao repositório. Nenhum banco remoto foi alterado e nenhuma publicação foi feita.

Para hospedar, publique os arquivos estáticos da raiz. A publicação não transforma o armazenamento local em banco compartilhado. A integração com Bling mencionada no projeto permanece futura.
