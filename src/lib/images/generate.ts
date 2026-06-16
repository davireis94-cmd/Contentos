/**
 * Geração de imagem via Replicate.
 * Usa o header `Prefer: wait` para resposta síncrona (sem polling manual),
 * adequado ao limite de 60s do route serverless.
 */

import { getImageModel } from "./models";

export interface GenerateImageResult {
  url?: string; // URL remota (Replicate)
  b64?: string; // imagem base64 (Gemini direto)
  error?: string;
}

/** Geração direta pela API do Gemini (free tier do Google). Retorna base64. */
async function generateImageGemini(prompt: string): Promise<GenerateImageResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { error: "GEMINI_API_KEY não configurado (crie grátis no Google AI Studio e adicione no Vercel)" };
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = (await res.json()) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[];
    };
    if (!res.ok) {
      const msg = data?.error?.message ?? `Gemini ${res.status}`;
      if (/quota|free_tier|exceeded|limit: 0/i.test(msg)) {
        return {
          error:
            "A geração de imagem do Gemini não está no plano grátis (cota 0). É preciso ativar o faturamento (billing) na conta Google Cloud para usar este modelo. Enquanto isso, use Flux Dev (barato) ou Flux 1.1 Pro.",
        };
      }
      return { error: msg };
    }
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const b64 = parts.map((p) => p.inlineData?.data ?? p.inline_data?.data).find(Boolean);
    if (!b64) return { error: "Gemini não retornou imagem (pode ter atingido o limite diário do free tier)" };
    return { b64 };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro Gemini" };
  }
}

/**
 * EDIÇÃO imagem→imagem (inpainting/instrução) via Nano Banana (google/nano-banana).
 * Recebe a imagem ATUAL + uma instrução e altera só o que foi pedido, mantendo o
 * resto — diferente de gerar do zero (texto→imagem). É o que permite "adicionar o
 * logo do Claude aqui" sem trocar a imagem inteira.
 */
export async function editImage(
  prompt: string,
  imageUrl: string
): Promise<GenerateImageResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return { error: "REPLICATE_API_TOKEN não configurado" };

  try {
    const res = await fetch(
      `https://api.replicate.com/v1/models/google/nano-banana/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({ input: { prompt, image_input: [imageUrl] } }),
      }
    );

    const data = (await res.json()) as {
      status?: string;
      output?: string | string[];
      error?: string;
      detail?: string;
    };

    if (!res.ok) return { error: data.detail ?? data.error ?? `Replicate ${res.status}` };
    if (data.status === "failed" || data.error) return { error: data.error ?? "Falha na edição" };

    const output = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!output) return { error: "Editor não retornou imagem" };
    return { url: output };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function generateImage(
  modelKey: string,
  prompt: string
): Promise<GenerateImageResult> {
  const model = getImageModel(modelKey);

  // Gemini direto (grátis) não passa pelo Replicate.
  if (model.provider === "gemini") {
    return generateImageGemini(prompt);
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return { error: "REPLICATE_API_TOKEN não configurado" };
  }

  try {
    const res = await fetch(
      `https://api.replicate.com/v1/models/${model.replicatePath}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({ input: model.buildInput(prompt) }),
      }
    );

    const data = (await res.json()) as {
      status?: string;
      output?: string | string[];
      error?: string;
      detail?: string;
    };

    if (!res.ok) {
      return { error: data.detail ?? data.error ?? `Replicate ${res.status}` };
    }

    if (data.status === "failed" || data.error) {
      return { error: data.error ?? "Falha na geração" };
    }

    const output = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!output) {
      return { error: "Modelo não retornou imagem (pode ainda estar processando)" };
    }

    return { url: output };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
