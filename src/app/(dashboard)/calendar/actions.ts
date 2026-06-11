"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/queries/context";
import type { ContentStatus } from "@/types/app";

export async function updatePieceStatus(pieceId: string, status: ContentStatus) {
  const { user, supabase } = await getSessionContext();
  if (!user) redirect("/login");

  await supabase
    .from("content_pieces")
    .update({ status })
    .eq("id", pieceId);

  revalidatePath("/calendar");
}

export async function updatePieceDate(pieceId: string, scheduledFor: string | null) {
  const { user, supabase } = await getSessionContext();
  if (!user) redirect("/login");

  await supabase
    .from("content_pieces")
    .update({ scheduled_for: scheduledFor, status: scheduledFor ? "scheduled" : undefined })
    .eq("id", pieceId);

  revalidatePath("/calendar");
}

export async function createIdea(formData: FormData) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user || !workspace) redirect("/login");

  const title = formData.get("title") as string;
  const brandId = formData.get("brandId") as string;
  const format = formData.get("format") as string;
  const scheduledFor = (formData.get("scheduledFor") as string) || null;

  if (!title?.trim() || !brandId || !format) return;

  await supabase.from("content_pieces").insert({
    workspace_id: workspace.id,
    brand_id: brandId,
    created_by: user.id,
    title: title.trim(),
    format,
    status: scheduledFor ? "scheduled" : "idea",
    scheduled_for: scheduledFor || null,
  });

  revalidatePath("/calendar");
}

export async function deletePiece(pieceId: string) {
  const { user, supabase } = await getSessionContext();
  if (!user) redirect("/login");

  await supabase.from("content_pieces").delete().eq("id", pieceId);

  revalidatePath("/calendar");
}
