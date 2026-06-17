"use client";

import { useState, useTransition, useRef, useEffect, type CSSProperties } from "react";
import { toPng } from "html-to-image";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  Image,
  Images,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Slide } from "@/lib/validations/generation";
import { updateSlides } from "@/app/(dashboard)/content/[pieceId]/actions";
import { IMAGE_MODEL_DEFS } from "@/lib/images/models";
import { deriveBrandTokens, type BrandTokens } from "@/lib/render/brand-tokens";
import { parseTitleHighlight } from "@/lib/render/highlight";
import {
  effectiveImageMode,
  computeImageLayout,
  setImageModeToken,
  getImageMode,
  IMAGE_MODE_LABELS,
  type ImageMode,
} from "@/lib/render/slide-geometry";
import {
  CAROUSEL_THEMES,
  FONT_OPTIONS,
  HIGHLIGHT_OPTIONS,
  getThemeId,
  getFontKey,
  getHighlightKey,
  setThemeToken,
  setFontToken,
  setHighlightToken,
  resolveFontFamily,
  type ThemeId,
  type FontKey,
  type HighlightKey,
} from "@/lib/render/carousel-themes";

// Base do preview: 216×270 (4:5), escalada por transform. Mesma proporção do PNG.
const PREVIEW_W = 216;
const PREVIEW_H = 270;

// ── Slide parsing helpers ──────────────────────────────────────────────────

function getLayout(body: string): string {
  const m = (body ?? "").match(/\[Layout:\s*([a-z-]+)\]/i);
  return m?.[1]?.toLowerCase() ?? "dark";
}

function cleanBody(body: string): string {
  return (body ?? "").replace(/\n?\[[^\]:]+:[^\]]*\]/gi, "").trim();
}

/**
 * Fator de redução do título conforme o nº de caracteres, para NÃO estourar a
 * caixa. Determinístico (mesmo resultado na tela e no PNG). Só encolhe títulos
 * longos — títulos curtos ficam no tamanho cheio.
 */
function titleFit(title: string): number {
  const len = (title ?? "").replace(/[*_]/g, "").trim().length;
  if (len <= 22) return 1;
  if (len <= 32) return 0.88;
  if (len <= 44) return 0.77;
  if (len <= 60) return 0.67;
  return 0.58;
}

/**
 * Igual ao titleFit, mas para o CORPO do slide: textos longos encolhem a fonte
 * E ganham mais linhas de clamp, pra caber na mesma caixa em vez de "comer" o final.
 * Mesma conta na tela e no PNG (fonte única).
 */
function bodyFit(text: string): { scale: number; clamp: number } {
  const len = (text ?? "").replace(/[*_]/g, "").trim().length;
  if (len <= 130) return { scale: 1, clamp: 5 };
  if (len <= 200) return { scale: 0.9, clamp: 6 };
  if (len <= 300) return { scale: 0.8, clamp: 8 };
  return { scale: 0.72, clamp: 11 };
}

/**
 * Estilo visual da palavra-chave destacada (*asteriscos*) conforme a escolha do
 * usuário no painel Estilo. Mesma renderização na tela e no PNG (fonte única).
 * Default = sublinhado (parecido com o comportamento antigo).
 */
function highlightStyle(key: HighlightKey, B: BrandTokens, isDark: boolean): CSSProperties {
  const accent = isDark ? B.vivid : B.primary;
  switch (key) {
    case "box":
      return {
        background: B.primary,
        color: "#fff",
        padding: "0.04em 0.22em",
        borderRadius: 4,
        WebkitBoxDecorationBreak: "clone",
        boxDecorationBreak: "clone",
      };
    case "marker":
      return {
        color: isDark ? "#fff" : "#1A1310",
        background: `color-mix(in srgb, ${accent} 42%, transparent)`,
        padding: "0 0.12em",
        borderRadius: 2,
        WebkitBoxDecorationBreak: "clone",
        boxDecorationBreak: "clone",
      };
    case "color":
      return { color: accent, fontWeight: 800 };
    case "underline":
    default:
      return { color: accent, borderBottom: `3px solid ${accent}`, paddingBottom: 1 };
  }
}

function parseFeatures(body: string) {
  return (body ?? "").split("\n").filter((l) => l.includes("|")).map((l) => {
    const [icon = "", title = "", desc = ""] = l.split("|").map((p) => p.trim());
    return { icon, title, desc };
  }).filter((i) => i.title).slice(0, 4);
}

function parseSteps(body: string) {
  return (body ?? "").split("\n").filter((l) => l.includes("|")).map((l) => {
    const [num = "01", title = "", desc = ""] = l.split("|").map((p) => p.trim());
    return { num, title, desc };
  }).filter((i) => i.title).slice(0, 4);
}

const LAYOUT_LABELS: Record<string, string> = {
  "dark-photo": "Escuro c/ foto",
  editorial: "Capa (editorial)",
  dark: "Escuro sólido",
  light: "Claro",
  "feature-list": "Lista de features",
  "step-list": "Lista de passos",
  gradient: "Gradiente (CTA)",
};

// Layouts que aceitam corpo de texto comum (troca com 1 clique, sem reformatar).
const QUICK_LAYOUTS = ["editorial", "dark", "dark-photo", "light", "gradient"] as const;

/** Troca o [Layout: x] no corpo do slide, preservando o resto do texto. */
function setLayoutToken(body: string, layout: string): string {
  const cleaned = (body ?? "").replace(/\n?\[Layout:\s*[a-z-]+\]/gi, "").trimEnd();
  return `${cleaned}\n[Layout: ${layout}]`;
}

/** Reatribui index sequencial após adicionar/remover/mover slides. */
function reindex(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({ ...s, index: i }));
}

// ── Parsers de elementos ricos ─────────────────────────────────────────────

/** [chips: tag1 | tag2 | tag3] — pills arredondadas no slide */
function parseChips(body: string): string[] {
  const m = (body ?? "").match(/\[chips:\s*([^\]]+)\]/i);
  if (!m) return [];
  return m[1].split("|").map((s) => s.trim()).filter(Boolean);
}

/** [quote: Rótulo | Texto da citação] — caixa inset com label + itálico */
function parseQuoteCard(body: string): { label: string; text: string } | null {
  const m = (body ?? "").match(/\[quote:\s*([^|]+)\|([^\]]+)\]/i);
  if (!m) return null;
  return { label: m[1].trim(), text: m[2].trim().replace(/^[""“”]|[""“”]$/g, "") };
}

/** **texto** em negrito inline no corpo */
function parseBoldInline(text: string): { text: string; bold: boolean }[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((p) => {
    if (p.startsWith("**") && p.endsWith("**")) return { text: p.slice(2, -2), bold: true };
    return { text: p, bold: false };
  });
}

