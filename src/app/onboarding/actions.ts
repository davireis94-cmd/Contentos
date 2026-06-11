"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { workspaceSlug } from "@/lib/slug";

export async function createWorkspace(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  if (!name || name.length < 2) {
    redirect("/onboarding?error=" + encodeURIComponent("Dê um nome ao seu workspace."));
  }

  // explicit id avoids INSERT...RETURNING before membership exists
  const workspaceId = crypto.randomUUID();

  const { error: wsError } = await supabase.from("workspaces").insert({
    id: workspaceId,
    name,
    slug: workspaceSlug(name),
    owner_id: user.id,
  });

  if (wsError) {
    redirect("/onboarding?error=" + encodeURIComponent("Não foi possível criar o workspace."));
  }

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    redirect("/onboarding?error=" + encodeURIComponent("Erro ao configurar permissões."));
  }

  redirect("/");
}
