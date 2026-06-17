# Lumio — Documentação Técnica

> Documento para revisão por um programador. Escrito em 2026-06-17.
> Objetivo: dar uma visão honesta da arquitetura, do stack e das decisões para
> uma segunda opinião técnica.

---

## 1. O que é o produto

**Lumio** é um SaaS web de **geração de conteúdo para Instagram** (foco em carrosséis
estáticos), voltado a quem produz conteúdo de autoridade (o dono é o @davimoxoto,
nicho de "IA aplicada a negócios").

O fluxo do produto, de ponta a ponta:

1. **Brand Brain** — o usuário cadastra a marca (identidade visual: cores, fontes,
   logo, foto de perfil; e voz/tom via entrevista por IA).
2. **Tendências / Referências** — coleta posts de referência (Instagram/TikTok via
   Apify, YouTube via transcript) para inspirar pautas e extrair "DNA visual".
3. **Gerador** — a partir de um tópico, a IA escreve o carrossel (texto por slide +
   legenda + hashtags), com frameworks de copy. Há também geração a partir de
   *templates* prontos.
4. **Studio** — editor visual on-brand: o usuário ajusta layout, cores, fontes,
   imagens (geradas por IA ou enviadas), reordena slides, e **exporta os slides
   como PNG 1080×1350** prontos pro Instagram.
5. **Publicar / Agendar** — integração com Instagram (e Ayrshare, dormente) +
   calendário.
6. **Métricas / Feedback loop** — lê insights do post publicado pra aprender.

O coração técnico — e o que mais evoluiu — é o **Studio + pipeline de render**.

---

## 2. Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | **Next.js 16** (App Router, Server Components + Server Actions) |
| Linguagem | **TypeScript** (strict; `tsc --noEmit` limpo antes de cada commit) |
| UI | **React 19**, **Tailwind CSS v4**, **shadcn/ui** + **Radix** |
| Estado client | **Zustand**, hooks locais |
| Validação | **Zod** |
| Banco + Auth + Storage | **Supabase** (Postgres + RLS + Storage buckets) |
| IA (texto) | **Anthropic SDK** (`@anthropic-ai/sdk`) — modelos Claude (Sonnet 4.6 no uso padrão) |
| IA (imagem) | **Replicate** (Flux, Ideogram, Nano Banana) + Google Gemini (opcional) |
| Coleta de dados | **Apify** (IG/TikTok), **youtube-transcript** |
| Export PNG | **html-to-image** (antes era html2canvas — ver §6) |
| Drag & drop | **@dnd-kit** |
| Deploy | **Vercel** (auto-deploy do branch `master`) |

Repositório: GitHub `davireis94-cmd/Contentos` · Deploy: `contentos-smoky.vercel.app`.

> Nota honesta: o produto foi construído de forma muito iterativa, com o dono
> (não-programador) dirigindo via IA. Então há dívida técnica e algumas
> duplicações conhecidas (ver §6 e §9). A revisão é bem-vinda justamente nesses
> pontos.

---

## 3. Arquitetura geral

```
Browser (React/Next client components)
   │
   ├── Server Components (leitura inicial: marca, slides, conexões)
   ├── Server Actions (mutações: salvar slides, identidade, etc.)
   └── Route Handlers /api/* (IA, imagens, integrações externas, export HTML)
                              │
        ┌─────────────────────┼───────────────────────────┐
   Supabase (Postgres+RLS,   Anthropic API           Replicate / Gemini
   Auth, Storage)            (texto)                 (imagens)
                              │
                         Apify / YouTube (coleta de referências)
```

- **Multi-tenant** por `workspace` (cada usuário tem um workspace; tabelas têm
  `workspace_id`, protegidas por **RLS**).
- **Server Actions** para a maioria das mutações simples (salvar slides é autosave).
- **Route Handlers** (`/api/*`) para tudo que chama serviço externo ou faz
  streaming de IA.

### Rotas /api principais
`generate`, `generate/chat`, `generate/from-template`, `generate/refine`,
`critic`, `fact-check`, `humanize`, `ideas`, `repurpose`, `research`,
`images/generate`, `images/library`, `images/upload`, `img-proxy`,
`brand/*` (builder, interview, analyze-voice, apply-voice, learn, export),
`brand-references/*`, `trends/*`, `social/instagram/*`, `publish`,
`generate/carousel` (export HTML standalone), `render/slide` (legado, ver §6).

