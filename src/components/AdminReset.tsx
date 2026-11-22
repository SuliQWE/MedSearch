"use client";

import { fillDemoOrdersAction, resetDemo } from "@/lib/admin-actions";
import { ActionButton } from "./ActionButton";

export function AdminReset() {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton variant="primary" action={fillDemoOrdersAction}>Заполнить демо-заказами</ActionButton>
      <ActionButton variant="danger" confirm="Сбросить все демо-данные (заказы, заявки, группы, отправки) к начальным?" action={resetDemo}>Сбросить демо-данные</ActionButton>
    </div>
  );
}
