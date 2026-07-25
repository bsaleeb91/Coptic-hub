// app/index.tsx
// Explicit root route: '/' lands on the sign-in screen, where the user chooses
// congregant / priest / servant. Without this, expo-router resolves the bare
// '/' to the alphabetically-first group index — (priest)/index — which exposed
// the priest dashboard on web deep links. Signed-in users never see sign-in:
// the root layout redirects any active session straight to their home.
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/sign-in" />;
}
