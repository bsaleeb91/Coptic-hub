import { Redirect } from 'expo-router';

/**
 * Root route. In commit 1 we send everyone to the onboarding carousel so the
 * mockup always starts from the best first-run experience. In commit 1.5 this
 * becomes a session check: onboarded + signed in → (tabs), otherwise → (auth).
 */
export default function Index() {
  return <Redirect href="/(auth)/onboarding" />;
}
