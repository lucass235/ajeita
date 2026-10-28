# AJEITA no Railway — estado em 24/10/2026

Projeto privado: https://railway.com/project/a583eea5-d6b1-40f8-b1f9-f806c60bd57a

- Projeto: `a583eea5-d6b1-40f8-b1f9-f806c60bd57a`.
- Ambiente production: `e7bd88b0-a76a-4275-a09f-7b618c1b3df9`.
- Servico ajeita-bot: `1f8835a5-550f-4ba2-b927-fca1bb736451`.
- Pasta fonte: `/services/ajeita`, branch `feature/ajeita-standalone-hosting`.
- Commit em execucao: `b8ff768e1805c9aac846d1d7cda398c3fa673e59` (fonte fixada).
- Deploy: `7582f76d-487c-4c24-b383-9c491b5f3089`, SUCCESS.
- Dominio: https://ajeita-bot-production.up.railway.app (porta interna 8080).
- Volume: `36d23a5e-122e-43c4-865e-f048143c7360`, 500 MB, em `/data`.

## Estado atual

O deploy esta ativo e passou no healthcheck. Usuario pareou o WhatsApp;
`/healthz` confirmou `ready` e os logs confirmaram a compatibilidade aplicada.
O bot local esta pausado para evitar respostas duplicadas. Nenhum recurso do
App_OS foi modificado. Envio real pela nuvem e recuperacao apos reinicio ainda
devem ser validados antes de considerar a migracao concluida.

A conta atual limita memoria a 1 GB e volumes a 500 MB. Foi implantado um teste
com esses limites, sem alterar a assinatura. Memoria chegou a ~0,96 GB no
pareamento; pouco espaco para picos ao converter/enviar. A recomendacao continua
sendo 2 GB de memoria e volume de 1 GB se os testes exigirem mais recursos.
O provedor recusou esses limites maiores na conta atual. Nao prometer operacao
gratuita permanente nem disponibilidade continua com a configuracao de teste.

O usuario liberou o acesso ao GitHub. O primeiro build usava main, onde o bot
nao existe. A branch foi corrigida. Depois foram removidos os mounts de segredo
na compilacao, nao aceitos pelo Railway. O inicializador tambem passou a definir
o HOME correto do usuario node, corrigindo EACCES em /root/.config/puppeteer.

## Sessao e inicializacao

- `AUTH_DATA_PATH=/data/whatsapp`: WhatsApp pareado pelo painel HTTPS `/pair`.
- `TIKTOK_COOKIES_FILE=/data/tiktok/cookies.txt`: cookies exclusivos do TikTok.
- `TIKTOK_COOKIES_BASE64`: segredo preparado no Railway, nunca no Git. O bot
  restaura o arquivo privado e remove a variavel do ambiente dos subprocessos.
- `ADMIN_TOKEN`: senha privada do painel; nao expor em README, commits ou logs.
- `RAILWAY_RUN_UID=0`: somente o inicializador prepara as permissoes do volume;
  em seguida reduz para o usuario `node` antes de executar Chromium/FFmpeg.
- O inicializador adquire uma trava de sistema antes de remover os tres links
  temporarios do Chromium. Outra instancia com o mesmo volume nao inicia.
- Manter uma replica, Serverless desligado, sobreposicao zero e restart ALWAYS.
- Healthcheck `/healthz` testa o processo. Somente `status=ready` confirma que
  a sessao do WhatsApp ficou pronta.

## Ativacao pendente

1. Testar TikTok/Instagram pelo celular com o bot local parado; conferir logs,
   memoria e envio real, inclusive um video que precise de conversao.
2. Apos a fila terminar, reiniciar a instancia e comprovar recuperacao sem QR.
3. Conferir limite de uso, duracao dos creditos e armazenamento no Railway.
   Limite de memoria nao e limite de cobranca. Nao alterar plano sem autorizacao.
4. Se faltar memoria, discutir com o usuario Hobby ou outra hospedagem, em vez
   de aumentar recursos/assinar automaticamente.

Para parear novamente sem digitar ADMIN_TOKEN no navegador, execute no PC
`node services/ajeita/scripts/pair-railway.js`. O helper usa a .env privada do
AJEITA, abre um painel somente em 127.0.0.1:3015 com caminho aleatorio e salva o
link em `services/ajeita/data/railway-pair-url.txt` (ignorado pelo Git). O QR
atualiza a cada 3 segundos e o painel expira em 20 minutos.

Custos: https://railway.com/pricing

Limites: https://docs.railway.com/pricing/cost-control

O limite de COMPUTE e separado do de AGENT. O minimo de hard limit publicado
para compute e US$10 e, ao atingir o teto, o Railway desliga os workloads.
Confirmar o valor com o usuario antes de configurar. O provedor pode tentar
reativa-los no ciclo seguinte. Nao tratar o limite de memoria como teto de custo.
