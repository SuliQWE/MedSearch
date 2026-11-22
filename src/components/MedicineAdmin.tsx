"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteMedicine, saveMedicine, seedCatalog } from "@/lib/catalog-actions";
import { ActionButton } from "./ActionButton";
import { MedicineImage } from "./MedicineImage";
import { Msg } from "./Msg";
import type { ActionResult, Category, Medicine } from "@/lib/types";

const MAX = 3 * 1024 * 1024;

export function MedicineForm({ categories, medicine }: { categories: Category[]; medicine?: Medicine }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const m = medicine;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) { setPreview(null); return; }
    if (f.size > MAX) { setRes({ ok: false, message: "Картинка больше 3 МБ. Уменьшите её." }); e.target.value = ""; setPreview(null); return; }
    setRes(null);
    setPreview(URL.createObjectURL(f));
  }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveMedicine(fd);
      setRes(r);
      if (r.ok) { if (!m) { ref.current?.reset(); setPreview(null); } router.refresh(); }
    });
  }
  return (
    <form ref={ref} onSubmit={submit} className="space-y-3">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Название<input name="name" className="input mt-1" defaultValue={m?.name} maxLength={120} required /></label>
        <label className="text-sm font-medium">Действующее вещество<input name="inn" className="input mt-1" defaultValue={m?.inn} maxLength={120} required /></label>
        <label className="text-sm font-medium">Дозировка<input name="dosage" className="input mt-1" defaultValue={m?.dosage} maxLength={40} required /></label>
        <label className="text-sm font-medium">Форма выпуска<input name="form" className="input mt-1" defaultValue={m?.form} maxLength={40} required /></label>
        <label className="text-sm font-medium">Производитель<input name="manufacturer" className="input mt-1" defaultValue={m && m.manufacturer !== "—" ? m.manufacturer : ""} maxLength={120} /></label>
        <label className="text-sm font-medium">Страна<input name="country" className="input mt-1" defaultValue={m && m.country !== "—" ? m.country : ""} maxLength={60} /></label>
        <label className="text-sm font-medium sm:col-span-2">Синонимы и частые написания (через запятую)<input name="synonyms" className="input mt-1" defaultValue={m?.synonyms.join(", ")} maxLength={400} /></label>
        <label className="text-sm font-medium sm:col-span-2">Описание<textarea name="description" className="input mt-1 min-h-[80px] py-2" defaultValue={m?.description} maxLength={1500} /></label>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Категории</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">{categories.map((c) => <label key={c.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="categories" value={c.id} defaultChecked={m?.categories.includes(c.id)} className="h-4 w-4" />{c.name}</label>)}</div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="prescription" defaultChecked={m?.prescription} className="h-4 w-4" />Рецептурный препарат</label>
      <div className="space-y-2">
        <p className="text-sm font-medium">Картинка упаковки (JPG, PNG или WebP, до 3 МБ)</p>
        <div className="flex flex-wrap items-center gap-3">
          {preview ? <MedicineImage src={preview} alt="Предпросмотр" size={72} /> : <MedicineImage src={m?.imageUrl} alt={m?.name ?? "Картинка"} size={72} />}
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="text-sm" />
        </div>
        {m?.imageUrl && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removeImage" className="h-4 w-4" />Удалить текущую картинку</label>}
        <p className="text-xs text-ink-500">Загружайте только изображения, на которые у вас есть права. Не выдавайте картинки за фото реальных аптек или лицензированных материалов.</p>
      </div>
      <Msg r={res} />
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Сохранение…" : m ? "Сохранить изменения" : "Добавить препарат"}</button>
    </form>
  );
}

export function DeleteMedicineButton({ id }: { id: string }) {
  return <ActionButton variant="danger" confirm="Удалить препарат из каталога?" action={deleteMedicine.bind(null, id)}>Удалить</ActionButton>;
}

export function SeedButton() {
  return <ActionButton confirm="Загрузить тестовые препараты? Существующие с теми же id перезапишутся." action={seedCatalog}>Загрузить тестовые препараты</ActionButton>;
}
