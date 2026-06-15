"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Minimize2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Painel "artifact" (estilo Claude): quando há resultado, o editor abre num
 * painel lateral GRANDE que escapa da largura da página. Pode ser minimizado
 * para uma pílula flutuante (sem trocar de página nem perder o estado) e
 * reexpandido. Não usa backdrop modal — você continua vendo a página atrás.
 */
interface Props {
  active: boolean; // há conteúdo para mostrar (geração iniciada)
  title?: string;
  onClose?: () => void;
  children: React.ReactNode;
}

export function ArtifactPanel({ active, title = "Conteúdo gerado", onClose, children }: Props) {
  const [minimized, setMinimized] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal só no cliente.
  useEffect(() => setMounted(true), []);

  // Cada nova geração reabre o painel expandido.
  useEffect(() => {
    if (active) setMinimized(false);
  }, [active]);

  if (!mounted || !active) return null;

  // ── Minimizado: pílula flutuante no canto ──
  if (minimized) {
    return createPortal(
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium shadow-lg transition-transform hover:scale-[1.03]"
      >
        <Sparkles className="size-4 text-primary" />
        {title}
        <span className="text-xs text-muted-foreground">— expandir</span>
      </button>,
      document.body
    );
  }

  // ── Expandido: drawer lateral grande ──
  return createPortal(
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-2xl",
        "sm:w-[760px] sm:max-w-[94vw]"
      )}
      role="dialog"
      aria-label={title}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="Minimizar"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Minimize2 className="size-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Fechar"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo rolável */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>,
    document.body
  );
}
