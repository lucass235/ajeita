# AJEITA no Cloud Run — preparacao segura, meta US$ 5/mes

**STATUS: somente codigo preparado. NENHUM RECURSO GOOGLE CLOUD FOI CRIADO OU ATIVADO.**

Este roteiro foi feito para o WhatsApp **normal** e a implementacao nao oficial
whatsapp-web.js. E experimental: pode desconectar ou restringir a conta. Valide
primeiro com um numero secundario. Nao oferece disponibilidade garantida 24h.

## Conceito

- Mesmo GitHub do App_OS, mas **somente** pasta services/ajeita.
- NOVO projeto Google Cloud com identificador iniciado por ajeita-, separado
  do projeto de producao do Ebenezer, com faturamento discriminado.
- Cloud Run: servico de nome fixo ajeita-bot em southamerica-east1, 1 vCPU,
  2 GiB, CPU sempre ativa quando LIGADO, uma unica instancia.
- Deploy inicial **DESLIGADO** com --scaling=0.
- Sessao WhatsApp via RemoteAuth em bucket Cloud Storage exclusivo, contendo
  dados sensiveis; acesso minimo ao service account do bot.
- Pareamento via /pair com usuario admin e ADMIN_TOKEN no Secret Manager.
- Outras pessoas podem usar ajeita em conversa privada; grupos inicialmente
  desabilitados. O MP4 vai para a **mesma conversa**.
- O comando nao ativa servico desligado; o usuario precisa liga-lo explicitamente.

## Regra financeira antes de qualquer deploy

1. Abra um **novo** projeto no Google Cloud Console; nome sugerido AJEITA-Teste,
   ID iniciado por ajeita-. O projeto pode usar a mesma conta de faturamento do
   Ebenezer, mas NAO deve ser o mesmo projeto. Criar projeto ou associar billing
   nao faz parte dos scripts e NAO foi feito.
2. Abra Billing > Budgets & alerts, filtre EXCLUSIVAMENTE esse projeto, periodo
   mensal e valor USD 5. Habilite alertas em 50%, 80% e 100%. Garanta que emails
   de alerta cheguem a pessoa responsavel.
3. Se a conta permitir **Spend cap budget** para Cloud Run (recurso com
   elegibilidade especifica), configure um gasto maximo mensal dedicado
   a Cloud Run no projeto. E melhor que alerta simples, mas tem atraso,
   pode ultrapassar e nao cobre todos os recursos do projeto.
4. NUNCA considerar um alerta como corte automatico. Ainda podem cobrar
   Cloud Build, Artifact Registry, Cloud Storage, Secret Manager, logs e rede.
5. Defina previamente o tempo do teste (ex.: 30–60 minutos) e use panico.sh
   parar imediatamente apos testar. Cloud Run 24h nao combina com US$ 5
   sem depender da franquia gratuita, que e compartilhada por conta billing.

Documentos oficiais:
- https://docs.cloud.google.com/billing/docs/how-to/budgets
- https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps
- https://docs.cloud.google.com/run/docs/configuring/services/manual-scaling
- https://cloud.google.com/run/pricing

## Fase 1 — preparar recursos no NOVO projeto (SO DEPOIS DE AUTORIZAR)

Passos para futuro operador no Cloud Shell (sao exemplos, NAO rodar agora):

    PROJECT_ID="ajeita-seu-id-unico"
    BUCKET="ajeita-sessoes-seu-id-unico"
    gcloud config set project "$PROJECT_ID"
    gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com storage.googleapis.com secretmanager.googleapis.com iam.googleapis.com --project="$PROJECT_ID"
    gcloud iam service-accounts create ajeita-runtime --project="$PROJECT_ID" --display-name="AJEITA runtime"
    gcloud storage buckets create "gs://$BUCKET" --project="$PROJECT_ID" --location=southamerica-east1 --uniform-bucket-level-access --public-access-prevention
    gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:ajeita-runtime@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/storage.objectAdmin --project="$PROJECT_ID"

Crie o segredo ajeita-admin-token no Secret Manager pelo console com uma senha
aleatoria >=32 caracteres, sem registra-la em git, logs ou mensagens. Dê acesso
roles/secretmanager.secretAccessor SOMENTE a conta de servico ajeita-runtime.
A conta que publica precisa de permissoes de build, Cloud Run e para agir como
essa conta de servico. Recomendado não reutilizar a conta de servico do Ebenezer.

## Fase 2 — implantar DESLIGADO (SOMENTE quando aprovado)

Rodar a partir da pasta services/ajeita (na branch do AJEITA).

Simulacao, sem criar recursos:

    GCS_AUTH_BUCKET="ajeita-sessoes-seu-id-unico" bash cloudrun/deploy.sh ajeita-seu-id-unico

Depois de verificar/confirmar orcamento e ativar recursos intencionalmente:

    BUDGET_REVIEWED=YES GCS_AUTH_BUCKET="ajeita-sessoes-seu-id-unico" bash cloudrun/deploy.sh ajeita-seu-id-unico --execute

IMPORTANTE: a flag BUDGET_REVIEWED=YES e apenas confirmacao HUMANA, nao
consulta nem prova que um budget/spend cap existe.

O gcloud run deploy --source pode criar imagens e gerar CUSTO DE BUILD mesmo
iniciando o servico com --scaling=0. Confirmar antes de executar.

## Fase 3 — botao de panico

Executar na pasta services/ajeita. Por padrao TODOS comandos sao SIMULACOES:

    bash cloudrun/panico.sh ajeita-seu-id-unico parar
    bash cloudrun/panico.sh ajeita-seu-id-unico status

Quando o projeto estiver realmente ativo, execute com --execute:

    bash cloudrun/panico.sh ajeita-seu-id-unico ligar --execute
    bash cloudrun/panico.sh ajeita-seu-id-unico status --execute
    bash cloudrun/panico.sh ajeita-seu-id-unico parar --execute
    bash cloudrun/panico.sh ajeita-seu-id-unico apagar --execute

LIGAR exige confirmacao digitada e comeca a cobrar runtime continuamente;
PARAR define ZERO instancias, mantendo codigo, bucket e artefatos; APAGAR
exige confirmacao digitada e exclui somente o servico ajeita-bot. APAGAR
nao limpa o bucket, segredos, imagens, logs ou outros recursos cobraveis.

Tambem pode desligar pelo **Console do Cloud Run**:
servico ajeita-bot -> Scaling -> manual -> instancia 0 -> salvar.
Nao modifique servicos app-os-api nem outros do Ebenezer.

## Pareamento / teste

Apos LIGAR: acesse dominio HTTPS do servico com /pair, usuario admin e
senha do Secret Manager. Escaneie pelo WhatsApp em Aparelhos conectados.
Aguarde a mensagem de backup da sessao no log antes de desligar.
Teste video publico curto com palavra **ajeita** numa conversa.
Ao terminar teste, **PARAR**. Se houver erro, desligue antes de depurar.
Enquanto DESLIGADO, nenhum novo comando sera detectado.

## Pendencias antes do primeiro uso real

- Provisionar projeto, budget/spend cap se elegivel, IAM, secret e bucket.
- Fazer primeira compilacao do Docker e validar RemoteAuth/GCS, QR, sessao.
- Validar envio de MP4 e comportamento do comando para ambas as pessoas.
- Ajustar permissoes e monitorar logs/consumo. Nenhum desses itens foi executado.
