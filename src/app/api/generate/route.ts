import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { anthropic } from "@/lib/ai/anthropic";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt-builder";
import {
  generationInputSchema,
  generationOutputSchema,
} from "@/lib/validations/generation";

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
        // ── Auth ─────────────────────────────────────────────────────────
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

        // ── Input validation ──────────────────────────────────────────────
        const body = await request.json();
        const parseResult = generationInputSchema.safeParse(body);
        if (!parseResult.success) {
          send("error", { message: "Dados inválidos.", issues: parseResult.error.issues });
          controller.close();
          return;
        }
        const input = parseResult.data;

        send("progress", { message: "Buscando contexto da marca..." });

        // ── Fetch brand context ───────────────────────────────────────────
        const { data: brand } = await supabase
          .from("brands")
          .select(
            `id, name, description,
             brand_voice ( tone, target_audience, content_pillars, characteristic_phrases, forbidden_words ),
             brand_examples ( content )`
          )
          .eq("id", input.brandId)
          .single();

        if (!brand) {
          send("error", { message: "Marca não encontrada." });
          controller.close();
          return;
        }

        // ── Workspace id ──────────────────────────────────────────────────
        const { data: brandRow } = await supabase
          .from("brands")
          .select("workspace_id")
          .eq("id", input.brandId)
          .single();

        if (!brandRow) {
          send("error", { message: "Workspace não encontrado." });
          controller.close();
          return;
        }

        send("progress", { message: "Montando briefing criativo..." });

        // ── Build prompts ─────────────────────────────────────────────────
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
          examples: Array.isArray(brand.brand_examples)
            ? brand.brand_examples
            : [],
        };

        const systemPrompt = buildSystemPrompt(brandContext, input);
        const userPrompt = buildUserPrompt(input);

        send("progress", { message: "Gerando conteúdo com IA..." });

        // ── Claude streaming ──────────────────────────────────────────────
        if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-COLE")) {
          send("error", {
            message:
              "Configure a variável ANTHROPIC_API_KEY no arquivo .env.local para usar o gerador.",
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
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
          }
        }

        send("progress", { message: "Validando e salvando conteúdo..." });

        // ── Parse & validate output ───────────────────────────────────────
        let parsed;
        try {
          const jsonMatch = fullText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("Sem JSON na resposta");
          parsed = generationOutputSchema.parse(JSON.parse(jsonMatch[0]));
        } catch {
          send("error", {
            message:
              "A IA retornou um formato inesperado. Tente novamente.",
          });
          controller.close();
          return;
        }

        // ── Save to DB ────────────────────────────────────────────────────
        const { data: piece, error: insertError } = await supabase
          .from("content_pieces")
          .insert({
            workspace_id: brandRow.workspace_id,
            brand_id: input.brandId,
            created_by: user.id,
            title: parsed.title,
            format: parsed.format,
            status: "scripted",
            ai_output: parsed,
            ai_prompt: userPrompt,
          })
          .select("id")
          .single();

        if (insertError || !piece) {
          send("error", { message: "Erro ao salvar conteúdo." });
          controller.close();
          return;
        }

        // ── Log usage ─────────────────────────────────────────────────────
        await supabase.from("usage_logs").insert({
          workspace_id: brandRow.workspace_id,
          user_id: user.id,
          type: "generation",
          metadata: { brand_id: input.brandId, format: input.format, piece_id: piece.id },
        });

        send("complete", { pieceId: piece.id, output: parsed });
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
