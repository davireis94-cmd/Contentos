/**
 * Geração de imagem via Replicate.
 * Usa o header `Prefer: wait` para resposta síncrona (sem polling manual),
 * adequado ao limite de 60s do route serverless.
 */

import { getImageModel } from "./models";

export interface GenerateImageResult {
  url?: string;
  error?: string;
}

export async function generateImage(
  modelKey: string,
  prompt: string
): Promise<GenerateImageResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return { error: "REPLICATE_API_TOKEN não configurado" };
  }

  const model = getImageModel(modelKey);

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
