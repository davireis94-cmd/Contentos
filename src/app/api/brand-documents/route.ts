import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { extractDocumentContent } from "@/lib/ai/extract-document";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

function supabaseFromRequest(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
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

  if (!ACCEPTED_TYPES[file.type]) {
    return NextResponse.json({ error: "Formato não suportado" }, { status: 400 });
  }

  const MB20 = 20 * 1024 * 1024;
  if (file.size > MB20) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 20MB)" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${workspaceId}/${brandId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("brand-docs")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Falha no upload: " + uploadError.message }, { status: 500 });
  }

  let extractedContent: string | null = null;
  if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-COLE")) {
    try {
      extractedContent = await extractDocumentContent(buffer, file.type, file.name);
    } catch (err) {
      console.error("Claude extraction error:", err);
    }
  }

  const { data: doc, error: dbError } = await supabase
    .from("brand_documents")
    .insert({
      brand_id: brandId,
      workspace_id: workspaceId,
      name: file.name,
      storage_path: path,
      file_type: file.type,
      file_size_bytes: file.size,
      extracted_content: extractedContent,
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
