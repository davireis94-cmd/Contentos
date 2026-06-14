"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Heart,
  MessageCircle,
  Eye,
  Bookmark,
  Users,
  Grid3x3,
  Loader2,
  RefreshCw,
  Camera,
  Play,
  Layers,
  Send,
  TrendingUp,
  Lock,
  MapPin,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PostMetric {
  id: string;
  caption: string;
  mediaType: string;
  mediaUrl: string | null;
  permalink: string;
  timestamp: string;
  likes: number;
  comments: number;
  reach: number;
  saved: number;
  shares: number;
  views: number;
  totalInteractions: number;
}

interface FollowerPoint {
  date: string;
  value: number;
}

interface Demographics {
  locked: boolean;
  followersNeeded: number;
  topCountries: { name: string; value: number }[];
  topCities: { name: string; value: number }[];
  genderAge: { name: string; value: number }[];
}

interface AccountInsights {
  followerGrowth: FollowerPoint[];
  profileViews: number;
  reach28d: number;
}

interface Insights {
  followersCount: number;
  mediaCount: number;
  username: string;
  profilePicture: string | null;
  posts: PostMetric[];
  account: AccountInsights | null;
  demographics: Demographics | null;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

interface Props {
  isConnected: boolean;
  username: string | null;
  justConnected: boolean;
  connectError: string | null;
}

export function InstagramAnalytics({ isConnected, username, justConnected, connectError }: Props) {
  const [loading, setLoading] = useState(isConnected);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(connectError);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social/instagram/insights");
      const data = await res.json();
      if (data.error) setError(data.error);
      else if (data.insights) setInsights(data.insights);
    } catch {
      setError("Erro ao buscar métricas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected) void load();
  }, [isConnected, load]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/social/instagram/disconnect", { method: "POST" });
      window.location.href = "/analytics";
    } finally {
      setDisconnecting(false);
    }
  }

  // ── Não conectado ──
  if (!isConnected) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center max-w-xl mx-auto">
        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500">
            <Camera className="size-7 text-white" />
          </div>
        </div>
        <h2 className="text-lg font-semibold mb-2">Conecte seu Instagram</h2>
        <p className="text-sm text-muted-foreground mb-1">
          Veja curtidas, alcance, salvamentos e seguidores direto aqui — e o app vai
          aprender o que mais funciona com o seu público.
        </p>
        <p className="text-xs text-muted-foreground/70 mb-5">
          Grátis. Seu Instagram precisa ser conta Profissional/Comercial ligada a uma página do Facebook.
        </p>
        {connectError && (
          <p className="text-xs text-destructive mb-4">{decodeURIComponent(connectError)}</p>
        )}
        <a
          href="/api/social/instagram/connect"
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Camera className="size-4" />
          Conectar Instagram
        </a>
      </div>
    );
  }

  // ── Conectado ──
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {insights?.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={insights.profilePicture} alt="" className="size-10 rounded-full object-cover" />
          ) : (
            <div className="flex items-center justify-center size-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
              <Camera className="size-5 text-white" />
            </div>
          )}
          <div>
            <p className="font-semibold text-sm">@{insights?.username ?? username}</p>
            <p className="text-xs text-muted-foreground">Instagram conectado</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleDisconnect()} disabled={disconnecting}>
            {disconnecting ? <Loader2 className="size-3.5 animate-spin" /> : "Desconectar"}
          </Button>
        </div>
      </div>

      {justConnected && (
        <p className="text-sm text-emerald-600 font-medium">✓ Instagram conectado com sucesso!</p>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Se o erro persistir, o acesso pode ter expirado — clique em Desconectar e conecte de novo.
          </p>
        </div>
      )}

      {loading && !insights ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : insights ? (
        <>
          {/* Cards de visão geral */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Users} label="Seguidores" value={compact(insights.followersCount)} />
            <StatCard icon={Grid3x3} label="Publicações" value={compact(insights.mediaCount)} />
            <StatCard
              icon={Eye}
              label="Alcance (30 dias)"
              value={compact(insights.account?.reach28d || insights.posts.reduce((s, p) => s + p.reach, 0))}
            />
            <StatCard
              icon={UserCircle2}
              label="Visitas ao perfil"
              value={compact(insights.account?.profileViews ?? 0)}
            />
            <StatCard
              icon={Send}
              label="Compart. (posts)"
              value={compact(insights.posts.reduce((s, p) => s + p.shares, 0))}
            />
            <StatCard
              icon={Bookmark}
              label="Salvos (posts)"
              value={compact(insights.posts.reduce((s, p) => s + p.saved, 0))}
            />
          </div>

          {/* Crescimento de seguidores + Demografia */}
          <div className="grid lg:grid-cols-2 gap-4">
            <FollowerGrowth points={insights.account?.followerGrowth ?? []} />
            <DemographicsCard demo={insights.demographics} followers={insights.followersCount} />
          </div>

          {/* Posts — grade estilo feed */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b">
              <h3 className="text-sm font-semibold">Posts recentes</h3>
            </div>
            {insights.posts.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhum post encontrado ainda.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1 p-1">
                {insights.posts.map((p) => (
                  <a
                    key={p.id}
                    href={p.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden bg-muted"
                    title={p.caption || "(sem legenda)"}
                  >
                    {p.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.mediaUrl}
                        alt={p.caption || "Post do Instagram"}
                        className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Camera className="size-6 text-muted-foreground/40" />
                      </div>
                    )}
                    {p.mediaType === "VIDEO" && (
                      <Play className="absolute right-1.5 top-1.5 size-4 text-white drop-shadow" fill="white" />
                    )}
                    {p.mediaType === "CAROUSEL_ALBUM" && (
                      <Layers className="absolute right-1.5 top-1.5 size-4 text-white drop-shadow" />
                    )}
                    {/* Overlay com métricas ao passar o mouse */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <div className="flex items-center gap-3 text-xs font-semibold">
                        <span className="flex items-center gap-1"><Heart className="size-3.5" fill="white" />{compact(p.likes)}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="size-3.5" fill="white" />{compact(p.comments)}</span>
                        <span className="flex items-center gap-1"><Send className="size-3.5" />{compact(p.shares)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-white/90">
                        {p.views > 0 ? (
                          <span className="flex items-center gap-1"><Play className="size-3" fill="white" />{compact(p.views)}</span>
                        ) : (
                          <span className="flex items-center gap-1"><Eye className="size-3" />{compact(p.reach)}</span>
                        )}
                        <span className="flex items-center gap-1"><Bookmark className="size-3" />{compact(p.saved)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function FollowerGrowth({ points }: { points: FollowerPoint[] }) {
  const net = points.reduce((s, p) => s + p.value, 0);
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Crescimento de seguidores</span>
        </div>
        <span className={`text-sm font-bold ${net >= 0 ? "text-emerald-600" : "text-destructive"}`}>
          {net >= 0 ? "+" : ""}{net} <span className="text-xs font-normal text-muted-foreground">/ 30 dias</span>
        </span>
      </div>
      {points.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Sem dados de crescimento ainda — o Instagram leva alguns dias acumulando.
        </p>
      ) : (
        <div className="flex items-end gap-0.5 h-24">
          {points.map((p, i) => {
            const h = Math.max(2, (Math.abs(p.value) / max) * 100);
            return (
              <div
                key={i}
                className={`flex-1 rounded-sm ${p.value >= 0 ? "bg-primary/70" : "bg-destructive/60"}`}
                style={{ height: `${h}%` }}
                title={`${new Date(p.date).toLocaleDateString("pt-BR")}: ${p.value >= 0 ? "+" : ""}${p.value}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function DemoBar({ name, value, total }: { name: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="truncate">{name}</span>
        <span className="text-muted-foreground shrink-0 ml-2">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DemographicsCard({ demo, followers }: { demo: Demographics | null; followers: number }) {
  if (!demo || demo.locked) {
    const needed = demo?.followersNeeded ?? Math.max(0, 100 - followers);
    const pct = Math.min(100, Math.round((followers / 100) * 100));
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Demografia do público</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          O Instagram libera dados de cidade, idade e gênero do seu público a partir de{" "}
          <b>100 seguidores</b>. Faltam <b>{needed}</b>.
        </p>
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-1">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground text-right">{followers}/100</p>
      </div>
    );
  }

  const countriesTotal = demo.topCountries.reduce((s, c) => s + c.value, 0);
  const agesTotal = demo.genderAge.reduce((s, c) => s + c.value, 0);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Demografia do público</span>
      </div>
      {demo.topCountries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Países</p>
          {demo.topCountries.map((c) => <DemoBar key={c.name} name={c.name} value={c.value} total={countriesTotal} />)}
        </div>
      )}
      {demo.genderAge.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Faixa etária</p>
          {demo.genderAge.map((c) => <DemoBar key={c.name} name={c.name} value={c.value} total={agesTotal} />)}
        </div>
      )}
    </div>
  );
}
