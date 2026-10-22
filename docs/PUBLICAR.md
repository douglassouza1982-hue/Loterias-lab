# Como colocar o Laboratório das Loterias no ar

O site (pasta `web/`) é publicado no **GitHub Pages** automaticamente a cada push e após cada sorteio.
Login, limites do plano grátis e assinaturas rodam no **Supabase** (plano grátis) com pagamentos pelo **Mercado Pago**.
Enquanto `web/config.js` estiver vazio, o site funciona em **modo demonstração** (login e pagamento simulados).

## 1. Supabase (banco, login e funções)
1. Crie um projeto em https://supabase.com (região São Paulo).
2. Instale a CLI (`npm i -g supabase`), depois na pasta do repositório:
   ```bash
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   supabase db push                      # cria as tabelas (supabase/migrations)
   supabase functions deploy gerar
   supabase functions deploy assinar
   supabase functions deploy cancelar
   supabase functions deploy mp-webhook --no-verify-jwt
   ```
3. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public* para `web/config.js` e faça commit.
4. Em **Authentication → URL Configuration**: *Site URL* = `https://douglassouza1982-hue.github.io/loterias-lab/`
   e adicione a mesma URL em *Redirect URLs*.
5. Em **Authentication → Providers → Email**: deixe "Confirm email" ligado (recomendado).
6. Em **Authentication → Email Templates**, traduza os e-mails para português (opcional, recomendado).
   Para envio em volume, configure um SMTP próprio (Resend, Brevo) em *Authentication → SMTP*; o SMTP padrão do Supabase tem limite baixo por hora.

## 2. Login com Google
1. No Google Cloud Console → *APIs e serviços → Credenciais*, crie um **ID do cliente OAuth** (tipo: Aplicativo da Web).
2. Em *URIs de redirecionamento autorizados*, cole: `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`.
3. Na *Tela de consentimento OAuth*, informe nome do app, e-mail de suporte e os links de
   `termos.html` e `privacidade.html` do site. Publique o app (sai do modo "teste").
4. No Supabase → **Authentication → Providers → Google**: ative e cole o *Client ID* e o *Client Secret*.

## 3. Mercado Pago (assinaturas)
1. Em https://www.mercadopago.com.br/developers/panel crie uma aplicação ("Pagamentos online", produto "Assinaturas").
2. Copie o **Access Token de produção** (use o de teste primeiro para validar).
3. Em **Webhooks**, cadastre a URL `https://SEU_PROJECT_REF.supabase.co/functions/v1/mp-webhook`,
   marque os eventos **Planos e assinaturas** (`subscription_preapproval` e `subscription_authorized_payment`) e copie a **chave secreta**.
4. Grave os segredos nas funções:
   ```bash
   supabase secrets set MP_ACCESS_TOKEN=APP_USR-... MP_WEBHOOK_SECRET=... \
     SITE_URL=https://douglassouza1982-hue.github.io/loterias-lab/
   ```
5. Teste com usuários de teste do Mercado Pago: assine, confira em *Minha conta* que o plano virou "Assinante", cancele.

Preços ficam em `supabase/functions/_shared/mercadopago.ts` (servidor) e em `PLANOS` no `web/index.html` (vitrine). Mude nos dois.

## 4. GitHub Pages
- Em *Settings → Pages*, a fonte deve ser **GitHub Actions** (já configurado).
- O workflow `.github/workflows/publicar.yml` roda a cada push em `main`, às 21h45, 23h30 e 9h (Brasília): baixa os concursos novos da API da Caixa (com fonte reserva), salva em `web/data/` e publica.
- Domínio próprio (ex.: `loteriaslab.com.br`): registre no Registro.br, aponte um CNAME para `douglassouza1982-hue.github.io` e informe o domínio em *Settings → Pages*. Atualize *Site URL* no Supabase, `SITE_URL` nos segredos e o redirecionamento no Google.

## 5. Antes de vender
- Preencha os campos `[ENTRE COLCHETES]` em `web/termos.html` e `web/privacidade.html` e peça revisão a um advogado.
- Para emitir nota fiscal das assinaturas, você precisa de CNPJ (MEI costuma servir para começar; confirme a atividade com um contador).
- Não use o nome ou as marcas da Caixa e das loterias como marca do produto, nem prometa aumentar a chance de ganhar (Código de Defesa do Consumidor).

## 6. Lojas de aplicativos
O site já é um **PWA**: no celular, "Adicionar à tela inicial" instala como app.
- **Google Play**: dá para empacotar o PWA como TWA (ferramenta Bubblewrap ou pwabuilder.com). Atenção: a Play exige o **Google Play Billing** para assinaturas vendidas dentro do app e tem regras próprias para apps ligados a loteria; o caminho mais simples é o app não vender assinatura por dentro e só permitir login de quem assinou pelo site.
- **App Store (iPhone)**: a Apple também exige compra dentro do app para conteúdo digital e costuma recusar apps que são só um site empacotado. Recomendo começar pelo site + PWA e avaliar as lojas depois.

## Desenvolvimento
- Testes: `node --experimental-strip-types --test testes/loterias.test.ts`
- Preview com dados embutidos (modo demonstração): `python3 scripts/build.py` → `dist/preview.html`
- Atualizar resultados manualmente: `node scripts/atualizar-dados.mjs`
