# Billing, Custos & Créditos — Manual do Produto

> Documento-norte para chegar ao produto perfeito. Junta o modelo de custos, a
> engenharia de créditos e as referências de mercado (Blotato, Higgsfield, Veo,
> Kling, ElevenLabs, Ayrshare, Canva). Fonte de verdade do código:
> [`src/lib/billing/pricing.ts`](../src/lib/billing/pricing.ts).

---

## 1. O princípio que governa tudo: custo BIMODAL

Os custos de IA não são lineares. Há diferença de **~100x** entre as pontas:

| Camada | Custo real (USD) | Em R$ |
|---|---|---|
| Texto (Claude Sonnet 4.6) — carrossel | ~$0,06 | ~R$0,33 |
| Caption / refine | ~$0,025 | ~R$0,14 |
| Render HTML→PNG (servidor) | ~$0,015 | ~R$0,08 |
| Extração de trend (YouTube) | ~$0,03 | ~R$0,16 |
| **Imagem IA** (Flux / Nano Banana) | $0,025–0,13/img | R$0,14–0,70 |
| **Voz IA** (ElevenLabs, 1 reel) | $0,10–0,25 | R$0,55–1,40 |
| **Vídeo Kling** (5–8s) | $0,45–0,70 | R$2,45–3,80 |
| **Vídeo Veo 3 / Higgsfield** (8s) | **$2–5** | **R$11–27** |

**Consequência:** crédito único linear não funciona. Se você precifica o crédito
seguro pra vídeo, o texto fica caríssimo. Se precifica generoso pro texto, você
**perde dinheiro em cada vídeo**. Por isso separamos:

- **Texto + imagem + render** → bundle generoso (bolsa mensal de créditos).
- **Vídeo** → metrado com **teto por janela** (estilo Claude weekly limit).

---

## 2. Preços de referência (atualizar antes de lançar)

### Texto — Claude (oficial, skill `claude-api`)

| Modelo | Input $/1M | Output $/1M |
|---|---|---|
| Opus 4.8 | $5,00 | $25,00 |
| **Sonnet 4.6** (atual do app) | $3,00 | $15,00 |
| Haiku 4.5 | $1,00 | $5,00 |

### Imagem — por imagem (⚠️ volátil)

| Modelo | $/img | Nota |
|---|---|---|
| Flux dev | $0,025 | mais barato |
| Flux 1.1 Pro | $0,04 | |
| Imagen 3 | $0,04 | |
| Ideogram v2 | $0,08 | bom p/ texto na imagem |
| Nano Banana Pro | $0,13 | = Gemini Image Pro |

### Vídeo — por segundo (⚠️ muito volátil)

| Modelo | $/s | Bucket | 8s ≈ |
|---|---|---|---|
| Kling 2.1 | $0,09 | `video_kling` | $0,72 |
| Runway Gen-4 | $0,12 | `video_kling` | $0,96 |
| Higgsfield | $0,40 | `video_premium` | $3,20 |
| Veo 3 | $0,50 | `video_premium` | $4,00 |

### Custos esquecidos (mas reais)

- **Storage + banda** — vídeo é pesado; GBs no Supabase + download.
- **Stripe Brasil** — ~3,99% + R$0,39 por transação.
- **Usuários free** — não pagam e consomem; saem do bolso dos pagantes.
- **Publicação** — Ayrshare ($29–149/mês fixo) ou Meta Graph (grátis, exige app review).
- **Churn + suporte** — ~5%/mês de perda + tempo humano.

---

## 3. Engenharia de créditos

```
1 crédito  = R$0,10 de valor de varejo
Markup-alvo = 4–10x sobre o custo cru nas ops baratas
Vídeo       = metrado, não embutido
```

### Cobrança por operação (o que o usuário vê)

| Operação | Créditos | Custo real ≈ |
|---|---|---|
| Carrossel (texto) | 5 | R$0,33 |
| Reel (roteiro) | 4 | R$0,22 |
| Story / Post único | 3 | R$0,16 |
| Refine | 2 | R$0,14 |
| Render PNG | 1 | R$0,08 |
| Extrair trend | 2 | R$0,16 |
| Imagem IA | 8 / img | R$0,22–0,70 |
| Vídeo Kling | dinâmico (por s) | metrado |
| Vídeo premium | dinâmico (por s) | metrado |
| Publicar | 2 | ~R$0 |

