"use client";

import { Card, CardContent } from "@/components/ui/card";

interface HealthBadgeProps {
  score: number | null;
  label?: string;
}

function getColor(score: number): { bg: string; text: string; ring: string } {
  if (score >= 70) return { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-500" };
  if (score >= 40) return { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-500" };
  return { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-500" };
}

export function HealthBadge({ score, label = "Salute Azienda" }: HealthBadgeProps) {
  if (score === null) return null;
  const colors = getColor(score);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${colors.bg} ring-4 ${colors.ring}`}>
          <span className={`text-2xl font-bold ${colors.text}`}>{score}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={`text-lg font-semibold ${colors.text}`}>
            {score >= 70 ? "Buono" : score >= 40 ? "Attenzione" : "Critico"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
