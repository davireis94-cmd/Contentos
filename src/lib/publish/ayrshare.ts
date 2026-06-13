/**
 * Cliente Ayrshare — publica/agenda em redes sociais.
 * https://www.ayrshare.com/docs — POST /api/post
 *
 * O usuário conecta as contas sociais no dashboard do Ayrshare; a API key
 * publica nas contas vinculadas. Carrossel = múltiplas mediaUrls no Instagram.
 */

export interface PublishInput {
  caption: string;
  platforms: string[]; // instagram | tiktok | linkedin | facebook | x | youtube ...
  mediaUrls: string[]; // URLs públicas das imagens
  scheduleDate?: string; // ISO 8601 — se ausente, publica imediatamente
}

export interface PublishResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function publishToAyrshare(input: PublishInput): Promise<PublishResult> {
  const key = process.env.AYRSHARE_API_KEY;
  if (!key) return { ok: false, error: "AYRSHARE_API_KEY não configurado" };

  const body: Record<string, unknown> = {
    post: input.caption,
    platforms: input.platforms,
    mediaUrls: input.mediaUrls,
  };
  if (input.scheduleDate) body.scheduleDate = input.scheduleDate;

  try {
    const res = await fetch("https://api.ayrshare.com/api/post", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      status?: string;
      id?: string;
      message?: string;
      errors?: unknown;
      posts?: unknown;
    };

    if (!res.ok || data.status === "error") {
      const err =
        data.message ??
        (data.errors ? JSON.stringify(data.errors) : `Ayrshare ${res.status}`);
      return { ok: false, error: err };
    }

    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
