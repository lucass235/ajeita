#!/usr/bin/env bash
# Controle manual EXCLUSIVO do servico ajeita-bot.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/guard.sh"
if [ "$#" -lt 2 ]; then
  echo "Uso: bash cloudrun/panico.sh <projeto-ajeita> {status|parar|ligar|apagar} [--execute]"; exit 2
fi
PROJECT_ID="$1"
ACTION="${2,,}"
if [ "$ACTION" = excluir ]; then ACTION=apagar; fi
validate_project_id "$PROJECT_ID"
if ! [[ "$ACTION" =~ ^(status|parar|ligar|apagar)$ ]]; then echo "Acao invalida"; exit 2; fi
echo "Projeto=$PROJECT_ID | Servico=ajeita-bot | Acao=$ACTION"
if [ "$#" -lt 3 ] || [ "$3" != "--execute" ]; then echo "SIMULACAO: nada alterado. Acrescente --execute."; exit 0; fi
command -v gcloud >/dev/null || { echo "gcloud nao encontrado"; exit 2; }
verify_project
verify_service
if [ "$ACTION" = "status" ]; then
  gcloud run services describe ajeita-bot --project="$PROJECT_ID" --region=southamerica-east1 \
    --format="yaml(metadata.name,metadata.annotations,status.url,status.conditions)"
  echo 'STATUS acima mostra configuracao e saude do deploy; WhatsApp conectado exige /pair autenticado.'
elif [ "$ACTION" = "parar" ]; then
  gcloud run services update ajeita-bot --project="$PROJECT_ID" --region=southamerica-east1 --scaling=0
  # Tags podem manter revisoes acessiveis mesmo com scaling=0.
  gcloud run services update-traffic ajeita-bot --project="$PROJECT_ID" --region=southamerica-east1 --clear-tags
  gcloud run services describe ajeita-bot --project="$PROJECT_ID" --region=southamerica-east1 --format='yaml(metadata.annotations,status.traffic)'
  echo "Parada solicitada; aguarde encerramento e confira instancias no Console. Conferir custos residuais no billing."
elif [ "$ACTION" = "ligar" ]; then
  echo "LIGAR inicia cobranca continua de CPU/RAM ate voce parar."
  read -r -p "Digite LIGAR AJEITA: " CONFIRM
  [ "$CONFIRM" = "LIGAR AJEITA" ] || { echo "Cancelado"; exit 2; }
  gcloud run services update ajeita-bot --project="$PROJECT_ID" --region=southamerica-east1 --scaling=1
  echo "AJEITA ligado. Mantenha o controle de gastos."
elif [ "$ACTION" = "apagar" ]; then
  echo "APAGAR nao remove bucket, imagem, secrets, logs. Ainda pode haver custos."
  read -r -p "Digite APAGAR AJEITA: " CONFIRM
  [ "$CONFIRM" = "APAGAR AJEITA" ] || { echo "Cancelado"; exit 2; }
  gcloud run services delete ajeita-bot --project="$PROJECT_ID" --region=southamerica-east1 --quiet
  echo "Servico excluido. Revise recursos residuais."
fi

