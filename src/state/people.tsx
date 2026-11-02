import { createContext, useContext, type ReactNode } from 'react';
import { usePeopleMap } from '../hooks/data';
import type { Person } from '../types';

/** One shared id → Person map so every timeline entry doesn't run its own query. */
const PeopleCtx = createContext<Map<string, Person>>(new Map());

export function PeopleProvider({ children }: { children: ReactNode }) {
  const map = usePeopleMap();
  return <PeopleCtx.Provider value={map}>{children}</PeopleCtx.Provider>;
}

export function usePeopleLookup() {
  return useContext(PeopleCtx);
}

/** Resolve ids to people, silently dropping any that were deleted. */
export function useResolvedPeople(ids: string[]): Person[] {
  const map = usePeopleLookup();
  return ids.map((id) => map.get(id)).filter((p): p is Person => !!p);
}
