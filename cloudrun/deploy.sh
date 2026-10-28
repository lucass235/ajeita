#!/usr/bin/env bash
# AJEITA: deploy DESLIGADO, exclusivamente em projeto dedicado.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/guard.sh"
cd "$SCRIPT_DIR/.."
if [ "$#" -lt 1 ]; then echo "Uso: GCS_AUTH_BUCKET=... bash cloudrun/deploy.sh <projeto-ajeita> [--execute]"; exit 2; fi
PROJECT_ID="$1"
validate_project_id "$PROJECT_ID"
BUCKET="$(printenv GCS_AUTH_BUCKET || true)"
if [ -z "$BUCKET" ]; then echo "Defina GCS_AUTH_BUCKET (bucket exclusivo para sessao)."; exit 2; fi
echo "AJEITA | projeto=$PROJECT_ID | Cloud Run em SP | 1 vCPU/2GiB | instancia inicial=0"
if [ "$#" -lt 2 ] || [ "$2" != "--execute" ]; then
  echo "SIMULACAO: nao criou nada nem iniciou cobranca. Use --execute so depois da aprovacao."
  exit 0
fi
if [ "$(printenv BUDGET_REVIEWED || true)" != "YES" ]; then
  echo "BLOQUEADO: configure antes alertas de USD 5; depois use BUDGET_REVIEWED=YES." >&2
  echo "Isso nao verifica o orcamento na API nem garante teto de custos." >&2
  exit 2
fi
command -v gcloud >/dev/null || { echo "gcloud nao encontrado"; exit 2; }
verify_project
bash "$SCRIPT_DIR/verificar-orcamento.sh" "$PROJECT_ID"
gcloud iam service-accounts describe "ajeita-runtime@$PROJECT_ID.iam.gserviceaccount.com" \
  --project="$PROJECT_ID" --format="value(email)" >/dev/null
gcloud secrets describe "ajeita-admin-token" --project="$PROJECT_ID" >/dev/null
gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
BUCKET_PROJECT="$(gcloud storage buckets describe "gs://$BUCKET" --format='value(project_number)')"
[ "$BUCKET_PROJECT" = "$PROJECT_NUMBER" ] || { echo 'BLOQUEADO: bucket pertence a outro projeto.' >&2; exit 2; }
gcloud run deploy ajeita-bot \
  --project="$PROJECT_ID" --region=southamerica-east1 --platform=managed \
  --source=. --execution-environment=gen2 \
  --service-account="ajeita-runtime@$PROJECT_ID.iam.gserviceaccount.com" \
  --memory=2Gi --cpu=1 --concurrency=1 --timeout=300 \
  --no-cpu-throttling --scaling=0 --max-instances=1 --allow-unauthenticated \
  --labels=app=ajeita,env=teste \
  --set-env-vars="GCS_AUTH_BUCKET=$BUCKET,CHROME_NO_SANDBOX=true,AUTH_DATA_PATH=/tmp/ajeita-auth,CHROME_PATH=/usr/bin/chromium,PYTHON_BIN=/opt/venv/bin/python,ALLOW_OTHER_PEOPLE=true,ALLOW_GROUPS=false,MAX_QUEUE=5,CHAT_COOLDOWN_SECONDS=30" \
  --set-secrets="ADMIN_TOKEN=ajeita-admin-token:latest"
echo "Deploy criado DESLIGADO (zero instancias). Build/imagem/bucket podem ter custos residuais."

