"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StreamOutput, type GenerationState } from "./stream-output";
import { ArtifactPanel } from "./artifact-panel";
import type { GenerationOutput } from "@/lib/validations/generation";

interface ChatMsg { role: "user" | "assistant"; content: string }

const QUICK_REPLIES = [
  "Carrossel educativo",
  "Reels com dica rápida",
  "Post de bastidores",
  "Stories de enquete",
];

export function ChatGenerator({ brandId, brands }: { brandId: string; brands: { id: string; name: string }[] }) {
  const [activeBrandId, setActiveBrandId] = useState(brandId);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [genState, setGenState] = useState<GenerationState>({ status: "idle" });
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = messages.length > 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Auto-start on mount
  useEffect(() => {
    void send([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(history: ChatMsg[]) {
    setLoading(true);
    try {
      const res = await fetch("/api/generate/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: activeBrandId, messages: history }),
      });
      const data = await res.json() as {
        message?: string;
        ready?: boolean;
        output?: GenerationOutput;
        pieceId?: string;
        error?: string;
      };

      if (data.error) {
        setMessages((m) => [...m, { role: "assistant", content: `Ops: ${data.error}` }]);
        return;
      }

      setMessages((m) => [...m, { role: "assistant", content: data.message ?? "…" }]);

      if (data.ready && data.output) {
        setGenState({
          status: "done",
          pieceId: data.pieceId ?? "local",
          output: data.output,
        });
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Erro de conexão. Tenta de novo?" }]);
    } finally {
      setLoading(false);
    }
  }

  function sendText(text: string) {
    if (!text.trim() || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setInput("");
    void send(next);
  }

  function reset() {
    setMessages([]);
    setGenState({ status: "idle" });
    void send([]);
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Brand selector */}
      {brands.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Marca:</span>
          <select
            value={activeBrandId}
            onChange={(e) => setActiveBrandId(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* Chat */}
      <div
        ref={scrollRef}
        className="rounded-xl border bg-card p-4 space-y-3 min-h-[200px] max-h-[380px] overflow-y-auto"
      >
        {!started && !loading && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <Sparkles className="size-6 opacity-30" />
            <p className="text-sm">Iniciando…</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted rounded-bl-sm"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Quick replies — show only before generation */}
      {genState.status === "idle" && !loading && messages.length <= 2 && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((r) => (
            <button
              key={r}
              onClick={() => sendText(r)}
              className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-muted transition-colors"
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {genState.status === "idle" && (
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(input); }
            }}
            rows={2}
            placeholder="Descreva o que quer criar… (Enter envia)"
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-primary"
            disabled={loading}
          />
          <Button size="sm" onClick={() => sendText(input)} disabled={loading || !input.trim()} className="self-end">
            <Send className="size-4" />
          </Button>
        </div>
      )}

      {/* Generated output — painel lateral grande (estilo artifact), minimizável */}
      <ArtifactPanel
        active={genState.status === "done"}
        title="Post gerado a partir da conversa"
        onClose={reset}
      >
        <StreamOutput state={genState} />
      </ArtifactPanel>
    </div>
  );
}
