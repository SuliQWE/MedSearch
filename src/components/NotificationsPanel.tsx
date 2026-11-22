"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/lib/actions";
import { formatDateTime } from "@/lib/status";
import type { AppNotification } from "@/lib/types";

export function NotificationsPanel({ notes }: { notes: AppNotification[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = notes.filter((n) => !n.read).length;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Bell size={20} />Уведомления{unread > 0 && <span className="rounded-full bg-brand-600 px-2 text-xs text-white">{unread}</span>}</h2>
        {unread > 0 && <button className="btn btn-secondary" disabled={pending} onClick={() => start(async () => { await markNotificationsRead(); router.refresh(); })}>Прочитано</button>}
      </div>
      {notes.length === 0 ? <div className="card text-ink-600">Уведомлений нет.</div> : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <motion.li key={n.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={`card py-3 text-sm ${n.read ? "" : "ring-brand-300"}`}>
                <p>{n.text}</p><p className="text-xs text-ink-400">{formatDateTime(n.at)}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
