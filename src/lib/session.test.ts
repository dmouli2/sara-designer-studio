// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mockCookieStore } from "../../vitest.setup";
import {
  encrypt,
  decrypt,
  createSession,
  updateSession,
  getSessionToken,
  deleteSession,
  SESSION_COOKIE_NAME,
  type SessionPayload,
} from "./session";

const payload: SessionPayload = {
  staffId: "s1",
  username: "anitha",
  role: "tailor",
  name: "Anitha K.",
};

describe("session", () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-key-for-unit-tests";
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("round-trips a payload through encrypt/decrypt", async () => {
    const token = await encrypt(payload);
    const decoded = await decrypt(token);
    expect(decoded).toMatchObject(payload);
  });

  it("decrypt returns null for an undefined token", async () => {
    expect(await decrypt(undefined)).toBeNull();
  });

  it("decrypt returns null for a malformed token", async () => {
    expect(await decrypt("not-a-real-token")).toBeNull();
  });

  it("encrypt throws when SESSION_SECRET is missing", async () => {
    delete process.env.SESSION_SECRET;
    await expect(encrypt(payload)).rejects.toThrow(/Missing SESSION_SECRET/);
  });

  it("createSession stores an httpOnly cookie readable via getSessionToken", async () => {
    await createSession(payload);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
    );
    const token = await getSessionToken();
    expect(token).toBeDefined();
    expect(await decrypt(token)).toMatchObject(payload);
  });

  it("getSessionToken returns undefined when no session cookie is set", async () => {
    expect(await getSessionToken()).toBeUndefined();
  });

  it("deleteSession clears the cookie", async () => {
    await createSession(payload);
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
    expect(await getSessionToken()).toBeUndefined();
  });

  it("updateSession re-signs a valid session with a fresh expiry", async () => {
    await createSession(payload);
    mockCookieStore.set.mockClear();
    await updateSession();
    expect(mockCookieStore.set).toHaveBeenCalledTimes(1);
    const token = await getSessionToken();
    expect(await decrypt(token)).toMatchObject(payload);
  });

  it("updateSession does nothing when there is no valid session", async () => {
    await updateSession();
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});
