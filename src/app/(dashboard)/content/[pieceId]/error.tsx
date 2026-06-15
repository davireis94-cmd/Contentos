"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ContentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[content/pieceId] render error:", error);
  }, [error]);

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-lg font-semibold">Não foi possível abrir este conteúdo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Houve um erro ao renderizar a página. Tente recarregar.
      </p>
      <pre className="mt-3 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
        {error.message || "Erro desconhecido"}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={reset}>Tentar de novo</Button>
        <Button size="sm" variant="outline" onClick={() => (window.location.href = "/library")}>
          Voltar à biblioteca
        </Button>
      </div>
    </div>
  );
}
