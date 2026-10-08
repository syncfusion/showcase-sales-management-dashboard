import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Scope } from '../domain/types';

export type Privilege = 'SM' | 'TL' | 'SR';
interface ViewState {
  privilege: Privilege; setPrivilege(p: Privilege): void;
  leadId: number; setLeadId(id: number): void;
  repId: number; setRepId(id: number): void;
  scope: Scope;
}
const Ctx = createContext<ViewState | null>(null);

/** Shared persona selection: the Dashboard privilege/pickers and the Orders acting rep stay in sync. */
export function ViewStateProvider({ children }: { children: ReactNode }) {
  const [privilege, setPrivilege] = useState<Privilege>('SM');
  const [leadId, setLeadId] = useState(2);
  const [repId, setRepId] = useState(5);
  const value = useMemo<ViewState>(() => ({
    privilege, setPrivilege, leadId, setLeadId, repId, setRepId,
    scope: privilege === 'SM' ? { kind: 'company' } : privilege === 'TL' ? { kind: 'team', leadId } : { kind: 'rep', repId },
  }), [privilege, leadId, repId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useViewState(): ViewState {
  const v = useContext(Ctx);
  if (!v) throw new Error('ViewStateProvider missing');
  return v;
}
