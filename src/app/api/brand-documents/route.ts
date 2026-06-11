import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { anthropic } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

function supabaseFromRequest(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabase = supabaseFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const brandId = formData.get("brandId") as string | null;
  const workspaceId = formData.get("workspaceId") as string | null;

  if (!file || !brandId || !workspaceId) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const MB10 = 10 * 1024 * 1024;
  if (file.size > MB10) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 10MB)" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${workspaceId}/${brandId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("brand-docs")
    .upload(path, buffer, { contentType: file.type || "application/pdf", upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Falha no upload: " + uploadError.message }, { status: 500 });
  }

  // Extract brand context with Claude
  let extractedContent = "";
  try {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const base64 = buffer.toString("base64");

    const userContent = isPdf
      ? [
          {
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 },
          },
          {
            type: "text" as const,
            text: `Analise este documento de identidade de marca e extraia as seguintes informações em JSON:
{
  "resumo": "resumo da marca em 2-3 frases",
  "publico_alvo": "descrição do público-alvo",
  "tom_de_voz": "como a marca se comunica (ex: autoridade, conversacional, inspiracional)",
  "valores": ["valor1", "valor2"],
  "diferenciais": ["diferencial1", "diferencial2"],
  "pilares": ["pilar de conteúdo 1", "pilar 2", "pilar 3"],
  "frases_chave": ["frases ou expressões características da marca"],
  "palavras_evitar": ["palavras que contradizem a identidade"],
  "posicionamento": "como a marca se posiciona no mercado"
}
Retorne APENAS o JSON, sem markdown, sem explicações.`,
          },
        ]
      : [
          {
            type: "text" as const,
            text: `DOCUMENTO DE MARCA:\n\n${buffer.toString("utf-8")}\n\n---\nAnalise e extraia em JSON:\n{"resumo":"","publico_alvo":"","tom_de_voz":"","valores":[],"diferenciais":[],"pilares":[],"frases_chave":[],"palavras_evitar":[],"posicionamento":""}`,
          },
        ];

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: userContent }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    extractedContent = match ? match[0] : text;
  } catch (err) {
    console.error("Claude extraction error:", err);
    // Continue without extraction — doc is still saved
  }

  // Save to DB
  const { data: doc, error: dbError } = await supabase
    .from("brand_documents")
    .insert({
      brand_id: brandId,
      workspace_id: workspaceId,
      name: file.name,
      storage_path: path,
      file_type: file.type || "application/pdf",
      file_size_bytes: file.size,
      extracted_content: extractedContent || null,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: "Erro ao salvar: " + dbError.message }, { status: 500 });
  }

  return NextResponse.json({ document: doc });
}

export async function DELETE(request: NextRequest) {
  const supabase = supabaseFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { documentId } = await request.json();

  const { data: doc } = await supabase
    .from("brand_documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (doc?.storage_path) {
    await supabase.storage.from("brand-docs").remove([doc.storage_path]);
  }

  await supabase.from("brand_documents").delete().eq("id", documentId);

  return NextResponse.json({ ok: true });
}
