// In-memory holder for admin onboarding credentials between the two setup
// steps. Kept out of sessionStorage/localStorage so the plaintext password
// never touches browser storage (it would persist across the tab session and
// be readable by any script). If the user refreshes mid-onboarding, they are
// simply sent back to step 1.
type OnboardingCredentials = { email: string; password: string; passwordHint: string; setupToken?: string };

let credentials: OnboardingCredentials | null = null;

export function setOnboardingCredentials(c: OnboardingCredentials): void {
  credentials = c;
}

export function getOnboardingCredentials(): OnboardingCredentials | null {
  return credentials;
}

export function clearOnboardingCredentials(): void {
  credentials = null;
}
