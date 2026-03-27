import { redirect } from "next/navigation";

// /guide-gratuit redirige vers /guide-initie (même contenu, URL alternative)
export default function GuideGratuitPage() {
  redirect("/guide-initie");
}
