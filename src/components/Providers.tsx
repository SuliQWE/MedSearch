"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CITY_CENTERS } from "@/lib/search";
import type { CartItem, Location } from "@/lib/types";

interface Ctx {
  cart: CartItem[];
  addToCart: (i: CartItem) => void;
  setQty: (medicineId: string, branchId: string, qty: number) => void;
  removeFromCart: (medicineId: string, branchId: string) => void;
  clearCart: () => void;
  location: Location | null;
  setLocation: (l: Location | null) => void;
  setCity: (city: string) => void;
  askGeolocation: () => Promise<string | null>;
  ready: boolean;
}

const AppCtx = createContext<Ctx | null>(null);
const CART_KEY = "mf_cart_v1";
const LOC_KEY = "mf_location_v1";

// В localStorage хранятся только удобства (корзина до оформления и выбранное место).
// Источник истины по заказам — сервер.
export function Providers({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [location, setLoc] = useState<Location | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem(CART_KEY);
      if (c) setCart(JSON.parse(c));
      const l = localStorage.getItem(LOC_KEY);
      if (l) setLoc(JSON.parse(l));
    } catch {
      /* повреждённые данные игнорируем */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart, ready]);

  const setLocation = useCallback((l: Location | null) => {
    setLoc(l);
    try {
      if (l) localStorage.setItem(LOC_KEY, JSON.stringify(l));
      else localStorage.removeItem(LOC_KEY);
    } catch {}
  }, []);

  const setCity = useCallback(
    (city: string) => {
      const c = CITY_CENTERS[city];
      if (c) setLocation({ ...c, city, label: `${city}, центр (выбрано вручную)` });
    },
    [setLocation],
  );

  // Геолокация запрашивается только по явному действию пользователя.
  const askGeolocation = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        if (!navigator.geolocation) return resolve("Браузер не поддерживает геолокацию. Выберите город вручную.");
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const { latitude: lat, longitude: lng } = p.coords;
            const city = Object.entries(CITY_CENTERS)
              .map(([name, c]) => ({ name, d: Math.hypot(c.lat - lat, c.lng - lng) }))
              .sort((a, b) => a.d - b.d)[0].name;
            setLocation({ lat, lng, city, label: "Ваше местоположение" });
            resolve(null);
          },
          () => resolve("Доступ к геолокации не предоставлен. Выберите город вручную."),
          { timeout: 10000 },
        );
      }),
    [setLocation],
  );

  const value = useMemo<Ctx>(
    () => ({
      cart,
      ready,
      location,
      setLocation,
      setCity,
      askGeolocation,
      addToCart: (i) =>
        setCart((cur) => {
          const ex = cur.find((x) => x.medicineId === i.medicineId && x.branchId === i.branchId);
          if (ex) return cur.map((x) => (x === ex ? { ...x, qty: Math.min(99, x.qty + i.qty) } : x));
          return [...cur, i];
        }),
      setQty: (m, b, qty) => setCart((cur) => cur.map((x) => (x.medicineId === m && x.branchId === b ? { ...x, qty: Math.max(1, Math.min(99, qty)) } : x))),
      removeFromCart: (m, b) => setCart((cur) => cur.filter((x) => !(x.medicineId === m && x.branchId === b))),
      clearCart: () => setCart([]),
    }),
    [cart, ready, location, setLocation, setCity, askGeolocation],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp вне Providers");
  return c;
}
