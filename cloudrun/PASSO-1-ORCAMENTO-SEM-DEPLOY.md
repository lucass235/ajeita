# Passo 1 — Projeto e orçamento antes de ativar AJEITA

**Estado esperado após este passo:** projeto dedicado criado, orçamento e alertas definidos; **nenhum Cloud Run, serviço, contêiner, VM, bucket ou segredo implantado**. O bot continua desligado.

## Alternativa automatizada via Cloud Shell (sem deploy)

Arquivo: [configurar-projeto-orcamento.sh](configurar-projeto-orcamento.sh).

O script pode ser executado no Google Cloud Shell com a conta autenticada. Pede o ID de faturamento no proprio terminal (nao compartilhe aqui), identifica a moeda, pede um ID unico de projeto e apresenta um resumo.

- Modo padrao **SIMULACAO**: `bash configurar-projeto-orcamento.sh`.
- Execucao efetiva, **somente apos revisao do resumo**: `bash configurar-projeto-orcamento.sh --execute`.
- No modo real, exige digitacao de `CRIAR AJEITA`, cria somente projeto, vincula billing e cria orcamento mensal de alertas 50/80/100. Se a criacao do budget falhar, tenta desvincular o faturamento por seguranca.
- Se a conta cobrar em BRL ou outra moeda diferente de USD, solicita que voce informe, na moeda da conta, um valor equivalente a US$ 5. Nao realiza conversao cambial automatica.
- **NAO cria Spend Cap de Cloud Run**. A opcao deve ser ativada separadamente no console, se elegivel, antes do primeiro deploy.
- Nao cria Cloud Run, VM, bucket, containers ou qualquer instancia ativa.

---

## 1. Criar projeto GCP dedicado

1. Abrir https://console.cloud.google.com/projectcreate
2. Nome de exibição sugerido: **AJEITA Teste**.
3. ID único de projeto deve começar por `ajeita-` (ex.: `ajeita-teste-12345`; não presumir que esteja livre).
4. Confirmar que o projeto novo não é o projeto do App_OS/Ebenezer e copiar o **ID do projeto** (não o número).
5. Se necessário para usar serviços mais tarde, associar a conta de faturamento existente ao novo projeto. **Somente projeto e orçamento, sem habilitar serviços nem publicar recursos nesta fase.**

## 2. Orçamento geral (meta: US$ 5 mensais)

1. Abrir https://console.cloud.google.com/billing e selecionar a conta de faturamento.
2. Em **Orçamentos e alertas / Budgets & alerts**, selecionar **Criar orçamento**.
3. Nome: `AJEITA — orçamento mensal`.
4. Escopo: **exclusivamente o novo projeto AJEITA**; todos os serviços. Periodicidade: mensal.
5. Valor: **US$ 5 equivalente na moeda configurada para sua conta de faturamento**. Se o console estiver em BRL, converta antes e registre a taxa/data utilizada.
6. Alertas sugeridos: 50%, 80% e 100%; verifique recipients e emails.
7. Conferir que o orçamento NÃO abrange o App_OS e que ele foi criado na conta correta.

**O orçamento de alertas NÃO desativa recursos e NÃO é um teto máximo de cobrança.**

## 3. Spend cap específico do Cloud Run (caso a opção exista)

1. Na mesma área de Orçamentos, verificar opção **Spend cap enforcement** ao criar **um segundo orçamento**.
2. Selecionar **somente o projeto AJEITA** e **somente o serviço Cloud Run**, período mensal.
3. Meta sugerida: **US$ 4 equivalente**, reservando alguma margem para build, storage e logs.
4. Concluir e confirmar se a proteção foi efetivamente ativada.
5. Se a opção não aparecer, NÃO assumir que existe teto: permanecer apenas com alertas e teste supervisionado por duração curta.

**Atenção:** a pausa do spend cap pode atrasar e exceder o valor. Serviços auxiliares podem cobrar à parte; o cap não é garantia de limite total de US$ 5.

Documentação oficial:
- https://docs.cloud.google.com/billing/docs/how-to/budgets
- https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps
- https://docs.cloud.google.com/run/docs/configuring/services/manual-scaling
- https://cloud.google.com/run/pricing

## 4. Verificação antes do primeiro deploy

- [ ] Projeto com ID `ajeita-...` criado, **distinto do App_OS**.
- [ ] Orçamento de alerta de US$ 5 (ou equivalente) para **todos os serviços** do novo projeto.
- [ ] Confirmados emails de alertas 50%, 80% e 100%.
- [ ] Spend cap específico Cloud Run de US$ 4 (ou equivalente) ativado, **se elegível**, ou registrado que não está disponível.
- [ ] Nenhum serviço Cloud Run criado.
- [ ] Nenhum container, bucket, máquina virtual ou secret criado.
- [ ] Confirmada uma janela curta de teste antes de qualquer recurso pago.

## 5. Como continuar no chat

Informe apenas o **ID do novo projeto GCP** (não é uma credencial) e se apareceram as opções **Alertas somente** e **Spend cap enforcement**. **Não compartilhe** senha, token, chave JSON, QR Code ou login.

Depois poderemos revisar a configuração de acesso com menor privilégio e comandos de deploy, sempre simulados por padrão e sem executar nada pago sem autorização específica.

## Botão de pânico preparado no GitHub

Arquivo: `cloudrun/panico.sh`. Por padrão, SEM `--execute` o comando **apenas simula**. Quando um serviço estiver realmente publicado, `parar` usa `--scaling=0`, o que encerra instâncias do AJEITA. O serviço ainda não existe neste passo. A exclusão do Cloud Run não remove bucket, imagens, segredos ou logs.

**Importante:** no WhatsApp normal com `whatsapp-web.js`, o bot precisará estar ligado para perceber `ajeita`. Cloud Run desligado não acorda por mensagem do WhatsApp.
