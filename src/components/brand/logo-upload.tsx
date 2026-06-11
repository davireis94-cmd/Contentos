"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateLogoUrl } from "@/app/(dashboard)/brands/actions";

interface LogoUploadProps {
  workspaceId: string;
  brandId: string;
  currentUrl: string | null;
}

export function LogoUpload({ workspaceId, brandId, currentUrl }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > 2 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. 2MB).");
      return;
    }

    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${workspaceId}/${brandId}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("brand-assets")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError("Falha no upload. Tente novamente.");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("brand-assets").getPublicUrl(path);

    startTransition(() => updateLogoUrl(brandId, publicUrl));
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="Logo" className="size-12 rounded-md object-contain" />
        ) : pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Upload className="size-5" />
        )}
        <span>
          {currentUrl ? "Trocar logo" : "Enviar logo (PNG, SVG, JPG — máx. 2MB)"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
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
