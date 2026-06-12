"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteContentPiece } from "@/app/(dashboard)/content/[pieceId]/actions";

interface Props {
  pieceId: string;
  variant?: "icon" | "full";
}

export function DeletePieceButton({ pieceId, variant = "icon" }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => {
      void deleteContentPiece(pieceId);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1">
        <AlertTriangle className="size-3 text-destructive shrink-0" />
        <span className="text-xs text-destructive">Apagar?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : "Sim"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Não
        </button>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
        className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="mr-1.5 size-3.5" />
        Apagar post
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true); }}
      className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      title="Apagar post"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
