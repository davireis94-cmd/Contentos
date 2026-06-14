import { NextRequest } from "next/server";

export const runtime = "nodejs";

// CDNs de redes sociais cujas imagens bloqueiam hotlink (precisam de proxy).
const ALLOWED_HOST_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "ttwstatic.com",
  "redd.it",
  "redditmedia.com",
  "ytimg.com",
  "unavatar.io",
  "licdn.com",
  "twimg.com",
];

/**
 * Proxy de imagens: busca server-side (sem Referer) e devolve a imagem.
 * Resolve o bloqueio de hotlink dos CDNs de Instagram/TikTok/etc.
 * Restrito a hosts conhecidos para evitar uso como open proxy.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new Response("missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  if (target.protocol !== "https:") {
    return new Response("only https", { status: 400 });
  }
  const host = target.hostname.toLowerCase();
  if (!ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return new Response("host not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        // Sem Referer; UA de browser ajuda alguns CDNs a liberar.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new Response("upstream error", { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return new Response("not an image", { status: 415 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        // Cache no edge/browser por 1 dia — URLs assinadas expiram, mas economiza re-fetch.
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
