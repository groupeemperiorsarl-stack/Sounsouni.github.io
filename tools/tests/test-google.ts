// « Continuer avec Google » (fonction social-login), sans toucher la vraie base ni Google.
import { DB } from "./faux-supabase.ts";
Deno.env.set("SESSION_SECRET", "test-secret-xyz");
Deno.env.set("SUPABASE_URL", "http://fake");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc-secret");
const CID = "779026073520-u3sc7onv671k4ruldqc6jruif2ou4k27.apps.googleusercontent.com";
const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pub: any = await crypto.subtle.exportKey("jwk", kp.publicKey); pub.kid = "k1"; pub.alg = "RS256"; pub.use = "sig";
const bad = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
globalThis.fetch = (async (u: string) => { if (String(u).includes("oauth2/v3/certs")) return new Response(JSON.stringify({ keys: [pub] })); return new Response("{}"); }) as any;
let handler: (r: Request) => Promise<Response>;
// @ts-ignore
Object.defineProperty(Deno, "serve", { value: (h: any) => { handler = h; return {} as any; }, configurable: true, writable: true });
await import("../fonctions/social-login.ts");
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = (o: any) => b64u(new TextEncoder().encode(JSON.stringify(o)));
async function idToken(claims: any, key = kp.privateKey, kid = "k1") {
  const h = enc({ alg: "RS256", kid, typ: "JWT" }), p = enc({ iss: "https://accounts.google.com", aud: CID, exp: Math.floor(Date.now() / 1000) + 600, email_verified: true, ...claims });
  return h + "." + p + "." + b64u(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(h + "." + p))));
}
async function token(accountId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret-xyz"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const p = enc({ accountId, purpose: "session", issuedAt: Date.now(), expiresAt: Date.now() + 1e7 });
  return p + "." + b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(p))));
}
async function googlePost(state: string, idt: string) {
  const f = new URLSearchParams({ state, id_token: idt });
  const r = await handler(new Request("http://x/social-login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: f.toString() }));
  return await r.text();
}
async function app(body: any, who?: string) {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (who) h["X-Session-Token"] = await token(who);
  const r = await handler(new Request("http://x/social-login", { method: "POST", headers: h, body: JSON.stringify(body) }));
  return { status: r.status, ...(await r.json()) };
}
const put = (collection: string, id: string, data: any) => DB.rows.push({ collection, id, data: { id, ...data }, updated_at: "" });
const get = (id: string) => (DB.rows.find((r) => r.collection === "accounts" && r.id === id) || { data: null }).data;
let pass = 0, failN = 0;
function check(name: string, cond: boolean, info?: unknown) { if (cond) { pass++; console.log("  ✔", name); } else { failN++; console.log("  ✘", name, JSON.stringify(info)); } }
const L1 = "a".repeat(30), L2 = "b".repeat(30), L3 = "c".repeat(30), L4 = "d".repeat(30), L5 = "e".repeat(30);

console.log("== Nouvelle personne");
let r: any = await app({ operation: "poll", loginId: L1 });
check("avant Google : en attente", r.status === "pending", r);
let html = await googlePost(L1 + ".a", await idToken({ sub: "G1", email: "awa@gmail.com", name: "Awa Traoré", picture: "https://x/p.jpg", nonce: L1 }));
check("page de retour : réussite", html.includes("✅"), html.slice(0, 200));
r = await app({ operation: "poll", loginId: L1 });
check("nouvelle personne : formulaire court avec nom et e-mail", r.status === "new" && r.name === "Awa Traoré" && r.email === "awa@gmail.com", r);
put("accounts", "AWA", { name: "Awa Traoré", phone: "+22370000020" });
r = await app({ operation: "link", loginId: L1 });
check("relier sans session : refusé", r.error === "session_required", r);
r = await app({ operation: "link", loginId: L1 }, "AWA");
check("compte créé puis relié à Google", r.success && get("AWA").googleSub === "G1" && get("AWA").email === "awa@gmail.com" && get("AWA").avatarPhoto === "https://x/p.jpg", r);

console.log("== Connexion suivante");
await googlePost(L2 + ".p", await idToken({ sub: "G1", email: "awa@gmail.com", nonce: L2 }));
r = await app({ operation: "poll", loginId: L2 });
check("même compte Google : connexion directe avec clé", r.status === "login" && r.accountId === "AWA" && !!r.sessionToken && r.account.name === "Awa Traoré", r);
r = await app({ operation: "poll", loginId: L2 });
check("la clé n'est donnée qu'une fois", r.error === "already_used", r);

console.log("== Même e-mail qu'un compte existant");
put("accounts", "MOUSSA", { name: "Moussa", phone: "+22370000021", email: "Moussa@Gmail.com", hasPassword: true });
await googlePost(L3 + ".w", await idToken({ sub: "G2", email: "moussa@gmail.com", nonce: L3 }));
r = await app({ operation: "poll", loginId: L3 });
check("e-mail Google = e-mail du compte : connexion + liaison", r.status === "login" && r.accountId === "MOUSSA" && get("MOUSSA").googleSub === "G2", r);

console.log("== Tentatives frauduleuses");
html = await googlePost(L4 + ".a", await idToken({ sub: "G3", email: "x@gmail.com", nonce: L4 }, bad.privateKey));
check("fausse signature : refusée", html.includes("❌"), html.slice(0, 120));
html = await googlePost(L4 + ".a", await idToken({ sub: "G3", email: "x@gmail.com", nonce: "autre" + L4 }));
check("mauvais code de tentative : refusé", html.includes("❌"));
html = await googlePost(L4 + ".a", await idToken({ sub: "G3", email: "x@gmail.com", nonce: L4, aud: "autre-appli" }));
check("jeton fait pour une autre application : refusé", html.includes("❌"));
html = await googlePost(L4 + ".a", await idToken({ sub: "G3", email: "x@gmail.com", nonce: L4, exp: Math.floor(Date.now() / 1000) - 3600 }));
check("jeton expiré : refusé", html.includes("❌"));
r = await app({ operation: "poll", loginId: L4 });
check("rien n'a été enregistré", r.status === "pending", r);
await googlePost(L5 + ".a", await idToken({ sub: "G4", email: "moussa@gmail.com", email_verified: false, nonce: L5 }));
r = await app({ operation: "poll", loginId: L5 });
check("e-mail non vérifié par Google : pas de connexion au compte existant", r.status === "new", r);
html = await googlePost("pas-bon", "x");
check("lien invalide : refusé", html.includes("❌"));
console.log("\n" + pass + " réussis, " + failN + " échoués");
if (failN) Deno.exit(1);
