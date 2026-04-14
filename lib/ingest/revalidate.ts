/**
 * lib/ingest/revalidate.ts
 * Couche centralisée de revalidation Next.js après ingestion MVP.
 * Spec §15 — jamais dispersé en dur dans les routes.
 */

import { revalidatePath } from "next/cache";

export function revalidatePronosticIngestion(): void {
  try {
    revalidatePath("/pronostics");
    revalidatePath("/");
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