### Skills de IA (`src/lib/skills/`)
Módulos de prompt composáveis: `content-critic`, `repurpose`, `idea-generation`,
`deep-research` (+ fact-check). Não são "AgentSkills" do Claude Code — são apenas
funções que montam prompts e chamam o SDK.

---

## 4. Modelo de dados (Supabase / Postgres)

Tabelas principais (migrations em `supabase/migrations/`):

- `workspaces`, `workspace_members`, `profiles` — tenancy e usuários.
- `brands` — a marca. Campo **`identity` (JSONB)** guarda `colors`, `font_heading`,
  `font_body`, e agora `avatar_url` + `avatar_zoom/x/y` (foto de perfil e
  enquadramento). `logo_url` é coluna própria.
- `brand_voice`, `brand_examples`, `brand_references`, `brand_documents` — voz/tom
  e material de referência.
- `content_pieces` — cada post gerado. **`slides` (JSONB)** = array de slides
  (ver §5). `caption`, `hashtags`, `status`, `start_date` (agendamento).
- `benchmark_content` — tendências/refs coletadas.
- `templates`, `template_favorites` — templates de carrossel.
- `social_connections`, `platform_posts` — integração IG e posts publicados.
- `usage_logs`, `subscriptions` — billing/uso (Stripe ainda não plugado).

> Decisão importante: **o conteúdo do carrossel é JSONB** em `content_pieces.slides`,
> não tabelas relacionais por slide. Isso simplificou muito a iteração rápida
> (sem migração a cada mudança de layout), ao custo de menos garantias no banco.
> **Esse é um ponto que eu gostaria de opinião:** vale normalizar?

---

## 5. O modelo do "slide" e o sistema de tokens

Cada slide é um objeto:

```ts
interface Slide {
  index: number;
  title: string;        // pode conter *destaque* com asteriscos
  subtitle?: string;
  body?: string;        // texto + TOKENS embutidos (ver abaixo)
  cta?: string;
  imageUrl?: string;
  imageHistory?: string[]; // versões anteriores da imagem (máx 8)
}
```

**Decisão central (e polêmica):** o estilo do slide é codificado como **tokens de
texto dentro do `body`**, em vez de campos estruturados. Exemplos:

- `[Layout: editorial|dark|light|dark-photo|gradient|...]` — layout do slide
- `[Theme: editorial-dark|bold-sans|revista|...]` — tema do carrossel
- `[Font: serif|condensed|sans|brand]` — fonte do título
- `[HL: box|marker|color|underline]` — estilo do destaque da palavra-chave
- `[Image: bg|card-top|framed|half|none]` — como a imagem se encaixa
- `[chips: a | b | c]`, `[quote: rótulo | texto]` — elementos ricos

Helpers (`getX`/`setXToken`) leem/gravam esses tokens; um `cleanBody()` remove
todos eles (`/\[[^\]:]+:[^\]]*\]/`) antes de exibir o texto.

**Por que assim:** evita migração de schema a cada novo estilo, e o mesmo `body`
serve preview, export e geração. **Trade-off:** é "stringly-typed" — frágil, sem
type-safety nos valores, parsing por regex. **Pergunta pro dev:** manteria os
tokens ou migraria pra um objeto `style` tipado no JSON do slide?

---

## 6. Pipeline de render (a parte mais interessante)

O requisito difícil: **o que o usuário vê no preview tem que ser idêntico ao PNG
baixado**. Já tivemos bugs sérios aqui.

### Como funciona hoje
- Existe **um único componente React `SlideVisual`** que desenha o slide (216×270px
  no preview). Ele é a **fonte única de verdade**.
- Para exportar, renderizamos o MESMO `SlideVisual` em nós escondidos (em tamanho
  216×270) e capturamos com **`html-to-image` (`toPng`)** em `pixelRatio: 5` →
  1080×1350px. Como é a mesma engine do navegador, preview = PNG.

### Bug grande resolvido recentemente (exemplo de armadilha)
Antes usávamos **html2canvas**. Mas o Tailwind v4 define cores em **`oklch()`**, e o
html2canvas (v1.4.1, última versão) **não parseia `oklch`** → erro em todos os
slides. Trocamos por `html-to-image`, que renderiza via `foreignObject` usando o
próprio motor do navegador (que entende `oklch`).

### Outros detalhes do render
- **Encaixe de texto sem cortar:** helpers determinísticos `titleFit()` (encolhe
  título longo) e `bodyFit()` (encolhe corpo + libera mais linhas de clamp) — mesma
  conta no preview e no PNG.
