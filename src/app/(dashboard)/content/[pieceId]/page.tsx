import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { generationOutputSchema } from "@/lib/validations/generation";
import { STATUS_LABELS } from "@/types/app";

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Post único",
};

export default async function ContentPiecePage({
  params,
}: {
  params: Promise<{ pieceId: string }>;
}) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const { pieceId } = await params;

  const { data: piece } = await supabase
    .from("content_pieces")
    .select("id, title, format, status, ai_output, created_at, brands(name)")
    .eq("id", pieceId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!piece) notFound();

  const output = generationOutputSchema.safeParse(piece.ai_output);
  const brandName = Array.isArray(piece.brands)
    ? piece.brands[0]?.name
    : (piece.brands as { name: string } | null)?.name;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={piece.title}>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {FORMAT_LABELS[piece.format] ?? piece.format}
          </Badge>
          <Badge variant="outline">
            {STATUS_LABELS[piece.status as keyof typeof STATUS_LABELS] ?? piece.status}
          </Badge>
        </div>
      </PageHeader>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/generate" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          Gerar novo
        </Link>
        {brandName && (
          <>
            <span>·</span>
            <span>{brandName}</span>
          </>
        )}
      </div>

      {!output.success ? (
        <p className="text-sm text-muted-foreground">
          Conteúdo salvo mas sem dados estruturados.
        </p>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {output.data.slides.map((slide, i) => (
            <Card key={i}>
              <CardHeader className="pb-2 pt-4">
                <span className="text-xs text-muted-foreground">Slide {i + 1}</span>
                <CardTitle className="text-base leading-snug">{slide.title}</CardTitle>
                {slide.subtitle && (
                  <p className="text-sm text-muted-foreground">{slide.subtitle}</p>
                )}
              </CardHeader>
              <CardContent className="pb-4">
                <p className="whitespace-pre-wrap text-sm">{slide.body}</p>
                {slide.cta && (
                  <p className="mt-2 text-sm font-medium">→ {slide.cta}</p>
                )}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="pb-2 pt-4">
              <span className="text-xs text-muted-foreground">Legenda</span>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="whitespace-pre-wrap text-sm">{output.data.caption}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="mb-2 text-xs text-muted-foreground">Hashtags</p>
              <div className="flex flex-wrap gap-1.5">
                {output.data.hashtags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-normal">
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 pt-2">
            <Button asChild size="sm">
              <Link href="/generate">
                <Wand2 className="mr-1.5 size-3.5" />
                Gerar novo conteúdo
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
