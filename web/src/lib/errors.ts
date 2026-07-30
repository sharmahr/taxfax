/** Maps raw Firebase error codes to sentences an exhausted accountant can act on. */
export function firebaseErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'That doesn’t look like a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Ask your workspace owner to re-enable it.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'That email and password don’t match. Try again.';
    case 'auth/email-already-in-use':
      return 'That email is already on a TaxFax workspace. Sign in instead.';
    case 'auth/weak-password':
      return 'Use at least 6 characters for your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute, then try again.';
    case 'auth/network-request-failed':
      return 'Network trouble. Check your connection and try again.';
    case 'auth/requires-recent-login':
      return 'For security, sign in again before making this change.';
    case 'functions/not-found':
    case 'functions/unimplemented':
      return 'That isn’t wired up in this environment yet.';
    case 'functions/unauthenticated':
      return 'Your session expired. Please sign in again.';
    case 'functions/permission-denied':
      return 'You don’t have permission to do that.';
    case 'functions/already-exists':
      return 'That already exists.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
