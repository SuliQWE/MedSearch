/* eslint-disable @next/next/no-img-element */
import { Pill } from "lucide-react";

export function MedicineImage({ src, alt, size = 64 }: { src?: string; alt: string; size?: number }) {
  if (!src) return <span className="grid shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600" style={{ width: size, height: size }} aria-hidden><Pill size={Math.round(size / 2.5)} /></span>;
  return <img src={src} alt={alt} loading="lazy" width={size} height={size} className="shrink-0 rounded-xl bg-white object-contain ring-1 ring-ink-100" style={{ width: size, height: size }} />;
}
