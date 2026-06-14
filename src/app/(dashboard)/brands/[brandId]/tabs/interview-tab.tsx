"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, MessageCircleQuestion, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  EXTRAS_FIELDS,
  extrasFilledCount,
  type BrandExtras,
} from "@/lib/brand/extras";

export function InterviewTab({
  brandId,
  initialExtras,
}: {
  brandId: string;
  initialExtras: BrandExtras | null;
}) {
  const router = useRouter();
  const [extras, setExtras] = useState<BrandExtras | null>(initialExtras);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const filled = extrasFilledCount(extras);

  async function start() {
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch("/api/brand/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, mode: "questions" }),
      });
      const data = await res.json();
      if (data.questions?.length) {
        setQuestions(data.questions);
        setAnswers(new Array(data.questions.length).fill(""));
      }
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    if (!questions) return;
    setSaving(true);
    try {
      const qa = questions.map((q, i) => ({ q, a: answers[i] ?? "" }));
      const res = await fetch("/api/brand/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, mode: "synthesize", answers: qa }),
      });
      const data = await res.json();
      if (data.extras) {
        setExtras(data.extras);
        setQuestions(null);
        setDone(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/[0.04] to-transparent p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 shrink-0">
            <MessageCircleQuestion className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Entrevista do Brand Brain</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A IA te entrevista pra captar o que formulário não pega: seu inimigo, opiniões
              fortes, histórias, dores do público e ofertas. Quanto mais rica a entrevista,
              melhor a geração.
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              Profundidade do cérebro avançado: <b>{filled}/{EXTRAS_FIELDS.length}</b> linhas preenchidas
            </p>
          </div>
        </div>

        {!questions && (
          <Button size="sm" className="mt-3" onClick={() => void start()} disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Preparando perguntas…</>
            ) : (
              <><Sparkles className="mr-1.5 size-3.5" /> {filled > 0 ? "Continuar entrevista" : "Iniciar entrevista"}</>
            )}
          </Button>
        )}
      </div>

      {done && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
          <Check className="size-4" /> Cérebro atualizado com sua entrevista!
        </p>
      )}

      {/* Perguntas */}
      {questions && (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg border bg-card p-3.5">
              <p className="text-sm font-medium mb-2">{i + 1}. {q}</p>
              <Textarea
                value={answers[i] ?? ""}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                rows={2}
                placeholder="Responda com suas palavras (pode ser informal)…"
                className="text-sm"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void finish()} disabled={saving}>
              {saving ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Salvando…</> : "Concluir entrevista"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setQuestions(null)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Cérebro avançado atual */}
      {!questions && (
        <div className="space-y-3">
          {EXTRAS_FIELDS.map(({ key, label, isArray }) => {
            const v = extras?.[key];
            const has = isArray ? Array.isArray(v) && v.length > 0 : !!(v as string)?.trim();
            return (
              <div key={key} className="rounded-lg border bg-card p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
                {has ? (
                  isArray ? (
                    <ul className="list-disc pl-4 space-y-0.5">
                      {(v as string[]).map((item, idx) => (
                        <li key={idx} className="text-sm">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm">{v as string}</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground/60 italic">Ainda não preenchido</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
