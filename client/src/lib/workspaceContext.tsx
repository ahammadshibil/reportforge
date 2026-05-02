import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Workspace } from "@shared/schema";

type Ctx = {
  workspaces: Workspace[];
  current: Workspace | undefined;
  setCurrentId: (id: number) => void;
  isLoading: boolean;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [currentId, setCurrentId] = useState<number | null>(null);
  const { data: workspaces = [], isLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  useEffect(() => {
    if (!currentId && workspaces.length) setCurrentId(workspaces[0].id);
  }, [workspaces, currentId]);

  const current = workspaces.find((w) => w.id === currentId);

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, current, setCurrentId, isLoading }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside provider");
  return ctx;
}
