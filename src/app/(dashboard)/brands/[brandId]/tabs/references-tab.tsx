"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Sparkles, Trash2, Wand2, Play, Layers, Heart, MessageCircle, Eye, RefreshCw, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_LABELS, type Platform } from "@/types/app";
import { PlatformsField } from "./platforms-field";
import { addReference, deleteReference } from "../../actions";
import { proxyImg } from "@/lib/utils";

interface Analysis {
  estrategia?: string;
  estilo?: string;
  pontos_fortes?: string[];
  formatos_frequentes?: string[];
  licoes?: string[];
  sugestoes?: { tema: string; formato: string; objetivo: string }[];
  visual_dna?: {
    paleta?: string[];
    mood?: string;
    layout?: string;
    tipografia?: string;
    uso_de_foto?: string;
    densidade_texto?: string;
  };
}

interface Reference {
  id: string;
  name: string;
  handle: string | null;
  platforms: Platform[];
  notes: string | null;
  ai_analysis: string | null;
}

interface BrandVoice {
  tone: string;
  target_audience: string | null;
  content_pillars: string[];
}

interface ReferencesTabProps {
  brandId: string;
  references: Reference[];
  voice: BrandVoice | null;
}

interface RefPost {
  externalId: string;
  title: string;
  description: string | null;
  sourceUrl: string;
  thumbnailUrl: string | null;
  author: string | null;
  format: string;
  publishedAt: string | null;
  metrics: { likes?: number; comments?: number; views?: number };
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-600 border-pink-200",
  tiktok: "bg-slate-900/10 text-slate-700 border-slate-300",
  youtube: "bg-red-500/10 text-red-600 border-red-200",
  linkedin: "bg-blue-500/10 text-blue-700 border-blue-200",
  x: "bg-slate-500/10 text-slate-600 border-slate-200",
};

function fmt(n: number | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const FORMAT_LABEL: Record<string, string> = {
  reel: "Reels",
  carousel: "Carrossel",
  single: "Post único",
  image: "Imagem",
};

/** Agrega os posts carregados num resumo de desempenho (estilo Métricas). */
function computeRefStats(posts: RefPost[]) {
  if (!posts.length) return null;
  const sum = (sel: (p: RefPost) => number | undefined) =>
    posts.reduce((s, p) => s + (sel(p) ?? 0), 0);
  const avgLikes = Math.round(sum((p) => p.metrics.likes) / posts.length);
  const avgComments = Math.round(sum((p) => p.metrics.comments) / posts.length);
  // Formato dominante entre os melhores posts.
  const byFormat = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.format] = (acc[p.format] ?? 0) + 1;
    return acc;
  }, {});
  const topFormat = Object.entries(byFormat).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  // Post campeão (mais engajamento = likes + comentários).
  const best = [...posts].sort(
    (a, b) =>
      (b.metrics.likes ?? 0) + (b.metrics.comments ?? 0) - (a.metrics.likes ?? 0) - (a.metrics.comments ?? 0)
  )[0];
  const bestEng = best ? (best.metrics.likes ?? 0) + (best.metrics.comments ?? 0) : 0;
  return { count: posts.length, avgLikes, avgComments, topFormat, bestEng };
}

function RefStat({ icon: Icon, label, value }: { icon: typeof Heart; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="size-3 text-muted-foreground" />
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground leading-none">{label}</span>
      </div>
      <p className="text-base font-bold leading-tight">{value}</p>
    </div>
  );
}

function RefStatsStrip({ posts }: { posts: RefPost[] }) {
  const s = computeRefStats(posts);
  if (!s) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <RefStat icon={Layers} label="Posts" value={String(s.count)} />
      <RefStat icon={Heart} label="Média curtidas" value={fmt(s.avgLikes)} />
      <RefStat icon={MessageCircle} label="Média coment." value={fmt(s.avgComments)} />
      <RefStat icon={TrendingUp} label={`Top: ${FORMAT_LABEL[s.topFormat] ?? s.topFormat}`} value={fmt(s.bestEng)} />
    </div>
  );
}

