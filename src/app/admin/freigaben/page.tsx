import { FreigabenBereich } from "@/components/admin/FreigabenBereich";

export const metadata = { title: "Freigaben" };
export const dynamic = "force-dynamic";

export default async function FreigabenSeite() {
  return <FreigabenBereich />;
}
