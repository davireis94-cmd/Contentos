"use client";

import { useState, useRef } from "react";
import { FileText, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface BrandDocument {
  id: string;
  name: string;
  file_type: string;
  file_size_bytes: number;
  extracted_content: string | null;
  created_at: string;
}

interface ExtractedContext {
  resumo?: string;
  publico_alvo?: string;
  tom_de_voz?: string;
  valores?: string[];
  diferenciais?: string[];
  pilares?: string[];
  frases_chave?: string[];
  palavras_evitar?: string[];
  posicionamento?: string;
}

interface DocumentsTabProps {
  brandId: string;
  workspaceId: string;
  initialDocuments: BrandDocument[];
}

function parseExtracted(raw: string | null): ExtractedContext | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function DocumentsTab({ brandId, workspaceId, initialDocuments }: DocumentsTabProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);

    const fd = new FormData();
    fd.set("file", file);
    fd.set("brandId", brandId);
    fd.set("workspaceId", workspaceId);

    try {
      const res = await fetch("/api/brand-documents", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro desconhecido");
      setDocuments((prev) => [json.document, ...prev]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(docId: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    await fetch("/api/brand-documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: docId }),
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Documentos de marca</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Envie manuais, estratégia de comunicação, identidade visual. A IA lê e extrai o contexto automaticamente para usar na geração de conteúdo.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="shrink-0"
          >
            {uploading ? (
              <><Loader2 className="mr-2 size-4 animate-spin" />Processando…</>
            ) : (
              <><Upload className="mr-2 size-4" />Upload</>
            )}
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        {documents.length === 0 && !uploading && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <FileText className="mx-auto mb-2 size-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhum documento ainda</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, TXT, PNG, JPG · máx. 20MB</p>
          </div>
        )}

        <div className="space-y-3">
          {documents.map((doc) => {
            const extracted = parseExtracted(doc.extracted_content);
            return (
              <div key={doc.id} className="rounded-lg border p-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(doc.file_size_bytes)} · {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                    title="Remover documento"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {extracted && (
                  <div className="rounded-md bg-muted/50 px-3 py-2.5 space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium">
                      <Sparkles className="size-3" />
                      Contexto extraído pela IA
                    </p>
                    {extracted.resumo && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{extracted.resumo}</p>
                    )}
                    {extracted.tom_de_voz && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Tom: </span>
                        {extracted.tom_de_voz}
                      </p>
                    )}
                    {extracted.pilares && extracted.pilares.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {extracted.pilares.map((p) => (
                          <span key={p} className="rounded-full border bg-background px-2 py-0.5 text-[10px]">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {extracted.frases_chave && extracted.frases_chave.length > 0 && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Frases características:</p>
                        <ul className="space-y-0.5">
                          {extracted.frases_chave.slice(0, 3).map((f) => (
                            <li key={f} className="text-xs text-muted-foreground">"{f}"</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {doc.extracted_content === null && (
                  <p className="text-xs text-muted-foreground italic px-1">
                    Extração de contexto não disponível (adicione a chave Anthropic para ativar).
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