function PostCard({ post }: { post: RefPost }) {
  const isReel = post.format === "reel";
  const isCarousel = post.format === "carousel";

  return (
    <div className="group relative rounded-lg overflow-hidden border bg-card">
      {/* Thumbnail */}
      <div className="aspect-square bg-muted relative overflow-hidden">
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyImg(post.thumbnailUrl) ?? post.thumbnailUrl}
            alt={post.title}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Sem preview
          </div>
        )}
        {/* Format icon */}
        {isReel && (
          <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1">
            <Play className="size-2.5 text-white fill-white" />
          </div>
        )}
        {isCarousel && (
          <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1">
            <Layers className="size-2.5 text-white" />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-1.5">
          <div className="flex gap-3 text-white text-xs">
            <span className="flex items-center gap-1"><Heart className="size-3" />{fmt(post.metrics.likes)}</span>
            <span className="flex items-center gap-1"><MessageCircle className="size-3" />{fmt(post.metrics.comments)}</span>
            {post.metrics.views ? <span className="flex items-center gap-1"><Eye className="size-3" />{fmt(post.metrics.views)}</span> : null}
          </div>
          <div className="flex gap-1">
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 rounded bg-white/20 hover:bg-white/30 text-white text-[10px] py-1 transition-colors"
            >
              <ExternalLink className="size-2.5" /> Ver post
            </a>
            <Link
              href={`/generate?topic=${encodeURIComponent(post.title.slice(0, 180))}&format=${post.format}`}
              className="flex-1 flex items-center justify-center gap-1 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] py-1 transition-colors"
            >
              <Wand2 className="size-2.5" /> Gerar similar
            </Link>
          </div>
        </div>
      </div>
      {/* Caption */}
      <p className="text-[10px] text-muted-foreground px-2 py-1.5 line-clamp-2 leading-relaxed">
        {post.title}
      </p>
    </div>
  );
}

function ReferenceAvatar({ name, handle }: { name: string; handle: string | null }) {
  const [imgFailed, setImgFailed] = useState(false);
  const cleanHandle = handle?.replace(/^@/, "");
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  if (cleanHandle && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://unavatar.io/instagram/${cleanHandle}?fallback=false`}
        alt={name}
        onError={() => setImgFailed(true)}
        referrerPolicy="no-referrer"
        className="size-10 shrink-0 rounded-full object-cover bg-accent"
      />
    );
  }
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold">
      {initials}
    </div>
  );
}

