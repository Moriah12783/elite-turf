/**
 * AiReviewClient — Client component pour la revue des drafts IA.
 *
 * UI master-detail :
 *   - Gauche : liste des drafts groupés par access_level (FREE/STARTER/PRO/ELITE)
 *   - Droite : détail du draft sélectionné (subscriber_content, scores, sources, agent_logs)
 *
 * Actions :
 *   - "Publier" → POST /api/admin/ai-review/:id/publish
 *   - "Rejeter" → POST /api/admin/ai-review/:id/reject (commentaire obligatoire)
 *
 * 📜 Conforme cahier §17.3 (badges visuels) + §17.4 (actions).
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, Loader2, AlertTriangle, ShieldCheck,
  Eye, FileWarning, Award, Star, FlaskConical, Gift,
  Globe, Database, FileText,
} from "lucide-react";
import type { DraftWithCourse } from "./page";
import type {
  AiPronosticDraft,
  NiveauAcces,
  QualityValidatorResult,
} from "@/lib/ai-pronostics/types";

interface Props {
  draftsWithCourse: DraftWithCourse[];
}

const LEVEL_ORDER: NiveauAcces[] = ["ELITE", "PRO", "STARTER", "FREE"];

const LEVEL_META: Record<NiveauAcces, { label: string; icon: typeof Award; color: string }> = {
  ELITE:   { label: "Elite",    icon: Award,          color: "text-elite-gold"     },
  PRO:     { label: "Pro",      icon: Star,           color: "text-blue-400"       },
  STARTER: { label: "Starter",  icon: FlaskConical,   color: "text-purple-400"     },
  FREE:    { label: "Gratuit",  icon: Gift,           color: "text-green-400"      },
};

export default function AiReviewClient({ draftsWithCourse }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    draftsWithCourse[0]?.draft.id ?? null,
  );
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rejectCommentDraftId, setRejectCommentDraftId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [isPending, startTransition] = useTransition();

  const selected = draftsWithCourse.find((d) => d.draft.id === selectedId) ?? null;

  // ── Actions ─────────────────────────────────────────────────────────────
  async function handlePublish(draftId: string) {
    setActionMsg(null);
    const res = await fetch(`/api/admin/ai-review/${draftId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMsg({ type: "error", text: data.error ?? "Erreur publication" });
      return;
    }
    setActionMsg({
      type: "success",
      text: `Publié (${data.action}) — pronostic ${data.pronostic_id?.slice(0, 8)}…`,
    });
    startTransition(() => router.refresh());
  }

  async function handleReject() {
    if (!rejectCommentDraftId) return;
    setActionMsg(null);
    const comment = rejectComment.trim();
    if (comment.length < 3) {
      setActionMsg({ type: "error", text: "Commentaire requis (≥ 3 chars)" });
      return;
    }
    const res = await fetch(`/api/admin/ai-review/${rejectCommentDraftId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ human_comment: comment }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMsg({ type: "error", text: data.error ?? "Erreur rejet" });
      return;
    }
    setActionMsg({ type: "success", text: "Draft rejeté." });
    setRejectCommentDraftId(null);
    setRejectComment("");
    startTransition(() => router.refresh());
  }

  // ── Groupement par level pour l'affichage ────────────────────────────────
  const byLevel: Record<NiveauAcces, DraftWithCourse[]> = {
    ELITE: [], PRO: [], STARTER: [], FREE: [],
  };
  for (const dwc of draftsWithCourse) {
    byLevel[dwc.draft.access_level].push(dwc);
  }

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-5">
      {/* ── Liste à gauche ──────────────────────────────────────────────── */}
      <aside className="space-y-3">
        {LEVEL_ORDER.map((level) => {
          const items = byLevel[level];
          if (items.length === 0) return null;
          const Meta = LEVEL_META[level].icon;
          return (
            <div key={level}>
              <h3 className={`text-xs uppercase tracking-wider font-semibold mb-2 flex items-center gap-2 ${LEVEL_META[level].color}`}>
                <Meta className="w-4 h-4" />
                {LEVEL_META[level].label} ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map((dwc) => (
                  <DraftCard
                    key={dwc.draft.id}
                    dwc={dwc}
                    selected={dwc.draft.id === selectedId}
                    onClick={() => setSelectedId(dwc.draft.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </aside>

      {/* ── Détail à droite ─────────────────────────────────────────────── */}
      <main>
        {actionMsg && (
          <div
            className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm ${
              actionMsg.type === "success"
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}
          >
            {actionMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            )}
            <span>{actionMsg.text}</span>
          </div>
        )}

        {!selected ? (
          <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-secondary">
            Sélectionne un draft à gauche pour voir le détail.
          </div>
        ) : (
          <DraftDetail
            dwc={selected}
            isPending={isPending}
            onPublish={() => handlePublish(selected.draft.id)}
            onRejectStart={() => {
              setRejectCommentDraftId(selected.draft.id);
              setRejectComment("");
              setActionMsg(null);
            }}
          />
        )}
      </main>

      {/* ── Modal commentaire de rejet ──────────────────────────────────── */}
      {rejectCommentDraftId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-bg-card border border-border rounded-xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-orange-400" />
              Rejeter ce draft
            </h3>
            <p className="text-sm text-text-secondary">
              Indique pourquoi tu rejettes ce draft. Audit trail : sera stocké dans <code>human_review.human_comment</code>.
            </p>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={4}
              placeholder="Ex : analyse trop fragile, sources contradictoires, etc."
              className="w-full bg-bg-page border border-border rounded-lg p-3 text-sm text-text-primary placeholder-text-secondary"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectCommentDraftId(null)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                disabled={isPending}
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={isPending || rejectComment.trim().length < 3}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Carte de draft (liste à gauche)
// ─────────────────────────────────────────────────────────────────────────

function DraftCard({
  dwc, selected, onClick,
}: {
  dwc:      DraftWithCourse;
  selected: boolean;
  onClick:  () => void;
}) {
  const { draft, course } = dwc;
  const courseLabel = course
    ? `R${course.numero_reunion}C${course.numero_course} — ${course.libelle}`
    : `Course ${draft.course_id.slice(0, 8)}…`;

  const decision = draft.human_review?.decision ?? "PENDING";
  const decisionBadge =
    decision === "PUBLISHED" ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
    : decision === "REJECTED" ? "bg-red-500/20 text-red-300 border-red-500/40"
    : "";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected
          ? "bg-elite-gold/10 border-elite-gold/60"
          : "bg-bg-card border-border hover:border-elite-gold/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-text-primary line-clamp-1">
          {courseLabel}
        </div>
        <StatusPill status={draft.status} />
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary flex-wrap">
        <ValidationBadge status={draft.validation_status} />
        {draft.quality_score != null && (
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> {draft.quality_score}/100
          </span>
        )}
        {decision !== "PENDING" && (
          <span className={`px-1.5 py-0.5 rounded border text-xs ${decisionBadge}`}>
            {decision === "PUBLISHED" ? "Publié" : "Rejeté"}
          </span>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Détail d'un draft (à droite)
// ─────────────────────────────────────────────────────────────────────────

function DraftDetail({
  dwc, isPending, onPublish, onRejectStart,
}: {
  dwc:           DraftWithCourse;
  isPending:     boolean;
  onPublish:     () => void;
  onRejectStart: () => void;
}) {
  const { draft, course } = dwc;
  const validator = draft.validator_report as QualityValidatorResult | undefined;
  const sub = draft.subscriber_content;
  const decision = draft.human_review?.decision ?? "PENDING";
  const isFinal  = decision !== "PENDING";

  const canPublish =
    !isFinal &&
    draft.status !== "REJECTED" &&
    Array.isArray(draft.selection) &&
    (draft.selection as unknown[]).length > 0;

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-text-primary">
            {draft.title || (course?.libelle ?? "Draft IA")}
          </h2>
          <StatusPill status={draft.status} />
        </div>
        <div className="text-sm text-text-secondary mt-2 flex items-center gap-3 flex-wrap">
          {course && (
            <span>
              <strong>R{course.numero_reunion}C{course.numero_course}</strong> · {course.hippodrome}
              {course.heure_depart && ` · ${course.heure_depart.slice(0, 5)}`}
            </span>
          )}
          <span>· Niveau <strong>{draft.access_level}</strong></span>
          <ValidationBadge status={draft.validation_status} />
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ScoreCell label="Afrique"        value={draft.africa_course_score} suffix="/100" />
        <ScoreCell label="Sources"        value={draft.source_confidence_score} suffix="/100" />
        <ScoreCell label="Sélection"      value={draft.selection_confidence_score} suffix="/100" />
        <ScoreCell label="Qualité"        value={draft.quality_score} suffix="/100" />
      </div>

      {/* Validator warnings + blocking */}
      {validator && (validator.blocking_issues.length > 0 || validator.warnings.length > 0) && (
        <div className="space-y-2">
          {validator.blocking_issues.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="font-medium text-red-400 text-sm flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4" /> Blocages QualityValidator ({validator.blocking_issues.length})
              </div>
              <ul className="text-sm text-text-secondary space-y-1">
                {validator.blocking_issues.map((bi, i) => (
                  <li key={i}>• <span className="font-mono text-xs text-red-300">{bi.code}</span> — {bi.message}</li>
                ))}
              </ul>
            </div>
          )}
          {validator.warnings.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
              <div className="font-medium text-orange-400 text-sm flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" /> Warnings ({validator.warnings.length})
              </div>
              <ul className="text-sm text-text-secondary space-y-1">
                {validator.warnings.slice(0, 6).map((w, i) => (
                  <li key={i}>
                    • <span className="font-mono text-xs">{w.code}</span> [{w.severity}] — {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Subscriber content */}
      {sub && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <FileText className="w-4 h-4 text-elite-gold" />
            Contenu rédigé (subscriber_content)
          </h3>

          {sub.intro && (
            <Section title="Intro" body={sub.intro} />
          )}
          {sub.course_context && (
            <Section title="Contexte course" body={sub.course_context} />
          )}
          {sub.race_reading && (
            <Section title="Lecture de course" body={sub.race_reading} />
          )}

          {Array.isArray(sub.selection) && sub.selection.length > 0 && (
            <div className="bg-bg-page border border-border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary mb-2">Sélection ({sub.selection.length} chevaux)</div>
              <ol className="space-y-2">
                {sub.selection.map((r) => (
                  <li key={r.runner_id} className="text-sm">
                    <span className="font-mono text-elite-gold">#{r.number}</span>{" "}
                    <span className="font-medium">{r.name}</span>{" "}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-bg-card text-text-secondary">{r.role}</span>
                    <div className="text-text-secondary mt-0.5 ml-6">{r.text}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {Array.isArray(sub.risks) && sub.risks.length > 0 && (
            <div className="bg-bg-page border border-orange-500/20 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wider text-orange-400 mb-1">Risques mentionnés</div>
              <ul className="text-sm text-text-secondary list-disc list-inside">
                {sub.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {sub.suggested_ticket && (
            <Section title="Ticket suggéré" body={sub.suggested_ticket} />
          )}

          {sub.confidence_level && (
            <div className="text-sm text-text-secondary">
              Niveau de confiance IA : <strong className="text-text-primary">{sub.confidence_level}</strong>
            </div>
          )}
        </div>
      )}

      {/* Source evidence */}
      {Array.isArray(draft.source_evidence) && draft.source_evidence.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-elite-gold" />
            Preuves sources ({draft.source_evidence.length})
          </h3>
          <div className="text-xs space-y-1 font-mono">
            {draft.source_evidence.map((ev, i) => (
              <div key={i} className="bg-bg-page border border-border rounded px-2 py-1 flex items-center gap-3">
                <span className="text-text-primary">{ev.source_name}</span>
                <span className="text-text-secondary">[{ev.source_tier}]</span>
                <span className="text-text-secondary">{ev.validation_role}</span>
                <span className={
                  ev.status === "MATCHED"  ? "text-green-400"
                  : ev.status === "PARTIAL" ? "text-yellow-400"
                  : ev.status === "CONFLICT" ? "text-red-400"
                  : "text-text-secondary"
                }>
                  {ev.status} ({ev.confidence}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent logs (raw JSON pour audit) */}
      <details className="bg-bg-page border border-border rounded-lg">
        <summary className="cursor-pointer p-3 text-sm text-text-secondary flex items-center gap-2">
          <Database className="w-4 h-4" /> Logs des 5 agents (audit, JSON brut)
        </summary>
        <pre className="text-xs p-3 overflow-x-auto text-text-secondary max-h-96">
          {JSON.stringify(draft.agent_logs, null, 2)}
        </pre>
      </details>

      {/* Décision actuelle */}
      {isFinal && (
        <div className={`p-3 rounded-lg border ${
          decision === "PUBLISHED"
            ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>
          <strong>Décision : {decision}</strong>
          {draft.human_review?.human_comment && (
            <div className="text-sm mt-1 opacity-80">« {draft.human_review.human_comment} »</div>
          )}
          {draft.human_review?.edited_at && (
            <div className="text-xs mt-1 opacity-60">
              le {new Date(draft.human_review.edited_at).toLocaleString("fr-FR")}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!isFinal && (
        <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
          <button
            onClick={onPublish}
            disabled={isPending || !canPublish}
            className="px-4 py-2 bg-elite-gold hover:bg-elite-gold/90 disabled:opacity-50 disabled:cursor-not-allowed text-bg-page font-semibold rounded-lg flex items-center gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Publier ce pronostic
          </button>
          <button
            onClick={onRejectStart}
            disabled={isPending}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 disabled:opacity-50 text-red-300 rounded-lg flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" /> Rejeter
          </button>
          {!canPublish && (
            <span className="text-xs text-text-secondary self-center">
              ⚠️ Publication bloquée (status REJECTED ou sélection vide)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-bg-page border border-border rounded-lg p-3">
      <div className="text-xs uppercase tracking-wider text-text-secondary mb-1">{title}</div>
      <div className="text-sm text-text-primary whitespace-pre-wrap">{body}</div>
    </div>
  );
}

function ScoreCell({ label, value, suffix }: { label: string; value: number | null | undefined; suffix?: string }) {
  return (
    <div className="bg-bg-page border border-border rounded-lg p-2.5 text-center">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${
        value == null ? "text-text-secondary"
        : value >= 75 ? "text-green-400"
        : value >= 60 ? "text-yellow-400"
        : "text-red-400"
      }`}>
        {value ?? "—"}{value != null && suffix}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: AiPronosticDraft["status"] }) {
  const meta = {
    APPROVED_FOR_ADMIN_REVIEW: { label: "Prêt", classes: "bg-green-500/20 text-green-300 border-green-500/40" },
    NEEDS_HUMAN_REVIEW:        { label: "À revoir", classes: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
    NEEDS_CORRECTION:          { label: "À corriger", classes: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
    REJECTED:                  { label: "Rejeté IA", classes: "bg-red-500/20 text-red-300 border-red-500/40" },
  }[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${meta.classes}`}>
      {meta.label}
    </span>
  );
}

function ValidationBadge({ status }: { status: AiPronosticDraft["validation_status"] }) {
  if (status === "VALIDATION_LONACI_DIRECTE") {
    return <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/30">🟢 LONACI directe</span>;
  }
  if (status === "VALIDATION_AFRIQUE_CORROBOREE") {
    return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">🟡 Afrique corroborée</span>;
  }
  return <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30">🔴 Afrique absente</span>;
}
