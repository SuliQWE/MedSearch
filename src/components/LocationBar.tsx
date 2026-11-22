"use client";

import { useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { useApp } from "./Providers";
import { CITY_CENTERS } from "@/lib/search";

export function LocationBar() {
  const { location, setCity, askGeolocation, setLocation } = useApp();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    setMsg(await askGeolocation());
    setBusy(false);
  }

  return (
    <div className="card flex flex-col gap-3 sm:flex-row sm:items-center" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-ink-700">
        <MapPin size={18} className="text-brand-600" />
        <span>{location ? location.label : "Местоположение не выбрано"}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
        <select className="input sm:max-w-[200px]" value={location?.city ?? ""} onChange={(e) => (e.target.value ? setCity(e.target.value) : setLocation(null))} aria-label="Город">
          <option value="">Выберите город</option>
          {Object.keys(CITY_CENTERS).map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={ask} disabled={busy}><LocateFixed size={16} />{busy ? "Определяем…" : "Определить по геолокации"}</button>
      </div>
      {msg && <p className="text-sm text-amber-800 sm:basis-full">{msg}</p>}
    </div>
  );
}
