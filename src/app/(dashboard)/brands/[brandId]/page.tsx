import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { scoreHint } from "@/lib/brand-score";
import { IdentityTab } from "./tabs/identity-tab";
import { VoiceTab } from "./tabs/voice-tab";
import { ExamplesTab } from "./tabs/examples-tab";
import { ReferencesTab } from "./tabs/references-tab";
import { DocumentsTab } from "./tabs/documents-tab";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const { supabase, workspace } = await getSessionContext();
  if (!workspace) return null;

  const [
    { data: brand },
    { data: voice },
    { data: references },
    { data: examples },
    { data: documents },
  ] = await Promise.all([
    supabase.from("brands").select("*").eq("id", brandId).maybeSingle(),
    supabase.from("brand_voice").select("*").eq("brand_id", brandId).maybeSingle(),
    supabase.from("brand_references").select("*").eq("brand_id", brandId).order("created_at"),
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
  ]);

  if (!brand) notFound();

  const hint = scoreHint(brand.brand_score);

  return (
    <>
      <PageHeader title={brand.name} description="Brand Brain — memória da IA.">
        <div className="flex w-44 flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Brand Score</span>
            <span className="font-medium">{brand.brand_score}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-accent">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${brand.brand_score}%` }}
            />
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 p-6">
        {hint && (
          <p className="mb-4 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {hint}
          </p>
        )}

        <Tabs defaultValue="identity" className="max-w-2xl">
          <TabsList>
            <TabsTrigger value="identity">Identidade</TabsTrigger>
            <TabsTrigger value="voice">Tom de voz</TabsTrigger>
            <TabsTrigger value="examples">
              Exemplos ({examples?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="references">
              Referências ({references?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documentos ({documents?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-4">
            <IdentityTab brand={brand} workspaceId={workspace.id} />
          </TabsContent>
          <TabsContent value="voice" className="mt-4">
            <VoiceTab brandId={brand.id} voice={voice} />
          </TabsContent>
          <TabsContent value="examples" className="mt-4">
            <ExamplesTab brandId={brand.id} examples={examples ?? []} />
          </TabsContent>
          <TabsContent value="references" className="mt-4">
            <ReferencesTab brandId={brand.id} references={references ?? []} />
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <DocumentsTab
              brandId={brand.id}
              workspaceId={workspace.id}
              initialDocuments={documents ?? []}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
