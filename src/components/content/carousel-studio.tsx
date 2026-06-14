"use client";

import { useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  Image,
  Loader2,
  Pencil,
  Send,
  Upload,
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

// ── Slide parsing helpers ──────────────────────────────────────────────────

function getLayout(body: string): string {
  const m = body.match(/\[Layout:\s*([a-z-]+)\]/i);
  return m?.[1]?.toLowerCase() ?? "dark";
}

function cleanBody(body: string): string {
  return body.replace(/\n?\[[^\]:]+:[^\]]*\]/gi, "").trim();
}

function parseFeatures(body: string) {
  return body.split("\n").filter((l) => l.includes("|")).map((l) => {
    const [icon = "", title = "", desc = ""] = l.split("|").map((p) => p.trim());
    return { icon, title, desc };
  }).filter((i) => i.title).slice(0, 4);
}

function parseSteps(body: string) {
  return body.split("\n").filter((l) => l.includes("|")).map((l) => {
    const [num = "01", title = "", desc = ""] = l.split("|").map((p) => p.trim());
    return { num, title, desc };
  }).filter((i) => i.title).slice(0, 4);
}

const LAYOUT_LABELS: Record<string, string> = {
  "dark-photo": "Escuro c/ foto",
  dark: "Escuro sólido",
  light: "Claro",
  "feature-list": "Lista de features",
  "step-list": "Lista de passos",
  gradient: "Gradiente (CTA)",
};

// ── Slide Visual Component ─────────────────────────────────────────────────

function SlideVisual({
  slide,
  idx,
  total,
  B,
}: {
  slide: Slide;
  idx: number;
  total: number;
  B: BrandTokens;
}) {
  const handle = B.handle;
  const body = slide.body ?? "";
  const layout = getLayout(body);
  const text = cleanBody(body);
  const pct = ((idx + 1) / total) * 100;
  const isDark = layout !== "light" && layout !== "feature-list" && layout !== "step-list";
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

  // ── imagem IA de fundo (preview) ──
  if (slide.imageUrl) {
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide.imageUrl}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom,rgba(24,14,12,0.05) 0%,rgba(24,14,12,0.45) 55%,rgba(24,14,12,0.92) 100%)",
          }}
        />
        <div style={{ position: "relative", zIndex: 2, padding: "0 20px 40px" }}>
          {slide.subtitle && (
            <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
              {slide.subtitle}
            </div>
          )}
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.12, marginBottom: 6, fontFamily: "Georgia,serif" }}>
            {slide.title}
          </div>
          {text && (
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
              {text.slice(0, 90)}
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
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.15,
              marginBottom: 6,
              fontFamily: "Georgia,serif",
            }}
          >
            {slide.title}
          </div>
          {text && (
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
              {text.slice(0, 90)}
            </div>
          )}
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
              fontSize: 14,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.15,
              marginBottom: 8,
              fontFamily: "Georgia,serif",
            }}
          >
            {slide.title}
          </div>
          {text && (
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 10 }}>
              {text.slice(0, 80)}
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
        <div style={{ padding: "0 20px 40px" }}>
          {slide.subtitle && (
            <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: B.primary, marginBottom: 8 }}>
              {slide.subtitle}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 700, color: B.darkBg, lineHeight: 1.15, marginBottom: 12, fontFamily: "Georgia,serif" }}>
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
            : <div style={{ fontSize: 9, color: "#4A3A34", lineHeight: 1.5 }}>{text.slice(0, 120)}</div>
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
        <div style={{ padding: "0 20px 40px" }}>
          {slide.subtitle && (
            <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: B.primary, marginBottom: 8 }}>
              {slide.subtitle}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 700, color: B.darkBg, lineHeight: 1.15, marginBottom: 12, fontFamily: "Georgia,serif" }}>
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
            : <div style={{ fontSize: 9, color: "#4A3A34", lineHeight: 1.5 }}>{text.slice(0, 120)}</div>
          }
        </div>
        {progressBar}
        {swipeHint}
      </div>
    );
  }

  // ── light ──
  if (layout === "light") {
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
        <div style={{ padding: "0 20px 40px" }}>
          {slide.subtitle && (
            <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: B.primary, marginBottom: 8 }}>
              {slide.subtitle}
            </div>
          )}
          <div style={{ fontSize: 15, fontWeight: 700, color: B.darkBg, lineHeight: 1.15, marginBottom: 8, fontFamily: "Georgia,serif" }}>
            {slide.title}
          </div>
          {text && (
            <div style={{ fontSize: 9, color: "#4A3A34", lineHeight: 1.55 }}>
              {text.slice(0, 150)}
            </div>
          )}
        </div>
        {progressBar}
        {swipeHint}
      </div>
    );
  }

  // ── dark (default) ──
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
      <div style={{ padding: "0 20px 40px" }}>
        {slide.subtitle && (
          <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: B.light, marginBottom: 8 }}>
            {slide.subtitle}
          </div>
        )}
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: 8, fontFamily: "Georgia,serif" }}>
          {slide.title}
        </div>
        {text && (
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>
            {text.slice(0, 150)}
          </div>
        )}
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
}

