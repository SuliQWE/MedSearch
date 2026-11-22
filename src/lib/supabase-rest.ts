// Лёгкий серверный клиент Supabase через REST (без пакета @supabase/supabase-js).
// Используется ТОЛЬКО на сервере: service role key нельзя выносить в клиентский код.

const baseUrl = () => (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabaseConfigured = (): boolean => baseUrl() !== "" && serviceKey() !== "";

function authHeaders(): Record<string, string> {
  return { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}` };
}

export async function rest(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<Response> {
  const res = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    cache: "no-store",
    headers: { ...authHeaders(), "Content-Type": "application/json", ...(init.prefer ? { Prefer: init.prefer } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res;
}

export const IMAGE_BUCKET = "medicine-images";

/** Загружает картинку в публичный бакет и возвращает публичную ссылку. */
export async function uploadImage(path: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const res = await fetch(`${baseUrl()}/storage/v1/object/${IMAGE_BUCKET}/${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { ...authHeaders(), "Content-Type": contentType, "x-upsert": "true" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Не удалось загрузить картинку (${res.status}). Проверьте, что бакет ${IMAGE_BUCKET} создан (миграция 0003).`);
  return `${baseUrl()}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
}
