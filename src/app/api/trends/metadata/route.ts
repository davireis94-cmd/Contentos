import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function detectPlatform(url: string): "youtube" | "tiktok" | "instagram" | "other" {
  if (/youtu\.be|youtube\.com/.test(url)) return "youtube";
  if (/tiktok\.com/.test(url)) return "tiktok";
  if (/instagram\.com/.test(url)) return "instagram";
  return "other";
}

async function fetchOEmbed(url: string, platform: string) {
  const endpoints: Record<string, string> = {
    youtube: `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    tiktok: `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  };
  const endpoint = endpoints[platform];
  if (!endpoint) return null;

  const res = await fetch(endpoint, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json() as Promise<{ title?: string; thumbnail_url?: string; author_name?: string }>;
}

async function fetchYouTubeTranscript(url: string): Promise<string | null> {
  try {
    const videoIdMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch) return null;
    const videoId = videoIdMatch[1];

    const { YoutubeTranscript } = await import("youtube-transcript");
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "pt" })
      .catch(() => YoutubeTranscript.fetchTranscript(videoId));

    if (!segments?.length) return null;

    const text = segments
      .map((s) => s.text.replace(/\[.*?\]/g, "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return text.length > 50 ? text.slice(0, 8000) : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url?.trim()) {
    return NextResponse.json({ error: "URL obrigatória" }, { status: 400 });
  }

  const platform = detectPlatform(url);
  const oembed = await fetchOEmbed(url, platform);

  let transcript: string | null = null;
  if (platform === "youtube") {
    transcript = await fetchYouTubeTranscript(url);
  }

  return NextResponse.json({
    platform,
    title: oembed?.title ?? null,
    thumbnail_url: oembed?.thumbnail_url ?? null,
    author: oembed?.author_name ?? null,
    transcript,
  });
}
