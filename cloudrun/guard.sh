#!/usr/bin/env bash
# Compartilhado somente pelos controles do AJEITA. Nunca altera projeto global.
set -euo pipefail
validate_project_id() {
  [[ "$1" =~ ^ajeita-[a-z][a-z0-9-]{3,22}$ ]] || { echo 'BLOQUEADO: ID de projeto AJEITA invalido.' >&2; exit 2; }
}
verify_project() {
  validate_project_id "$PROJECT_ID"
  command -v gcloud >/dev/null || { echo 'gcloud nao encontrado' >&2; exit 2; }
  local app
  app="$(gcloud projects describe "$PROJECT_ID" --format='value(labels.app)')"
  [ "$app" = ajeita ] || { echo 'BLOQUEADO: projeto sem label app=ajeita. Confira o isolamento.' >&2; exit 2; }
}
verify_service() {
  local app
  app="$(gcloud run services describe ajeita-bot --project="$PROJECT_ID" --region=southamerica-east1 --format='value(metadata.labels.app)')"
  [ "$app" = ajeita ] || { echo 'BLOQUEADO: servico sem label app=ajeita.' >&2; exit 2; }
}
