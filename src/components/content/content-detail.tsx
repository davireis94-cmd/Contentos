"use client";

import React, { useState, useRef, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ClipboardCopy, Copy, Loader2, Pencil, Send, Wand2, X } from "lucide-react";
import { DeletePieceButton } from "@/components/content/delete-piece-button";
import { CarouselStudio } from "@/components/content/carousel-studio";

function stripNote(body: string): string {
  return (body ?? "").replace(/\n?\[[^\]:]+:[^\]]*\]/g, "").trim();
}
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GenerationOutput, Slide } from "@/lib/validations/generation";
import type { ContentStatus } from "@/types/app";
import { STATUS_LABELS } from "@/types/app";
import {
  updateContentStatus,
  updateSlides,
  updateCaption,
} from "@/app/(dashboard)/content/[pieceId]/actions";

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Post único",
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  idea: "bg-gray-100 text-gray-600 border-gray-200",
  scripted: "bg-blue-50 text-blue-700 border-blue-200",
  editing: "bg-amber-50 text-amber-700 border-amber-200",
  scheduled: "bg-purple-50 text-purple-700 border-purple-200",
  published: "bg-green-50 text-green-700 border-green-200",
};

const ALL_STATUSES: ContentStatus[] = ["idea", "scripted", "editing", "scheduled", "published"];

interface Props {
  pieceId: string;
  title: string;
  format: string;
  status: ContentStatus;
  createdAt: string;
  brandName: string | null;
  brandColors?: { hex: string; role?: string }[];
  brandHandle?: string | null;
  brandFontHeading?: string | null;
  brandFontBody?: string | null;
  output: GenerationOutput;
}

function CopyButton({ text, label, icon }: { text: string; label?: string; icon?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {copied ? (
        <><Check className="size-3 text-green-600" /> Copiado</>
      ) : (
        <>{icon ?? <Copy className="size-3" />} {label ?? "Copiar"}</>
      )}
    </button>
  );
}

