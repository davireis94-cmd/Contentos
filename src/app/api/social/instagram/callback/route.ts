import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { connectInstagram } from "@/lib/social/instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!workspace) return NextResponse.redirect(new URL("/onboarding", request.url));

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("ig_oauth_state")?.value;
  const igError = request.nextUrl.searchParams.get("error_description");

  if (igError) {
    return NextResponse.redirect(
      new URL(`/analytics?error=${encodeURIComponent(igError)}`, request.url)
    );
  }
  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL("/analytics?error=autorizacao_invalida", request.url));
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/social/instagram/callback`;
    const acc = await connectInstagram(code, redirectUri);

    // Grava a conexão (service role — token nunca passa pelo cliente)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    await admin.from("social_connections").upsert(
      {
        workspace_id: workspace.id,
        platform: "instagram",
        external_id: acc.igUserId,
        username: acc.username,
        access_token: acc.token,
        token_expires_at: acc.expiresAt,
        connected_by: user.id,
        updated_at: new Date().toISOString(),
        meta: {
          followers_count: acc.followersCount,
          media_count: acc.mediaCount,
          profile_picture: acc.profilePicture,
          page_id: acc.pageId,
        },
      },
      { onConflict: "workspace_id,platform" }
    );

    return NextResponse.redirect(new URL("/analytics?connected=1", request.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao conectar";
    return NextResponse.redirect(
      new URL(`/analytics?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
