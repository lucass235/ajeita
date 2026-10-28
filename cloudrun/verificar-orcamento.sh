#!/usr/bin/env bash
# Leitura somente. Falha fechada; valores devem ser os aprovados na moeda da conta.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/guard.sh"
PROJECT_ID="${1:?Informe projeto}"
verify_project
: "${AJEITA_BUDGET_AMOUNT:?Defina o valor aprovado do equivalente a USD 5 na moeda da conta}"
: "${AJEITA_BUDGET_CURRENCY:?Defina USD, BRL ou moeda da conta}"
number="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
billing="$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingAccountName)')"
[ -n "$billing" ] || { echo 'Sem conta de faturamento.' >&2; exit 2; }
gcloud billing budgets list --billing-account="${billing#billingAccounts/}" --format=json |
  python3 "$(dirname "${BASH_SOURCE[0]}")/verificar-orcamento.py" "$number" "$AJEITA_BUDGET_AMOUNT" "$AJEITA_BUDGET_CURRENCY"
