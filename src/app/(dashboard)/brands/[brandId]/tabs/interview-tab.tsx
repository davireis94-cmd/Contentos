"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Send, Check, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extrasFilledCount, type BrandExtras } from "@/lib/brand/extras";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  updated?: string[];
}

export function InterviewTab({
  brandId,
  workspaceId,
  initialExtras,
}: {
  brandId: string;
  workspaceId: string;
  initialExtras: BrandExtras | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ filled: number; total: number; phase: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filled = progress?.filled ?? extrasFilledCount(initialExtras);
  const total = progress?.total ?? 12;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(history: ChatMsg[]) {
    setLoading(true);
    try {
      const res = await fetch("/api/brand/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((m) => [...m, { role: "assistant", content: `Ops: ${data.error}` }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.message, updated: data.updated }]);
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        if (data.progress) setProgress(data.progress);
        if (data.done) setDone(true);
        if (data.updated?.length) router.refresh();
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Erro de conexão. Tenta de novo?" }]);
    } finally {
      setLoading(false);
    }
  }

  // Abre o chat automaticamente ao entrar na aba.
  useEffect(() => {
    setStarted(true);
    void send([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sendText(text: string) {
    if (!text.trim() || loading) return;
    setSuggestions([]);
    const next: ChatMsg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setInput("");
    void send(next);
  }

  function handleSend() {
    sendText(input);
  }

  async function handleFile(file: File) {
    setUploading(true);
    if (!started) setStarted(true);
    setMessages((m) => [...m, { role: "user", content: `📎 Anexando: ${file.name}…` }]);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("brandId", brandId);
      fd.set("workspaceId", workspaceId);
      const res = await fetch("/api/brand-documents", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha no upload");
      const next: ChatMsg[] = [
        ...messages,
        { role: "user", content: `Anexei o documento "${file.name}". Use o conteúdo dele pra preencher e sugerir o que faltar.` },
      ];
      setMessages(next);
      await send(next);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Não consegui ler o arquivo: ${e instanceof Error ? e.message : "erro"}.` }]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/[0.04] to-transparent p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 shrink-0">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Construtor do Brand Brain (chat)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Converse com a IA e ela monta seu cérebro de marca — usando seus documentos
              quando existirem e sugerindo o que falta. Responda no seu ritmo.
            </p>
            {/* Barra de progresso */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>{progress?.phase ?? "Construindo seu cérebro"}</span>
                <span><b>{filled}</b>/{total}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.round((filled / total) * 100)}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 inline-flex items-center gap-1">
              <FileText className="size-3" /> Use o <b>+</b> abaixo pra anexar documentos — o chat lê e preenche sozinho.
            </p>
          </div>
        </div>
      </div>

      {/* Chat */}
      {started && (
        <>
          <div
            ref={scrollRef}
            className="rounded-xl border bg-card p-4 space-y-3 max-h-[420px] overflow-y-auto"
          >
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.updated && m.updated.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] opacity-80">
                      <Check className="size-3" /> salvou: {m.updated.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {done && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <Check className="size-4" /> Cérebro construído! Você pode continuar refinando quando quiser.
            </p>
          )}

          {/* Respostas rápidas */}
          {!loading && !done && messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={`s${i}`}
                  onClick={() => sendText(s)}
                  className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
              {["Me dá um exemplo", "Não sei 🤔", "Pular"].map((s) => (
                <button
                  key={s}
                  onClick={() => sendText(s)}
                  className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 items-end">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="self-end"
              onClick={() => fileRef.current?.click()}
              disabled={loading || uploading}
              title="Anexar documento (manual, estratégia, identidade…)"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              placeholder="Escreva sua resposta… (Enter envia, Shift+Enter quebra linha)"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-primary"
              disabled={loading}
            />
            <Button size="sm" onClick={handleSend} disabled={loading || !input.trim()} className="self-end">
              <Send className="size-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
