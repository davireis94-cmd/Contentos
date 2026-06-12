"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, RefreshCw, Sparkles, Trash2, Upload, Wand2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { applyDocumentsToBrand, reprocessDocuments } from "../../actions";

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

type ApplyResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; updated: string[] }
  | { status: "error"; message: string }
  | { status: "nothing" };

export function DocumentsTab({ brandId, workspaceId, initialDocuments }: DocumentsTabProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult>({ status: "idle" });
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<{ processed: number; failed: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasExtracted = documents.some((d) => d.extracted_content !== null);
  const unprocessedCount = documents.filter((d) => d.extracted_content === null).length;

  async function handleFile(file: File) {
    setUploadError(null);
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
      setUploadError(e instanceof Error ? e.message : "Falha no upload");
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

  async function handleApply() {
    setApplyResult({ status: "loading" });
    const result = await applyDocumentsToBrand(brandId);
    if (result.error) {
      setApplyResult({ status: "error", message: result.error });
    } else if (result.updated.length === 0) {
      setApplyResult({ status: "nothing" });
    } else {
      setApplyResult({ status: "success", updated: result.updated });
    }
  }

  async function handleReprocess() {
    setReprocessing(true);
    setReprocessResult(null);
    const result = await reprocessDocuments(brandId);
    setReprocessing(false);
    if (result.processed > 0) {
      setReprocessResult(result);
      router.refresh();
    } else {
      setReprocessResult(result);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Documentos de marca</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Envie manuais, estratégia de comunicação, identidade visual. A IA extrai o contexto automaticamente.
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

        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

        {/* Reprocess banner */}
        {unprocessedCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-900">
                {unprocessedCount === 1
                  ? "1 documento ainda não foi analisado pela IA"
                  : `${unprocessedCount} documentos ainda não foram analisados pela IA`}
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Agora que a API está configurada, clique para extrair o contexto.
              </p>
              {reprocessResult && (
                <p className="mt-1 text-xs font-medium text-amber-800">
                  {reprocessResult.processed > 0
                    ? `✓ ${reprocessResult.processed} processado(s)${reprocessResult.failed > 0 ? ` · ${reprocessResult.failed} com falha` : ""}`
                    : "Nenhum documento pôde ser processado."}
                </p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleReprocess}
              disabled={reprocessing}
              className="shrink-0 border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              {reprocessing ? (
                <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Processando…</>
              ) : (
                <><RefreshCw className="mr-1.5 size-3.5" />Analisar agora</>
              )}
            </Button>
          </div>
        )}

        {/* Apply to Brand Brain */}
        {hasExtracted && (
          <div className="rounded-lg border border-dashed p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Wand2 className="size-3.5 text-primary" />
                  Aplicar ao Brand Brain
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Preenche automaticamente público-alvo, pilares, frases características e palavras proibidas com base nos documentos. Campos já preenchidos não são sobrescritos.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleApply}
                disabled={applyResult.status === "loading"}
                className="shrink-0"
              >
                {applyResult.status === "loading" ? (
                  <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Aplicando…</>
                ) : (
                  "Aplicar"
                )}
              </Button>
            </div>

            {applyResult.status === "success" && (
              <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2">
                <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-green-600" />
                <div>
                  <p className="text-xs font-medium text-green-800">Campos preenchidos com sucesso</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {applyResult.updated.map((u) => (
                      <li key={u} className="text-xs text-green-700">· {u}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[10px] text-green-600">Acesse a aba Tom de voz para revisar.</p>
                </div>
              </div>
            )}

            {applyResult.status === "nothing" && (
              <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Nenhum campo novo para preencher — o Brand Brain já está atualizado com estas informações.
                </p>
              </div>
            )}

            {applyResult.status === "error" && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2">
                <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">{applyResult.message}</p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {documents.length === 0 && !uploading && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <FileText className="mx-auto mb-2 size-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhum documento ainda</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, TXT, PNG, JPG · máx. 20MB</p>
          </div>
        )}

        {/* Document list */}
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
                  <p className="text-xs text-amber-600 italic px-1">
                    Aguardando análise da IA…
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
