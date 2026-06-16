import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { ContentDetail } from "@/components/content/content-detail";
import type { ContentStatus } from "@/types/app";
import type { GenerationOutput } from "@/lib/validations/generation";

export default async function ContentPiecePage({
  params,
}: {
  params: Promise<{ pieceId: string }>;
}) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const { pieceId } = await params;

  const { data: piece, error: pieceError } = await supabase
    .from("content_pieces")
    .select("id, title, format, status, slides, caption, hashtags, created_at, scheduled_for, brand_id, brands(name, identity)")
    .eq("id", pieceId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (pieceError) {
    return (
      <div className="p-6">
        <PageHeader title="Erro ao carregar" />
        <p className="mt-4 text-sm text-destructive">Não foi possível carregar este conteúdo.</p>
        <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{pieceError.message}</pre>
      </div>
    );
  }
  if (!piece) notFound();

  const slides = Array.isArray(piece.slides) ? piece.slides : [];
  const brandObj = Array.isArray(piece.brands) ? piece.brands[0] : piece.brands;
  const brandName = (brandObj as { name: string } | null)?.name ?? null;
  const brandIdentity = ((brandObj as { identity?: { colors?: { hex: string; role?: string }[]; font_heading?: string; font_body?: string } } | null)?.identity ?? {}) as {
    colors?: { hex: string; role?: string }[];
    font_heading?: string;
    font_body?: string;
  };
  const brandColors = Array.isArray(brandIdentity.colors) ? brandIdentity.colors : [];
  const brandFontHeading = brandIdentity.font_heading ?? null;
  const brandFontBody = brandIdentity.font_body ?? null;

  // Handle do Instagram conectado (para o rodapé dos slides) — não derruba a página se falhar
  let brandHandle: string | null = null;
  try {
    const { data: conn } = await supabase
      .from("social_connections")
      .select("username")
      .eq("workspace_id", workspace.id)
      .eq("platform", "instagram")
      .maybeSingle();
    brandHandle = conn?.username ?? null;
  } catch {
    brandHandle = null;
  }

  if (slides.length === 0) {
    return (
      <div className="p-6">
        <PageHeader title={piece.title} />
        <p className="mt-4 text-sm text-muted-foreground">
          Conteúdo salvo mas sem dados estruturados para exibir.
        </p>
      </div>
    );
  }

  const output: GenerationOutput = {
    title: piece.title,
    format: piece.format as GenerationOutput["format"],
    slides: slides as GenerationOutput["slides"],
    caption: (piece.caption as string) ?? "",
    hashtags: (piece.hashtags as string[]) ?? [],
  };

  return (
    <ContentDetail
      pieceId={piece.id}
      title={piece.title}
      format={piece.format}
      status={piece.status as ContentStatus}
      createdAt={piece.created_at}
      scheduledFor={(piece as { scheduled_for?: string | null }).scheduled_for ?? null}
      brandName={brandName}
      brandColors={brandColors}
      brandHandle={brandHandle}
      brandFontHeading={brandFontHeading}
      brandFontBody={brandFontBody}
      output={output}
    />
  );
}
