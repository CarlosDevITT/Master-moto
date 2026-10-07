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

- **Backup completo** baixa um JSON com motos, notas, classificações comerciais, notas de componentes, filtros favoritos, colunas, visualização e tema. Ele inclui toda a base, mesmo quando a busca mostra apenas algumas motos.
- **Restaurar backup** permite escolher esse JSON e conferir as quantidades antes de confirmar. Dados inválidos e IDs duplicados são recusados. A base atual é substituída; a versão anterior fica disponível em **Recuperar base anterior**, inclusive após recarregar. Você também pode baixar um backup atual antes da confirmação. Essa recuperação permanece no navegador e não substitui a cópia exportada.
- **Colunas** permite ocultar informações da tabela. Modelo, seleção e ações permanecem disponíveis. Use **Mostrar todas** para retornar à tabela completa.
- **Salvar filtro** guarda busca, filtros, ordenação e quantidade por página. Escolha um nome de até 60 caracteres. Salvar novamente com o mesmo nome atualiza o favorito. Escolha um favorito na lista para reaplicá-lo ou use **Remover favorito**.
- **Tabela / Cartões** muda a visualização mantendo busca, paginação e seleção. Sem preferência manual, o celular usa cartões automaticamente. Cada cartão oferece seleção, edição, notas e classificação de curva.
- **Editar selecionados** aparece na barra de seleção. Selecione motos na tabela ou nos cartões, inclusive em páginas diferentes, e altere categoria, perfil, faixa ou curva. **Manter atual** preserva o campo; as opções automáticas removem apenas os ajustes manuais de perfil/faixa. Fechar ou cancelar não modifica os registros.

Preferências e filtros favoritos permanecem no navegador após recarregar. As gravações de restauração e edição em lote verificam todas as partes antes de atualizar a tela e tentam reverter os dados se uma gravação falhar. Exporte um backup para manter uma cópia fora do navegador.

## Verificação

`npm test` valida inicialização, navegação, busca, paginação, cadastro, classificação, notas, exclusão simples e em lote, persistência após recarga, filtros favoritos, colunas, cartões, backups, recuperação, edição em lote, cancelamento e falhas de armazenamento. `npm run check` verifica a sintaxe dos arquivos JavaScript e os recursos locais do HTML.

Os testes usam um DOM simulado; não substituem a inspeção visual em um navegador real. A tentativa de abrir a prévia no navegador conectado nesta revisão não conseguiu acessar o servidor local.

## Integrações

O repositório não contém integração com Supabase, autenticação ou servidor de aplicação. Os projetos Supabase disponíveis no conector não foram identificados como pertencentes ao Master Motos. A consulta Vercel não encontrou projeto ligado ao repositório. Nenhum banco remoto foi alterado e nenhuma publicação foi feita.

Para hospedar, publique os arquivos estáticos da raiz. A publicação não transforma o armazenamento local em banco compartilhado. A integração com Bling mencionada no projeto permanece futura.
