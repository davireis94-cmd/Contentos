"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  ExternalLink,
  Flame,
  Heart,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addTrend, deleteTrend } from "@/app/(dashboard)/trends/actions";

export interface TrendMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  ups?: number;
  engagementRate?: number;
  velocityPerHour?: number;
}

export interface Trend {
  id: string;
  title: string;
  description: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  format: string;
  platform: string;
  topic_tags: string[];
  notes: string | null;
  transcript: string | null;
  added_by: string | null;
  workspace_id: string | null;
  created_at: string;
  source: string; // 'manual' | 'youtube' | 'reddit'
  niche: string | null;
  author: string | null;
  published_at: string | null;
  metrics: TrendMetrics | null;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Post único",
  post: "Post",
  video: "Vídeo",
  short: "Shorts",
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
  reddit: "Reddit",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-600 border-pink-200",
  tiktok: "bg-slate-900/10 text-slate-700 border-slate-200",
  youtube: "bg-red-500/10 text-red-600 border-red-200",
  linkedin: "bg-blue-500/10 text-blue-700 border-blue-200",
  x: "bg-slate-500/10 text-slate-600 border-slate-200",
  reddit: "bg-orange-500/10 text-orange-600 border-orange-200",
};

// ── Add Trend Dialog ────────────────────────────────────────────────────────

