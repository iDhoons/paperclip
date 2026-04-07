import { useQuery } from "@tanstack/react-query";
import type { PlanSummary, PlanFolderStatus } from "@paperclipai/shared";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import { FileText, FolderOpen } from "lucide-react";

const STATUS_CONFIG: Record<PlanFolderStatus, { label: string; icon: string; headerClass: string }> = {
  "in-progress": { label: "In Progress", icon: "🔄", headerClass: "text-blue-600 dark:text-blue-400" },
  backlog: { label: "Backlog", icon: "⏳", headerClass: "text-yellow-600 dark:text-yellow-400" },
  done: { label: "Done", icon: "✅", headerClass: "text-green-600 dark:text-green-400" },
};

const STATUS_ORDER: PlanFolderStatus[] = ["in-progress", "backlog", "done"];

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanSummary }) {
  return (
    <div className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <h4 className="text-sm font-medium truncate">{plan.title}</h4>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {plan.completedPhases}/{plan.totalPhases} phases
        </span>
      </div>

      {plan.currentPhase && (
        <p className="text-xs text-muted-foreground mb-2 truncate">
          → {plan.currentPhase}
        </p>
      )}

      <ProgressBar value={plan.completedTasks} max={plan.totalTasks} />

      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
        <span className="truncate mr-2">{plan.goal}</span>
        <span className="tabular-nums shrink-0">{plan.completedTasks}/{plan.totalTasks} tasks</span>
      </div>
    </div>
  );
}

export function PlansContent({ projectId, companyId }: { projectId: string; companyId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.plans(companyId, projectId),
    queryFn: () => projectsApi.plans(projectId, companyId),
    enabled: !!companyId && !!projectId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load plans</p>;
  }

  const plans = data?.plans ?? [];

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FolderOpen className="h-8 w-8 mb-2" />
        <p className="text-sm">No plans found</p>
        <p className="text-xs mt-1">Add task_plan.md files in docs/plans/</p>
      </div>
    );
  }

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    ...STATUS_CONFIG[status],
    plans: plans.filter((p) => p.folderStatus === status),
  })).filter((g) => g.plans.length > 0);

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.status}>
          <h3 className={`text-sm font-medium mb-3 ${group.headerClass}`}>
            {group.icon} {group.label} ({group.plans.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.plans.map((plan) => (
              <PlanCard key={plan.slug} plan={plan} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
