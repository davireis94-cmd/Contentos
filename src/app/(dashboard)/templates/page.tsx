import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";

const BUILTIN_TEMPLATES = [
  {
    id: "authority-carousel",
    title: "Carrossel de Autoridade",
    description: "5 insights práticos sobre um tema do seu nicho. Gancho forte + entrega real em cada slide.",
    format: "carousel",
    objective: "educate",
    slides: 7,
    badge: "Popular",
  },
  {
    id: "storytelling-reel",
    title: "Storytelling para Reels",
    description: "História pessoal que conecta com a transformação do cliente. Do problema à solução.",
    format: "reel",
    objective: "inspire",
    slides: 8,
    badge: null,
  },
  {
    id: "offer-carousel",
    title: "Apresentação de Oferta",
    description: "Apresenta o produto/serviço, supera objeções e termina com CTA irresistível.",
    format: "carousel",
    objective: "sell",
    slides: 9,
    badge: null,
  },
  {
    id: "tips-single",
    title: "Dica Rápida (Single)",
    description: "Um insight poderoso em formato de post único. Direto ao ponto, fácil de salvar.",
    format: "single",
    objective: "educate",
    slides: 1,
    badge: null,
  },
  {
    id: "engage-question",
    title: "Pergunta de Engajamento",
    description: "Post que provoca reflexão e convida o público a comentar. Gera conversas reais.",
    format: "single",
    objective: "engage",
    slides: 1,
    badge: "Alto engajamento",
  },
  {
    id: "behind-scenes",
    title: "Bastidores — Stories",
    description: "Sequência de stories mostrando o processo interno, a rotina ou os bastidores da marca.",
    format: "story",
    objective: "engage",
    slides: 6,
    badge: null,
  },
];

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Single",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  educate: "Educar",
  engage: "Engajar",
  sell: "Vender",
  inspire: "Inspirar",
};

const FORMAT_COLORS: Record<string, string> = {
  carousel: "bg-blue-500/10 text-blue-700 border-blue-200",
  reel: "bg-purple-500/10 text-purple-700 border-purple-200",
  story: "bg-orange-500/10 text-orange-700 border-orange-200",
  single: "bg-green-500/10 text-green-700 border-green-200",
};

export default async function TemplatesPage() {
  const { user, workspace } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Templates"
        description="Estruturas prontas para acelerar a criação. Selecione um e gere o conteúdo no seu tom de voz."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BUILTIN_TEMPLATES.map((tpl) => (
          <Card key={tpl.id} className="group flex flex-col transition-shadow hover:shadow-md">
            <CardContent className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] border ${FORMAT_COLORS[tpl.format]}`}
                >
                  {FORMAT_LABELS[tpl.format]}
                </Badge>
                {tpl.badge && (
                  <Badge className="bg-foreground text-background text-[10px] border-0">
                    {tpl.badge}
                  </Badge>
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-medium leading-snug">{tpl.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tpl.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span>{OBJECTIVE_LABELS[tpl.objective]}</span>
                  <span>·</span>
                  <span>{tpl.slides} {tpl.slides === 1 ? "slide" : "slides"}</span>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 px-3 text-xs">
                  <Link
                    href={`/generate?template=${tpl.id}&format=${tpl.format}&objective=${tpl.objective}&slides=${tpl.slides}`}
                  >
                    <Wand2 className="mr-1 size-3" />
                    Usar
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-dashed p-5 text-center">
        <LayoutGrid className="mx-auto mb-2 size-6 text-muted-foreground/40" />
        <p className="text-sm font-medium">Templates personalizados</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Salve seus próprios formatos reutilizáveis — disponível na V2.
        </p>
      </div>
    </div>
  );
}
