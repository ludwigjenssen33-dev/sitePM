export type AdminSession = {
  authenticated: boolean;
  configured: boolean;
  storage: "postgres" | "unconfigured";
};
export async function adminRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch("/api/admin/" + path, {
    credentials: "same-origin",
    cache: "no-store",
    ...(body !== undefined
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ProductLab-Request": "1",
          },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await r
    .json()
    .catch(() => ({ error: "Сервер недоступен. Проверьте подключение." }));
  if (!r.ok) throw new Error(data.error || "Не удалось выполнить запрос.");
  return data;
}