function SlideCard({
  slide,
  isHook,
  onSave,
}: {
  slide: Slide;
  isHook: boolean;
  onSave: (updated: Slide) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Slide>(slide);
  const [saving, startSave] = useTransition();

  function handleSave() {
    startSave(() => {
      onSave(draft);
      setEditing(false);
    });
  }

  function handleCancel() {
    setDraft(slide);
    setEditing(false);
  }

  const copyText = [slide.title, slide.subtitle, slide.body, slide.cta]
    .filter(Boolean)
    .join("\n"); // body kept with production note for copy

  return (
    <Card className={isHook ? "border-primary/20 bg-primary/[0.03]" : undefined}>
      <CardContent className="py-3 px-4">
        {editing ? (
          <div className="space-y-2">
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Título"
              className="font-medium"
            />
            <Input
              value={draft.subtitle ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value || undefined }))}
              placeholder="Subtítulo (opcional)"
              className="text-sm"
            />
            <Textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="Corpo do texto"
              rows={5}
              className="text-sm"
            />
            <Input
              value={draft.cta ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value || undefined }))}
              placeholder="Call to action (opcional)"
              className="text-sm"
            />
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground mb-1">
                {isHook ? "Hook — " : ""}Slide {slide.index + 1}
              </p>
              <p className={`font-medium leading-snug ${isHook ? "text-base" : "text-sm"}`}>
                {slide.title}
              </p>
              {slide.subtitle && (
                <p className="mt-0.5 text-xs text-muted-foreground">{slide.subtitle}</p>
              )}
              {slide.body && (
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
                  {stripNote(slide.body)}
                </p>
              )}
              {slide.cta && (
                <p className="mt-1.5 text-sm font-medium text-primary">→ {slide.cta}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <CopyButton text={copyText} />
              <button
                onClick={() => setEditing(true)}
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
                title="Editar slide"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ContentDetail({
  pieceId,
  title,
  format,
  status: initialStatus,
  createdAt,
  brandName,
  brandColors,
  brandHandle,
  brandFontHeading,
  brandFontBody,
  output,
}: Props) {
  const [status, setStatus] = useState<ContentStatus>(initialStatus);
  const [slides, setSlides] = useState<Slide[]>(output.slides);
  const [caption, setCaption] = useState(output.caption);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(output.caption);
  const [, startTransition] = useTransition();

  // Chat refinement state
  type ChatMsg = { role: "user" | "assistant"; content: string };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendRefinement = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || refining) return;
    setChatInput("");
    setRefining(true);
    setRefineError(null);
    const userMsg: ChatMsg = { role: "user", content: msg };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    try {
      const res = await fetch("/api/generate/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pieceId, message: msg, history: chatMessages }),
      });
      const data = await res.json() as { output?: { slides: Slide[]; caption: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro no refinamento");
      if (data.output) {
        setSlides(data.output.slides);
        setCaption(data.output.caption);
        setCaptionDraft(data.output.caption);
      }
      setChatMessages([...nextMessages, { role: "assistant", content: "Conteúdo atualizado! Veja os slides acima." }]);
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setRefining(false);
    }
  }, [chatInput, chatMessages, refining, pieceId]);

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus as ContentStatus);
    startTransition(() => updateContentStatus(pieceId, newStatus));
  }

  function handleSaveSlide(updated: Slide) {
    const next = slides.map((s) => (s.index === updated.index ? updated : s));
    setSlides(next);
    startTransition(() => updateSlides(pieceId, next));
  }

  function handleSaveCaption() {
    setCaption(captionDraft);
    setEditingCaption(false);
    startTransition(() => updateCaption(pieceId, captionDraft));
  }

  const allHashtags = output.hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");

  const fullCopy = [
    ...slides.map((s, i) => {
      const header = i === 0 ? "SLIDE 1 — HOOK" : `SLIDE ${i + 1}`;
      return [header, s.title, s.subtitle ?? null, s.body, s.cta ? `→ ${s.cta}` : null]
        .filter(Boolean)
        .join("\n");
    }),
    "",
    "---",
    "LEGENDA:",
    caption,
    "",
    "HASHTAGS:",
    allHashtags,
  ].join("\n");

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/library"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Biblioteca
        </Link>
        <div className="flex items-center gap-2">
          {brandName && <span className="text-xs text-muted-foreground">{brandName}</span>}
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {new Date(createdAt).toLocaleDateString("pt-BR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Title + controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-xl font-bold leading-snug tracking-tight">{title}</h1>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Badge variant="outline">{FORMAT_LABELS[format] ?? format}</Badge>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger
              className={`h-7 w-auto gap-1.5 border text-xs px-2 ${STATUS_COLORS[status]}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Slides */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Roteiro · {slides.length} slides
          </p>
          <CopyButton text={fullCopy} label="Copiar tudo" icon={<ClipboardCopy className="size-3" />} />
        </div>
        <div className="space-y-2">
          {slides.map((slide, i) => (
            <SlideCard
              key={slide.index}
              slide={slide}
              isHook={i === 0}
              onSave={handleSaveSlide}
            />
          ))}
        </div>
      </section>

      {/* Caption */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Legenda
          </p>
          <div className="flex items-center gap-1">
            <CopyButton text={caption} />
            {!editingCaption && (
              <button
                onClick={() => { setCaptionDraft(caption); setEditingCaption(true); }}
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
                title="Editar legenda"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <Card>
          <CardContent className="py-4">
            {editingCaption ? (
              <div className="space-y-2">
                <Textarea
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  rows={6}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveCaption}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingCaption(false)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{caption}</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Hashtags */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Hashtags · {output.hashtags.length}
          </p>
          <CopyButton text={allHashtags} />
        </div>
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap gap-1.5">
              {output.hashtags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs font-normal">
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Chat refinement */}
      <section>
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Wand2 className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Refinar com IA
            </p>
          </div>

          {chatMessages.length > 0 && (
            <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-2">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {refining && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Refinando…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {refineError && (
            <div className="px-4 pb-2">
              <p className="text-xs text-destructive">{refineError}</p>
            </div>
          )}

          <div className="flex gap-2 p-3">
            <Textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendRefinement();
                }
              }}
              placeholder='Ex: "Reescreve o hook", "Deixa o tom mais leve", "Adiciona slide sobre preço"'
              rows={2}
              className="resize-none text-sm"
              disabled={refining}
            />
            <button
              type="button"
              onClick={() => void sendRefinement()}
              disabled={refining || !chatInput.trim()}
              className="flex shrink-0 self-end items-center justify-center rounded-md bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {refining ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Carousel Studio — preview + editor for carousel format */}
      {format === "carousel" && (
        <section>
          <CarouselStudio
            slides={slides}
            pieceId={pieceId}
            brandColors={brandColors}
            brandHandle={brandHandle}
            brandFontHeading={brandFontHeading}
            brandFontBody={brandFontBody}
            onSlidesChange={(next) => {
              setSlides(next);
            }}
          />
        </section>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/generate">
              <Wand2 className="mr-1.5 size-3.5" />
              Novo conteúdo
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/generate?ref=${pieceId}`}>
              <Wand2 className="mr-1.5 size-3.5" />
              Gerar variação deste post
            </Link>
          </Button>
        </div>
        <DeletePieceButton pieceId={pieceId} variant="full" />
      </div>
    </div>
  );
}
