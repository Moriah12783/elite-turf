"use client";

import { useState } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
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
    const newState = !isPublie;
    try {
      const res = await fetch(`/api/admin/pronostics/${id}/publie`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publie: newState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setIsPublie(newState);
      toast.success(newState ? "Pronostic publié" : "Mis en brouillon");
      router.refresh();
    } catch (err: any) {
      toast.error(`Erreur lors du changement de statut : ${err.message}`);
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
