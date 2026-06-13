import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { syncTrends } from "@/lib/trends/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Sincroniza tendências do mercado (YouTube + Reddit).
 * Chamável por:
 *   - Cron do Vercel (GET com header Authorization: Bearer ${CRON_SECRET})
 *   - Usuário autenticado (POST a partir da página de Tendências)
 */

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Cron path
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  // Authenticated user path
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

async function handle(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await syncTrends();
  const status = result.error && result.total === 0 ? 502 : 200;
  return NextResponse.json(result, { status });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
