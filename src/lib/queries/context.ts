import { createClient } from "@/lib/supabase/server";

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: "free" | "starter" | "pro";
}

export async function getSessionContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, workspace: null };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug, owner_id, plan")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<WorkspaceRow>();

  return { supabase, user, workspace };
}
