"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/queries/context";
import { redirect } from "next/navigation";

export async function addTrend(formData: FormData) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user || !workspace) redirect("/login");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "Título obrigatório" };

  const tagsRaw = (formData.get("topic_tags") as string) ?? "";
  const topic_tags = tagsRaw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  await supabase.from("benchmark_content").insert({
    workspace_id: workspace.id,
    added_by: user.id,
    title,
    description: (formData.get("description") as string)?.trim() || null,
    source_url: (formData.get("source_url") as string)?.trim() || null,
    thumbnail_url: (formData.get("thumbnail_url") as string)?.trim() || null,
    format: (formData.get("format") as string) || "carousel",
    platform: (formData.get("platform") as string) || "instagram",
    topic_tags,
    notes: (formData.get("notes") as string)?.trim() || null,
    transcript: (formData.get("transcript") as string)?.trim() || null,
  });

  revalidatePath("/trends");
}

export async function deleteTrend(id: string) {
  const { user, supabase } = await getSessionContext();
  if (!user) redirect("/login");

  await supabase
    .from("benchmark_content")
    .delete()
    .eq("id", id)
    .eq("added_by", user.id);

  revalidatePath("/trends");
}
