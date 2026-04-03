"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import CourseCard from "@/components/courses/CourseCard";

interface Group {
  hippodrome: any;
  courses: any[];
}

interface Props {
  count: number;
  groups: Group[];
  userSubscription: string;
}

export default function TermineesCollapse({ count, groups, userSubscription }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-elevated border border-border hover:border-gold-primary/30 transition-all group"
      >
        <CheckCircle2 className="w-4 h-4 text-text-muted flex-shrink-0" />
        <span className="text-text-secondary text-sm font-medium flex-1 text-left">
          {count} course{count > 1 ? "s" : ""} terminée{count > 1 ? "s" : ""} aujourd&apos;hui
        </span>
        <span className="text-text-muted text-xs mr-2 group-hover:text-gold-light transition-colors">
          {open ? "Masquer" : "Voir les résultats"}
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-text-muted" />
          : <ChevronDown className="w-4 h-4 text-text-muted" />
        }
      </button>

      {/* Contenu dépliable */}
      {open && (
        <div className="mt-4 space-y-8 animate-in fade-in duration-200">
          {groups.map((group) => (
            <div key={group.hippodrome?.nom || "autre"}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-text-muted text-sm font-medium">{group.hippodrome?.nom || "Hippodrome"}</span>
                <span className="text-text-muted text-xs">· {group.courses.length} course{group.courses.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-3 opacity-70">
                {group.courses.map((course: any) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    userSubscription={userSubscription}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
