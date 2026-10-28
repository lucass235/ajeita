#!/usr/bin/env bash
# Configura somente projeto e budget (NUNCA Cloud Run, VM, container, bucket ou segredo).
# Por padrao SIMULA. Necessario --execute para criar recursos.
set -euo pipefail
MODE="PREVIEW"
if [ "$#" -ge 1 ] && [ "$1" = "--execute" ]; then MODE="EXECUTE"; fi

echo "=== AJEITA | Configuracao inicial de projeto e orcamento ==="
echo "Esta ferramenta NAO implanta ou inicia o bot."
echo "Modo: $MODE"
command -v gcloud >/dev/null 2>&1 || { echo "ERRO: execute no Google Cloud Shell (gcloud nao encontrado)."; exit 2; }
echo
gcloud auth list --filter="status:ACTIVE" --format="table(account,status)" || true
echo
gcloud billing accounts list --format="table(name,displayName,open)"
echo
read -r -p "Escolha o ID da conta de faturamento (somente no Cloud Shell): " BILLING_INPUT
BILLING_ID="$(printf '%s' "$BILLING_INPUT" | sed 's#^billingAccounts/##')"
if ! [[ "$BILLING_ID" =~ ^[A-Za-z0-9-]{6,45}$ ]]; then echo "ID de faturamento invalido."; exit 2; fi

# A conta de faturamento nao expoe currencyCode no gcloud billing accounts describe.
# Valor do budget sem sufixo usa automaticamente a moeda da conta.
echo "Meta mensal: equivalente a US\$ 5."
echo "Confira a moeda de faturamento no Console Google Cloud (Billing)."
echo "O valor abaixo DEVE estar na moeda da sua conta (ex.: 5.00 se USD)."
read -r -p "Valor mensal na moeda da conta (decimal com ponto): " BUDGET_AMOUNT
if ! python3 -c 'import sys,decimal; v=decimal.Decimal(sys.argv[1]); assert v>0 and v<10000 and v.as_tuple().exponent >= -2 and v.is_finite()' "$BUDGET_AMOUNT" 2>/dev/null; then
  echo "Valor invalido. Nenhuma alteracao foi realizada."; exit 2
fi
read -r -p "Codigo da moeda da sua conta (ex.: USD ou BRL; para registro): " CURRENCY
if ! [[ "$CURRENCY" =~ ^[A-Z]{3}$ ]]; then echo "Moeda invalida."; exit 2; fi

echo
read -r -p "ID unico do novo projeto (iniciado por ajeita-, de 6 a 30 caracteres): " PROJECT_ID
if ! [[ "$PROJECT_ID" =~ ^ajeita-[a-z][a-z0-9-]{3,22}$ ]]; then
  echo "ID invalido. Use 'ajeita-' mais letras, numeros ou hifens."; exit 2
fi
if gcloud projects describe "$PROJECT_ID" --format="value(projectId)" >/dev/null 2>&1; then
  echo "O projeto $PROJECT_ID JA EXISTE. Por seguranca, este script nao altera projetos existentes."
  exit 2
fi
echo
echo "RESUMO:"
echo "  Novo projeto = $PROJECT_ID"
echo "  Nome = AJEITA Teste"
echo "  Conta de faturamento = $BILLING_ID"
echo "  Orçamento mensal de alertas = $BUDGET_AMOUNT $CURRENCY"
echo "  Alertas: 50% / 80% / 100%"
echo "  Nenhum Cloud Run, VM, bucket, armazenamento ou segredo sera criado."
echo "  Orçamento nao e um teto automatico."
echo "  Spend Cap Cloud Run (se disponivel) deve ser feito depois no Console."

if [ "$MODE" != "EXECUTE" ]; then
  echo
  echo "SIMULACAO CONCLUIDA: nenhuma alteracao foi feita."
  echo "Quando quiser executar: bash configurar-projeto-orcamento.sh --execute"
  exit 0
fi

echo
read -r -p "Para CRIAR o projeto e ASSOCIAR ao faturamento, digite CRIAR AJEITA: " CONFIRM
if [ "$CONFIRM" != "CRIAR AJEITA" ]; then echo "Cancelado, nenhuma alteracao."; exit 2; fi

gcloud projects create "$PROJECT_ID" --name="AJEITA Teste"
gcloud projects update "$PROJECT_ID" --update-labels=app=ajeita
echo "Projeto criado: $PROJECT_ID"
# API de orçamento e gratuita. Nao cria nenhum serviço de processamento.
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ID"
if ! gcloud services enable billingbudgets.googleapis.com --project="$PROJECT_ID"; then
  gcloud billing projects unlink "$PROJECT_ID" --quiet
  exit 1
fi
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
echo "Conta de faturamento vinculada."
# Comandos budget documentados em
# https://docs.cloud.google.com/sdk/gcloud/reference/billing/budgets/create
if ! gcloud billing budgets create \
  --billing-account="$BILLING_ID" \
  --display-name="AJEITA mensal - alertas" \
  --project="$PROJECT_ID" \
  --budget-amount="${BUDGET_AMOUNT}${CURRENCY}" \
  --calendar-period=month \
  --filter-projects="projects/$PROJECT_NUMBER" \
  --threshold-rule=percent=0.50 \
  --threshold-rule=percent=0.80 \
  --threshold-rule=percent=1.00; then
  echo "ERRO: nao foi possivel criar o orcamento! Desvinculando faturamento para impedir uso cobrado sem alertas." >&2
  gcloud billing projects unlink "$PROJECT_ID" --quiet || echo "ALERTA: desvincule manualmente o faturamento do projeto $PROJECT_ID!" >&2
  exit 1
fi

echo
echo "SUCESSO: orcamento de alertas criado para o projeto AJEITA."
echo "Verifique no Console -> Billing -> Budgets, com o filtro SOMENTE do projeto."
echo "Tarefa opcional pendente: Spend Cap de Cloud Run, caso elegivel."
echo "O AJEITA permanece NAO IMPLANTADO, sem container e sem instancia ativa."
echo "Guarde o ID do projeto para a proxima etapa."

