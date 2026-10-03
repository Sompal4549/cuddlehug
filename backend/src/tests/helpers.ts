import request from "supertest";
import { createApp } from "../app";

const app = createApp();

export const api = () => request(app);

export type Session = {
  accessToken: string;
  cookie: string;
  user: { id: string; email: string; role: string };
};

let counter = 0;

export function uniqueEmail(prefix = "it"): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}@example.com`;
}

export async function registerSession(prefix = "it"): Promise<Session> {
  const email = uniqueEmail(prefix);
  const res = await api().post("/api/auth/register").send({
    firstName: "Integration",
    lastName: "Tester",
    email,
    password: "Tester@1234",
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const { accessToken, user } = res.body.data;
  const refresh = extractCookie(res.headers["set-cookie"], "ch_refresh");
  return { accessToken, cookie: refresh, user };
}

export async function loginAdmin(): Promise<Session> {
  const res = await api()
    .post("/api/auth/login")
    .send({ email: "admin@cuddlehug.com", password: "Admin@1234" });
  if (res.status !== 200) throw new Error(`admin login failed: ${res.status}`);
  const { accessToken, user } = res.body.data;
  return { accessToken, cookie: extractCookie(res.headers["set-cookie"], "ch_refresh"), user };
}

export function extractCookie(headers: string[] | undefined, name: string): string {
  const raw = (headers ?? []).find((entry) => entry.startsWith(`${name}=`));
  return raw ? raw.split(";")[0] : "";
}

export function auth(session: Session): Record<string, string> {
  return { Authorization: `Bearer ${session.accessToken}` };
}
