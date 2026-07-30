/**
 * Every error a user can hit is written as a sentence they can act on. These
 * constructors keep that convention in one place; callables `throw invalid(...)`
 * rather than hand-rolling `HttpsError` with a machine code.
 */
import { HttpsError } from 'firebase-functions/v2/https';

export const unauth = (message: string) => new HttpsError('unauthenticated', message);
export const denied = (message: string) => new HttpsError('permission-denied', message);
export const invalid = (message: string) => new HttpsError('invalid-argument', message);
export const notFound = (message: string) => new HttpsError('not-found', message);
export const already = (message: string) => new HttpsError('already-exists', message);
export const conflict = (message: string) => new HttpsError('failed-precondition', message);
export const exhausted = (message: string) => new HttpsError('resource-exhausted', message);
export const internal = (message: string) => new HttpsError('internal', message);

export { HttpsError };
