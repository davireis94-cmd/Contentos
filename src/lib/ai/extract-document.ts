import { anthropic } from "@/lib/ai/anthropic";
import mammoth from "mammoth";

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

const EXTRACT_PROMPT = `Analise este documento de identidade de marca e extraia as informações em JSON:
{
  "resumo": "resumo da marca em 2-3 frases",
  "publico_alvo": "descrição do público-alvo",
  "tom_de_voz": "como a marca se comunica",
  "valores": ["valor1", "valor2"],
  "diferenciais": ["diferencial1"],
  "pilares": ["pilar de conteúdo 1", "pilar 2"],
  "frases_chave": ["frases características"],
  "palavras_evitar": ["palavras que contradizem a identidade"],
  "posicionamento": "como a marca se posiciona"
}
Retorne APENAS o JSON, sem markdown.`;

export async function extractDocumentContent(
  buffer: Buffer,
  fileType: string,
  fileName: string
): Promise<string> {
  const kind = ACCEPTED_TYPES[fileType] ?? "txt";
  const base64 = buffer.toString("base64");

  let content;

  if (kind === "pdf") {
    content = [
      {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: base64,
        },
      },
      { type: "text" as const, text: EXTRACT_PROMPT },
    ];
  } else if (kind === "image") {
    const mediaType = fileType as "image/png" | "image/jpeg" | "image/webp";
    content = [
      {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType, data: base64 },
      },
      { type: "text" as const, text: EXTRACT_PROMPT },
    ];
  } else if (kind === "docx" || kind === "doc") {
    const { value: text } = await mammoth.extractRawText({ buffer });
    content = [
      {
        type: "text" as const,
        text: `DOCUMENTO: ${fileName}\n\n${text}\n\n---\n${EXTRACT_PROMPT}`,
      },
    ];
  } else {
    const text = buffer.toString("utf-8");
    content = [
      {
        type: "text" as const,
        text: `DOCUMENTO: ${fileName}\n\n${text}\n\n---\n${EXTRACT_PROMPT}`,
      },
    ];
  }

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : raw;
}
