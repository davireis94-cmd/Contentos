"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Slide } from "@/lib/validations/generation";

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

export async function updateContentStatus(pieceId: string, status: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("content_pieces")
    .update({ status })
    .eq("id", pieceId);

  if (!error) {
    revalidatePath(`/content/${pieceId}`);
    revalidatePath("/library");
  }
}

export async function updateSlides(pieceId: string, slides: Slide[]) {
  const supabase = await getClient();
  await supabase
    .from("content_pieces")
    .update({ slides })
    .eq("id", pieceId);
  // Sem revalidatePath: este é um autosave do editor (o cliente já tem o estado).
  // Revalidar aqui re-renderiza a página e faz o scroll subir pro topo ao gerar
  // imagem/editar slide. A Biblioteca é revalidada ao navegar.
}

export async function updateCaption(pieceId: string, caption: string) {
  const supabase = await getClient();
  await supabase
    .from("content_pieces")
    .update({ caption })
    .eq("id", pieceId);
  // Sem revalidatePath (autosave — ver updateSlides).
}

export async function deleteContentPiece(pieceId: string) {
  const supabase = await getClient();
  await supabase.from("content_pieces").delete().eq("id", pieceId);
  revalidatePath("/library");
  redirect("/library");
}
