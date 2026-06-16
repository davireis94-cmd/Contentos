"use client";

import { useState, useTransition } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createFromTemplate } from "@/app/(dashboard)/templates/actions";

interface Props {
  templateId: string;
  templateTitle: string;
  brands: { id: string; name: string }[];
}

export function UseTemplateButton({ templateId, templateTitle, brands }: Props) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleUse() {
    if (!brandId) { setError("Escolha uma marca."); return; }
    setError("");
    startTransition(async () => {
      try {
        await createFromTemplate(templateId, topic, brandId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              Qual é o tema do carrossel?
            </label>
            <Input
              className="mt-1.5 text-sm"
              placeholder='Ex: "Por que você usa IA errado"'
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUse()}
              autoFocus
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Os slides já vêm estruturados — você só edita o texto.
            </p>
          </div>

          {brands.length > 1 && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Marca
              </label>
              <Select value={brandId} onValueChange={setBrandId}>
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

          <Button className="w-full" onClick={handleUse} disabled={pending}>
            {pending
              ? <><Loader2 className="mr-1.5 size-4 animate-spin" /> Criando slides…</>
              : <><Wand2 className="mr-1.5 size-4" /> Criar e abrir no Studio</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
