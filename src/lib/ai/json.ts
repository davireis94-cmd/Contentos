/**
 * Extrai e faz parse do JSON que a IA retorna, de forma robusta.
 *
 * Problema comum: a IA coloca quebras de linha/tabs CRUAS dentro de strings
 * (ex: no body de um slide), o que é JSON inválido e quebra JSON.parse com
 * "Bad control character in string literal". Esta função escapa os caracteres
 * de controle APENAS quando estão dentro de uma string, preservando as quebras
 * de linha intencionais (viram \n) e descartando o lixo.
 */
export function sanitizeJsonString(raw: string): string {
  let inStr = false;
  let esc = false;
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) {
      out += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      out += ch;
      continue;
    }
    if (inStr) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      const code = ch.charCodeAt(0);
      if (code < 0x20) continue; // descarta outros caracteres de controle
    }
    out += ch;
  }
  return out;
}

/**
 * Acha o primeiro objeto JSON no texto da IA e faz parse com saneamento.
 * Lança erro se não houver JSON ou se o parse falhar mesmo após sanear.
 */
export function extractJson<T = unknown>(raw: string): T {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Sem JSON na resposta");
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    // Tenta de novo saneando caracteres de controle dentro de strings.
    return JSON.parse(sanitizeJsonString(match[0])) as T;
  }
}
