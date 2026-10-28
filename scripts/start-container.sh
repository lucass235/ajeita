#!/bin/sh
set -eu

AUTH_DATA_PATH="${AUTH_DATA_PATH:-/data/whatsapp}"
export AUTH_DATA_PATH

# Railway monta o volume como root. Corrigir a pasta e baixar os privilegios
# antes de iniciar o navegador ou processar qualquer video.
if [ "$(id -u)" = 0 ]; then
    mkdir -p "$AUTH_DATA_PATH" /data/tiktok
    chown -R node:node "$AUTH_DATA_PATH"
    chown node:node /data /data/tiktok
    exec env HOME=/home/node XDG_CONFIG_HOME=/home/node/.config XDG_CACHE_HOME=/home/node/.cache \
        setpriv --reuid=node --regid=node --init-groups sh "$0" "$@"
fi

mkdir -p "$AUTH_DATA_PATH"
# A trava do sistema so e liberada quando o processo termina. Assim uma
# segunda instancia nao remove os locks de um Chromium ainda em execucao.
exec 9>"$AUTH_DATA_PATH/.ajeita-runtime.lock"
if ! flock -n 9; then
    echo 'Outra instancia do AJEITA esta usando esta sessao.' >&2
    exit 1
fi
for name in SingletonLock SingletonCookie SingletonSocket; do
    lock="$AUTH_DATA_PATH/session-ajeita/$name"
    if [ -L "$lock" ]; then rm -f "$lock"; fi
done

exec tini -s -- "$@"
