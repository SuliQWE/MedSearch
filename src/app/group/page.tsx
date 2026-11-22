import { redirect } from "next/navigation";

// Group Orders и Cargo объединены с Global в один раздел «Международный заказ».
export default function Page() {
  redirect("/global");
}
