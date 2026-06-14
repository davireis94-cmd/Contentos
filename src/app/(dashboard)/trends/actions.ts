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

export interface ReferenceProfile {
  platform: "instagram" | "tiktok";
  handle: string; // sem @
}

/** Lê os perfis de referência guardados na marca do workspace. */
export async function getReferenceProfiles(): Promise<ReferenceProfile[]> {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user || !workspace) return [];
  const { data: brand } = await supabase
    .from("brands")
    .select("identity")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const identity = (brand?.identity ?? {}) as { reference_profiles?: ReferenceProfile[] };
  return Array.isArray(identity.reference_profiles) ? identity.reference_profiles : [];
}

/** Salva (substitui) a lista de perfis de referência da marca. */
export async function saveReferenceProfiles(profiles: ReferenceProfile[]) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user || !workspace) redirect("/login");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, identity")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!brand) return { error: "Marca não encontrada" };

  const clean = profiles
    .filter((p) => p.handle?.trim())
    .map((p) => ({
      platform: p.platform === "tiktok" ? "tiktok" : "instagram",
      handle: p.handle.trim().replace(/^@/, "").replace(/\s/g, ""),
    }))
    .slice(0, 10) as ReferenceProfile[];

  const identity = { ...((brand.identity ?? {}) as object), reference_profiles: clean };
  await supabase.from("brands").update({ identity }).eq("id", brand.id);
  revalidatePath("/trends");
  return { ok: true };
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
