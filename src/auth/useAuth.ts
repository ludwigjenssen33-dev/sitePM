import { useCallback, useEffect, useState } from "react";
import { adminRequest, type AdminSession } from "./admin";
/** Rights only come from the HttpOnly server session; localStorage is never consulted. */
export function useAuth() {
  const [status, setStatus] = useState<AdminSession>({
    authenticated: false,
    configured: false,
    storage: "unconfigured",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await adminRequest<AdminSession>("session"));
      setError("");
    } catch (e) {
      setStatus({
        authenticated: false,
        configured: false,
        storage: "unconfigured",
      });
      setError(e instanceof Error ? e.message : "Сервер недоступен.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const listener = () => {
      void refresh();
    };
    window.addEventListener("product-lab:admin-session", listener);
    return () =>
      window.removeEventListener("product-lab:admin-session", listener);
  }, [refresh]);
  return { admin: status.authenticated, loading, error, refresh, status };
}
