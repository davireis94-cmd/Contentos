import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ImportedContent {
  url: string;
  platform: string;
  platformLabel: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  author: string | null;
  isPartial: boolean;
}

const PLATFORM_MAP: { test: RegExp; id: string; label: string }[] = [
  { test: /instagram\.com/, id: "instagram", label: "Instagram" },
  { test: /youtu\.be|youtube\.com/, id: "youtube", label: "YouTube" },
  { test: /twitter\.com|x\.com/, id: "twitter", label: "X (Twitter)" },
  { test: /tiktok\.com/, id: "tiktok", label: "TikTok" },
  { test: /linkedin\.com/, id: "linkedin", label: "LinkedIn" },
];

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
};

function detectPlatform(url: string): { id: string; label: string } {
  for (const { test, id, label } of PLATFORM_MAP) {
    if (test.test(url)) return { id, label };
  }
  return { id: "web", label: "Web" };
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*?)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']*?)["'][^>]*(?:property|name)=["']${property}["']`,
      "i"
    ),
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m?.[1]?.trim()) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16))
    );
}

function cleanInstagramDescription(desc: string): string {
  // Remove "1,234 likes, 56 comments - @user on Instagram: " prefix
  const match = desc.match(/on Instagram:\s*["']?([\s\S]+?)["']?$/i);
  if (match?.[1]) return match[1].trim().replace(/["']$/, "").trim();
  return desc;
}

function extractTweetText(embedHtml: string): string | null {
  // Extract text from <p lang="..."> inside the blockquote
  const m = embedHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return null;
  // Strip HTML tags from the paragraph
  return m[1]
    .replace(/<a[^>]*>([^<]*)<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOEmbed(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function importYouTube(url: string): Promise<ImportedContent> {
  const oembed = await fetchOEmbed(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  );
  return {
    url,
    platform: "youtube",
    platformLabel: "YouTube",
    title: (oembed?.title as string) ?? null,
    description: (oembed?.title as string) ?? null,
    imageUrl: (oembed?.thumbnail_url as string) ?? null,
    author: (oembed?.author_name as string) ?? null,
    isPartial: !oembed?.title,
  };
}

async function importTwitter(url: string): Promise<ImportedContent> {
  const oembed = await fetchOEmbed(
    `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`
  );
  const embedHtml = (oembed?.html as string) ?? "";
  const tweetText = embedHtml ? extractTweetText(embedHtml) : null;
  return {
    url,
    platform: "twitter",
    platformLabel: "X (Twitter)",
    title: tweetText ? tweetText.slice(0, 120) : null,
    description: tweetText,
    imageUrl: null,
    author: (oembed?.author_name as string) ?? null,
    isPartial: !tweetText,
  };
}

async function importTikTok(url: string): Promise<ImportedContent> {
  const oembed = await fetchOEmbed(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
  );
  return {
    url,
    platform: "tiktok",
    platformLabel: "TikTok",
    title: (oembed?.title as string) ?? null,
    description: (oembed?.title as string) ?? null,
    imageUrl: (oembed?.thumbnail_url as string) ?? null,
    author: (oembed?.author_name as string) ?? null,
    isPartial: !oembed?.title,
  };
}

async function importInstagram(url: string): Promise<ImportedContent> {
  const html = await fetchHtml(url);

  // Detect login wall
  if (!html || html.includes("login") && html.includes("You must log in")) {
    return {
      url,
      platform: "instagram",
      platformLabel: "Instagram",
      title: null,
      description: null,
      imageUrl: null,
      author: null,
      isPartial: true,
    };
  }

  const rawDesc = extractMeta(html, "og:description");
  const description = rawDesc ? cleanInstagramDescription(rawDesc) : null;
  const title = extractMeta(html, "og:title");
  const imageUrl = extractMeta(html, "og:image");

  // Try to extract author from title pattern "@username • Instagram"
  let author: string | null = null;
  if (title) {
    const m = title.match(/@([\w.]+)/);
    if (m) author = `@${m[1]}`;
  }

  return {
    url,
    platform: "instagram",
    platformLabel: "Instagram",
    title: title ?? null,
    description,
    imageUrl: imageUrl ?? null,
    author,
    isPartial: !description,
  };
}

async function importGeneric(url: string, platform: { id: string; label: string }): Promise<ImportedContent> {
  const html = await fetchHtml(url);
  if (!html) {
    return {
      url,
      platform: platform.id,
      platformLabel: platform.label,
      title: null,
      description: null,
      imageUrl: null,
      author: null,
      isPartial: true,
    };
  }

  const title =
    extractMeta(html, "og:title") ?? extractMeta(html, "twitter:title");
  const description =
    extractMeta(html, "og:description") ?? extractMeta(html, "twitter:description");
  const imageUrl =
    extractMeta(html, "og:image") ?? extractMeta(html, "twitter:image");
  const siteName = extractMeta(html, "og:site_name");

  return {
    url,
    platform: platform.id,
    platformLabel: siteName ?? platform.label,
    title: title ?? null,
    description: description ?? null,
    imageUrl: imageUrl ?? null,
    author: null,
    isPartial: !description,
  };
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { url } = await request.json() as { url?: string };
  if (!url?.trim()) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const normalizedUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
  const platform = detectPlatform(normalizedUrl);

  let result: ImportedContent;
  try {
    switch (platform.id) {
      case "youtube":
        result = await importYouTube(normalizedUrl);
        break;
      case "twitter":
        result = await importTwitter(normalizedUrl);
        break;
      case "tiktok":
        result = await importTikTok(normalizedUrl);
        break;
      case "instagram":
        result = await importInstagram(normalizedUrl);
        break;
      default:
        result = await importGeneric(normalizedUrl, platform);
    }
  } catch {
    return NextResponse.json({ error: "Não foi possível acessar este URL." }, { status: 502 });
  }

  return NextResponse.json({ content: result });
}
