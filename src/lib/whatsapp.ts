/**
 * Envio de mensagens de WhatsApp pelo Evolution API (gateway auto-hospedado —
 * ver `evolution/docker-compose.yml`). Usado pela ação de automação
 * `send_whatsapp`; a conexão vem de variáveis de ambiente para que o mesmo
 * código aponte para o Evolution local no desenvolvimento e para o de
 * produção sem mudança de regra.
 */

export type WhatsAppConfig = { url: string; apiKey: string; instance: string };

/** `null` quando o servidor não tem as três variáveis — a ação é pulada. */
export function whatsAppConfig(): WhatsAppConfig | null {
  const url = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instance = process.env.EVOLUTION_INSTANCE?.trim();
  if (!url || !apiKey || !instance) return null;
  return { url, apiKey, instance };
}

/**
 * Só dígitos, com DDI: "(61) 99999-0000" → "5561999990000". Número já com
 * DDI (12+ dígitos) passa como está; menos de 10 dígitos não é um telefone.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}

/**
 * Motivo de um número não servir para WhatsApp, ou `null`. Pega o erro mais
 * comum: celular brasileiro digitado sem o 9 (8 dígitos depois do DDD).
 */
export function phoneIssue(raw: string): string | null {
  const digits = normalizePhone(raw);
  if (!digits) return "Informe DDD + número.";
  if (digits.startsWith("55") && digits.length === 12)
    return "Faltou o 9: celular no Brasil tem 9 dígitos depois do DDD (ex.: 61 99999-0000).";
  return null;
}

export type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string };

export async function sendWhatsAppText(
  number: string,
  text: string,
  config: WhatsAppConfig | null = whatsAppConfig()
): Promise<SendResult> {
  if (!config) {
    return {
      ok: false,
      error: "WhatsApp não configurado (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE).",
    };
  }
  const to = normalizePhone(number);
  if (!to) return { ok: false, error: `Número de WhatsApp inválido: "${number}".` };

  try {
    const res = await fetch(`${config.url}/message/sendText/${encodeURIComponent(config.instance)}`, {
      method: "POST",
      headers: { apikey: config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: to, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Evolution respondeu ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }
    const data = (await res.json().catch(() => null)) as { key?: { id?: string } } | null;
    return { ok: true, messageId: data?.key?.id ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
