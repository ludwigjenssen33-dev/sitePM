import { expect, it } from "vitest";
import {
  activeSlice,
  IDLE_MS,
  MAX_SESSION_MS,
  sessionExpired,
} from "./session";
const session = { id: "s", started: 1000, last: 1000 };
it("сессия заканчивается после 30 минут простоя либо 8 часов даже при активности", () => {
  expect(sessionExpired(session, 1000 + IDLE_MS - 1)).toBe(false);
  expect(sessionExpired(session, 1000 + IDLE_MS)).toBe(true);
  expect(
    sessionExpired(
      { ...session, last: 1000 + MAX_SESSION_MS },
      1000 + MAX_SESSION_MS,
    ),
  ).toBe(true);
});
it("скрытая вкладка не создаёт учебное время", () => {
  expect(activeSlice(1000, 11000, 0, session, false)).toBeNull();
});
it("watermark предотвращает повтор интервала после обновления и пересечение вкладок", () => {
  const a = activeSlice(1000, 11000, 0, session, true)!;
  expect(a.duration).toBe(10000);
  expect(activeSlice(1000, 11000, a.end, session, true)).toBeNull();
  expect(activeSlice(6000, 16000, a.end, session, true)?.duration).toBe(5000);
});
it("долгое зависание не превращается в часы активного обучения", () => {
  expect(activeSlice(1000, 61000, 0, session, true)?.duration).toBe(15000);
  expect(activeSlice(11000, 1000, 0, session, true)).toBeNull();
  expect(activeSlice(1000, NaN, 0, session, true)).toBeNull();
});
it("срез ограничен временем конца сессии и сроком бездействия", () => {
  const end = 1000 + IDLE_MS;
  expect(activeSlice(end - 5000, end + 5000, 0, session, true)?.duration).toBe(
    5000,
  );
});
