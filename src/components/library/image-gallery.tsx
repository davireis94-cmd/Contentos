"use client";

import { useEffect, useState } from "react";
import { Download, ImageOff, Loader2 } from "lucide-react";

export function ImageGallery() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/images/library")
      .then((r) => r.json())
      .then((d) => setImages(d.images ?? []))
      .catch(() => setImages([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload(url: string) {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = url.split("/").pop() ?? "imagem.png";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <ImageOff className="mb-3 size-8 text-muted-foreground/30" />
        <p className="text-sm font-medium">Nenhuma imagem ainda</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Gere imagens nos seus slides e elas aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {images.map((url, i) => (
        <div key={url + i} className="group relative rounded-lg overflow-hidden border bg-muted aspect-[4/5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button
              onClick={() => void handleDownload(url)}
              className="flex items-center gap-1.5 rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-black hover:bg-white transition-colors"
            >
              <Download className="size-3.5" />
              Baixar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
