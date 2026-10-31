# AJEITA no notebook com Docker

Este guia instala o AJEITA em outro computador Windows usando Docker Desktop.
O notebook sera o servidor: ele precisa permanecer ligado, conectado a internet e
sem entrar em suspensao.

## Requisitos

- Windows 10 ou 11 com virtualizacao habilitada.
- Docker Desktop usando WSL 2.
- Git.
- Pelo menos 4 GB de RAM disponivel durante o uso.
- Uma conta ou numero de teste do WhatsApp.

O AJEITA utiliza uma integracao nao oficial com o WhatsApp Web. Isso pode causar
desconexoes ou restricoes. Evite usar inicialmente o seu numero principal.

## 1. Parar a instalacao antiga

Se o bot estiver funcionando em outro computador, pare-o antes:

```powershell
docker compose down
```

Nao acrescente `-v`: essa opcao apaga o volume com a sessao local. Nao execute duas
instalacoes simultaneamente com a mesma conta.

## 2. Instalar Git e Docker

1. Instale o Git: <https://git-scm.com/download/win>.
2. Instale o Docker Desktop: <https://www.docker.com/products/docker-desktop/>.
3. Durante a instalacao, permita o uso do WSL 2.
4. Reinicie o Windows se for solicitado.
5. Abra o Docker Desktop e espere o mecanismo ficar pronto.

## 3. Clonar o repositorio

Abra o PowerShell. Se o AJEITA estiver dentro do App_OS:

```powershell
git clone https://github.com/lucass235/App_OS.git
cd App_OS\services\ajeita
```

Se estiver em um repositorio proprio:

```powershell
git clone URL_DO_REPOSITORIO
cd ajeita
```

Confirme que a pasta possui `Dockerfile`, `docker-compose.yml`, `package.json`,
`src` e `scripts`.

## 4. Criar o arquivo `.env`

Esse arquivo nao fica no Git porque pode conter segredos:

```powershell
Copy-Item .env.example .env
notepad .env
```

Deixe-o assim:

```env
ALLOW_OTHER_PEOPLE=true
ALLOW_GROUPS=false
SEND_PROGRESS=true
REQUEST_DELAY_SECONDS=10
MAX_FILE_MB=100
MAX_DURATION_SECONDS=1200
DOWNLOAD_TIMEOUT_SECONDS=180
MAX_QUEUE=5
MAX_LINKS_PER_REQUEST=5
CHAT_COOLDOWN_SECONDS=30
MAX_LINK_AGE_HOURS=72
ADMIN_TOKEN=troque-por-uma-senha-secreta-com-32-caracteres
```

Troque `ADMIN_TOKEN` por uma senha longa. Nao envie o `.env` ao GitHub.

## 5. Construir e iniciar

```powershell
docker compose up -d --build
```

Na primeira vez, o download das dependencias pode demorar. Confira:

```powershell
docker compose ps
docker compose logs --tail=100 ajeita
```

O conteiner deve aparecer como `Up`.

## 6. Parear o WhatsApp

Abra <http://127.0.0.1:3000/pair> no notebook.

- Usuario: `admin`
- Senha: o valor de `ADMIN_TOKEN` definido no `.env`

No celular, abra **WhatsApp > Aparelhos conectados > Conectar aparelho** e leia o QR.
Confirme o estado:

```powershell
curl.exe http://127.0.0.1:3000/healthz
```

Resultado esperado:

```json
{"service":"ajeita","status":"ready"}
```

## 7. Testar

1. Envie um link publico do TikTok, Instagram ou Facebook.
2. Envie `ajeita` na mesma conversa. Frases como `ajeita por favor`,
   `pode ajeitar?`, `ajeita ai` e o erro comum `ageita` tambem funcionam.
3. O bot deve responder `perai` e depois enviar o video.

Tambem e possivel enviar varios links consecutivos e escrever `ajeita` uma vez. O
bot responde `perai`, processa os links em ordem e envia cada video como resposta
ao link correspondente. O limite padrao e cinco links por comando.

Grupos permanecem desativados enquanto `ALLOW_GROUPS=false`.

## 8. Deixar ligado continuamente

1. No Docker Desktop, abra **Settings > General**.
2. Ative **Start Docker Desktop when you sign in**.
3. No Windows, desative a suspensao quando o notebook estiver ligado na tomada.
4. Evite fechar a tampa se isso estiver configurado para suspender o Windows.

O conteiner usa `restart: unless-stopped` e volta quando o Docker inicia, exceto se
tiver sido parado manualmente.

## Comandos uteis

```powershell
# Consultar o estado
docker compose ps

# Acompanhar os logs; use Ctrl+C para sair
docker compose logs -f ajeita

# Reiniciar
docker compose restart

# Parar sem apagar a sessao
docker compose down

# Iniciar novamente
docker compose up -d
```

## Atualizar o codigo

```powershell
docker compose down
git pull
docker compose up -d --build
```

O volume persistente normalmente preserva o pareamento durante a atualizacao.

## Problemas comuns

### O painel nao abre

```powershell
docker compose ps
docker compose logs --tail=150 ajeita
```

Confirme que o Docker Desktop esta aberto e que a porta 3000 esta livre.

### O estado fica em `pairing`

Abra novamente <http://127.0.0.1:3000/pair> e leia o novo QR.

### A mensagem `perai` nao aparece

Confirme que o `.env` possui `SEND_PROGRESS=true` e recrie o conteiner:

```powershell
docker compose up -d --force-recreate
```

### O download falha

```powershell
docker compose logs --tail=200 ajeita
```

Videos privados, removidos, protegidos por DRM ou que exigem login podem nao
funcionar.

## Modo local sem Docker (Windows)

Alternativa mais leve: o bot roda direto com Node, sem Docker Desktop.

- Requisitos: Node 22, ffmpeg (`winget install Gyan.FFmpeg`), Chrome, e um venv com
  yt-dlp em `.venv` (`python -m venv .venv` e `.venv\Scripts\python -m pip install "yt-dlp[default]" curl_cffi`).
- No `.env`: `PORT`, `HOST=127.0.0.1`, `PYTHON_BIN`, `CHROME_PATH` e `AUTH_DATA_PATH` com caminhos do Windows.
- `scripts/start-local.ps1` inicia o bot, reinicia se cair e atualiza o yt-dlp a cada 24 h.
- Tarefa agendada `AJEITA` (no login do Windows) executa esse script oculto.
- Painel com status, pedidos e logs: `http://127.0.0.1:PORTA/logs`. O historico fica em `data/`.
- Alertas do Windows e uma mensagem no seu proprio WhatsApp avisam quando ha desconexao ou 3 falhas seguidas.

## Seguranca

- O painel esta em `127.0.0.1` e so abre no proprio notebook.
- Nao abra a porta 3000 no roteador.
- Nao compartilhe `ADMIN_TOKEN`, QR, cookies ou o volume do Docker.
- Nao execute `docker compose down -v` se quiser preservar a sessao.
- Ao trocar de notebook, o procedimento mais seguro e parear novamente pelo QR.

