import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { EntityRow } from "../components/EntityRow";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate, projectUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, Hexagon, Loader2, Plus, Trash2 } from "lucide-react";

export function Projects() {
  const { selectedCompanyId } = useCompany();
  const { openNewProject } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Projects" }]);
  }, [setBreadcrumbs]);

  const { data: allProjects, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const projects = useMemo(
    () => (allProjects ?? []).filter((p) => !p.archivedAt),
    [allProjects],
  );
  const archivedProjects = useMemo(
    () => (allProjects ?? []).filter((p) => !!p.archivedAt),
    [allProjects],
  );

  const unarchiveProject = useMutation({
    mutationFn: (id: string) =>
      projectsApi.update(id, { archivedAt: null }, selectedCompanyId!),
    onSuccess: (updatedProject) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId!) });
      pushToast({ title: `"${updatedProject?.name}" has been unarchived`, tone: "success" });
    },
    onError: () => {
      pushToast({ title: "Failed to unarchive project", tone: "error" });
    },
  });

  const deleteProjectMut = useMutation({
    mutationFn: (id: string) =>
      projectsApi.remove(id, selectedCompanyId!),
    onSuccess: (deletedProject) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId!) });
      setConfirmDeleteId(null);
      pushToast({ title: `"${deletedProject?.name}" has been deleted`, tone: "success" });
    },
    onError: () => {
      pushToast({ title: "Failed to delete project", tone: "error" });
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Hexagon} message="Select a company to view projects." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={openNewProject}>
          <Plus className="h-4 w-4 mr-1" />
          Add Project
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!isLoading && projects.length === 0 && archivedProjects.length === 0 && (
        <EmptyState
          icon={Hexagon}
          message="No projects yet."
          action="Add Project"
          onAction={openNewProject}
        />
      )}

      {projects.length > 0 && (
        <div className="border border-border">
          {projects.map((project) => (
            <EntityRow
              key={project.id}
              title={project.name}
              subtitle={project.description ?? undefined}
              to={projectUrl(project)}
              trailing={
                <div className="flex items-center gap-3">
                  {project.targetDate && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(project.targetDate)}
                    </span>
                  )}
                  <StatusBadge status={project.status} />
                </div>
              }
            />
          ))}
        </div>
      )}

      {archivedProjects.length > 0 && (
        <div className="space-y-2">
          <button
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Archive className="h-3.5 w-3.5" />
            Archived ({archivedProjects.length})
          </button>

          {showArchived && (
            <div className="border border-border rounded-md">
              {archivedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground truncate">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground/60 truncate">{project.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {confirmDeleteId === project.id ? (
                      <>
                        <span className="text-xs text-destructive font-medium">Delete?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteProjectMut.isPending}
                          onClick={() => deleteProjectMut.mutate(project.id)}
                        >
                          {deleteProjectMut.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Confirm"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={unarchiveProject.isPending}
                          onClick={() => unarchiveProject.mutate(project.id)}
                        >
                          <ArchiveRestore className="h-3 w-3 mr-1" />
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteId(project.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
