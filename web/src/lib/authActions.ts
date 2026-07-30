import {
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  updateProfile,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';

const MAGIC_EMAIL_KEY = 'taxfax.magicEmail';

export function signIn(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(name: string, email: string, password: string): Promise<UserCredential> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name.trim() });
  return cred;
}

export function sendReset(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email);
}

/** Sends a passwordless sign-in link and remembers the address to complete it on return. */
export async function sendMagicLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, {
    url: `${window.location.origin}/login`,
    handleCodeInApp: true,
  });
  window.localStorage.setItem(MAGIC_EMAIL_KEY, email);
}

/** If the current URL is a sign-in link, completes it. Returns true when a sign-in happened. */
export async function completeMagicLink(): Promise<boolean> {
  if (!isSignInWithEmailLink(auth, window.location.href)) return false;
  const stored = window.localStorage.getItem(MAGIC_EMAIL_KEY);
  const email = stored ?? window.prompt('Confirm the email this link was sent to') ?? '';
  if (!email) return false;
  await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem(MAGIC_EMAIL_KEY);
  return true;
}
