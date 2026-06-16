"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { CAROUSEL_TEMPLATES } from "@/lib/templates/carousel-templates";

async function getClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) =>
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

export async function createFromTemplate(
  templateId: string,
  topic: string,
  brandId: string
) {
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const tpl = CAROUSEL_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) throw new Error("Template não encontrado");

  // Resolve workspace
  const { data: brand } = await supabase
    .from("brands")
    .select("workspace_id")
    .eq("id", brandId)
    .single();
  if (!brand) throw new Error("Marca não encontrada");

  const slides = tpl.build(topic.trim() || tpl.title);

  const { data: piece, error } = await supabase
    .from("content_pieces")
    .insert({
      workspace_id: brand.workspace_id,
      brand_id: brandId,
      title: topic.trim() || tpl.title,
      format: "carousel",
      status: "idea",
      slides,
      caption: "",
      hashtags: [],
    })
    .select("id")
    .single();

  if (error || !piece) throw new Error("Erro ao criar conteúdo");

  redirect(`/content/${piece.id}`);
}
