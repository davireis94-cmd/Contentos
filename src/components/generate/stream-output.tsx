"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Copy,
  Check,
  Send,
  Wand2,
  ClipboardCopy,
  Sparkles,
  Gavel,
  AlertTriangle,
} from "lucide-react";
import type { CriticResult } from "@/lib/skills/content-critic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { GenerationOutput } from "@/lib/validations/generation";

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Post único",
};

export type GenerationState =
  | { status: "idle" }
  | { status: "running"; messages: string[] }
  | { status: "done"; pieceId: string; output: GenerationOutput }
  | { status: "error"; message: string };

interface Props {
  state: GenerationState;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function stripNote(body: string): string {
  return body.replace(/\n?\[[^\]:]+:[^\]]*\]/g, "").trim();
}

function buildFullCopy(output: GenerationOutput): string {
  const slideParts = output.slides.map((s, i) => {
    const header = i === 0 ? "SLIDE 1 — HOOK" : `SLIDE ${i + 1}`;
    return [
      header,
      s.title,
      s.subtitle ?? null,
      s.body, // keep production note
      s.cta ? `→ ${s.cta}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    ...slideParts,
    "",
    "---",
    "LEGENDA:",
    output.caption,
    "",
    "HASHTAGS:",
    output.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
  ].join("\n");
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 rounded p-1 text-xs text-muted-foreground hover:text-foreground"
      title="Copiar"
    >
      {copied ? (
        <><Check className="size-3.5 text-green-600" />{label && " Copiado"}</>
      ) : (
        <><Copy className="size-3.5" />{label && ` ${label}`}</>
      )}
    </button>
  );
}

export function StreamOutput({ state }: Props) {
  const router = useRouter();

  const [localOutput, setLocalOutput] = useState<GenerationOutput | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const lastPieceIdRef = useRef<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [allCopied, setAllCopied] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  const [humanized, setHumanized] = useState(false);
  const [critiquing, setCritiquing] = useState(false);
  const [critique, setCritique] = useState<CriticResult | null>(null);

  useEffect(() => {
    if (state.status === "done" && lastPieceIdRef.current !== state.pieceId) {
      lastPieceIdRef.current = state.pieceId;
      setLocalOutput(state.output);
      setChatMessages([]);
      setRefineError(null);
      setChatInput("");
      setCritique(null);
    }
  }, [state]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendRefinement = useCallback(async () => {
    if (state.status !== "done") return;
    const msg = chatInput.trim();
    if (!msg || refining) return;
    setChatInput("");
    setRefining(true);
    setRefineError(null);
    const userMsg: ChatMessage = { role: "user", content: msg };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    try {
      const res = await fetch("/api/generate/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pieceId: state.pieceId, message: msg, history: chatMessages }),
      });
      const data = await res.json() as { output?: GenerationOutput; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro no refinamento");
      if (data.output) setLocalOutput(data.output);
      setChatMessages([...nextMessages, { role: "assistant", content: "Conteúdo atualizado! Veja os slides acima." }]);
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setRefining(false);
    }
  }, [state, chatInput, chatMessages, refining]);

  if (state.status === "idle") return null;

  if (state.status === "running") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
          <div className="space-y-1 text-center">
            {state.messages.map((msg, i) => (
              <p key={i} className={i === state.messages.length - 1 ? "text-sm font-medium" : "text-xs text-muted-foreground line-through"}>
                {msg}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-start gap-3 py-5">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-sm">Erro na geração</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayOutput = localOutput ?? state.output;
  const { pieceId } = state;

  async function handleCopyAll() {
    await navigator.clipboard.writeText(buildFullCopy(displayOutput));
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }

  async function applyCritiqueFixes() {
    if (state.status !== "done" || !critique || refining) return;
    const instruction =
      "Aplique estas correções ao conteúdo, mantendo a voz da marca e a estrutura. Reescreva o que for necessário:\n" +
      critique.issues.map((i) => `- [${i.where}] ${i.problem} → ${i.fix}`).join("\n");
    setRefining(true);
    setRefineError(null);
    setChatMessages((m) => [...m, { role: "user", content: "Aplicar as correções da crítica ✦" }]);
    try {
      const res = await fetch("/api/generate/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pieceId: state.pieceId, message: instruction, history: [] }),
      });
      const data = await res.json() as { output?: GenerationOutput; error?: string };
      if (!res.ok || !data.output) throw new Error(data.error ?? "Erro ao aplicar");
      setLocalOutput(data.output);
      setCritique(null);
      setChatMessages((m) => [...m, { role: "assistant", content: "Correções aplicadas! Veja os slides acima." }]);
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Erro ao aplicar correções");
    } finally {
      setRefining(false);
    }
  }

  async function handleCritique() {
    if (critiquing) return;
    setCritiquing(true);
    try {
      const res = await fetch("/api/critic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output: displayOutput }),
      });
      const data = await res.json() as { result?: CriticResult; error?: string };
      if (!res.ok || !data.result) throw new Error(data.error ?? "Erro");
      setCritique(data.result);
    } catch (e) {
      console.error(e);
    } finally {
      setCritiquing(false);
    }
  }

  async function handleHumanize() {
    if (humanizing) return;
    setHumanizing(true);
    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output: displayOutput }),
      });
      const data = await res.json() as { output?: GenerationOutput; error?: string };
      if (!res.ok || !data.output) throw new Error(data.error ?? "Erro");

      setLocalOutput(data.output);
      setHumanized(true);
      setTimeout(() => setHumanized(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setHumanizing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="size-4 text-green-600" />
          <p className="text-sm font-medium">Conteúdo gerado com sucesso</p>
          <Badge variant="secondary">{FORMAT_LABELS[displayOutput.format] ?? displayOutput.format}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleCritique()}
            disabled={critiquing}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Crítica honesta do post (gancho, retenção, CTA, cara de IA)"
          >
            {critiquing ? (
              <><Loader2 className="size-3.5 animate-spin" /> Avaliando…</>
            ) : (
              <><Gavel className="size-3.5" /> Criticar</>
            )}
          </button>
          <button
            onClick={() => void handleHumanize()}
            disabled={humanizing}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              humanized
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
            title="Remove padrões de IA e deixa o texto mais humano"
          >
            {humanizing ? (
              <><Loader2 className="size-3.5 animate-spin" /> Humanizando…</>
            ) : humanized ? (
              <><Check className="size-3.5" /> Humanizado!</>
            ) : (
              <><Sparkles className="size-3.5" /> Humanizar ✦</>
            )}
          </button>
          <button
            onClick={() => void handleCopyAll()}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              allCopied
                ? "border-green-300 bg-green-50 text-green-700"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            {allCopied ? (
              <><Check className="size-3.5" /> Copiado!</>
            ) : (
              <><ClipboardCopy className="size-3.5" /> Copiar tudo</>
            )}
          </button>
        </div>
      </div>

      {/* Crítica do conteúdo */}
      {critique && (
        <Card className="border-amber-200/60 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/10">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center size-11 rounded-full text-sm font-bold shrink-0 ${
                critique.score >= 75 ? "bg-emerald-100 text-emerald-700" : critique.score >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
              }`}>
                {critique.score}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Gavel className="size-3.5" /> Crítica honesta
                </p>
                <p className="text-sm mt-0.5">{critique.verdict}</p>
              </div>
            </div>

            {critique.issues.length > 0 && (
              <div className="space-y-1.5">
                {critique.issues.map((iss, i) => (
                  <div key={i} className="rounded-lg border bg-card px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        iss.severity === "alta" ? "bg-red-100 text-red-700" : iss.severity === "média" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {iss.severity}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">{iss.where}</span>
                    </div>
                    <p className="text-xs">{iss.problem}</p>
                    <p className="text-xs mt-1 flex gap-1.5"><span className="text-emerald-600 shrink-0">→ corrigir:</span>{iss.fix}</p>
                  </div>
                ))}
              </div>
            )}

            {critique.strengths.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {critique.strengths.map((s, i) => (
                  <span key={i} className="text-[11px] rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">✓ {s}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={() => void applyCritiqueFixes()} disabled={refining}>
                {refining ? (
                  <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Aplicando…</>
                ) : (
                  <><Wand2 className="mr-1.5 size-3.5" /> Aplicar correções</>
                )}
              </Button>
              <button
                onClick={() => setCritique(null)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Dispensar
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="size-3" /> A IA aplica as correções automaticamente — ou ajuste manual no &quot;Refinar com IA&quot; abaixo.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Slides */}
      <div className="space-y-3">
        {displayOutput.slides.map((slide, i) => {
          const bodyDisplay = stripNote(slide.body);
          const copyText = [slide.title, slide.subtitle, slide.body, slide.cta]
            .filter(Boolean).join("\n");
          return (
            <Card key={i}>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {i === 0 ? "Hook — Slide 1" : `Slide ${i + 1}`}
                  </span>
                  <CopyButton text={copyText} />
                </div>
                <CardTitle className="text-base leading-snug">{slide.title}</CardTitle>
                {slide.subtitle && <p className="text-sm text-muted-foreground">{slide.subtitle}</p>}
              </CardHeader>
              <CardContent className="pb-4">
                <p className="whitespace-pre-wrap text-sm">{bodyDisplay}</p>
                {slide.cta && <p className="mt-2 text-sm font-medium text-foreground/80">→ {slide.cta}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Caption */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Legenda</span>
            <CopyButton text={displayOutput.caption} />
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="whitespace-pre-wrap text-sm">{displayOutput.caption}</p>
        </CardContent>
      </Card>

      {/* Hashtags */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Hashtags</span>
            <CopyButton
              text={displayOutput.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {displayOutput.hashtags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs font-normal">
                {tag.startsWith("#") ? tag : `#${tag}`}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat refinement */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Wand2 className="size-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Refinar com IA
          </p>
        </div>
        {chatMessages.length > 0 && (
          <div className="max-h-60 overflow-y-auto px-4 py-3 space-y-2">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {refining && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Refinando…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
        {refineError && <div className="px-4 pb-2"><p className="text-xs text-destructive">{refineError}</p></div>}
        <div className="flex gap-2 p-3">
          <Textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendRefinement(); } }}
            placeholder='Ex: "Reescreve o hook", "Deixa o tom mais leve", "Adiciona slide sobre preço"'
            rows={2}
            className="resize-none text-sm"
            disabled={refining}
          />
          <Button size="sm" onClick={() => void sendRefinement()} disabled={refining || !chatInput.trim()} className="shrink-0 self-end">
            {refining ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push(`/content/${pieceId}`)}>
          <Eye className="mr-1.5 size-3.5" /> Ver conteúdo
        </Button>
        <Button size="sm" onClick={() => router.push("/generate")}>Gerar novo</Button>
      </div>
    </div>
  );
}
