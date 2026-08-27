// Errors whose message is written FOR the person using the app ("retake the
// photo with better light"), as opposed to internal failures whose message is
// only useful in a log.
//
// The distinction matters because Next.js replaces every error thrown out of a
// Server Action with an opaque "An error occurred in the Server Components
// render… A digest property is included" in production builds. Nothing we
// throw ever reaches the admin's screen, so an action that wants to explain
// itself has to return the reason as data — and to do that safely it needs to
// know which messages were meant to be read and which would leak internals.
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

// Duck-typed rather than `instanceof`: a UserFacingError thrown inside a
// bundled server module and one thrown from the app can come from two copies
// of this file, which breaks prototype identity.
export function isUserFacingError(err: unknown): err is UserFacingError {
  return err instanceof Error && err.name === "UserFacingError";
}

// The message to show the admin for a failed operation. Deliberate,
// user-facing messages pass through; anything else (a Supabase error, a
// TypeError, a network failure) is logged for us and replaced with `fallback`
// so internals never reach the screen.
export function userMessageFor(err: unknown, fallback: string): string {
  if (isUserFacingError(err)) return err.message;
  console.error(err);
  return fallback;
}
