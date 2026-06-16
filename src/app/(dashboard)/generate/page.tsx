import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { BriefForm } from "@/components/generate/brief-form";
import { ChatGenerator } from "@/components/generate/chat-generator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CAROUSEL_TEMPLATES } from "@/lib/templates/carousel-templates";
import { UseTemplateButton } from "@/components/templates/use-template-button";
import { Badge } from "@/components/ui/badge";

const STYLE_PREVIEW: Record<string, { bg: string; accent: string; text: string }> = {
  "editorial-light": { bg: "#FAF7F2", accent: "#6B1A2A", text: "#1A1310" },
  "editorial-dark":  { bg: "#1E1E1E", accent: "#6B1A2A", text: "#ffffff" },
  "bold-sans":       { bg: "#0A0A0A", accent: "#6B1A2A", text: "#ffffff" },
  "revista":         { bg: "#ffffff", accent: "#111111", text: "#111111" },
  "davi-moxoto":     { bg: "#180E0C", accent: "#6B1A2A", text: "#ffffff" },
  "image-cards":     { bg: "#FAF7F2", accent: "#6B1A2A", text: "#1A1310" },
};

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
  const activeTab = mode === "templates" ? "templates" : mode === "chat" ? "chat" : hasBriefIntent ? "brief" : "chat";

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Gerar conteúdo"
        description="Preencha o briefing ou converse com a IA para criar seu post."
      />

      <Tabs defaultValue={activeTab} className="max-w-2xl">
        <TabsList>
          <TabsTrigger value="chat">✦ Chat (Lumio)</TabsTrigger>
          <TabsTrigger value="templates">◻ Templates</TabsTrigger>
          <TabsTrigger value="brief">📝 Briefing</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          {defaultBrand ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {CAROUSEL_TEMPLATES.map((tpl) => {
                const style = STYLE_PREVIEW[tpl.id] ?? STYLE_PREVIEW["editorial-light"];
                return (
                  <div key={tpl.id} className="rounded-xl border bg-card overflow-hidden flex flex-col">
                    <div className="h-20 flex flex-col justify-end px-4 pb-3" style={{ background: style.bg }}>
                      <div style={{ width: 20, height: 1.5, background: style.accent, marginBottom: 6 }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: style.text, lineHeight: 1.1,
                        fontFamily: tpl.id === "bold-sans" ? "Impact, sans-serif" : "Georgia, serif",
                        textTransform: tpl.id === "bold-sans" || tpl.id === "revista" ? "uppercase" : "none",
                      }}>
                        {tpl.title}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium truncate">{tpl.title}</p>
                          {tpl.badge && (
                            <Badge className="bg-foreground text-background text-[9px] px-1.5 py-0 border-0 shrink-0">
                              {tpl.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{tpl.description}</p>
                      </div>
                      <UseTemplateButton
                        templateId={tpl.id}
                        templateTitle={tpl.title}
                        brands={(brands ?? []).map((b) => ({ id: b.id, name: b.name }))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Crie uma marca primeiro para usar templates.
            </div>
          )}
        </TabsContent>

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