function ReferenceCard({ reference, brandId, voice }: { reference: Reference; brandId: string; voice: BrandVoice | null }) {
  const [tab, setTab] = useState<"posts" | "analysis">("posts");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(() => {
    if (!reference.ai_analysis) return null;
    try { return JSON.parse(reference.ai_analysis); } catch { return null; }
  });
  const [posts, setPosts] = useState<RefPost[] | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handle = reference.handle?.replace(/^@/, "");

  async function loadPosts() {
    if (!handle) return;
    setLoadingPosts(true);
    setPostsError(null);
    try {
      const res = await fetch("/api/brand-references/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handles: [handle] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao buscar posts");
      setPosts(json.posts ?? []);
    } catch (e) {
      setPostsError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingPosts(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/brand-references/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceId: reference.id,
          name: reference.name,
          handle: reference.handle,
          platforms: reference.platforms,
          notes: reference.notes,
          brandVoice: voice,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro desconhecido");
      setAnalysis(json.analysis);
      setTab("analysis");
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Erro ao analisar");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <ReferenceAvatar name={reference.name} handle={reference.handle} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">{reference.name}</p>
              {handle && (
                <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            {reference.handle && <p className="text-xs text-muted-foreground">{reference.handle}</p>}
            <div className="flex flex-wrap gap-1 mt-1">
              {reference.platforms.map((p) => (
                <Badge key={p} variant="outline" className={`text-[10px] border ${PLATFORM_COLORS[p] ?? ""}`}>
                  {PLATFORM_LABELS[p]}
                </Badge>
              ))}
            </div>
          </div>
          <form action={deleteReference}>
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="referenceId" value={reference.id} />
            <button type="submit" title="Remover" className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive">
              <Trash2 className="size-3.5" />
            </button>
          </form>
        </div>

        {reference.notes && (
          <p className="text-xs text-muted-foreground border-l-2 pl-2 italic">{reference.notes}</p>
        )}

        {/* Tabs */}
        {handle && (
          <div className="flex gap-1 border-b">
            <button
              onClick={() => { setTab("posts"); if (!posts && !loadingPosts) loadPosts(); }}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === "posts" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Melhores posts
            </button>
            <button
              onClick={() => setTab("analysis")}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === "analysis" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Análise IA
            </button>
          </div>
        )}

        {/* Posts tab */}
        {tab === "posts" && handle && (
          <div>
            {!posts && !loadingPosts && (
              <Button size="sm" variant="outline" onClick={loadPosts} className="w-full text-xs h-8">
                <RefreshCw className="size-3 mr-1.5" /> Buscar posts via Apify
              </Button>
            )}
            {loadingPosts && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Buscando posts… (pode levar ~30s)
              </div>
            )}
            {postsError && (
              <p className="text-xs text-destructive">{postsError}</p>
            )}
            {posts && posts.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">Nenhum post encontrado para @{handle}.</p>
            )}
            {posts && posts.length > 0 && (
              <>
                <div className="mb-3">
                  <RefStatsStrip posts={posts} />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {posts.map((p) => <PostCard key={p.externalId} post={p} />)}
                </div>
                <Button size="sm" variant="ghost" onClick={loadPosts} disabled={loadingPosts} className="mt-2 h-7 px-2 text-[11px] text-muted-foreground w-full">
                  <RefreshCw className="size-3 mr-1" /> Atualizar
                </Button>
              </>
            )}
          </div>
        )}

        {/* Analysis tab */}
        {tab === "analysis" && (
          <div className="space-y-3">
            {!analysis && !analyzing && (
              <Button size="sm" variant="outline" onClick={handleAnalyze} className="w-full text-xs h-8">
                <Sparkles className="size-3 mr-1.5" /> Analisar com IA
              </Button>
            )}
            {analyzing && (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Analisando estratégia…
              </div>
            )}
            {analysisError && <p className="text-xs text-destructive">{analysisError}</p>}
            {analysis && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3 text-sm">
                {analysis.estrategia && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Estratégia de conteúdo</p>
                    <p className="text-xs leading-relaxed">{analysis.estrategia}</p>
                  </div>
                )}
                {analysis.estilo && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Tom & estilo</p>
                    <p className="text-xs">{analysis.estilo}</p>
                  </div>
                )}
                {analysis.visual_dna && (analysis.visual_dna.mood || analysis.visual_dna.paleta?.length) ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">DNA visual (a IA usa ao gerar)</p>
                    {analysis.visual_dna.paleta?.length ? (
                      <div className="flex items-center gap-1 mb-1.5">
                        {analysis.visual_dna.paleta.slice(0, 6).map((c, i) => (
                          <span key={i} className="size-4 rounded-full border" style={{ backgroundColor: c }} title={c} />
                        ))}
                      </div>
                    ) : null}
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {analysis.visual_dna.mood && <p><b className="text-foreground/70">Mood:</b> {analysis.visual_dna.mood}</p>}
                      {analysis.visual_dna.layout && <p><b className="text-foreground/70">Layout:</b> {analysis.visual_dna.layout}</p>}
                      {analysis.visual_dna.uso_de_foto && <p><b className="text-foreground/70">Foto:</b> {analysis.visual_dna.uso_de_foto}</p>}
                    </div>
                  </div>
                ) : null}

                {analysis.pontos_fortes?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Pontos fortes</p>
                    <ul className="space-y-0.5">
                      {analysis.pontos_fortes.map((p) => (
                        <li key={p} className="text-xs flex gap-1.5"><span className="text-muted-foreground">·</span>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {analysis.licoes?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Lições para aplicar</p>
                    <ul className="space-y-0.5">
                      {analysis.licoes.map((l) => (
                        <li key={l} className="text-xs flex gap-1.5"><span className="text-amber-500">→</span>{l}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {analysis.sugestoes?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Sugestões de conteúdo</p>
                    <div className="space-y-1.5">
                      {analysis.sugestoes.map((s, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{s.tema}</p>
                            <p className="text-[10px] text-muted-foreground">{s.formato} · {s.objetivo}</p>
                          </div>
                          <Link
                            href={`/generate?topic=${encodeURIComponent(s.tema)}&format=${s.formato}&objective=${s.objetivo}`}
                            className="shrink-0 flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] hover:bg-accent transition-colors"
                          >
                            <Wand2 className="size-2.5" />Gerar
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={handleAnalyze} disabled={analyzing} className="h-6 px-2 text-[10px] text-muted-foreground">
                  <Sparkles className="mr-1 size-3" /> Reanalisar
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReferencesTab({ brandId, references, voice }: ReferencesTabProps) {
  return (
    <div className="space-y-4">
      <Card className="max-w-2xl">
        <CardContent className="pt-5">
          <form action={addReference} className="space-y-4">
            <input type="hidden" name="brandId" value={brandId} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="Ex: Alex Hormozi" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handle">@ handle (Instagram)</Label>
                <Input id="handle" name="handle" placeholder="@alexhormozi" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Plataformas</Label>
              <PlatformsField name="platforms" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea id="notes" name="notes" rows={2} placeholder="Por que essa referência inspira? O que admira no conteúdo dela?" />
            </div>
            <Button type="submit" size="sm">Adicionar referência</Button>
          </form>
        </CardContent>
      </Card>

      {references.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma referência ainda</p>
          <p className="text-xs text-muted-foreground mt-1">Adicione criadores que inspiram seu conteúdo — você vai ver os melhores posts deles e gerar conteúdo similar na sua identidade.</p>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {references.map((ref) => (
          <ReferenceCard key={ref.id} reference={ref} brandId={brandId} voice={voice} />
        ))}
      </div>
    </div>
  );
}
