/**
 * lib/ingest/revalidate.ts
 * Couche centralisée de revalidation Next.js après ingestion MVP.
 * Spec §15 — jamais dispersé en dur dans les routes.
 */

import { revalidatePath } from "next/cache";

/**
 * Revalidation après ingestion d'un pronostic.
 * @param pronosticId - UUID Supabase du pronostic (optionnel).
 *   Si fourni, invalide aussi la page détail /pronostics/[id].
 */
export function revalidatePronosticIngestion(pronosticId?: string): void {
  try {
    revalidatePath("/pronostics");
    revalidatePath("/");
    if (pronosticId) {
      revalidatePath(`/pronostics/${pronosticId}`);
    }
  } catch (err) {
    console.error("[Revalidate] pronostic:", err);
  }
}

export function revalidateCourseIngestion(): void {
  try {
    revalidatePath("/courses");
    revalidatePath("/pronostics");
  } catch (err) {
    console.error("[Revalidate] course:", err);
  }
}

export function revalidateResultIngestion(): void {
  try {
    revalidatePath("/performances");
    revalidatePath("/courses");
    revalidatePath("/pronostics");
  } catch (err) {
    console.error("[Revalidate] resultat:", err);
  }
}
