"use client";

import { resetDemo } from "@/lib/admin-actions";
import { ActionButton } from "./ActionButton";

export function AdminReset() {
  return <ActionButton variant="danger" confirm="Сбросить все демо-данные (заказы, заявки, группы, отправки) к начальным?" action={resetDemo}>Сбросить демо-данные</ActionButton>;
}
