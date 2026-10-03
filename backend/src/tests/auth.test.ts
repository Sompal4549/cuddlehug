import { describe, expect, it } from "vitest";
import { api, extractCookie, registerSession, uniqueEmail } from "./helpers";

describe("auth API", () => {
  it("registers a customer and returns tokens", async () => {
    const email = uniqueEmail("signup");
    const res = await api().post("/api/auth/register").send({
      firstName: "Aarav",
      lastName: "Sharma",
      email,
      password: "StrongPass@1",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email, role: "CUSTOMER" });
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(extractCookie(res.headers["set-cookie"], "ch_refresh")).toContain("ch_refresh=");
  });

  it("rejects duplicate email and weak passwords", async () => {
    const email = uniqueEmail("dupe");
    const payload = { firstName: "Av", lastName: "Bh", email, password: "StrongPass@1" };
    expect((await api().post("/api/auth/register").send(payload)).status).toBe(201);
    const duplicate = await api().post("/api/auth/register").send(payload);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("CONFLICT");

    const weak = await api()
      .post("/api/auth/register")
      .send({ ...payload, email: uniqueEmail("weak"), password: "123" });
    expect(weak.status).toBe(400);
    expect(weak.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid credentials without leaking which field failed", async () => {
    const res = await api()
      .post("/api/auth/login")
      .send({ email: "admin@cuddlehug.com", password: "WrongPassword@1" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("serves the signed-in user profile", async () => {
    const session = await registerSession("me");
    const res = await api().get("/api/auth/me").set(sessionToken(session));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(session.user.email);
  });

  it("requires a token for protected routes", async () => {
    expect((await api().get("/api/auth/me")).status).toBe(401);
    expect((await api().get("/api/orders").set({ Authorization: "Bearer nope" })).status).toBe(401);
    expect((await api().get("/api/addresses")).status).toBe(401);
  });

  it("rotates refresh tokens and rejects reuse of a revoked one", async () => {
    const email = uniqueEmail("refresh");
    const register = await api().post("/api/auth/register").send({
      firstName: "Ri",
      lastName: "Ta",
      email,
      password: "StrongPass@1",
    });
    const firstRefresh = extractCookie(register.headers["set-cookie"], "ch_refresh");

    const rotated = await api().post("/api/auth/refresh").set("Cookie", firstRefresh);
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.accessToken).toBeTruthy();
    const secondRefresh = extractCookie(rotated.headers["set-cookie"], "ch_refresh");
    expect(secondRefresh).not.toBe(firstRefresh);

    const reuse = await api().post("/api/auth/refresh").set("Cookie", firstRefresh);
    expect(reuse.status).toBe(401);

    // reuse of a revoked token revokes the whole session family
    const familyRevoked = await api().post("/api/auth/refresh").set("Cookie", secondRefresh);
    expect(familyRevoked.status).toBe(401);

    const relogin = await api()
      .post("/api/auth/login")
      .send({ email, password: "StrongPass@1" });
    expect(relogin.status).toBe(200);
    expect(relogin.body.data.accessToken).toBeTruthy();
  });

  it("logs out by revoking the refresh session", async () => {
    const session = await registerSession("logout");
    const out = await api().post("/api/auth/logout").set("Cookie", session.cookie);
    expect(out.status).toBe(200);
    const reuse = await api().post("/api/auth/refresh").set("Cookie", session.cookie);
    expect(reuse.status).toBe(401);
  });

  it("blocks customers from admin endpoints and anonymous callers entirely", async () => {
    const session = await registerSession("rbac");
    const asCustomer = await api().get("/api/admin/dashboard").set(sessionToken(session));
    expect(asCustomer.status).toBe(403);
    expect(asCustomer.body.code).toBe("FORBIDDEN");

    const anonymous = await api().get("/api/admin/dashboard");
    expect(anonymous.status).toBe(401);
  });

  it("updates the customer profile", async () => {
    const session = await registerSession("profile");
    const res = await api()
      .patch("/api/profile")
      .set(sessionToken(session))
      .send({ firstName: "Updated", phone: "+91 98765 43210" });
    expect(res.status).toBe(200);
    expect(res.body.data.user.firstName).toBe("Updated");
  });
});

function sessionToken(session: { accessToken: string }): Record<string, string> {
  return { Authorization: `Bearer ${session.accessToken}` };
}
