import { useMemo, useSyncExternalStore } from 'react';
import { collection, query } from 'firebase/firestore';
import { paths, type FirmMember } from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useCollection } from '@/lib/firestore';

/** Tracks a media query without tearing on resize. Client-only SPA, so safe. */
export function useMediaQuery(queryString: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(queryString);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(queryString).matches,
    () => false,
  );
}

export type MemberDoc = FirmMember & { id: string };

export interface MembersIndex {
  list: MemberDoc[];
  byId: Map<string, MemberDoc>;
  loading: boolean;
}

/** Live firm staff, indexed by uid — resolves assignee names, colours, filters. */
export function useMembers(firmId: string | null): MembersIndex {
  const membersQuery = useMemo(
    () => (firmId ? query(collection(db, paths.members(firmId))) : null),
    [firmId],
  );
  const { data, loading } = useCollection<FirmMember>(membersQuery);
  return useMemo(() => {
    const list = [...data].sort((a, b) => a.name.localeCompare(b.name));
    return { list, byId: new Map(list.map((m) => [m.uid, m])), loading };
  }, [data, loading]);
}
