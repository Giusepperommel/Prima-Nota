"use client";

import { AlertRuleList } from "@/components/configurazione/alert-rule-list";

export function AlertConfigContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Personalizza soglie, gravita, canali e destinatari per ogni regola di alert. Le modifiche si applicano solo alla tua societa.
      </p>
      <AlertRuleList />
    </div>
  );
}
