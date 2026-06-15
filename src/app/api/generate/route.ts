import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { anthropic } from "@/lib/ai/anthropic";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt-builder";
import {
  generationInputSchema,
  generationOutputSchema,
} from "@/lib/validations/generation";
import { trackUsage } from "@/lib/billing/track";
import { extractJson } from "@/lib/ai/json";
import type { Operation } from "@/lib/billing/pricing";
// generationOutputSchema used for validating Claude's response below

export const runtime = "nodejs";
export const maxDuration = 60;

const GENERATE_MODEL = "claude-sonnet-4-6";

const FORMAT_OPERATION: Record<string, Operation> = {
  carousel: "generate_carousel",
  reel: "generate_reel",
  story: "generate_story",
  single: "generate_single",
};

function sseEvent(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll: () => request.cookies.getAll(),
              setAll: () => {},
            },
          }
        );

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          send("error", { message: "Não autenticado." });
          controller.close();
          return;
        }

        const body = await request.json();
        const parseResult = generationInputSchema.safeParse(body);
        if (!parseResult.success) {
          const first = parseResult.error.issues[0];
          const fieldLabel: Record<string, string> = {
            topic: "Tópico",
            brandId: "Marca",
            slideCount: "Nº de slides",
            objective: "Objetivo",
            format: "Formato",
          };
          const field = fieldLabel[String(first?.path?.[0] ?? "")] ?? String(first?.path?.[0] ?? "campo");
          const detail = first
            ? `${field}: ${first.message}`
            : "Dados inválidos.";
          send("error", { message: detail, issues: parseResult.error.issues });
          controller.close();
          return;
        }
        const input = parseResult.data;

        send("progress", { message: "Buscando contexto da marca..." });

        const [{ data: brand }, { data: brandRow }] = await Promise.all([
          supabase
            .from("brands")
            .select(
              `id, name, description, identity,
               brand_voice ( tone, target_audience, content_pillars, characteristic_phrases, forbidden_words ),
               brand_examples ( content ),
               brand_documents ( extracted_content ),
               brand_references ( name, handle, ai_analysis )`
            )
            .eq("id", input.brandId)
            .single(),
          supabase
            .from("brands")
            .select("workspace_id")
            .eq("id", input.brandId)
            .single(),
        ]);

        if (!brand || !brandRow) {
          send("error", { message: "Marca não encontrada." });
          controller.close();
          return;
        }

        send("progress", { message: "Montando briefing criativo..." });

        const rawDocs = Array.isArray((brand as Record<string, unknown>).brand_documents)
          ? (brand as Record<string, unknown>).brand_documents as { extracted_content: string | null }[]
          : [];
        const documents = rawDocs
          .map((d) => {
            if (!d.extracted_content) return null;
            try { return JSON.parse(d.extracted_content); } catch { return null; }
          })
          .filter(Boolean);

        // Fetch reference posts if provided
        let references: Array<{ title: string; format: string; slides: { index: number; title: string; subtitle?: string; body: string; cta?: string }[]; caption: string }> = [];
        if (input.referenceIds && input.referenceIds.length > 0) {
          const { data: refPieces } = await supabase
            .from("content_pieces")
            .select("title, format, slides, caption")
            .in("id", input.referenceIds)
            .eq("workspace_id", brandRow.workspace_id);

          if (refPieces) {
            references = refPieces
              .filter((p) => p.slides && p.caption)
              .map((p) => ({
                title: p.title as string,
                format: p.format as string,
                slides: p.slides as { index: number; title: string; subtitle?: string; body: string; cta?: string }[],
                caption: p.caption as string,
              }));
          }
        }

        const brandContext = {
          name: brand.name,
          description: brand.description,
          voice: Array.isArray(brand.brand_voice)
            ? brand.brand_voice[0] ?? null
            : (brand.brand_voice as {
                tone: string;
                target_audience: string | null;
                content_pillars: string[];
                characteristic_phrases: string[];
                forbidden_words: string[];
              } | null),
          examples: Array.isArray(brand.brand_examples) ? brand.brand_examples : [],
          documents,
          references,
          externalRef: input.externalRef,
          extras: ((brand as { identity?: { brain_extras?: unknown } }).identity?.brain_extras ?? null) as
            | import("@/lib/brand/extras").BrandExtras
            | null,
          performance: ((brand as { identity?: { performance_insights?: unknown } }).identity?.performance_insights ?? null) as
            | import("@/lib/brand/performance").PerformanceInsights
            | null,
          benchmark: (Array.isArray((brand as Record<string, unknown>).brand_references)
            ? ((brand as Record<string, unknown>).brand_references as { name: string; handle: string | null; ai_analysis: string | null }[])
            : []
          )
            .map((r) => {
              let a: { estrategia?: string; estilo?: string; licoes?: string[] } = {};
              try { a = r.ai_analysis ? JSON.parse(r.ai_analysis) : {}; } catch { a = {}; }
              return { name: r.name, handle: r.handle, estrategia: a.estrategia, estilo: a.estilo, licoes: a.licoes };
            })
            .filter((b) => b.estrategia || b.estilo || (b.licoes?.length ?? 0) > 0),
        };

        const systemPrompt = buildSystemPrompt(brandContext, input);
        const userPrompt = buildUserPrompt(input);

        // Create draft row immediately so it appears in the library
        const { data: draftPiece, error: draftError } = await supabase
          .from("content_pieces")
          .insert({
            workspace_id: brandRow.workspace_id,
            brand_id: input.brandId,
            created_by: user.id,
            title: input.topic.slice(0, 120),
            format: input.format,
            status: "idea",
            objective: input.objective,
            slides: [],
            hashtags: [],
          })
          .select("id")
          .single();

        if (draftError || !draftPiece) {
          send("error", { message: "Erro ao criar rascunho." });
          controller.close();
          return;
        }

        send("progress", { message: references.length > 0 ? "Analisando referências e gerando conteúdo..." : "Gerando conteúdo com IA..." });

        if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-COLE")) {
          send("error", {
            message: "Configure a variável ANTHROPIC_API_KEY no arquivo .env.local para usar o gerador.",
          });
          controller.close();
          return;
        }

        const claudeStream = anthropic.messages.stream({
          model: GENERATE_MODEL,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        let fullText = "";
        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
          }
        }

        // Capture real token usage for cost tracking
        let usageIn = 0;
        let usageOut = 0;
        try {
          const finalMsg = await claudeStream.finalMessage();
          usageIn = finalMsg.usage.input_tokens;
          usageOut = finalMsg.usage.output_tokens;
        } catch {
          // usage unavailable — tracking will log 0
        }

        send("progress", { message: "Validando e salvando conteúdo..." });

        let parsed;
        try {
          const rawObj = extractJson<Record<string, unknown>>(fullText);

          // Guarantee format/platform match input — don't trust Claude's echoed values
          rawObj.format = input.format;
          rawObj.platform = input.platform;
          rawObj.productionTool = input.productionTool ?? rawObj.productionTool ?? "";

          // Sanitize hashtags: remove spaces/special chars, ensure leading #
          if (Array.isArray(rawObj.hashtags)) {
            rawObj.hashtags = rawObj.hashtags
              .map((h: unknown) => {
                if (typeof h !== "string") return null;
                const clean = h.replace(/\s+/g, "").replace(/[^\p{L}\p{N}_#]/gu, "");
                return clean.startsWith("#") ? clean : `#${clean}`;
              })
              .filter((h: string | null): h is string => !!h && h.length > 2);
          }

          parsed = generationOutputSchema.parse(rawObj);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          send("error", { message: `Formato inesperado: ${detail.slice(0, 300)}` });
          controller.close();
          return;
        }

        // Update the draft with generated content
        const { error: updateError } = await supabase
          .from("content_pieces")
          .update({
            title: parsed.title,
            status: "scripted",
            slides: parsed.slides,
            caption: parsed.caption,
            hashtags: parsed.hashtags,
          })
          .eq("id", draftPiece.id);

        if (updateError) {
          send("error", { message: "Erro ao salvar conteúdo gerado." });
          controller.close();
          return;
        }

        await trackUsage({
          supabase,
          workspaceId: brandRow.workspace_id,
          userId: user.id,
          operation: FORMAT_OPERATION[input.format] ?? "generate_single",
          model: GENERATE_MODEL,
          tokensInput: usageIn,
          tokensOutput: usageOut,
          metadata: {
            brand_id: input.brandId,
            format: input.format,
            piece_id: draftPiece.id,
            reference_count: references.length,
          },
        });

        send("complete", { pieceId: draftPiece.id, output: parsed });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro inesperado.";
        try {
          controller.enqueue(encoder.encode(sseEvent("error", { message })));
        } catch {
          // controller already closed
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
