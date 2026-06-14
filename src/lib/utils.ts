import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Roteia imagens de CDNs que bloqueiam hotlink (Instagram/TikTok/etc.) pelo
 * proxy interno /api/img. Para outras URLs, retorna a original.
 */
const PROXY_HOSTS = [
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "ttwstatic.com",
  "redd.it",
  "redditmedia.com",
  "twimg.com",
  "licdn.com",
];

export function proxyImg(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (PROXY_HOSTS.some((s) => host === s || host.endsWith(`.${s}`))) {
      return `/api/img?url=${encodeURIComponent(url)}`;
    }
  } catch {
    return url;
  }
  return url;
}
