/**
 * Cliente mínimo do Apify. Roda um actor de forma síncrona e devolve os
 * itens do dataset. Econômico: usado só sob demanda, com limites baixos.
 * Requer APIFY_TOKEN. Retorna [] se a chave não estiver configurada.
 */
export async function runActor<T = unknown>(
  actorId: string,
  input: Record<string, unknown>,
  timeoutSecs = 50
): Promise<T[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return [];

  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify ${actorId} ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T[];
}
