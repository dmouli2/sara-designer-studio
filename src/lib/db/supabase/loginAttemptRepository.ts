import { getSupabaseClient } from "../../supabase/client";
import type { LoginAttemptRepository, LoginAttemptState } from "../types";

interface LoginAttemptRow {
  username: string;
  failed_count: number;
  locked_until: string | null;
  last_failure: string;
}

function toState(row: LoginAttemptRow): LoginAttemptState {
  return { failedCount: row.failed_count, lockedUntil: row.locked_until };
}

// A row exists only while an account has unspent failures against it; a
// successful login deletes it. So "no row" and "clean slate" are the same
// thing, and the table stays empty in normal use.
export function createSupabaseLoginAttemptRepository(): LoginAttemptRepository {
  return {
    async get(username) {
      const { data, error } = await getSupabaseClient()
        .from("login_attempts")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toState(data as LoginAttemptRow) : null;
    },

    async recordFailure(username, lockAfter, lockForMs) {
      const { data: existing, error: readError } = await getSupabaseClient()
        .from("login_attempts")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (readError) throw new Error(readError.message);

      const previous = existing ? (existing as LoginAttemptRow).failed_count : 0;
      const failedCount = previous + 1;
      // The lockout is re-armed on every failure at or past the threshold, so
      // hammering a locked account keeps it locked rather than letting the
      // attacker wait out one window and then spend a fresh burst.
      const lockedUntil =
        failedCount >= lockAfter ? new Date(Date.now() + lockForMs).toISOString() : null;

      const { error } = await getSupabaseClient().from("login_attempts").upsert(
        {
          username,
          failed_count: failedCount,
          locked_until: lockedUntil,
          last_failure: new Date().toISOString(),
        },
        { onConflict: "username" }
      );
      if (error) throw new Error(error.message);

      return { failedCount, lockedUntil };
    },

    async clear(username) {
      const { error } = await getSupabaseClient()
        .from("login_attempts")
        .delete()
        .eq("username", username);
      if (error) throw new Error(error.message);
    },
  };
}
