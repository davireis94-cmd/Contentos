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

  const { data: piece } = await supabase
    .from("content_pieces")
    .select("id, title, format, status, slides, caption, hashtags, created_at, brands(name, identity)")
    .eq("id", pieceId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!piece) notFound();

  const slides = Array.isArray(piece.slides) ? piece.slides : [];
  const brandObj = Array.isArray(piece.brands) ? piece.brands[0] : piece.brands;
  const brandName = (brandObj as { name: string } | null)?.name ?? null;
  const brandIdentity = ((brandObj as { identity?: { colors?: { hex: string; role?: string }[]; font_heading?: string; font_body?: string } } | null)?.identity ?? {});
  const brandColors = brandIdentity.colors ?? [];
  const brandFontHeading = brandIdentity.font_heading ?? null;
  const brandFontBody = brandIdentity.font_body ?? null;

  // Handle do Instagram conectado (para o rodapé dos slides)
  const { data: conn } = await supabase
    .from("social_connections")
    .select("username")
    .eq("workspace_id", workspace.id)
    .eq("platform", "instagram")
    .maybeSingle();
  const brandHandle = conn?.username ?? null;

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
      brandName={brandName}
      brandColors={brandColors}
      brandHandle={brandHandle}
      brandFontHeading={brandFontHeading}
      brandFontBody={brandFontBody}
      output={output}
    />
  );
}
