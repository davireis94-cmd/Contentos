import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { buildAuthUrl } from "@/lib/social/instagram";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  if (!process.env.META_APP_ID) {
    return NextResponse.redirect(new URL("/analytics?error=meta_nao_configurado", request.url));
  }

  const redirectUri = `${request.nextUrl.origin}/api/social/instagram/callback`;
  const state = randomBytes(16).toString("hex");

  const res = NextResponse.redirect(buildAuthUrl(redirectUri, state));
  res.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
