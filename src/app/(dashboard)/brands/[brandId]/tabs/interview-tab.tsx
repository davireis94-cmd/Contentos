"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Send, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extrasFilledCount, type BrandExtras } from "@/lib/brand/extras";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  updated?: string[];
}

export function InterviewTab({
  brandId,
  initialExtras,
}: {
  brandId: string;
  initialExtras: BrandExtras | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filled = extrasFilledCount(initialExtras);

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
        if (data.done) setDone(true);
        if (data.updated?.length) router.refresh();
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Erro de conexão. Tenta de novo?" }]);
    } finally {
      setLoading(false);
    }
  }

  function start() {
    setStarted(true);
    void send([]);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    void send(next);
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
            <p className="text-[11px] text-muted-foreground mt-2">
              Estratégia avançada: <b>{filled}/7</b> linhas preenchidas
            </p>
          </div>
        </div>

        {!started && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={start} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Sparkles className="mr-1.5 size-3.5" />}
              {filled > 0 ? "Continuar construção" : "Começar"}
            </Button>
            <a
              href={`/brands/${brandId}?tab=documents`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <FileText className="size-3.5" /> Tem documentos? Anexe na aba Documentos — o chat usa eles.
            </a>
          </div>
        )}
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

          {/* Input */}
          <div className="flex gap-2">
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