function AddTrendDialog({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [meta, setMeta] = useState<{
    title: string;
    thumbnail_url: string;
    platform: string;
    transcript: string;
  } | null>(null);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [format, setFormat] = useState("carousel");
  const [saving, startSave] = useTransition();

  async function handleFetch() {
    const url = urlInput.trim();
    if (!url) return;
    setFetching(true);
    setFetchError("");
    setMeta(null);
    try {
      const res = await fetch(`/api/trends/metadata?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar metadados");
      setMeta({
        title: data.title ?? "",
        thumbnail_url: data.thumbnail_url ?? "",
        platform: data.platform ?? "other",
        transcript: data.transcript ?? "",
      });
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setFetching(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setUrlInput("");
    setMeta(null);
    setFetchError("");
    setTags("");
    setNotes("");
    setFormat("carousel");
  }

  function handleSave(formData: FormData) {
    startSave(async () => {
      await addTrend(formData);
      handleClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" />
          Adicionar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar referência viral</DialogTitle>
        </DialogHeader>

        {/* Step 1: URL fetch */}
        <div className="space-y-3">
          <Label>URL do vídeo ou post</Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleFetch()}
              className="flex-1 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleFetch()}
              disabled={fetching || !urlInput.trim()}
            >
              {fetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            </Button>
          </div>
          {fetchError && <p className="text-xs text-destructive">{fetchError}</p>}
        </div>

        {/* Step 2: Metadata preview + form */}
        {meta !== null && (
          <form action={handleSave} className="space-y-3 mt-1">
            {/* Hidden fields */}
            <input type="hidden" name="source_url" value={urlInput.trim()} />
            <input type="hidden" name="thumbnail_url" value={meta.thumbnail_url} />
            <input type="hidden" name="platform" value={meta.platform} />
            <input type="hidden" name="transcript" value={meta.transcript} />

            {/* Thumbnail preview */}
            {meta.thumbnail_url && (
              <div className="flex gap-3 items-start rounded-lg bg-muted/40 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={meta.thumbnail_url}
                  alt=""
                  className="w-20 h-14 object-cover rounded shrink-0"
                />
                <div className="min-w-0">
                  <Badge variant="outline" className={`text-[10px] mb-1 ${PLATFORM_COLORS[meta.platform] ?? ""}`}>
                    {PLATFORM_LABELS[meta.platform] ?? meta.platform}
                  </Badge>
                  {meta.transcript && (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                      <Video className="size-3" />
                      Transcrição capturada
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Título</Label>
              <Input
                name="title"
                defaultValue={meta.title}
                required
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Formato</Label>
              <Select name="format" value={format} onValueChange={setFormat}>
                <SelectTrigger className="mt-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMAT_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Tags (separadas por vírgula)
              </Label>
              <Input
                name="topic_tags"
                placeholder="ia, produtividade, marketing"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Por que funciona? (opcional)
              </Label>
              <Textarea
                name="notes"
                placeholder="Hook contraintuitivo, ritmo rápido, dado específico no slide 2..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 text-xs"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Salvar referência
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Manual entry fallback */}
        {meta === null && !fetching && (
          <p className="text-xs text-muted-foreground">
            Cole uma URL do YouTube ou TikTok e clique em buscar para auto-preencher.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Trend Card ──────────────────────────────────────────────────────────────

function TrendCard({
  trend,
  currentUserId,
}: {
  trend: Trend;
  currentUserId: string;
}) {
  const router = useRouter();
  const [deleting, startDelete] = useTransition();
  const isOwn = trend.added_by === currentUserId;
  const isGlobal = trend.workspace_id === null;

  function handleGenerate() {
    const params = new URLSearchParams({
      trendId: trend.id,
      topic: trend.title,
    });
    router.push(`/generate?${params.toString()}`);
  }

  function handleDelete() {
    startDelete(() => deleteTrend(trend.id));
  }

  return (
    <div className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-muted overflow-hidden">
        {trend.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trend.thumbnail_url}
            alt={trend.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TrendingUp className="size-8 text-muted-foreground/30" />
          </div>
        )}
        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge
            variant="outline"
            className={`text-[10px] border bg-white/90 ${PLATFORM_COLORS[trend.platform] ?? ""}`}
          >
            {PLATFORM_LABELS[trend.platform] ?? trend.platform}
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-white/90 border">
            {FORMAT_LABELS[trend.format] ?? trend.format}
          </Badge>
        </div>
        {trend.transcript && (
          <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-medium">
            <Video className="size-2.5" />
            Transcrição
          </div>
        )}
        {isGlobal && (
          <div className="absolute bottom-2 right-2 text-[10px] bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded font-medium">
            Curado
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="font-semibold text-sm leading-snug line-clamp-2 mb-2">{trend.title}</p>

        {/* Metrics row (auto-fetched trends) */}
        {trend.metrics && Object.keys(trend.metrics).length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-2.5 text-[11px] text-muted-foreground">
            {trend.metrics.views != null && (
              <span className="flex items-center gap-1">
                <Eye className="size-3" />
                {formatCompact(trend.metrics.views)}
              </span>
            )}
            {trend.metrics.ups != null && (
              <span className="flex items-center gap-1">
                <Flame className="size-3 text-orange-500" />
                {formatCompact(trend.metrics.ups)}
              </span>
            )}
            {trend.metrics.likes != null && (
              <span className="flex items-center gap-1">
                <Heart className="size-3" />
                {formatCompact(trend.metrics.likes)}
              </span>
            )}
            {trend.metrics.comments != null && (
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3" />
                {formatCompact(trend.metrics.comments)}
              </span>
            )}
            {trend.metrics.engagementRate != null && trend.metrics.engagementRate > 0 && (
              <span className="flex items-center gap-1 font-medium text-emerald-600">
                {trend.metrics.engagementRate.toFixed(1)}% eng.
              </span>
            )}
            {trend.metrics.velocityPerHour != null && trend.metrics.velocityPerHour > 0 && (
              <span className="flex items-center gap-1 font-medium text-primary">
                <TrendingUp className="size-3" />
                {formatCompact(trend.metrics.velocityPerHour)}/h
              </span>
            )}
          </div>
        )}

        {trend.topic_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {trend.topic_tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {trend.notes && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 italic">
            "{trend.notes}"
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" className="flex-1 text-xs" onClick={handleGenerate}>
            <Sparkles className="mr-1.5 size-3.5" />
            Gerar similar
          </Button>

          {trend.source_url && (
            <a
              href={trend.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded border hover:bg-muted transition-colors"
              title="Ver original"
            >
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </a>
          )}

          {isOwn && !isGlobal && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded border hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
              title="Remover"
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              ) : (
                <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Client Component ───────────────────────────────────────────────────

interface SubFilter {
  value: string; // matches Trend.format
  label: string;
}

interface PlatformTab {
  value: string; // 'all' | 'saved' | platform key
  label: string;
  active: boolean; // false = "Em breve" (fonte ainda não ligada)
  sub?: SubFilter[];
}

const PLATFORM_TABS: PlatformTab[] = [
  { value: "all", label: "Todos", active: true },
  {
    value: "youtube",
    label: "YouTube",
    active: true,
    sub: [
      { value: "all", label: "Tudo" },
      { value: "video", label: "Vídeo" },
      { value: "short", label: "Shorts" },
    ],
  },
  { value: "tiktok", label: "TikTok", active: false },
  {
    value: "instagram",
    label: "Instagram",
    active: false,
    sub: [
      { value: "all", label: "Tudo" },
      { value: "reel", label: "Reels" },
      { value: "carousel", label: "Carrossel" },
    ],
  },
  { value: "reddit", label: "Reddit", active: true },
  { value: "x", label: "X", active: false },
  { value: "linkedin", label: "LinkedIn", active: false },
  { value: "saved", label: "Minhas refs", active: true },
];

/** Um trend é relevante ao nicho se alguma palavra-chave da marca aparece nele. */
function matchesNiche(trend: Trend, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const haystack = [
    trend.title,
    trend.niche ?? "",
    trend.notes ?? "",
    ...trend.topic_tags,
  ]
    .join(" ")
    .toLowerCase();
  return keywords.some((k) => haystack.includes(k));
}

export function TrendsClient({
  trends,
  currentUserId,
  brandKeywords = [],
}: {
  trends: Trend[];
  currentUserId: string;
  brandKeywords?: string[];
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState("all");
  const [sub, setSub] = useState("all");
  const [nicheOnly, setNicheOnly] = useState(brandKeywords.length > 0);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const activeTab = PLATFORM_TABS.find((t) => t.value === platform);

  function selectPlatform(value: string) {
    setPlatform(value);
    setSub("all");
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/trends/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg(data.error ?? "Falha ao atualizar");
      } else {
        setSyncMsg(`${data.total} tendências atualizadas (YT ${data.youtube} · Reddit ${data.reddit})`);
        router.refresh();
      }
    } catch {
      setSyncMsg("Erro de conexão");
    } finally {
      setSyncing(false);
    }
  }

  const comingSoon = !!activeTab && !activeTab.active;

  const filtered = comingSoon
    ? []
    : trends.filter((t) => {
        if (platform === "saved") {
          if (t.source !== "manual") return false;
        } else if (platform !== "all") {
          if (t.platform !== platform) return false;
          if (sub !== "all" && t.format !== sub) return false;
        }
        // Personalização por nicho (não aplica em "Minhas refs")
        if (nicheOnly && platform !== "saved" && !matchesNiche(t, brandKeywords)) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          const matches =
            t.title.toLowerCase().includes(q) ||
            t.topic_tags.some((tag) => tag.includes(q)) ||
            (t.notes ?? "").toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {PLATFORM_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => selectPlatform(tab.value)}
              className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                platform === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
              {!tab.active && (
                <span className="ml-1.5 text-[9px] uppercase tracking-wide opacity-70">
                  em breve
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleSync()}
            disabled={syncing}
            title="Buscar tendências do mercado agora"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
          </Button>
          <AddTrendDialog currentUserId={currentUserId} />
        </div>
      </div>

      {syncMsg && (
        <p className="text-xs text-muted-foreground -mt-2">{syncMsg}</p>
      )}

      {/* Sub-filtros + personalização por nicho */}
      {!comingSoon && (
        <div className="flex flex-wrap items-center gap-2 -mt-1">
          {activeTab?.sub && (
            <div className="flex gap-1">
              {activeTab.sub.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSub(s.value)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    sub === s.value
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {brandKeywords.length > 0 && platform !== "saved" && (
            <button
              onClick={() => setNicheOnly((v) => !v)}
              className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                nicheOnly
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-muted-foreground border-transparent hover:bg-muted"
              }`}
              title={nicheOnly ? "Mostrando só o seu nicho" : "Mostrando tudo"}
            >
              <Sparkles className="size-3" />
              {nicheOnly ? "Meu nicho" : "Ver tudo"}
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {comingSoon ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingUp className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {activeTab?.label}: em breve
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
            Estamos preparando a coleta de tendências desta plataforma. Em breve ela aparece aqui automaticamente.
          </p>
        </div>
      ) : (
      <>
      {/* Grid de resultados */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingUp className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {trends.length === 0
              ? "Nenhuma referência ainda"
              : "Nenhum resultado para este filtro"}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {trends.length === 0
              ? 'Clique em atualizar (↻) para buscar tendências do mercado, ou adicione suas próprias referências.'
              : "Tente outro filtro ou busca."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((trend) => (
            <TrendCard key={trend.id} trend={trend} currentUserId={currentUserId} />
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