export function CarouselStudio({ slides, pieceId, onSlidesChange, brandColors, brandHandle }: Props) {
  const B = deriveBrandTokens(brandColors, brandHandle);
  const [current, setCurrent] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Slide>(() => slides[0]);
  const [saving, startSave] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [exportIdx, setExportIdx] = useState<number | null>(null);
  const [imgModel, setImgModel] = useState(IMAGE_MODEL_DEFS[0].key);
  const [genImg, setGenImg] = useState(false);
  const [imgError, setImgError] = useState("");
  const [uploading, setUploading] = useState(false);

  const currentSlide = slides[current];

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
        }),
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        const next = slides.map((s) =>
          s.index === currentSlide.index ? { ...s, imageUrl: data.imageUrl as string } : s
        );
        onSlidesChange(next);
        startSave(() => void updateSlides(pieceId, next));
      } else {
        setImgError(data.error ?? "Falha ao gerar imagem");
      }
    } catch {
      setImgError("Erro de conexão");
    } finally {
      setGenImg(false);
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
        const next = slides.map((s) =>
          s.index === currentSlide.index ? { ...s, imageUrl: data.imageUrl as string } : s
        );
        onSlidesChange(next);
        startSave(() => void updateSlides(pieceId, next));
      } else {
        setImgError(data.error ?? "Falha ao fazer upload");
      }
    } catch {
      setImgError("Erro de conexão");
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveImage() {
    const next = slides.map((s) =>
      s.index === currentSlide.index ? { ...s, imageUrl: undefined } : s
    );
    onSlidesChange(next);
    startSave(() => void updateSlides(pieceId, next));
  }

  async function handleExportPng() {
    setExporting(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        setExportIdx(i);
        const res = await fetch("/api/render/slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slide: slides[i],
            idx: i,
            total: slides.length,
            brand: { colors: brandColors, handle: brandHandle },
          }),
        });
        if (!res.ok) continue;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `slide-${String(i + 1).padStart(2, "0")}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 120));
      }
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

  const layout = getLayout(currentSlide.body ?? "");

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Studio · {slides.length} slides
          </p>
          {saving && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
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
        <div className="flex flex-col items-center gap-4 bg-muted/20 px-6 py-5 border-b lg:border-b-0 lg:border-r lg:w-72 shrink-0">
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

          {/* Slide visual — fixed 4:5 aspect, 216px wide */}
          <div
            className="rounded-lg overflow-hidden shadow-lg border border-border/50"
            style={{ width: 216, height: 270 }}
          >
            <SlideVisual slide={currentSlide} idx={current} total={slides.length} B={B} />
          </div>

          {/* Layout label */}
          <div className="text-center">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-background text-muted-foreground">
              {LAYOUT_LABELS[layout] ?? layout}
            </span>
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

          {/* Thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto w-full pb-1">
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`shrink-0 rounded overflow-hidden border-2 transition-colors ${
                  i === current ? "border-primary" : "border-transparent hover:border-border"
                }`}
                style={{ width: 44, height: 55 }}
                title={`Slide ${i + 1}: ${s.title}`}
              >
                <SlideVisual slide={s} idx={i} total={slides.length} B={B} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Editor panel ── */}
        <div className="flex-1 min-w-0 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-semibold">Slide {current + 1}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {LAYOUT_LABELS[layout] ?? layout}
              </p>
            </div>
            {!editing && (
              <Button size="sm" variant="outline" onClick={handleEdit}>
                <Pencil className="mr-1.5 size-3.5" />
                Editar
              </Button>
            )}
          </div>

          {editing ? (
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

              {/* ── Imagem de fundo IA ── */}
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Image className="size-3.5 text-primary" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Imagem de fundo (IA)
                  </p>
                </div>

                {currentSlide.imageUrl ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentSlide.imageUrl}
                      alt=""
                      className="w-full h-24 object-cover rounded-md border"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={() => void handleGenerateImage()}
                        disabled={genImg || uploading}
                      >
                        {genImg ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                        Gerar outra
                      </Button>
                      <label className="flex-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs pointer-events-none"
                          disabled={genImg || uploading}
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
                      <Button size="sm" variant="ghost" onClick={handleRemoveImage} disabled={genImg || uploading}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
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
              </div>
            </div>
          )}
        </div>
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