/** Renderiza chips + quote card — reutilizado em vários layouts */
function RichExtras({
  chips,
  quoteCard,
  isDark,
  primary,
  gap = 6,
}: {
  chips: string[];
  quoteCard: { label: string; text: string } | null;
  isDark: boolean;
  primary: string;
  gap?: number;
}) {
  return (
    <>
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: gap }}>
          {chips.map((c, i) => (
            <span
              key={i}
              style={{
                fontSize: 6.5,
                padding: "2px 7px",
                borderRadius: 99,
                border: `1px solid ${isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.22)"}`,
                color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
                whiteSpace: "nowrap",
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {quoteCard && (
        <div
          style={{
            marginTop: gap,
            padding: "6px 9px",
            borderRadius: 6,
            background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
          }}
        >
          {quoteCard.label && (
            <div
              style={{
                fontSize: 6,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                marginBottom: 3,
              }}
            >
              {quoteCard.label}
            </div>
          )}
          <div
            style={{
              fontSize: 8,
              fontStyle: "italic",
              fontFamily: "Georgia,serif",
              color: isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.72)",
              lineHeight: 1.45,
            }}
          >
            &ldquo;{quoteCard.text}&rdquo;
          </div>
        </div>
      )}
    </>
  );
}

// ── Miniatura arrastável (drag-and-drop na tira de slides) ──────────────────

function SortableThumbnail({
  slide,
  idx,
  total,
  isCurrent,
  B,
  headingFont,
  onClick,
}: {
  slide: Slide;
  idx: number;
  total: number;
  isCurrent: boolean;
  B: BrandTokens;
  headingFont: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.index });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        onClick={onClick}
        className={`shrink-0 rounded overflow-hidden border-2 transition-colors ${
          isCurrent ? "border-primary" : "border-transparent hover:border-border"
        }`}
        style={{ width: 44, height: 55, display: "block", position: "relative" }}
        title={`Slide ${idx + 1}: ${slide.title}`}
      >
        {/* slide cheio (216×270) reduzido p/ caber — sem isto a miniatura mostrava só o canto ampliado */}
        <div
          style={{
            width: PREVIEW_W,
            height: PREVIEW_H,
            transform: `scale(${44 / PREVIEW_W})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          <SlideVisual slide={slide} idx={idx} total={total} B={B} headingFont={headingFont} />
        </div>
      </button>
    </div>
  );
}

// ── Móvel: etiqueta + contador (aparece em todos os slides quando há tema) ──

function TopBar({
  themeId,
  isDark,
  handle,
  idx,
  total,
}: {
  themeId: ThemeId | null;
  isDark: boolean;
  handle: string | null;
  idx: number;
  total: number;
}) {
  if (!themeId) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "9px 16px 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontSize: 6,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: isDark ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.28)",
        }}
      >
        {handle ?? ""}
      </span>
      <span
        style={{
          fontSize: 6,
          fontWeight: 600,
          letterSpacing: 0.5,
          color: isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.2)",
        }}
      >
        {String(idx + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
      </span>
    </div>
  );
}

// ── Slide Visual Component ─────────────────────────────────────────────────

function SlideVisual({
  slide,
  idx,
  total,
  B,
  headingFont,
  forExport,
}: {
  slide: Slide;
  idx: number;
  total: number;
  B: BrandTokens;
  headingFont: string;
  /** No export PNG, roteia a imagem pelo proxy same-origin (evita CORS no html2canvas) */
  forExport?: boolean;
}) {
  const handle = B.handle;
  const body = slide.body ?? "";
  const layout = getLayout(body);
  const text = cleanBody(body);
  // Na exportação, a imagem vai pelo proxy same-origin p/ o canvas não ficar "tainted".
  const imgSrc = slide.imageUrl
    ? (forExport ? `/api/img-proxy?url=${encodeURIComponent(slide.imageUrl)}` : slide.imageUrl)
    : undefined;
  // Anton/Impact é visualmente ~25% maior que Georgia no mesmo px — compensamos
  const fontScale = /anton|Impact/i.test(headingFont) ? 0.80 : 1.0;
  // resolveFontFamily só produz aspas iniciais no caminho "fonte da marca".
  // Nesse caso damos IMPACTO ao título (caixa-alta + tracking + peso 800),
  // resolvendo o "Playfair fraco" vs @brandsdecoded. Mesmo estilo na tela e no PNG.
  const isBrandFont = headingFont.trim().startsWith('"');
  const brandTitleStyle = isBrandFont
    ? { textTransform: "uppercase" as const, letterSpacing: "0.02em", fontWeight: 800 as const }
    : {};
  // Estilo do destaque da palavra-chave (*asteriscos*); default sublinhado.
  const hlKey: HighlightKey = getHighlightKey(body) ?? "underline";
  // Encolhe título longo p/ caber na caixa (some o "comendo as letras")
  const tFit = titleFit(slide.title);
  const bFit = bodyFit(text);
  const pct = ((idx + 1) / total) * 100;
  const themeId = getThemeId(body);
  const isDark = layout === "editorial" || (layout !== "light" && layout !== "feature-list" && layout !== "step-list");
  const chips = parseChips(body);
  const quoteCard = parseQuoteCard(body);
  const bodySegs = parseBoldInline(text);
  const isLast = idx === total - 1;

  const progressBar = (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "10px 20px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        zIndex: 10,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 2,
          borderRadius: 1,
          background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: isDark ? "#fff" : B.primary,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 9,
          fontWeight: 500,
          color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
        }}
      >
        {idx + 1}/{total}
      </span>
    </div>
  );

  const swipeHint = !isLast && (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isDark
          ? "linear-gradient(to right,transparent,rgba(255,255,255,0.05))"
          : "linear-gradient(to right,transparent,rgba(0,0,0,0.04))",
        zIndex: 9,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 6l6 6-6 6"
          stroke={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );

  // Tag
  const tag = (color: string) =>
    (slide.subtitle || layout !== "dark-photo") ? (
      <div
        style={{
          fontSize: 7,
          fontWeight: 600,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color,
          marginBottom: 8,
        }}
      >
        {slide.subtitle ?? ""}
      </div>
    ) : null;

  // ── imagem contida (card-top / framed / half) — geometria compartilhada ──
  // Usa o token bruto: assim o layout (com placeholder) aparece ANTES de gerar a
  // imagem, mostrando na hora onde a imagem vai entrar.
  const imgMode = getImageMode(body);
  if (imgMode === "card-top" || imgMode === "framed" || imgMode === "half") {
    const G = computeImageLayout(imgMode, PREVIEW_W, PREVIEW_H);
    const img = G.image!;
    const segs = parseTitleHighlight(slide.title);
    return (
      <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: B.lightBg }}>
        <TopBar themeId={themeId} isDark={false} handle={handle} idx={idx} total={total} />
        <div
          style={{
            position: "absolute",
            left: img.x,
            top: img.y,
            width: img.w,
            height: img.h,
            borderRadius: img.radius,
            overflow: "hidden",
            border: slide.imageUrl
              ? (img.border ? `${img.border}px solid ${B.lightBorder}` : "none")
              : `1px dashed rgba(0,0,0,0.18)`,
            background: B.lightBorder,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {slide.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: "rgba(0,0,0,0.35)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.5-3.5L9 20" />
              </svg>
              <span style={{ fontSize: 7, fontWeight: 600, letterSpacing: 0.5 }}>imagem aqui</span>
            </div>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: G.text.x,
            top: G.text.y,
            width: G.text.w,
            maxHeight: G.text.bottom - G.text.y,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: G.text.align === "center" ? "center" : "flex-start",
          }}
        >
          {slide.subtitle && (
            <div style={{ fontSize: G.font.sub, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: B.primary, marginBottom: 4, textAlign: G.text.align, flexShrink: 0 }}>
              {slide.subtitle}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: G.text.align === "center" ? "center" : "flex-start", flexShrink: 0 }}>
            {segs.map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: G.font.title,
                  lineHeight: 1.08,
                  fontWeight: 700,
                  fontStyle: s.hl ? "italic" : "normal",
                  fontFamily: s.hl ? headingFont : "inherit",
                  color: s.hl ? B.primary : "#1A1310",
                  marginRight: 3,
                }}
              >
                {s.text}
              </span>
            ))}
          </div>
          {text && (
            <div style={{
              fontSize: G.font.body * bFit.scale,
              color: "#5A4A44",
              lineHeight: 1.5,
              marginTop: 6,
              textAlign: G.text.align,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical" as const,
              WebkitLineClamp: bFit.clamp,
              overflow: "hidden",
            }}>
              {text}
            </div>
          )}
        </div>
        {/* barra de progresso clara (fundo claro) */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 20px 14px", display: "flex", alignItems: "center", gap: 8, zIndex: 10 }}>
          <div style={{ flex: 1, height: 2, borderRadius: 1, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: B.primary }} />
          </div>
          <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(0,0,0,0.3)" }}>{idx + 1}/{total}</span>
        </div>
      </div>
    );
  }

  // ── editorial (estilo capa / makemusicnow) — preview ──
  if (layout === "editorial") {
    const segs = parseTitleHighlight(slide.title);
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: B.darkBg,
        }}
      >
        <TopBar themeId={themeId} isDark={true} handle={handle} idx={idx} total={total} />
        {slide.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to bottom,rgba(10,6,5,0.15) 0%,rgba(10,6,5,0.55) 50%,rgba(10,6,5,0.94) 100%)",
              }}
            />
          </>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at 70% 18%, ${B.dark} 0%, ${B.darkBg} 62%)`,
            }}
          />
        )}
        <div style={{ position: "relative", zIndex: 2, padding: "0 16px 34px" }}>
          {slide.subtitle && (
            <div style={{ fontSize: 7, fontStyle: "italic", color: "rgba(255,255,255,0.75)", marginBottom: 5, fontFamily: "Georgia,serif" }}>
              {slide.subtitle}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "0 5px" }}>
            {segs.map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: 23 * fontScale * tFit,
                  lineHeight: 1.0,
                  textTransform: "uppercase",
                  fontFamily: headingFont,
                  color: "#fff",
                  ...brandTitleStyle,
                  ...(s.hl ? highlightStyle(hlKey, B, true) : {}),
                }}
              >
                {s.text}
              </span>
            ))}
          </div>
        </div>
        {progressBar}
        {swipeHint}
      </div>
    );
  }

  // ── imagem IA de FUNDO — o layout escolhido controla overlay/cor/posição ──
  // (editorial já foi tratado acima com sua própria arte; aqui caem dark/light/
  //  gradient/dark-photo). Antes este bloco ignorava o layout — por isso "mexer no
  //  layout não mudava nada" em slides com imagem. Agora cada layout muda de fato.
  if (slide.imageUrl && effectiveImageMode(body, true) === "bg") {
    const isLight = layout === "light";
    const isGradient = layout === "gradient";
    const titleSegs = parseTitleHighlight(slide.title);
    const overlay = isLight
      ? "linear-gradient(to bottom,rgba(250,247,242,0.25) 0%,rgba(250,247,242,0.80) 55%,rgba(250,247,242,0.97) 100%)"
      : "linear-gradient(to bottom,rgba(24,14,12,0.05) 0%,rgba(24,14,12,0.45) 55%,rgba(24,14,12,0.93) 100%)";
    const titleColor = isLight ? "#1A1310" : "#fff";
    const subColor = isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";
    const bodyColor = isLight ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.82)";
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: isGradient ? "center" : "flex-end",
          background: B.darkBg,
        }}
      >
        <TopBar themeId={themeId} isDark={!isLight} handle={handle} idx={idx} total={total} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "absolute", inset: 0, background: overlay }} />
        {isGradient && (
          <div style={{ position: "absolute", inset: 0, background: B.gradient, opacity: 0.72 }} />
        )}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            padding: isGradient ? "0 20px" : "0 20px 40px",
            textAlign: isGradient ? "center" : "left",
          }}
        >
          {slide.subtitle && (
            <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: isGradient ? "rgba(255,255,255,0.72)" : subColor, marginBottom: 8 }}>
              {slide.subtitle}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0 5px", justifyContent: isGradient ? "center" : "flex-start", marginBottom: 6 }}>
            {titleSegs.map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: 15 * fontScale * tFit,
                  fontWeight: 700,
                  lineHeight: 1.12,
                  fontFamily: headingFont,
                  color: isGradient ? "#fff" : titleColor,
                  ...brandTitleStyle,
                  ...(s.hl ? highlightStyle(hlKey, B, !isLight) : {}),
                }}
              >
                {s.text}
              </span>
            ))}
          </div>
          {text && !isGradient && (
            <div style={{
              fontSize: 9 * bFit.scale,
              color: bodyColor,
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical" as const,
              WebkitLineClamp: bFit.clamp,
              overflow: "hidden",
            }}>
              {text}
            </div>
          )}
          {isGradient && slide.cta && (
            <div style={{ display: "inline-block", marginTop: 10, padding: "7px 18px", background: B.lightBg, color: B.dark, borderRadius: 20, fontSize: 9, fontWeight: 700 }}>
              {slide.cta}
            </div>
          )}
        </div>
        {progressBar}
        {swipeHint}
      </div>
    );
  }

  // ── dark-photo ──
  if (layout === "dark-photo") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: B.darkBg,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <TopBar themeId={themeId} isDark={true} handle={handle} idx={idx} total={total} />
        {/* Simulated photo gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(160deg,#2a1810 0%,#1a0e0c 40%,#180E0C 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 70% 20%,rgba(107,26,42,0.18) 0%,transparent 65%)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 2,
            padding: "0 20px 40px",
          }}
        >
          {handle && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: B.primary,
                  border: `1px solid ${B.light}`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                {handle}
              </span>
            </div>
          )}
          {tag("rgba(255,255,255,0.5)")}
          <div
            style={{
              fontSize: 15 * fontScale * tFit,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.15,
              marginBottom: 6,
              fontFamily: headingFont,
              ...brandTitleStyle,
            }}
          >
            {slide.title}
          </div>
          {text && (
            <div style={{
              fontSize: 9 * bFit.scale,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical" as const,
              WebkitLineClamp: bFit.clamp,
              overflow: "hidden",
            }}>
              {bodySegs.map((s, i) => (
                <span key={i} style={{ fontWeight: s.bold ? 700 : 400, color: s.bold ? "#fff" : undefined }}>{s.text}</span>
              ))}
            </div>
          )}
          <RichExtras chips={chips} quoteCard={quoteCard} isDark={true} primary={B.primary} />
        </div>
        {progressBar}
        {swipeHint}
      </div>
    );
  }

  // ── gradient ──
  if (layout === "gradient") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: B.gradient,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TopBar themeId={themeId} isDark={true} handle={handle} idx={idx} total={total} />
        <div style={{ textAlign: "center", padding: "0 20px", position: "relative", zIndex: 2 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              margin: "0 auto 8px",
            }}
          />
          {handle && (
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginBottom: 6 }}>
              {handle}
            </div>
          )}
          {slide.subtitle && (
            <div style={{ fontSize: 7, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
              {slide.subtitle}
            </div>
          )}
          <div
            style={{
              fontSize: 14 * fontScale * tFit,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.15,
              marginBottom: 8,
              fontFamily: headingFont,
              ...brandTitleStyle,
            }}
          >
            {slide.title}
          </div>
          {text && (
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 10 }}>
              {text}
            </div>
          )}
          <div
            style={{
              display: "inline-block",
              padding: "7px 18px",
              background: B.lightBg,
              color: B.dark,
              borderRadius: 20,
              fontSize: 9,
              fontWeight: 700,
            }}
          >
            {slide.cta ?? (handle ? `Seguir ${handle}` : "Seguir para mais")}
          </div>
        </div>
        {progressBar}
      </div>
    );
  }

  // ── feature-list ──
  if (layout === "feature-list") {
    const items = parseFeatures(text);
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: B.lightBg,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <TopBar themeId={themeId} isDark={false} handle={handle} idx={idx} total={total} />
        <div style={{ padding: "0 20px 40px" }}>
          {slide.subtitle && (
            <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: B.primary, marginBottom: 8 }}>
              {slide.subtitle}
            </div>
          )}
          <div style={{ fontSize: 14 * fontScale * tFit, fontWeight: 700, color: B.darkBg, lineHeight: 1.15, marginBottom: 12, fontFamily: headingFont, ...brandTitleStyle }}>
            {slide.title}
          </div>
          {items.length > 0
            ? items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "7px 0",
                    borderBottom: i < items.length - 1 ? `1px solid ${B.lightBorder}` : "none",
                  }}
                >
                  <span style={{ fontSize: 12, color: B.primary, flexShrink: 0 }}>{it.icon}</span>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: B.darkBg }}>{it.title}</div>
                    {it.desc && <div style={{ fontSize: 8, color: "#8A7A74", marginTop: 1 }}>{it.desc}</div>}
                  </div>
                </div>
              ))
            : <div style={{ fontSize: 9 * bFit.scale, color: "#4A3A34", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical" as const, WebkitLineClamp: bFit.clamp }}>{text}</div>
          }
        </div>
        {progressBar}
        {swipeHint}
      </div>
    );
  }

  // ── step-list ──
  if (layout === "step-list") {
    const steps = parseSteps(text);
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: B.lightBg,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <TopBar themeId={themeId} isDark={false} handle={handle} idx={idx} total={total} />
        <div style={{ padding: "0 20px 40px" }}>
          {slide.subtitle && (
            <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: B.primary, marginBottom: 8 }}>
              {slide.subtitle}
            </div>
          )}
          <div style={{ fontSize: 14 * fontScale * tFit, fontWeight: 700, color: B.darkBg, lineHeight: 1.15, marginBottom: 12, fontFamily: headingFont, ...brandTitleStyle }}>
            {slide.title}
          </div>
          {steps.length > 0
            ? steps.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "7px 0",
                    borderBottom: i < steps.length - 1 ? `1px solid ${B.lightBorder}` : "none",
                  }}
                >
                  <div style={{ fontSize: 18, fontFamily: "Georgia,serif", fontWeight: 300, color: B.light, lineHeight: 1, minWidth: 24 }}>
                    {s.num}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: B.darkBg }}>{s.title}</div>
                    {s.desc && <div style={{ fontSize: 8, color: "#4A3A34", marginTop: 1 }}>{s.desc}</div>}
                  </div>
                </div>
              ))
            : <div style={{ fontSize: 9 * bFit.scale, color: "#4A3A34", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical" as const, WebkitLineClamp: bFit.clamp }}>{text}</div>
          }
        </div>
        {progressBar}
        {swipeHint}
      </div>
    );
  }

  // ── light ──
  if (layout === "light") {
    const isRevista = themeId === "revista";
    const isEditorialLight = themeId === "editorial-light";
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: isRevista ? "#FFFFFF" : B.lightBg,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <TopBar themeId={themeId} isDark={false} handle={handle} idx={idx} total={total} />
        <div style={{ padding: "0 20px 40px" }}>
          {isRevista && (
            <div style={{ height: 1, background: "rgba(0,0,0,0.15)", marginBottom: 10 }} />
          )}
          {isEditorialLight && (
            <div style={{ height: 2, background: B.primary, marginBottom: 10, width: 28 }} />
          )}
          {slide.subtitle && (
            <div style={{
              fontSize: 7,
              fontWeight: isRevista ? 800 : 600,
              letterSpacing: isRevista ? "2px" : "1.5px",
              textTransform: "uppercase",
              color: isRevista ? "#111" : B.primary,
              marginBottom: 8,
            }}>
              {slide.subtitle}
            </div>
          )}
          <div style={{
            fontSize: 15 * fontScale * tFit,
            fontWeight: 700,
            color: B.darkBg,
            lineHeight: 1.15,
            marginBottom: 8,
            fontFamily: headingFont,
            ...brandTitleStyle,
            textTransform: isRevista ? "uppercase" : "none",
            letterSpacing: isRevista ? "0.3px" : "normal",
          }}>
            {slide.title}
          </div>
          {text && (
            <div style={{
              fontSize: 9 * bFit.scale,
              color: "#4A3A34",
              lineHeight: 1.55,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical" as const,
              WebkitLineClamp: bFit.clamp,
              overflow: "hidden",
            }}>
              {bodySegs.map((s, i) => (
                <span key={i} style={{ fontWeight: s.bold ? 700 : 400, color: s.bold ? B.darkBg : undefined }}>{s.text}</span>
              ))}
            </div>
          )}
          <RichExtras chips={chips} quoteCard={quoteCard} isDark={false} primary={B.primary} />
        </div>
        {progressBar}
        {swipeHint}
      </div>
    );
  }

  // ── dark (default) ──
  const isBoldSans = themeId === "bold-sans";
  const isEditorialDark = themeId === "editorial-dark";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: isBoldSans ? "#0A0A0A" : isEditorialDark ? "#1E1E1E" : B.darkBg,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <TopBar themeId={themeId} isDark={true} handle={handle} idx={idx} total={total} />
      <div style={{ padding: "0 20px 40px" }}>
        {isEditorialDark && (
          <div style={{ height: 1, background: B.primary, marginBottom: 10, width: 28 }} />
        )}
        {slide.subtitle && (
          <div style={{
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: isBoldSans ? "2px" : "1.5px",
            textTransform: "uppercase",
            color: isBoldSans ? B.primary : isEditorialDark ? "rgba(255,255,255,0.45)" : B.light,
            marginBottom: 8,
          }}>
            {slide.subtitle}
          </div>
        )}
        <div style={{
          fontSize: (isBoldSans ? 18 : 15) * fontScale * tFit,
          fontWeight: 700,
          color: "#fff",
          lineHeight: isBoldSans ? 0.95 : 1.15,
          marginBottom: 8,
          fontFamily: headingFont,
          textTransform: isBoldSans ? "uppercase" : "none",
          letterSpacing: isEditorialDark ? "-0.3px" : "normal",
          ...brandTitleStyle,
        }}>
          {slide.title}
        </div>
        {text && (
          <div style={{
            fontSize: 9 * bFit.scale,
            color: isEditorialDark ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.65)",
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical" as const,
            WebkitLineClamp: bFit.clamp,
            overflow: "hidden",
          }}>
            {bodySegs.map((s, i) => (
              <span key={i} style={{ fontWeight: s.bold ? 700 : 400, color: s.bold ? "#fff" : undefined }}>{s.text}</span>
            ))}
          </div>
        )}
        <RichExtras chips={chips} quoteCard={quoteCard} isDark={true} primary={B.primary} />
      </div>
      {progressBar}
      {swipeHint}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface Props {
  slides: Slide[];
  pieceId: string;
  onSlidesChange: (slides: Slide[]) => void;
  brandColors?: { hex: string; role?: string }[];
  brandHandle?: string | null;
  brandFontHeading?: string | null;
  brandFontBody?: string | null;
}

export function CarouselStudio({ slides, pieceId, onSlidesChange, brandColors, brandHandle, brandFontHeading }: Props) {
  const B = deriveBrandTokens(brandColors, brandHandle);
  const [current, setCurrent] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Slide>(() => slides[0]);
  const [saving, startSave] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [exportIdx, setExportIdx] = useState<number | null>(null);
  const [exportError, setExportError] = useState("");
  const [imgModel, setImgModel] = useState(IMAGE_MODEL_DEFS[0].key);
  const [libImages, setLibImages] = useState<string[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  // Painel lateral de imagens estilo Canva (todas geradas + enviadas, persistente).
  const [libPanelOpen, setLibPanelOpen] = useState(false);
  // Modo de encaixe desejado para a próxima imagem gerada/enviada (quando o slide
  // ainda não tem imagem). Com imagem, o modo vem do token [Image:] do slide.
  const [desiredMode, setDesiredMode] = useState<ImageMode>("card-top");
  // Ajuste livre do usuário pro escritor de prompt (ex.: "sem pessoas", "mesa escura").
  const [imgHint, setImgHint] = useState("");
  const [genImg, setGenImg] = useState(false);
  const [editImgBusy, setEditImgBusy] = useState(false);
  const [imgError, setImgError] = useState("");
  const [uploading, setUploading] = useState(false);
  // Aba ativa do inspetor (divulgação progressiva — menos poluição).
  const [panelTab, setPanelTab] = useState<"texto" | "imagem" | "estilo">("imagem");
  // Nós escondidos em tamanho real (216×270) usados p/ exportar PNG via html2canvas.
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);

  const currentSlide = slides[current];

  // Carrega a fonte de TÍTULO da marca (ex.: Playfair Display) no navegador com
  // pesos pesados (700/800/900). Sem isso o preview E o PNG (html-to-image) caíam
  // no fallback system-ui — por isso a fonte da marca parecia "fraca".
  useEffect(() => {
    const fam = brandFontHeading?.trim();
    if (!fam) return;
    const id = `brandfont-${fam.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      fam
    )}:wght@400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
  }, [brandFontHeading]);

  /** Aplica nova imagem ao slide atual, empurrando a anterior pro histórico (máx 8). */
  function applyNewImage(newUrl: string, opts?: { ensureModeWith?: ImageMode }) {
    const next = slides.map((s) => {
      if (s.index !== currentSlide.index) return s;
      const prev = s.imageUrl;
      const hist = s.imageHistory ?? [];
      const nextHist =
        prev && prev !== newUrl
          ? [prev, ...hist.filter((u) => u !== prev && u !== newUrl)].slice(0, 8)
          : hist.filter((u) => u !== newUrl);
      const body =
        opts?.ensureModeWith && getImageMode(s.body) === "none"
          ? setImageModeToken(s.body ?? "", opts.ensureModeWith)
          : (s.body ?? "");
      return { ...s, imageUrl: newUrl, imageHistory: nextHist, body };
    });
    onSlidesChange(next);
    startSave(() => void updateSlides(pieceId, next));
  }

  async function loadLibrary(force = false) {
    if (libImages.length > 0 && !force) return;
    setLibLoading(true);
    try {
      const res = await fetch("/api/images/library");
      const data = await res.json();
      setLibImages(data.images ?? []);
    } catch {
      // silent
    } finally {
      setLibLoading(false);
    }
  }

  function openLibrary() {
    setLibOpen(true);
    void loadLibrary();
  }

  function openLibPanel() {
    setLibPanelOpen(true);
    void loadLibrary();
  }

  /** Prepende uma imagem recém-criada à biblioteca (sem refetch), evitando duplicar. */
  function addToLibrary(url: string) {
    setLibImages((prev) => [url, ...prev.filter((u) => u !== url)]);
  }

  /** Aplica uma imagem da biblioteca ao slide atual, garantindo um modo de encaixe. */
  function applyLibraryImage(url: string) {
    applyNewImage(url, {
      ensureModeWith: getImageMode(currentSlide.body) === "none" ? desiredMode : undefined,
    });
  }

  async function handleGenerateImage() {
    setGenImg(true);
    setImgError("");
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceId,
          slideIndex: currentSlide.index,
          model: imgModel,
          topic: currentSlide.title,
          imageMode: effectiveImageMode(currentSlide.body, true) === "bg" ? desiredMode : getImageMode(currentSlide.body),
          userHint: imgHint.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        applyNewImage(data.imageUrl as string, { ensureModeWith: desiredMode });
        addToLibrary(data.imageUrl as string);
      } else {
        setImgError(data.error ?? "Falha ao gerar imagem");
      }
    } catch {
      setImgError("Erro de conexão");
    } finally {
      setGenImg(false);
    }
  }

  /** Edita a imagem ATUAL (mantém a foto, aplica só a instrução) via Nano Banana. */
  async function handleEditImage() {
    if (!currentSlide.imageUrl || !imgHint.trim()) return;
    setEditImgBusy(true);
    setImgError("");
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceId,
          slideIndex: currentSlide.index,
          model: imgModel,
          editImageUrl: currentSlide.imageUrl,
          userHint: imgHint.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        applyNewImage(data.imageUrl as string);
        addToLibrary(data.imageUrl as string);
      } else {
        setImgError(data.error ?? "Falha ao editar imagem");
      }
    } catch {
      setImgError("Erro de conexão");
    } finally {
      setEditImgBusy(false);
    }
  }

  async function handleUploadImage(file: File) {
    setUploading(true);
    setImgError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pieceId", pieceId);
      const res = await fetch("/api/images/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        applyNewImage(data.imageUrl as string, { ensureModeWith: desiredMode });
        addToLibrary(data.imageUrl as string);
      } else {
        setImgError(data.error ?? "Falha ao fazer upload");
      }
    } catch {
      setImgError("Erro de conexão");
    } finally {
      setUploading(false);
    }
  }

  /** Volta para uma imagem do histórico (a atual vai pro histórico). */
  function handleRestoreImage(url: string) {
    applyNewImage(url);
  }

  function handleRemoveImage() {
    const next = slides.map((s) => {
      if (s.index !== currentSlide.index) return s;
      const prev = s.imageUrl;
      const hist = s.imageHistory ?? [];
      const nextHist = prev ? [prev, ...hist.filter((u) => u !== prev)].slice(0, 8) : hist;
      return { ...s, imageUrl: undefined, imageHistory: nextHist };
    });
    onSlidesChange(next);
    startSave(() => void updateSlides(pieceId, next));
  }

  async function handleExportPng() {
    setExporting(true);
    setExportError("");
    try {
      // Espera as imagens carregarem, mas NUNCA trava: cada uma tem timeout de 5s.
      // (uma imagem quebrada que já está "complete" não dispara load/error de novo)
      const allImgs = exportRefs.current
        .filter(Boolean)
        .flatMap((node) => Array.from(node!.querySelectorAll("img")));
      await Promise.all(
        allImgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                const done = () => resolve();
                img.addEventListener("load", done, { once: true });
                img.addEventListener("error", done, { once: true });
                setTimeout(done, 5000);
              })
        )
      );

      // PREVIEW_W=216 → escala 5 = 1080px de largura (tamanho cheio do Instagram).
      const SCALE = 1080 / PREVIEW_W;
      let exported = 0;

      for (let i = 0; i < slides.length; i++) {
        const node = exportRefs.current[i];
        if (!node) continue;
        setExportIdx(i);
        try {
          // html-to-image renderiza via foreignObject usando o motor do navegador,
          // que já desenha oklch() (Tailwind v4) igual à tela. pixelRatio 5 = 1080×1350.
          const dataUrl = await toPng(node, {
            pixelRatio: SCALE,
            width: PREVIEW_W,
            height: PREVIEW_H,
            backgroundColor: "#ffffff",
            cacheBust: true,
          });
          const link = document.createElement("a");
          link.download = `slide-${String(i + 1).padStart(2, "0")}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          link.remove();
          exported++;
          await new Promise((r) => setTimeout(r, 150));
        } catch (err) {
          console.error(`[export] slide ${i + 1} falhou:`, err);
        }
      }

      if (exported === 0) {
        setExportError("Não consegui gerar os PNGs. Veja o console (F12) e me avise o erro.");
      }
    } catch (err) {
      console.error("[export] erro geral:", err);
      setExportError(err instanceof Error ? err.message : "Erro ao exportar.");
    } finally {
      setExportIdx(null);
      setExporting(false);
    }
  }

  // ── Publicação (Ayrshare) ──
  const [pubPlatforms, setPubPlatforms] = useState<string[]>(["instagram"]);
  const [pubSchedule, setPubSchedule] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [pubMsg, setPubMsg] = useState("");

  function togglePlatform(p: string) {
    setPubPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handlePublish() {
    if (pubPlatforms.length === 0) {
      setPubMsg("Escolha ao menos uma rede.");
      return;
    }
    setPublishing(true);
    setPubMsg("");
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceId,
          platforms: pubPlatforms,
          scheduleDate: pubSchedule ? new Date(pubSchedule).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPubMsg(pubSchedule ? "✓ Agendado com sucesso!" : "✓ Publicado com sucesso!");
      } else {
        setPubMsg(data.error ?? "Falha ao publicar.");
      }
    } catch {
      setPubMsg("Erro de conexão.");
    } finally {
      setPublishing(false);
    }
  }

  function goTo(idx: number) {
    const clamped = Math.max(0, Math.min(slides.length - 1, idx));
    setCurrent(clamped);
    setDraft({ ...slides[clamped] });
    setEditing(false);
  }

  function handleEdit() {
    setDraft({ ...currentSlide });
    setEditing(true);
  }

  function handleCancel() {
    setDraft({ ...currentSlide });
    setEditing(false);
  }

  function handleSave() {
    const next = slides.map((s) => (s.index === draft.index ? draft : s));
    onSlidesChange(next);
    setEditing(false);
    startSave(() => {
      void updateSlides(pieceId, next);
    });
  }

  function persist(next: Slide[]) {
    onSlidesChange(next);
    startSave(() => void updateSlides(pieceId, next));
  }

  function applyFont(fontKey: FontKey) {
    const next = slides.map((s) => ({ ...s, body: setFontToken(s.body ?? "", fontKey) }));
    persist(next);
  }

  function applyHighlight(key: HighlightKey) {
    const next = slides.map((s) => ({ ...s, body: setHighlightToken(s.body ?? "", key) }));
    persist(next);
  }

  function applyTheme(themeId: ThemeId) {
    const def = CAROUSEL_THEMES.find((t) => t.id === themeId)!;
    const next = slides.map((s, i) => {
      const isCover = i === 0;
      const isCta = i === slides.length - 1 && slides.length > 1;
      const targetLayout = isCover ? def.coverLayout : isCta ? def.ctaLayout : def.contentLayout;
      const imgMode = getImageMode(s.body);
      const hasContainedImage = imgMode === "card-top" || imgMode === "framed" || imgMode === "half";
      const hasBgImage = imgMode === "bg" && !!s.imageUrl;
      // Slides com imagem contida ou de fundo preservam seu layout
      let body = (hasContainedImage || hasBgImage) ? (s.body ?? "") : setLayoutToken(s.body ?? "", targetLayout);
      body = setThemeToken(body, themeId);
      return { ...s, body };
    });
    persist(next);
  }

  function applyLayout(layoutKey: string) {
    const next = slides.map((s) =>
      s.index === currentSlide.index ? { ...s, body: setLayoutToken(s.body ?? "", layoutKey) } : s
    );
    persist(next);
    if (editing) setDraft((d) => ({ ...d, body: setLayoutToken(d.body ?? "", layoutKey) }));
  }

  function applyImageMode(mode: ImageMode) {
    setDesiredMode(mode);
    // Grava o token sempre — assim o layout (com placeholder) aparece na hora,
    // mesmo antes de gerar/subir a imagem.
    const next = slides.map((s) =>
      s.index === currentSlide.index ? { ...s, body: setImageModeToken(s.body ?? "", mode) } : s
    );
    persist(next);
  }

  const IMG_MODE_KEYS: ImageMode[] = ["card-top", "framed", "half", "bg"];

  function addSlide() {
    const insertAt = current + 1;
    const blank: Slide = { index: insertAt, title: "Novo slide", body: "Escreva o conteúdo aqui\n[Layout: dark]" };
    const next = reindex([...slides.slice(0, insertAt), blank, ...slides.slice(insertAt)]);
    persist(next);
    setCurrent(insertAt);
    setEditing(false);
  }

  function removeSlide() {
    if (slides.length <= 1) return;
    const next = reindex(slides.filter((_, i) => i !== current));
    persist(next);
    setCurrent(Math.max(0, current - 1));
    setEditing(false);
  }

  function moveSlide(dir: -1 | 1) {
    const j = current + dir;
    if (j < 0 || j >= slides.length) return;
    const arr = [...slides];
    [arr[current], arr[j]] = [arr[j], arr[current]];
    const next = reindex(arr);
    persist(next);
    setCurrent(j);
  }

  const layout = getLayout(currentSlide.body ?? "");

  // DnD sensors — requer mover 8px antes de ativar (evita conflito com o clique)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.index === active.id);
    const newIdx = slides.findIndex((s) => s.index === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = reindex(arrayMove(slides, oldIdx, newIdx));
    persist(next);
    setCurrent(newIdx);
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Studio · {slides.length} slides
          </p>
          {saving && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          {exportError && <span className="text-[11px] text-destructive">{exportError}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleExportPng()}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Image className="size-3.5" />
            )}
            {exporting ? `Exportando ${(exportIdx ?? 0) + 1}/${slides.length}…` : "Exportar PNG"}
          </button>
          <a
            href={`/api/generate/carousel?pieceId=${pieceId}`}
            download
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Download className="size-3.5" />
            Baixar HTML
          </a>
          <button
            onClick={openLibPanel}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            title="Biblioteca de imagens (todas as geradas e enviadas)"
          >
            <Images className="size-3.5" />
            Biblioteca
          </button>

          {/* Publicar */}
          <Dialog>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                <Send className="size-3.5" />
                Publicar
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Publicar carrossel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Onde publicar
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "instagram", label: "Instagram" },
                      { id: "tiktok", label: "TikTok" },
                      { id: "linkedin", label: "LinkedIn" },
                      { id: "facebook", label: "Facebook" },
                      { id: "x", label: "X" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => togglePlatform(p.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          pubPlatforms.includes(p.id)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Agendar (opcional)
                  </p>
                  <Input
                    type="datetime-local"
                    value={pubSchedule}
                    onChange={(e) => setPubSchedule(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Deixe em branco para publicar agora.
                  </p>
                </div>

                <Button onClick={() => void handlePublish()} disabled={publishing} className="w-full">
                  {publishing ? (
                    <>
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 size-4" />
                      {pubSchedule ? "Agendar" : "Publicar agora"}
                    </>
                  )}
                </Button>

                {pubMsg && (
                  <p
                    className={`text-xs ${
                      pubMsg.startsWith("✓") ? "text-emerald-600 font-medium" : "text-destructive"
                    }`}
                  >
                    {pubMsg}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* ── Preview panel ── */}
        <div className="flex flex-col items-center gap-4 bg-muted/20 px-6 py-5 border-b lg:border-b-0 lg:border-r lg:w-[440px] shrink-0">
          {/* Navigation */}
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="rounded-full p-1.5 border bg-background hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="text-[11px] text-muted-foreground font-medium">
              {current + 1} / {slides.length}
            </span>
            <button
              onClick={() => goTo(current + 1)}
              disabled={current === slides.length - 1}
              className="rounded-full p-1.5 border bg-background hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {/* Slide visual — base 216x270 escalada p/ ~384px (fontes proporcionais) */}
          <div
            className="rounded-lg overflow-hidden shadow-lg border border-border/50"
            style={{ width: 384, height: 480, position: "relative" }}
          >
            <div
              style={{
                width: 216,
                height: 270,
                transform: "scale(1.7778)",
                transformOrigin: "top left",
                position: "absolute",
                top: 0,
                left: 0,
              }}
            >
              <SlideVisual slide={currentSlide} idx={current} total={slides.length} B={B} headingFont={resolveFontFamily(getFontKey(currentSlide.body), brandFontHeading)} />
            </div>
          </div>

          {/* Layout label */}
          <div className="text-center">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-background text-muted-foreground">
              {LAYOUT_LABELS[layout] ?? layout}
            </span>
          </div>

          {/* Controles de slides */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => moveSlide(-1)}
              disabled={current === 0}
              title="Mover para a esquerda"
              className="rounded-md border p-1.5 hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              onClick={addSlide}
              title="Adicionar slide"
              className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-medium hover:bg-accent transition-colors"
            >
              <Plus className="size-3.5" /> Slide
            </button>
            <button
              onClick={removeSlide}
              disabled={slides.length <= 1}
              title="Remover slide"
              className="rounded-md border p-1.5 hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              onClick={() => moveSlide(1)}
              disabled={current === slides.length - 1}
              title="Mover para a direita"
              className="rounded-md border p-1.5 hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {/* Dot navigation */}
          <div className="flex gap-1 flex-wrap justify-center max-w-[200px]">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                title={`Slide ${i + 1}`}
                className={`rounded-full transition-all duration-150 ${
                  i === current
                    ? "w-4 h-2 bg-primary"
                    : "w-2 h-2 bg-muted-foreground/25 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>

          {/* Thumbnail strip — arrastar para reordenar */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={slides.map((s) => s.index)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-2 overflow-x-auto w-full pb-1">
                {slides.map((s, i) => (
                  <SortableThumbnail
                    key={s.index}
                    slide={s}
                    idx={i}
                    total={slides.length}
                    isCurrent={i === current}
                    B={B}
                    headingFont={resolveFontFamily(getFontKey(s.body), brandFontHeading)}
                    onClick={() => goTo(i)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* ── Editor panel ── */}
        <div className="flex-1 min-w-0 p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-semibold">Slide {current + 1}</p>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-background text-muted-foreground">
              {LAYOUT_LABELS[layout] ?? layout}
            </span>
          </div>

          {/* Abas do inspetor (divulgação progressiva) */}
          <div className="flex items-center gap-1 mb-4 border-b">
            {([
              { id: "texto", label: "Texto" },
              { id: "imagem", label: "Imagem" },
              { id: "estilo", label: "Estilo" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setPanelTab(t.id)}
                className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  panelTab === t.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Aba ESTILO ── */}
          {panelTab === "estilo" && (
          <div className="space-y-5">
            {/* Tema do carrossel (kit 1-clique, aplica em todos os slides) */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                Tema do carrossel
              </p>
              <p className="text-[10px] text-muted-foreground/60 mb-2">
                Aplica layout + estilo em todos os slides de uma vez
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CAROUSEL_THEMES.map((t) => {
                  const activeTheme = getThemeId(currentSlide.body ?? "");
                  const isActive = activeTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => applyTheme(t.id)}
                      className={`rounded-lg border p-2.5 text-left transition-colors ${
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-foreground/30 hover:bg-muted/40"
                      }`}
                    >
                      <div className={`text-[11px] font-semibold mb-0.5 ${isActive ? "text-primary" : ""}`}>
                        {t.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fonte do carrossel */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                Fonte dos títulos
              </p>
              <p className="text-[10px] text-muted-foreground/60 mb-2">
                Aplica em todos os slides de uma vez
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FONT_OPTIONS.filter((f) => f.key !== "brand" || brandFontHeading).map((f) => {
                  const activeFontKey = getFontKey(currentSlide.body ?? "");
                  const isActive = activeFontKey === f.key || (activeFontKey === null && f.key === "serif");
                  return (
                    <button
                      key={f.key}
                      onClick={() => applyFont(f.key)}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] border transition-colors ${
                        isActive
                          ? "border-primary bg-primary/5 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                      style={{ fontFamily: f.key === "brand" && brandFontHeading ? `"${brandFontHeading}", sans-serif` : f.preview }}
                    >
                      {f.label}{f.key === "brand" && brandFontHeading ? ` (${brandFontHeading})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Destaque da palavra-chave (*asteriscos*) */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                Destaque da palavra
              </p>
              <p className="text-[10px] text-muted-foreground/60 mb-2">
                Marque a palavra com *asteriscos* no texto. Aplica em todos os slides.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {HIGHLIGHT_OPTIONS.map((h) => {
                  const activeHl = getHighlightKey(currentSlide.body ?? "");
                  const isActive = activeHl === h.key || (activeHl === null && h.key === "underline");
                  return (
                    <button
                      key={h.key}
                      onClick={() => applyHighlight(h.key)}
                      title={h.hint}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] border transition-colors ${
                        isActive
                          ? "border-primary bg-primary/5 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      {h.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Layout do slide atual (override individual) */}
            <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Layout deste slide
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_LAYOUTS.map((l) => (
                <button
                  key={l}
                  onClick={() => applyLayout(l)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    layout === l
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {LAYOUT_LABELS[l]}
                </button>
              ))}
              {(layout === "feature-list" || layout === "step-list") && (
                <span className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-primary bg-primary text-primary-foreground">
                  {LAYOUT_LABELS[layout]}
                </span>
              )}
            </div>
            </div>
          </div>
          )}

          {/* ── Aba TEXTO ── */}
          {panelTab === "texto" && (editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Título
                </label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Subtítulo / Tag
                </label>
                <Input
                  value={draft.subtitle ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, subtitle: e.target.value || undefined }))
                  }
                  placeholder="Opcional"
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Corpo
                </label>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 mb-1">
                  Mantenha a linha <code className="bg-muted px-1 rounded">[Layout: …]</code> no final
                </p>
                <Textarea
                  value={draft.body ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  rows={8}
                  className="mt-0.5 text-xs font-mono"
                />
              </div>
              {layout === "gradient" || draft.cta !== undefined ? (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    CTA
                  </label>
                  <Input
                    value={draft.cta ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, cta: e.target.value || undefined }))
                    }
                    placeholder="Seguir para mais"
                    className="mt-1 text-sm"
                  />
                </div>
              ) : null}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 size-3.5" />
                  )}
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={handleEdit}>
                  <Pencil className="mr-1.5 size-3.5" /> Editar textos
                </Button>
              </div>
              <FieldBlock label="Título" value={currentSlide.title} mono={false} />
              {currentSlide.subtitle && (
                <FieldBlock label="Subtítulo" value={currentSlide.subtitle} mono={false} />
              )}
              {currentSlide.body && (
                <FieldBlock label="Corpo" value={cleanBody(currentSlide.body)} mono />
              )}
              {currentSlide.cta && (
                <FieldBlock label="CTA" value={currentSlide.cta} mono={false} highlight />
              )}
            </div>
          ))}

          {/* ── Aba IMAGEM ── */}
          {panelTab === "imagem" && (
            <div>
              {/* ── Imagem do slide ── */}
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Image className="size-3.5 text-primary" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Imagem do slide
                  </p>
                </div>

                {/* Modo de encaixe da imagem */}
                <div className="mb-3">
                  <p className="text-[10px] text-muted-foreground/70 mb-1.5">Como a imagem aparece</p>
                  <div className="flex flex-wrap gap-1.5">
                    {IMG_MODE_KEYS.map((m) => {
                      const tokenMode = getImageMode(currentSlide.body);
                      const activeMode =
                        tokenMode !== "none"
                          ? tokenMode
                          : currentSlide.imageUrl
                            ? "bg"
                            : desiredMode;
                      return (
                        <button
                          key={m}
                          onClick={() => applyImageMode(m)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                            activeMode === m
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                          }`}
                        >
                          {IMAGE_MODE_LABELS[m]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ajuste livre pra IA escrever o prompt da imagem */}
                <div className="mb-3">
                  <p className="text-[10px] text-muted-foreground/70 mb-1.5">
                    Ajustar a imagem <span className="text-muted-foreground/50">(opcional — a IA decide o resto)</span>
                  </p>
                  <Input
                    value={imgHint}
                    onChange={(e) => setImgHint(e.target.value)}
                    placeholder='Ex: "sem pessoas", "mesa escura com notebook", "mais minimalista"'
                    className="text-xs h-8"
                  />
                </div>

                {currentSlide.imageUrl ? (
                  <div className="space-y-2">
                    {/* Visualização grande e inteira (clique pra ampliar) */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <button
                          className="block w-full rounded-md border bg-[repeating-conic-gradient(#0000000a_0_25%,transparent_0_50%)] bg-[length:16px_16px] overflow-hidden"
                          title="Ver em tamanho real"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={currentSlide.imageUrl}
                            alt=""
                            className="w-full max-h-72 object-contain mx-auto"
                          />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Imagem do slide {current + 1}</DialogTitle>
                        </DialogHeader>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={currentSlide.imageUrl} alt="" className="w-full rounded-lg" />
                      </DialogContent>
                    </Dialog>

                    {/* Editar ESTA imagem (mantém a foto, aplica só o ajuste) */}
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => void handleEditImage()}
                      disabled={editImgBusy || genImg || uploading || !imgHint.trim()}
                      title={!imgHint.trim() ? "Escreva o ajuste no campo acima primeiro" : "Mantém a imagem e aplica só o ajuste"}
                    >
                      {editImgBusy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Wand2 className="mr-1.5 size-3.5" />}
                      Editar esta imagem
                    </Button>
                    <p className="text-[10px] text-muted-foreground/70 -mt-1">
                      Edita a imagem atual (ex.: “adiciona um símbolo do Claude”). Para uma imagem totalmente nova, use “Gerar nova”.
                    </p>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={() => void handleGenerateImage()}
                        disabled={genImg || uploading || editImgBusy}
                      >
                        {genImg ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                        Gerar nova
                      </Button>
                      <label className="flex-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs pointer-events-none"
                          disabled={genImg || uploading || editImgBusy}
                          asChild={false}
                        >
                          {uploading ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <Upload className="mr-1.5 size-3.5" />
                          )}
                          Trocar foto
                        </Button>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUploadImage(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <Button size="sm" variant="ghost" onClick={handleRemoveImage} disabled={genImg || uploading || editImgBusy}>
                        <X className="size-3.5" />
                      </Button>
                    </div>

                    {/* Histórico de imagens deste slide */}
                    {(currentSlide.imageHistory?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground/70 mt-1 mb-1">Versões anteriores (clique pra voltar)</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {currentSlide.imageHistory!.map((url, i) => (
                            <button
                              key={url + i}
                              onClick={() => handleRestoreImage(url)}
                              disabled={genImg || uploading || editImgBusy}
                              className="shrink-0 rounded border hover:border-primary transition-colors disabled:opacity-50"
                              title="Voltar para esta imagem"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="h-12 w-12 object-cover rounded" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      Suba sua própria foto ou gere um fundo no estilo da marca via IA.
                    </p>
                    {/* Upload própria foto */}
                    <label className="block">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs pointer-events-none"
                        disabled={uploading || genImg}
                        asChild={false}
                      >
                        {uploading ? (
                          <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Enviando foto…</>
                        ) : (
                          <><Upload className="mr-1.5 size-3.5" />Subir minha foto</>
                        )}
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadImage(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <div className="relative flex items-center gap-2 py-0.5">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground">ou gerar com IA</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {IMAGE_MODEL_DEFS.map((m) => (
                        <button
                          key={m.key}
                          onClick={() => setImgModel(m.key)}
                          title={m.hint}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                            imgModel === m.key
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => void handleGenerateImage()}
                      disabled={genImg || uploading}
                    >
                      {genImg ? (
                        <>
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          Gerando imagem…
                        </>
                      ) : (
                        <>
                          <Image className="mr-1.5 size-3.5" />
                          Gerar fundo IA
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {imgError && <p className="text-[11px] text-destructive mt-2">{imgError}</p>}

                {/* Biblioteca de imagens geradas */}
                <div className="mt-3 border-t pt-3">
                  <button
                    className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                    onClick={() => libOpen ? setLibOpen(false) : void openLibrary()}
                  >
                    <Image className="size-3" />
                    Imagens geradas com IA
                    <span className="ml-auto text-[10px]">{libOpen ? "▲" : "▼"}</span>
                  </button>
                  {libOpen && (
                    <div className="mt-2">
                      {libLoading ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-2">
                          <Loader2 className="size-3 animate-spin" /> Carregando…
                        </div>
                      ) : libImages.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground py-2">Nenhuma imagem gerada ainda.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                          {libImages.map((url, i) => (
                            <button
                              key={url + i}
                              onClick={() => {
                                applyNewImage(url, { ensureModeWith: getImageMode(currentSlide.body) === "none" ? "bg" : undefined });
                                setLibOpen(false);
                              }}
                              className="rounded border hover:border-primary transition-colors aspect-square overflow-hidden"
                              title="Usar esta imagem"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Biblioteca de imagens estilo Canva (drawer lateral, persistente) ── */}
      {libPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setLibPanelOpen(false)}
          />
          <div className="relative h-full w-full max-w-sm bg-card border-l shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <div className="flex items-center gap-2">
                <Images className="size-4" />
                <p className="text-sm font-semibold">Biblioteca de imagens</p>
                {libImages.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">{libImages.length}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void loadLibrary(true)}
                  disabled={libLoading}
                  className="rounded-md p-1.5 hover:bg-accent transition-colors disabled:opacity-50"
                  title="Atualizar"
                >
                  <Loader2 className={`size-4 ${libLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setLibPanelOpen(false)}
                  className="rounded-md p-1.5 hover:bg-accent transition-colors"
                  title="Fechar"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-b shrink-0">
              <label className="flex items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs font-medium cursor-pointer transition-colors hover:bg-accent">
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {uploading ? "Enviando…" : "Enviar imagem do computador"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadImage(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="text-[11px] text-muted-foreground mt-2">
                Clique numa imagem para aplicá-la ao <strong>slide {current + 1}</strong>.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {libLoading && libImages.length === 0 ? (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-10">
                  <Loader2 className="size-4 animate-spin" /> Carregando…
                </div>
              ) : libImages.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-10">
                  Nenhuma imagem ainda.<br />Gere ou envie uma imagem para começar.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {libImages.map((url, i) => (
                    <button
                      key={url + i}
                      onClick={() => applyLibraryImage(url)}
                      className="group relative rounded-lg border hover:border-primary transition-colors aspect-square overflow-hidden"
                      title="Aplicar ao slide atual"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <span className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nós escondidos em tamanho real (216×270) — fonte única do PNG via html-to-image.
          Renderizam o MESMO SlideVisual da tela, então o download é idêntico ao preview. */}
      <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, zIndex: -1, pointerEvents: "none" }}>
        {slides.map((s, i) => (
          <div
            key={s.index}
            ref={(el) => { exportRefs.current[i] = el; }}
            style={{ width: PREVIEW_W, height: PREVIEW_H, overflow: "hidden" }}
          >
            <SlideVisual
              slide={s}
              idx={i}
              total={slides.length}
              B={B}
              headingFont={resolveFontFamily(getFontKey(s.body), brandFontHeading)}
              forExport
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={`text-sm whitespace-pre-wrap leading-relaxed ${
          mono ? "font-mono text-xs text-muted-foreground" : ""
        } ${highlight ? "font-medium text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
