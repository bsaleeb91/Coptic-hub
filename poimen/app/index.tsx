import { Redirect } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';

export default function Index() {
  const { profile } = useSession();
  const { demoMode, demoRole } = useDemoMode();

  const role = demoMode ? demoRole : profile?.role;

  if (role === 'priest' || role === 'admin') return <Redirect href="/(priest)" />;
  if (role === 'servant') return <Redirect href="/(servant)" />;
  return <Redirect href="/(drawer)" />;
}
