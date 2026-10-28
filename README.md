# AJEITA — continuidade e implantacao controlada

**Instalacao em notebook Windows:** siga o passo a passo completo em
[README-NOTEBOOK.md](README-NOTEBOOK.md).

**Railway (24/10/2026):** deploy ativo, WhatsApp pareado e status `ready`.
Teste no plano atual com 1 vCPU, 1 GB de memoria e volume persistente de 500 MB.
O bot local esta pausado. Veja [estado e validacao](railway/DEPLOY.md).

**Roteiros anteriores do Google Cloud (nao utilizados no Railway):** [estado, correcoes, custos e operacao pelo celular](cloudrun/REVISAO-2026-10-22.md).
Codigo revisado; implantacao e budget/Spend Cap continuam pendentes
de acesso Google autenticado e validacao. WhatsApp validado localmente em 24/10/2026:
dois pedidos reais do TikTok (link seguido de ajeita e ajeita LINK), com videos
enviados na conversa do comando e confirmacao ack=3. Operacao continua excede a meta US$5.
Use apenas teste curto. Nao confundir os roteiros abaixo com recursos ja criados.

**Google Cloud:** apenas preparado no GitHub. Nenhuma hospedagem, bucket, secret, budget ou maquina Google Cloud foi criado.

Plano acordado: orcamento-meta de **US$ 5/mes**, projeto GCP exclusivo do AJEITA e deploy inicialmente **desligado** (`--scaling=0`).
**PASSO ATUAL, sem custos de hospedagem:** [criar projeto separado e configurar orçamento de US$ 5](cloudrun/PASSO-1-ORCAMENTO-SEM-DEPLOY.md). A etapa exige acesso ao console Google Cloud e nao executa implantacao.

A primeira leitura deve ser [CUSTOS-E-ATIVACAO.md](cloudrun/CUSTOS-E-ATIVACAO.md), que tambem documenta os comandos de parada e exclusao de emergencia.
Nao execute nada com `--execute` nem ligue instancias ate a autorizacao explicita.

---

# AJEITA — WhatsApp Downloader (experimental, isolado)

Servico independente do App_OS. Nada neste diretorio e importado pelo App_OS. A hospedagem do AJEITA e feita em outro projeto, com outra configuracao de deploy e uma branch dedicada.

## Uso

- Alguem envia link publico do TikTok, Facebook ou Instagram (incluindo Reels) na conversa.
- Qualquer participante envia **ajeita** (maiusculas/minusculas indiferentes).
- A conta conectada baixa e envia o MP4 **na mesma conversa**, nao em outro chat.
- Responder a uma mensagem com **ajeita** prioriza o link da mensagem citada.
- Tambem aceita **ajeita LINK** na mesma mensagem.
- Aguarda 10 segundos antes do aviso e do download (`REQUEST_DELAY_SECONDS=10`). Com SEND_PROGRESS=true, responde **perai** e depois envia o video, sem legenda. Se ocorrer um erro, espera 5 segundos e responde **eita deu alguma bronca aqui nesse video, nao conseguir baixar**. Os detalhes do erro ficam apenas nos logs.
- Antes do envio, confere os codecs com FFprobe e converte MP4 incompativel (ex.: HEVC/HE-AAC do TikTok) para H.264/AAC-LC com FFmpeg. O limite de tamanho tambem vale para o arquivo convertido.
- A conversao limita o lado maior a 1280 pixels e ajusta o bitrate para manter o video abaixo de 14 MiB quando possivel, permitindo reproduzir diretamente na conversa.
- Em grupos, o uso deve ser habilitado com ALLOW_GROUPS=true. Na primeira configuracao mantenha false.
- O bot usa WhatsApp Web nao oficial. **Pode parar ou resultar em restricao/bloqueio da conta. Use primeiro com numero de teste.**

## Publicar no Railway (servico 24 horas)

1. Crie um projeto Railway novo, **separado** de qualquer app da Ebenezer.
2. Conecte repo GitHub **lucass235/App_OS** na branch **feature/ajeita-standalone-hosting**.
3. Ajuste **Root Directory = /services/ajeita**. Dockerfile instala Chromium, FFmpeg, Python/yt-dlp e Node.js.
4. Adicione volume persistente, **Mount path = /data**. Sem volume os dados de sessao do WhatsApp se perdem no novo deploy.
5. Em Variables, configure **ADMIN_TOKEN** (senha aleatoria de 32+ caracteres), ALLOW_OTHER_PEOPLE=true, ALLOW_GROUPS=false, MAX_QUEUE=5 e CHAT_COOLDOWN_SECONDS=30. Nunca envie segredos ou perfil WhatsApp ao Git.
6. Uma unica replica, instancia sempre ligada e memoria >= 1 GB (Chromium pode exigir mais). Em plano pago, use Restart Policy Always. Railway cobra computacao, volume e trafego.
7. Em Networking, gere dominio HTTPS. No computador, abra **https://DOMINIO/pair**, usuario **admin** e senha ADMIN_TOKEN. No celular abra **WhatsApp - Aparelhos conectados - Conectar aparelho** e escaneie o QR. Painel atualiza periodicamente.
8. Logs indicam **AJEITA pronto!**; tambem veja **/healthz** para conferir **status=ready**. HTTP 200 em /healthz indica processo vivo, mesmo se ainda estiver esperando QR.
9. Teste com um video publico pequeno e **ajeita** em conversa individual; depois faca outra pessoa solicitar. O envio real depende de validacao e compatibilidade.
10. Pode remover o dominio publico apos o pareamento para reduzir exposicao; o bot segue executando com volume persistente.

## Configuracao

Veja .env.example. Docker define CHROME_PATH=/usr/bin/chromium; CHROME_NO_SANDBOX=true; AUTH_DATA_PATH=/data/whatsapp; PYTHON_BIN=/opt/venv/bin/python; PORT=3000. Railway pode fornecer outra porta automaticamente.

**Seguranca:** nao exponha ADMIN_TOKEN, QR, cookies ou volume; HTTPS obrigatorio para pareamento remoto. Nao execute duas instancias com a mesma conta. Grupos podem gerar alto consumo. Respeite direitos autorais e regras das plataformas. Videos privados, exigindo login ou DRM podem nao funcionar.

### Docker local

Copie .env.example para .env e defina ADMIN_TOKEN. Execute **docker compose up -d --build**. Painel em **http://localhost:3000/pair** somente no loopback. Para VPS use proxy HTTPS.

### Conectar TikTok localmente

Execute **npm run login:tiktok** no Windows e entre na janela do Chrome que abrir.
O AJEITA salva somente cookies do TikTok em `data/tiktok/cookies.txt` e fecha a
janela ao concluir. A pasta e privada, ignorada pelo Git e pelo build Docker.
O Docker monta essa pasta somente para leitura; cada download usa uma copia
temporaria. Repita o login se a sessao expirar. A autenticacao nao garante que
todo video esteja disponivel para a conta. Fora do Docker, configure
`TIKTOK_COOKIES_FILE` com o caminho do arquivo.

### Testes de codigo

Execute **npm install**, **npm test**, **npm run check**. Os testes reais do envio dependem de parear conta. Codigo no GitHub sozinho **nao equivale a deploy**.

## Custo e risco

Railway cobra uso e/ou assinatura, RAM continua e trafego. Confira tabela no painel. Biblioteca WhatsApp Web e experimental e nao oficial, sem SLA ou garantia de conexao 24 horas.

