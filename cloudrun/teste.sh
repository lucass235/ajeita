#!/usr/bin/env bash
# Janela controlada: manter este terminal aberto. Nao e corte financeiro garantido.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/guard.sh"
PROJECT_ID="${1:?Informe projeto AJEITA}"
validate_project_id "$PROJECT_ID"
if [ "${2:-}" != --execute ]; then
  echo 'SIMULACAO: liga uma instancia por ate 30 minutos; depois solicita parada.'
  exit 0
fi
verify_project
bash "$SCRIPT_DIR/verificar-orcamento.sh" "$PROJECT_ID"
stop_test() { bash "$SCRIPT_DIR/panico.sh" "$PROJECT_ID" parar --execute; }
trap stop_test EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
bash "$SCRIPT_DIR/panico.sh" "$PROJECT_ID" ligar --execute
echo 'Teste de 30 minutos. CTRL+C solicita parada imediata. Mantenha o terminal aberto.'
echo 'A queda abrupta do terminal pode impedir a parada. Console: Scaling > Manual > 0.'
for ((minute=1; minute<=30; minute++)); do
  sleep 60 &
  wait "$!"
  echo "Minuto $minute/30"
done
