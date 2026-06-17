"use client";

import { useRef, useState, useTransition, type CSSProperties } from "react";
import { Loader2, Upload, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateAvatar } from "@/app/(dashboard)/brands/actions";

interface AvatarUploadProps {
  workspaceId: string;
  brandId: string;
  currentUrl: string | null;
  currentZoom?: number | null;
  currentX?: number | null;
  currentY?: number | null;
}

/**
 * Estilo do avatar (foto de perfil) num recorte circular. MESMA fórmula usada no
 * render do carrossel (carousel-studio) — assim o que você ajusta aqui é
 * exatamente o que sai no slide e no PNG.
 */
export function avatarStyle(
  url: string,
  zoom: number,
  x: number,
  y: number
): CSSProperties {
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: `${Math.round(zoom * 100)}%`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: "no-repeat",
  };
}

export function AvatarUpload({
  workspaceId,
  brandId,
  currentUrl,
  currentZoom,
  currentX,
  currentY,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [url, setUrl] = useState<string | null>(currentUrl);
  const [zoom, setZoom] = useState(currentZoom ?? 1);
  const [x, setX] = useState(currentX ?? 50);
  const [y, setY] = useState(currentY ?? 50);

  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setSaved(false);
    if (file.size > 4 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. 4MB).");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${workspaceId}/${brandId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("brand-assets")
        .upload(path, file, { upsert: true });
      if (upErr) {
        setError("Falha no upload. Tente novamente.");
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("brand-assets").getPublicUrl(path);
      setUrl(publicUrl);
      // Nova foto: volta o enquadramento pro centro/100%.
      setZoom(1);
      setX(50);
      setY(50);
    } finally {
      setUploading(false);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!url) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: x, oy: y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !previewRef.current) return;
    const size = previewRef.current.offsetWidth || 160;
    // Arrastar a foto: mover pra direita mostra mais da ESQUERDA (x diminui).
    const dx = ((e.clientX - drag.current.sx) / size) * 100;
    const dy = ((e.clientY - drag.current.sy) / size) * 100;
    setX(Math.max(0, Math.min(100, drag.current.ox - dx)));
    setY(Math.max(0, Math.min(100, drag.current.oy - dy)));
  }

  function onPointerUp() {
    drag.current = null;
  }

  function save() {
    setSaved(false);
    startTransition(async () => {
      await updateAvatar(brandId, { url, zoom, x, y });
      setSaved(true);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        {/* Preview circular ajustável */}
        <div className="shrink-0 text-center">
          <div
            ref={previewRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="size-40 rounded-full border bg-muted overflow-hidden touch-none select-none"
            style={{
              cursor: url ? "grab" : "default",
              ...(url ? avatarStyle(url, zoom, x, y) : {}),
            }}
          >
            {!url && (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground px-3 text-center">
                Sua foto aparece aqui
              </div>
            )}
          </div>
          {url && (
            <p className="text-[10px] text-muted-foreground mt-1.5">Arraste a foto pra ajustar</p>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {url ? "Trocar foto de perfil" : "Enviar foto de perfil (máx. 4MB)"}
          </button>

          {url && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                <span>Zoom</span>
                <span>{zoom.toFixed(2)}×</span>
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          <button
            type="button"
            onClick={save}
            disabled={pending || uploading}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            {saved ? "Salvo" : "Salvar foto de perfil"}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Dica: pra ficar <strong>idêntico ao Instagram</strong>, suba a mesma foto quadrada que o
        IG já mostra no seu perfil — aí o recorte fica igual. Se subir a original, use o zoom e
        arraste pra acertar o enquadramento.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
