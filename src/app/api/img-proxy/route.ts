import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Proxy de imagem same-origin. Existe para o html2canvas conseguir desenhar as
 * imagens (geradas por IA / no Supabase Storage) sem esbarrar em CORS — ao servir
 * pela mesma origem, o canvas não fica "tainted" e o PNG sai com a imagem.
 *
 * Uso: /api/img-proxy?url=<URL https encodada>
 */
export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  // Só https público — evita SSRF p/ rede interna.
  if (parsed.protocol !== "https:") return new Response("only https", { status: 400 });
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return new Response("blocked host", { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString());
    if (!upstream.ok) return new Response("upstream error", { status: 502 });
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
