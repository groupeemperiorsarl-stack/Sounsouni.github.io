// Serveur local de test : la vraie fonction gestion-sync + faux Supabase en mémoire.
import { DB, TABLES } from "/home/claude/sounsouni.github.io/tools/tests/faux-supabase.ts";
Deno.env.set("SESSION_SECRET", "test-secret-xyz");
Deno.env.set("SUPABASE_URL", "http://fake");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc-secret");
const realFetch = globalThis.fetch;
globalThis.fetch = (async () => new Response("{}")) as any;
let handler: (r: Request) => Promise<Response>;
const realServe = Deno.serve;
// @ts-ignore
Object.defineProperty(Deno, "serve", { value: (h: any) => { handler = h; return {} as any; }, configurable: true, writable: true });
await import("/home/claude/sounsouni.github.io/tools/fonctions/gestion-sync.ts");
const put = (collection: string, id: string, data: any) => DB.rows.push({ collection, id, data: { id, ...data }, updated_at: "" });
put("accounts", "CHEF", { name: "Moussa", shopName: "Quincaillerie Moussa", sellerType: "entreprise", phone: "+22370000010", role: "vendeur" });
put("accounts", "COMPTA", { name: "Fanta", phone: "+22370000011", role: "acheteur" });
put("accounts", "CAISSE", { name: "Ali", phone: "+22370000012", role: "acheteur" });
put("accounts", "PART", { name: "Oumar", phone: "+22370000013", role: "acheteur" });
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function token(accountId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret-xyz"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const p = b64u(new TextEncoder().encode(JSON.stringify({ accountId, purpose: "session", issuedAt: Date.now(), expiresAt: Date.now() + 1e8 })));
  return p + "." + b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(p))));
}
let offline = false;
realServe({ port: 8787 }, async (req) => {
  const u = new URL(req.url);
  if (u.pathname === "/token") return new Response(await token(u.searchParams.get("id") || ""));
  if (u.pathname === "/offline") { offline = u.searchParams.get("v") === "1"; return new Response("ok"); }
  if (u.pathname === "/dump") return new Response(JSON.stringify({ tables: TABLES, notifs: DB.rows.filter((r) => r.collection === "notifications") }), { headers: { "content-type": "application/json" } });
  if (offline) return new Response("down", { status: 503 });
  return await handler(req);
});
