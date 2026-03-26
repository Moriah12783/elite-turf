"use client";

import { useState } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface TogglePublieButtonProps {
  id: string;
  publie: boolean;
}

export default function TogglePublieButton({ id, publie }: TogglePublieButtonProps) {
  const [isPublie, setIsPublie] = useState(publie);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggle = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const newState = !isPublie;
      const { error } = await supabase
        .from("pronostics")
        .update({
          publie: newState,
          date_publication: newState ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;
      setIsPublie(newState);
      toast.success(newState ? "Pronostic publié" : "Mis en brouillon");
      router.refresh();
    } catch {
      toast.error("Erreur lors du changement de statut");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${
        loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${isPublie ? "text-status-win hover:text-status-win/70" : "text-text-muted hover:text-gold-primary"}`}
    >
      {isPublie ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
      {isPublie ? "Publié" : "Brouillon"}
    </button>
  );
}
