import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchInstagramProfiles } from "@/lib/trends/instagram-trends";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json() as { handles: string[] };
  if (!body.handles?.length) return NextResponse.json({ error: "handles obrigatório" }, { status: 400 });

  try {
    const posts = await fetchInstagramProfiles(body.handles, 6);
    // Extract hashtags from captions for trend feeding
    const hashtagSet = new Set<string>();
    for (const post of posts) {
      const tags = (post.description ?? post.title).match(/#[\wÀ-ɏ]+/g) ?? [];
      tags.slice(0, 5).forEach((t) => hashtagSet.add(t.toLowerCase()));
    }
    return NextResponse.json({ posts, hashtags: Array.from(hashtagSet).slice(0, 20) });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Erro Apify";
    const friendly = /timed?-?out/i.test(raw)
      ? "O Instagram demorou demais pra responder (timeout). Tente de novo em alguns segundos — costuma funcionar na 2ª tentativa."
      : raw;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
