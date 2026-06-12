import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { anthropic } from "@/lib/ai/anthropic";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt-builder";
import {
  generationInputSchema,
  generationOutputSchema,
} from "@/lib/validations/generation";
// generationOutputSchema used for validating Claude's response below

export const runtime = "nodejs";
export const maxDuration = 60;

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
          send("error", { message: "Dados inválidos.", issues: parseResult.error.issues });
          controller.close();
          return;
        }
        const input = parseResult.data;

        send("progress", { message: "Buscando contexto da marca..." });

        const [{ data: brand }, { data: brandRow }] = await Promise.all([
          supabase
            .from("brands")
            .select(
              `id, name, description,
               brand_voice ( tone, target_audience, content_pillars, characteristic_phrases, forbidden_words ),
               brand_examples ( content ),
               brand_documents ( extracted_content )`
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
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        let fullText = "";
        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
          }
        }

        send("progress", { message: "Validando e salvando conteúdo..." });

        let parsed;
        try {
          const jsonMatch = fullText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("Sem JSON na resposta");

          const rawObj = JSON.parse(jsonMatch[0]);

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

        await supabase.from("usage_logs").insert({
          workspace_id: brandRow.workspace_id,
          user_id: user.id,
          type: "generation",
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
