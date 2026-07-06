"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { AutomationBuilder, type AutomationData } from "./automation-builder";

export default function AutomationBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [automation, setAutomation] = useState<AutomationData | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/automations/${id}`);
    const data = await r.json();
    if (data.ok) setAutomation(data.automation);
    else setNotFound(true);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Automation not found.</div>
    );
  }

  if (!automation) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading automation…
      </div>
    );
  }

  return <AutomationBuilder automation={automation} />;
}
