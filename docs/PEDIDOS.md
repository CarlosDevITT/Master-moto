# Pedidos de peças — Master Motos

## Objetivo
Gerenciar solicitações de peças por fornecedor com histórico, exportação e conferência de recebimento, preservando os módulos atuais.

## Fornecedores iniciais
Danidrea, ATHENA/VEDAMOTORS, PROX e ORIGINAL KAWASAKI. São sugestões de cadastro, não IDs rígidos. Cada usuário administra seus próprios fornecedores.

## Fluxo
1. Cadastrar/selecionar fornecedor.
2. Criar rascunho com código, descrição, aplicação opcional, quantidade inteira positiva, preço opcional e observação.
3. Revisar e confirmar pedido, atribuindo número único por usuário.
4. Gerar CSV compatível com Excel (primeira etapa), XLSX/PDF (etapa posterior) ou mensagem para WhatsApp.
5. Marcar como enviado **somente mediante confirmação explícita do operador**; abrir WhatsApp não confirma envio.
6. Registrar recebimentos por item; manter saldo pendente e trilha de eventos.
7. Permitir cancelamento controlado, sem apagar histórico.

## Estados
draft -> confirmed -> sent -> partially_received -> received.
Cancelamento permitido a partir de draft, confirmed ou sent, com motivo; pedidos recebidos não são cancelados automaticamente.
Eventos e recebimentos são imutáveis na aplicação; correções exigirão operação auditada.

## Modelo de dados proposto (ainda NÃO aplicado)
- mm_suppliers: id uuid PK, user_id uuid FK auth.users, name, whatsapp_e164, active, created_at, updated_at.
- mm_parts: id uuid PK, user_id, supplier_id opcional, sku, description, motorcycle_application, created_at.
- mm_purchase_orders: id uuid PK, user_id, supplier_id, order_number, status, notes, created_at, updated_at, sent_at.
- mm_purchase_order_items: id uuid PK, user_id, order_id, part_id opcional, sku_snapshot, description_snapshot, application_snapshot, quantity_ordered, quantity_received, unit_price_snapshot.
- mm_order_events: id uuid PK, user_id, order_id, event_type, metadata jsonb, created_at.

## Segurança e integridade
Todas as tabelas terão RLS por auth.uid() = user_id, FKs compostas ou triggers para impedir vínculo entre usuários, restrições de quantidade e valores, índices por user_id/created_at e operação transacional para registrar recebimento. Não confiar no cliente para mudar status, quantidade recebida ou user_id; implementar RPCs SECURITY INVOKER e validar transições no banco. Evitar políticas permissivas de update/delete sobre eventos. Validar telefone E.164; não registrar dados sensíveis em logs.

## Compatibilidade
Não adicionar as novas entidades ao JSON legado mm_user_workspaces; manter o armazenamento atual intacto. Nova migração SQL será aditiva e revisada antes de aplicar. O novo módulo só deve ser ativado na interface após existir backend funcional, testes e tratamento de falhas de rede.

## Entregas
- Etapa 1: motor de domínio puro, validações e testes automatizados.
- Etapa 2: migração aditiva + RLS/RPCs, revisão de segurança.
- Etapa 3: UI integrada à navegação e testes de sessão/isolamento.
- Etapa 4: CSV/XLSX/PDF, WhatsApp, recebimentos, testes ponta a ponta e publicação.
