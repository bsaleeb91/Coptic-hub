// app/(priest)/canon-templates.tsx
// The drawer's Canon tab: the template workshop, and nothing else. It takes no
// route params at all, so it can never open on a member — which is the whole
// reason it is its own route rather than assign-canon without a memberId.
import React from 'react';
import CanonEditor from '@/components/priest/CanonEditor';

export default function CanonTemplatesScreen() {
  return <CanonEditor />;
}
