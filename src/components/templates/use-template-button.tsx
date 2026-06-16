"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  templateId: string;
  templateTitle: string;
  brands: { id: string; name: string }[];
}

export function UseTemplateButton({ templateId, templateTitle, brands }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleUse() {
    if (!brandId) { setError("Escolha uma marca."); return; }
    if (!topic.trim()) { setError("Informe o tema do carrossel."); return; }
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/generate/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, topic: topic.trim(), angle: angle.trim() || undefined, brandId }),
      });
      const data = await res.json() as { pieceId?: string; error?: string };
      if (!res.ok || !data.pieceId) throw new Error(data.error ?? "Erro ao gerar");
      setOpen(false);
      router.push(`/content/${data.pieceId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!pending) setOpen(v); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-3 text-xs">
          <Wand2 className="mr-1 size-3" />
          Usar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{templateTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Tema do carrossel *
            </label>
            <Input
              className="mt-1.5 text-sm"
              placeholder='Ex: "Por que você usa IA errado"'
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !pending && void handleUse()}
              autoFocus
              disabled={pending}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Contexto extra <span className="font-normal normal-case tracking-normal">(opcional)</span>
            </label>
            <Textarea
              className="mt-1.5 text-sm"
              placeholder="Ângulo específico, público-alvo, exemplos que quer usar, tom mais sério ou leve…"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              rows={3}
              disabled={pending}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              A IA usa isso para escrever o conteúdo real — não só preencher placeholder.
            </p>
          </div>

          {brands.length > 1 && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Marca
              </label>
              <Select value={brandId} onValueChange={setBrandId} disabled={pending}>
                <SelectTrigger className="mt-1.5 text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button className="w-full" onClick={() => void handleUse()} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Gerando conteúdo com IA…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 size-4" />
                Gerar e abrir no Studio
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
