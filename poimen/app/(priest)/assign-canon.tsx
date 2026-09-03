// app/(priest)/assign-canon.tsx
// Build ONE member's canon. Always reached with a memberId, from that member's
// screen — it is not in the drawer, because a canon editor with no member in
// front of it is the Canon tab (canon-templates), not this.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import CanonEditor from '@/components/priest/CanonEditor';

export default function AssignCanonScreen() {
  const { memberId, memberName } = useLocalSearchParams<{ memberId: string; memberName: string }>();
  return <CanonEditor memberId={memberId} memberName={memberName} />;
}
