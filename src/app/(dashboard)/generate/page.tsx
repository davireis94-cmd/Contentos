import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { BriefForm } from "@/components/generate/brief-form";
import { ChatGenerator } from "@/components/generate/chat-generator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string; ref?: string; topic?: string; ext?: string; trendId?: string; mode?: string; format?: string; objective?: string }>;
}) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const { brandId, ref, topic, ext, trendId, mode, format, objective } = await searchParams;

  const [{ data: brands }, { data: recentPieces }, trendResult] = await Promise.all([
    supabase
      .from("brands")
      .select("id, name, logo_url")
      .eq("workspace_id", workspace.id)
      .order("name"),
    supabase
      .from("content_pieces")
      .select("id, title, format, brands(name)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(30),
    trendId
      ? supabase
          .from("benchmark_content")
          .select("title, description, notes, transcript, source_url, platform, format")
          .eq("id", trendId)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const trend = trendResult.data;
  const defaultBrand = brandId ?? brands?.[0]?.id;
  // Chat é a aba padrão. Vai pro Briefing quando há intenção estruturada
  // (recriar post, referência, tópico vindo de tendência) ou mode=brief explícito.
  const hasBriefIntent = mode === "brief" || !!ref || !!ext || !!topic || !!trendId;
  const activeTab = mode === "chat" ? "chat" : hasBriefIntent ? "brief" : "chat";

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Gerar conteúdo"
        description="Preencha o briefing ou converse com a IA para criar seu post."
      />

      <Tabs defaultValue={activeTab} className="max-w-2xl">
        <TabsList>
          <TabsTrigger value="brief">📝 Briefing</TabsTrigger>
          <TabsTrigger value="chat">✦ Chat (Lumio)</TabsTrigger>
        </TabsList>

        <TabsContent value="brief" className="mt-4">
          <BriefForm
            brands={brands ?? []}
            defaultBrandId={brandId}
            recentPieces={(recentPieces ?? []).map((p) => ({
              id: p.id,
              title: p.title,
              format: p.format,
              brandName: Array.isArray(p.brands)
                ? (p.brands[0] as { name: string } | null)?.name ?? null
                : (p.brands as { name: string } | null)?.name ?? null,
            }))}
            defaultRefId={ref}
            defaultTopic={topic ?? trend?.title ?? undefined}
            defaultExt={!!ext}
            defaultFormat={format}
            defaultObjective={objective}
            trendContext={trend ?? undefined}
          />
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          {defaultBrand ? (
            <ChatGenerator
              brandId={defaultBrand}
              brands={(brands ?? []).map((b) => ({ id: b.id, name: b.name }))}
            />
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Crie uma marca primeiro para usar o gerador por chat.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
