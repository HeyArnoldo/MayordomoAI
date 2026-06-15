import { useMe } from '@/hooks/use-auth';

/**
 * Returns whether the current user is in the AI onboarding flow.
 *
 * - Returns `true` while `onboardingCompleted` is false (onboarding active).
 * - Returns `false` when onboarding is done or user data is not yet loaded.
 *
 * The chat page uses this to show/hide the onboarding banner and to poll
 * for the flag change when the agent marks the session as complete.
 */
export function useOnboardingGuard(): {
  isOnboarding: boolean;
  isLoading: boolean;
} {
  // Poll every 3 s so the banner disappears promptly after the agent completes.
  const { data: user, isLoading } = useMe({ refetchInterval: 3000 });
  const isOnboarding = Boolean(user && user.onboardingCompleted === false);
  return { isOnboarding, isLoading };
}
