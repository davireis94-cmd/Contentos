import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { computeQualityItems, computeLiveScore, type DocExtracted } from "@/lib/brand-quality";
import { QualityGuide } from "@/components/brand/quality-guide";
import { IdentityTab } from "./tabs/identity-tab";
import { VoiceTab } from "./tabs/voice-tab";
import { ExamplesTab } from "./tabs/examples-tab";
import { DocumentsTab } from "./tabs/documents-tab";
import { SuggestionsTab } from "./tabs/suggestions-tab";
import { InterviewTab } from "./tabs/interview-tab";
import type { BrandExtras } from "@/lib/brand/extras";

const VALID_TABS = ["identity", "voice", "examples", "documents", "interview", "suggestions"];

export default async function BrandDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { brandId } = await params;
  const { tab: tabParam } = await searchParams;
  const activeTab = VALID_TABS.includes(tabParam ?? "") ? tabParam! : "interview";

  const { supabase, workspace } = await getSessionContext();
  if (!workspace) return null;

  const [
    { data: brand },
    { data: voice },
    { data: examples },
    { data: documents },
    { count: referencesCount },
  ] = await Promise.all([
    supabase.from("brands").select("*").eq("id", brandId).maybeSingle(),
    supabase.from("brand_voice").select("*").eq("brand_id", brandId).maybeSingle(),
    supabase
      .from("brand_examples")
      .select("id, content, created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false }),
    supabase
      .from("brand_documents")
      .select("id, name, file_type, file_size_bytes, extracted_content, created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false }),
    supabase
      .from("brand_references")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId),
  ]);

  if (!brand) notFound();

  const docExtracted: DocExtracted = (() => {
    const parsed = (documents ?? [])
      .map((d) => {
        try { return d.extracted_content ? JSON.parse(d.extracted_content) : null; }
        catch { return null; }
      })
      .filter(Boolean) as Record<string, unknown>[];

    return {
      hasPublicoAlvo: parsed.some((e) => typeof e.publico_alvo === "string" && (e.publico_alvo as string).trim().length > 0),
      hasPilares: parsed.some((e) => Array.isArray(e.pilares) && (e.pilares as unknown[]).length > 0),
      hasFrasesChave: parsed.some((e) => Array.isArray(e.frases_chave) && (e.frases_chave as unknown[]).length > 0),
      hasPalavrasEvitar: parsed.some((e) => Array.isArray(e.palavras_evitar) && (e.palavras_evitar as unknown[]).length > 0),
    };
  })();

  const qualityItems = computeQualityItems(
    brand,
    voice,
    examples?.length ?? 0,
    documents?.length ?? 0,
    referencesCount ?? 0,
    docExtracted
  );
  const liveScore = computeLiveScore(qualityItems);

  return (
    <>
      <PageHeader title={brand.name} description="Brand Brain — memória da IA." />

      <div className="flex-1 space-y-4 p-6">
        <QualityGuide brandId={brand.id} score={liveScore} items={qualityItems} />

        <Tabs key={activeTab} defaultValue={activeTab} className="max-w-2xl">
          <TabsList>
            <TabsTrigger value="interview">✦ Construir (chat)</TabsTrigger>
            <TabsTrigger value="identity">Identidade</TabsTrigger>
            <TabsTrigger value="voice">Tom de voz</TabsTrigger>
            <TabsTrigger value="examples">Exemplos ({examples?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="documents">Documentos ({documents?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="suggestions">Sugestões ✦</TabsTrigger>
          </TabsList>

          <TabsContent value="interview" className="mt-4">
            <InterviewTab
              brandId={brand.id}
              workspaceId={workspace.id}
              initialExtras={
                ((brand.identity ?? {}) as { brain_extras?: BrandExtras }).brain_extras ?? null
              }
            />
          </TabsContent>
          <TabsContent value="identity" className="mt-4">
            <IdentityTab brand={brand} workspaceId={workspace.id} />
          </TabsContent>
          <TabsContent value="voice" className="mt-4">
            <VoiceTab brandId={brand.id} voice={voice} />
          </TabsContent>
          <TabsContent value="examples" className="mt-4">
            <ExamplesTab brandId={brand.id} examples={examples ?? []} />
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <DocumentsTab
              brandId={brand.id}
              workspaceId={workspace.id}
              initialDocuments={documents ?? []}
            />
          </TabsContent>
          <TabsContent value="suggestions" className="mt-4">
            <SuggestionsTab
              brandId={brand.id}
              brandName={brand.name}
              references={[]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
