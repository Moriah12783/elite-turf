import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { fr } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "d MMMM yyyy", { locale: fr });
}

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "d MMM yyyy à HH:mm", { locale: fr });
}

export function timeFromNow(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { locale: fr, addSuffix: true });
}

export function formatMoney(amount: number, currency: "XOF" | "EUR" | "USD" = "XOF"): string {
  if (currency === "XOF") {
    return new Intl.NumberFormat("fr-CI", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function isCourseEnCours(heure: string, date: string): boolean {
  const now = new Date();
  const courseDate = new Date(`${date}T${heure}`);
  const endDate = new Date(courseDate.getTime() + 30 * 60 * 1000);
  return now >= courseDate && now <= endDate;
}

export function getCountdown(date: string, time: string): string {
  const target = new Date(`${date}T${time}`);
  if (isPast(target)) return "Terminé";
  return formatDistanceToNow(target, { locale: fr, addSuffix: false });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}