- **Imagens externas no PNG:** para o `html-to-image` não "tingir" (taint/CORS) o
  resultado, imagens passam por um proxy same-origin `/api/img-proxy` (com guard
  anti-SSRF) quando `forExport`.
- **Avatar (foto de perfil):** renderizado em círculo via `background-size`/
  `background-position` controlados (zoom + posição salvos na marca) — a mesma
  fórmula no ajuste (Brand Brain) e no slide, garantindo consistência.

### Dívida conhecida aqui
- `/api/render/slide` é um **renderizador legado** (Satori/next-og) que **divergia**
  do preview — foi a causa-raiz do "baixa diferente da tela". Hoje está **morto**
  (pode ser removido). Sobrou também `/api/generate/carousel` que gera um **HTML
  standalone** com html2canvas via CDN (botão "Baixar HTML") — funciona, mas é um
  segundo caminho de export.
- **Pergunta pro dev:** preview→PNG por DOM-capture (`html-to-image`) é a melhor
  abordagem, ou valeria um render server-side determinístico (ex.: Satori/Puppeteer)
  como fonte única? O risco do DOM-capture é fragilidade entre browsers.

---

## 7. Integrações externas

- **Anthropic** (texto): geração, crítica, humanização, fact-check (usa web search
  nativo do SDK), reaproveitamento, ideias. Modelo padrão Sonnet 4.6.
- **Replicate** (imagem): Flux (texto→imagem), Nano Banana (imagem→imagem, para
  *editar* mantendo a foto), Ideogram. Há um "escritor de prompt" (Claude Haiku) que
  traduz o sentido do slide em cena para o Flux.
- **Google Gemini** (imagem): opcional; free tier = 0 (precisa billing).
- **Apify**: scraping de posts IG/TikTok para referências/tendências.
- **Instagram Graph** (`social/instagram/*`): OAuth, insights. Foto de perfil via API
  é instável (pendência).
- **Ayrshare**: publicação multi-rede — código existe mas dormente.

---

## 8. Segurança / auth

- **Supabase Auth** (cookies via `@supabase/ssr`).
- **RLS** nas tabelas por `workspace_id`.
- Rotas `/api` checam `auth.getUser()`; algumas usam a **service role key** (server-only)
  para operações de storage administrativas.
- `/api/img-proxy` tem guard anti-SSRF (só https, sem IP interno).
- **Pergunta pro dev:** a checagem de RLS + service role está espalhada; vale um
  middleware/util central de autorização?

---

## 9. Dívida técnica e limitações conhecidas (honesto)

1. **Tokens "stringly-typed" no body** (§5) — frágil, parsing por regex.
2. **Slides em JSONB** (§4) — sem integridade relacional.
3. **Dois caminhos de export** + um renderizador legado morto (§6).
4. **`html2canvas` ainda no `package.json`** (usado só no export HTML standalone).
5. **Sem testes automatizados** — validação é `tsc` + teste manual no browser.
6. **`carousel-studio.tsx` é um arquivo gigante** (~2600 linhas) — concentra
   preview, export, painéis e lógica. Candidato a quebrar em módulos.
7. **Custo de IA não 100% rastreado** (ex.: Haiku do prompt de imagem não vai pro
   ledger; desprezível, mas existe).
8. **Fontes:** só Google Fonts (sem upload de `.ttf`).
9. **Stripe/billing** não plugado (tabelas existem).

---

## 10. O que eu gostaria de opinião (resumo das perguntas)

1. **Tokens no texto vs objeto `style` tipado** no JSON do slide?
2. **JSONB vs normalizar** os slides em tabelas?
3. **Export por DOM-capture (`html-to-image`) vs render server-side** determinístico?
4. Vale **centralizar autorização** (RLS + service role) num util?
5. Como você **quebraria o `carousel-studio.tsx`** sem perder a "fonte única" do render?
6. Prioridades de **testes** dado que o dono não é dev (o que cobrir primeiro)?

---

## 11. Como rodar localmente

```bash
npm install
# .env.local com: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, REPLICATE_API_TOKEN,
# (opcional) GEMINI_API_KEY, APIFY_TOKEN, credenciais do Instagram
npm run dev          # Next em dev
npx tsc --noEmit     # checagem de tipos
```

Migrations em `supabase/migrations/` (aplicadas no projeto Supabase).