> Ops dinâmicas (vídeo/TTS) calculam créditos do custo real via `usdToCredits()`.

---

## 4. Planos

| | Free | Starter R$49 | Pro R$129 | Agency R$349 |
|---|---|---|---|---|
| Créditos/mês | 50 | 400 | 2.000 | 8.000 |
| Carrosséis | 10 | 100 | ilimitado* | ilimitado* |
| Imagens IA | — | 30 | 150 | 600 |
| **Vídeo Kling/sem** | — | 3 | 10 | 40 |
| **Vídeo premium/sem** | — | — | 4 | 15 |
| Publicação direta | — | ✓ | ✓ | ✓ |

*ilimitado com soft-limit anti-abuso por hora (estilo Claude).

**Checagem de margem (Pro R$129, uso pesado realista):**
30 carrosséis + 30 refines + 40 imagens + 16 reels Kling/mês ≈ **COGS R$60–75**
→ margem ~45–55% depois de Stripe. Saudável; o teto de vídeo impede o cenário catastrófico.

---

## 5. A camada de tracking (✅ construída)

Cada operação de IA é registrada em `usage_logs` com:

| Coluna | O quê |
|---|---|
| `operation` | tipo da operação (`generate_carousel`, `refine`, `video_kling`…) |
| `model` | modelo usado |
| `tokens_input` / `tokens_output` | tokens reais (capturados do SDK) |
| `units` / `unit_type` | imagens, segundos de vídeo ou caracteres TTS |
| `cost_usd` | **custo real calculado** |
| `credits` | **créditos cobrados do usuário** |
| `window_bucket` | pool de teto rolante (vídeo) |
| `metadata` | contexto (piece_id, brand_id…) |

**Funções** (`src/lib/billing/`):
- `pricing.ts` — fonte da verdade: tabelas de preço, planos, cálculos.
- `track.ts` — `trackUsage()` (registra), `getUsageSummary()` (rollup mensal),
  `countWindowUsage()` (checa teto rolante de vídeo).

**Ligado em:** `/api/generate` (geração) e `/api/generate/refine` (refine).
Captura uso via `stream.finalMessage().usage` (streaming) e `response.usage`
(não-streaming).

> ⚠️ Antes desta camada, o `usage_logs` estava **quebrado** — o código inseria
> `type: "generation"` e um campo `metadata` que não existiam no schema, então
> nada era registrado. A migration `00000000000005` consertou.

---

## 6. Como o Blotato faz (referência de produto)

Blotato (sem API no free trial — só Starter pago) tem 3 workflows que queremos
reproduzir nativamente:

1. **Sourcing** (`POST /source-resolutions-v3`) — extrai YouTube/TikTok/artigos/PDF.
   → No app: já temos extração de trend; pode evoluir.
2. **Geração visual** (`POST /videos/from-templates`) — template + prompt → carrossel/vídeo.
   → No app: render server-side de HTML→PNG (a construir) + IA de imagem.
3. **Publicação** (`POST /posts`) — 9+ plataformas.
   → No app: Ayrshare ou Meta Graph direto.

---

## 7. Roadmap (ordem de valor)

- [x] **Tracking de custo por operação** — base de tudo *(feito)*
- [ ] **Dashboard de créditos** — página mostrando uso, custo, margem por período
  (usa `getUsageSummary`)
- [ ] **Enforcement** — checar saldo antes de gerar; teto rolante de vídeo
  (usa `countWindowUsage`)
- [ ] **Render server-side HTML→PNG** — `@sparticuz/chromium` no Vercel → PNG no Storage
- [ ] **Imagem IA por slide** — Flux/Nano Banana via Replicate/fal
- [ ] **Vídeo IA** — Kling (base) + Veo/Higgsfield (premium)
- [ ] **Publicação** — Ayrshare
- [ ] **Stripe** — planos + cobrança

---

## 8. Ao mudar um preço

1. Edite só `src/lib/billing/pricing.ts` (tabelas no topo).
2. Confirme preços de imagem/vídeo ao vivo (mudam todo mês).
3. Atualize `USD_TO_BRL` periodicamente.
4. Rode `getUsageSummary` num período real para ver margem antes de mexer em plano.
