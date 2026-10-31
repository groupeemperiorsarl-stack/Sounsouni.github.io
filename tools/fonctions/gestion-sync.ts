// ============================================================
// Fonction serveur : gestion-sync (Sounsouni Gestion) — version 2026-10-31
// Gestion et comptabilité des entreprises. Chaque téléphone garde tout chez
// lui et envoie ici seulement de petites « lignes » (une vente, une
// dépense…) ; les autres membres les récupèrent. Rôles :
//   chef (propriétaire) : tout ; comptable : tout sauf les membres ;
//   caissier : ventes, clients, encaissements ; partenaire : lecture seule.
// Abonnement : réglage Admin settings/gestion_config {mode free|paid, price,
// days}. En mode payant, une entreprise non « offerte » dont l'abonnement est
// fini peut encore LIRE, mais plus rien envoyer.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
function fromB64u(s: string): Uint8Array { const b = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4); const t = atob(b); const o = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) o[i] = t.charCodeAt(i); return o; }
async function sessionOf(req: Request) {
  const token = req.headers.get("X-Session-Token"), secret = Deno.env.get("SESSION_SECRET");
  if (!token || !secret) return null;
  const parts = token.split("."); if (parts.length !== 2) return null;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!(await crypto.subtle.verify("HMAC", key, fromB64u(parts[1]), new TextEncoder().encode(parts[0])))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64u(parts[0])));
    if (!p.accountId || p.purpose !== "session" || typeof p.expiresAt !== "number" || Date.now() > p.expiresAt) return null;
    return p;
  } catch { return null; }
}
const digits = (p: unknown) => String(p || "").replace(/\D/g, "");
const ROLES = ["chef", "comptable", "caissier", "partenaire"];
const KINDS = ["item", "sale", "purchase", "expense", "client", "supplier", "payment", "employee", "adjust", "settings"];
const CASHIER_KINDS = ["sale", "client", "payment"];
const DAY = 86400000;
function rid(prefix: string) { return prefix + Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10); }
function canWrite(role: string, kind: string) {
  if (role === "chef" || role === "comptable") return true;
  if (role === "caissier") return CASHIER_KINDS.includes(kind);
  return false;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const op = String(body.operation || "");
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const s = await sessionOf(req);
    if (!s) return json({ success: false, error: "session_required" }, 401);
    const callerId = String(s.accountId);
    const isAdmin = callerId === "admin_owner" || callerId.startsWith("national_admin_");
    const getCfg = async () => {
      const { data } = await db.from("app_data").select("data").eq("collection", "settings").eq("id", "gestion_config").maybeSingle();
      const c: any = (data && (data as any).data) || {};
      return { mode: c.mode === "paid" ? "paid" : "free", price: Math.max(0, Math.round(Number(c.price) || 0)), days: Math.max(1, Math.round(Number(c.days) || 30)) };
    };
    const access = (c: any, cfg: any) => {
      const expired = cfg.mode === "paid" && c.plan !== "offert" && Number(c.paid_until) < Date.now();
      return { expired, paidUntil: Number(c.paid_until) || 0, plan: c.plan };
    };

    // Abonnements payés par LigdiCash (transactions « completed » de type gestion) :
    // prolongés ici, une seule fois par transaction (fonction SQL atomique).
    const applyPaid = async (cids: string[], cfg: any) => {
      if (cfg.mode !== "paid" || !cids.length) return;
      const { data: rows } = await db.from("app_data").select("data").eq("collection", "ligdicashTransactions").eq("data->>kind", "gestion").eq("data->>status", "completed").in("data->>refId", cids);
      for (const r of (rows || []) as any[]) {
        const t = r.data; if (!t || !t.transactionId) continue;
        const { data: until } = await db.rpc("sns_gestion_extend", { p_cid: String(t.refId), p_txn: String(t.transactionId), p_days: Math.max(1, Math.round(Number(t.days) || cfg.days)) });
        if (until && t.buyerId) {
          const nid = "ntf_" + t.transactionId;
          await db.from("app_data").insert({ collection: "notifications", id: nid, data: { id: nid, channel: "sms", message: "📒 Abonnement Sounsouni Gestion payé : actif jusqu'au " + new Date(Number(until)).toLocaleDateString("fr-FR", { timeZone: "Africa/Bamako" }) + ".", userId: t.buyerId, time: Date.now(), read: false, target: "role-menu", senderId: "system" }, updated_at: new Date().toISOString() });
        }
      }
    };

    // ---------------- Administration ----------------
    if (op.startsWith("admin_")) {
      if (!isAdmin) return json({ success: false, error: "admin_only" }, 403);
      if (op === "admin_list") {
        const cfg = await getCfg();
        const { data: cs } = await db.from("gestion_companies").select("*").order("created_at", { ascending: false }).limit(2000);
        const { data: ms } = await db.from("gestion_members").select("company_id, status");
        const out = [];
        for (const c of (cs || []) as any[]) {
          const { count } = await db.from("gestion_ops").select("seq", { count: "exact", head: true }).eq("company_id", c.id);
          const mem = (ms || []).filter((m: any) => m.company_id === c.id);
          out.push({ id: c.id, name: c.name, ownerId: c.owner_id, ownerPhone: c.owner_phone, plan: c.plan, paidUntil: Number(c.paid_until) || 0, createdAt: c.created_at,
            members: mem.filter((m: any) => m.status === "active").length, invited: mem.filter((m: any) => m.status !== "active").length, ops: count || 0, ...access(c, cfg) });
        }
        return json({ success: true, config: cfg, companies: out });
      }
      if (op === "admin_config") {
        const doc = { id: "gestion_config", mode: body.mode === "paid" ? "paid" : "free", price: Math.max(0, Math.round(Number(body.price) || 0)), days: Math.max(1, Math.min(366, Math.round(Number(body.days) || 30))), updatedAt: Date.now() };
        if (doc.mode === "paid" && doc.price < 100) return json({ success: false, error: "price_min_100" }, 400);
        await db.from("app_data").upsert({ collection: "settings", id: "gestion_config", data: doc, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
        return json({ success: true, config: doc });
      }
      if (op === "admin_set_plan") {
        const cid = String(body.companyId || "");
        const patch: any = { updated_at: new Date().toISOString() };
        if (body.plan === "offert" || body.plan === "free") patch.plan = body.plan;
        if (typeof body.addDays === "number" && body.addDays !== 0) {
          const { data: c } = await db.from("gestion_companies").select("paid_until").eq("id", cid).maybeSingle();
          if (!c) return json({ success: false, error: "not_found" }, 404);
          const base = Math.max(Date.now(), Number((c as any).paid_until) || 0);
          patch.paid_until = body.addDays > 0 ? base + Math.round(body.addDays) * DAY : 0;
        }
        const { error } = await db.from("gestion_companies").update(patch).eq("id", cid);
        if (error) throw error;
        return json({ success: true });
      }
      if (op === "admin_delete") {
        await db.from("gestion_companies").delete().eq("id", String(body.companyId || ""));
        return json({ success: true });
      }
      return json({ success: false, error: "unknown_operation" }, 400);
    }

    // ---------------- Qui appelle ? ----------------
    const { data: meRow } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", callerId).maybeSingle();
    const me: any = meRow ? (meRow as any).data : null;
    if (!me || me.banned) return json({ success: false, error: "account_not_found" }, 403);
    const myPhone = digits(me.phone);
    if (myPhone.length < 6) return json({ success: false, error: "no_phone" }, 400);
    const callerIds = [callerId];
    {
      const { data: sib } = await db.from("app_data").select("id").eq("collection", "accounts").eq("data->>phone", me.phone);
      (sib || []).forEach((r: any) => { if (r.id && !callerIds.includes(r.id)) callerIds.push(r.id); });
    }
    const membership = async (cid: string) => {
      const { data: m } = await db.from("gestion_members").select("*").eq("company_id", cid).eq("phone", myPhone).maybeSingle();
      const { data: c } = await db.from("gestion_companies").select("*").eq("id", cid).maybeSingle();
      return { m: m as any, c: c as any };
    };

    if (op === "my") {
      const cfg = await getCfg();
      const { data: ms } = await db.from("gestion_members").select("*").eq("phone", myPhone);
      const ids = (ms || []).map((m: any) => m.company_id);
      await applyPaid((ms || []).filter((m: any) => m.status === "active" && m.role === "chef").map((m: any) => m.company_id), cfg);
      const { data: cs } = ids.length ? await db.from("gestion_companies").select("*").in("id", ids) : { data: [] as any[] };
      const companies: any[] = [], invites: any[] = [];
      for (const m of (ms || []) as any[]) {
        const c = (cs || []).find((x: any) => x.id === m.company_id);
        if (!c) continue;
        const item = { id: c.id, name: c.name, role: m.role, ownerId: c.owner_id, shopId: c.shop_id, isOwner: callerIds.includes(c.owner_id), ...access(c, cfg) };
        if (m.status === "active") companies.push(item); else invites.push({ ...item, invitedBy: m.invited_by || "" });
      }
      return json({ success: true, companies, invites, config: cfg, phone: myPhone });
    }

    if (op === "create") {
      const name = String(body.name || "").trim().slice(0, 80);
      if (name.length < 2) return json({ success: false, error: "name_required" }, 400);
      if (!isAdmin && !me.shopName && !me.sellerType) return json({ success: false, error: "sellers_only" }, 403);
      const { count } = await db.from("gestion_companies").select("id", { count: "exact", head: true }).eq("owner_phone", myPhone);
      if ((count || 0) >= 5) return json({ success: false, error: "too_many_companies" }, 400);
      const id = rid("gc_");
      const { error } = await db.from("gestion_companies").insert({ id, owner_id: callerId, owner_phone: myPhone, name, shop_id: me.shopName ? callerId : null });
      if (error) throw error;
      await db.from("gestion_members").insert({ company_id: id, phone: myPhone, role: "chef", status: "active", name: String(me.name || "").slice(0, 80), invited_by: null });
      return json({ success: true, company: { id, name, role: "chef", ownerId: callerId, isOwner: true, expired: false, plan: "free", paidUntil: 0 } });
    }

    if (op === "respond") {
      const cid = String(body.companyId || "");
      const { m } = await membership(cid);
      if (!m || m.status !== "invited") return json({ success: false, error: "no_invite" }, 404);
      if (body.accept === true) await db.from("gestion_members").update({ status: "active", name: String(me.name || "").slice(0, 80) }).eq("company_id", cid).eq("phone", myPhone);
      else await db.from("gestion_members").delete().eq("company_id", cid).eq("phone", myPhone);
      return json({ success: true });
    }

    // ---- Tout le reste : membre actif d'une entreprise ----
    const cid = String(body.companyId || "");
    let { m, c } = await membership(cid);
    if ((op === "pull" || op === "push") && c && Number(c.paid_until) < Date.now() + 3 * DAY) {
      const cfg0 = await getCfg();
      if (cfg0.mode === "paid") { await applyPaid([cid], cfg0); ({ m, c } = await membership(cid)); }
    }
    if (!c || !m || m.status !== "active") return json({ success: false, error: "not_member" }, 403);
    const role = String(m.role);
    const isChef = role === "chef";

    if (op === "members") {
      const { data: rows } = await db.from("gestion_members").select("phone, role, status, name, created_at").eq("company_id", cid).order("created_at");
      return json({ success: true, members: rows || [], ownerPhone: c.owner_phone });
    }
    if (op === "invite") {
      if (!isChef) return json({ success: false, error: "chef_only" }, 403);
      const ph = digits(body.phone), r = String(body.role || "");
      if (ph.length < 8 || ph.length > 15) return json({ success: false, error: "bad_phone" }, 400);
      if (!ROLES.includes(r) || r === "chef") return json({ success: false, error: "bad_role" }, 400);
      const { count } = await db.from("gestion_members").select("phone", { count: "exact", head: true }).eq("company_id", cid);
      if ((count || 0) >= 40) return json({ success: false, error: "too_many_members" }, 400);
      const { data: exist } = await db.from("gestion_members").select("status").eq("company_id", cid).eq("phone", ph).maybeSingle();
      if (exist) return json({ success: false, error: "already_member" }, 409);
      // Retrouver son nom s'il a déjà un compte Sounsouni (même numéro).
      const { data: accs } = await db.from("app_data").select("id, data").eq("collection", "accounts").ilike("data->>phone", "%" + ph.slice(-8));
      const targets = (accs || []).filter((a: any) => digits(a.data && a.data.phone) === ph);
      await db.from("gestion_members").insert({ company_id: cid, phone: ph, role: r, status: "invited", name: targets[0] ? String(targets[0].data.name || "").slice(0, 80) : null, invited_by: String(me.name || "").slice(0, 80) });
      const label: Record<string, string> = { comptable: "comptable", caissier: "caissier", partenaire: "partenaire" };
      const msg = "📒 " + c.name + " vous invite comme " + label[r] + " dans Sounsouni Gestion. Ouvrez « Changer de rôle » pour rejoindre.";
      for (const a of targets.slice(0, 5) as any[]) {
        const nid = rid("ntf_g");
        await db.from("app_data").insert({ collection: "notifications", id: nid, data: { id: nid, channel: "sms", message: msg, userId: a.id, time: Date.now(), read: false, target: "role-menu", senderId: "system" }, updated_at: new Date().toISOString() });
        fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/send-push-fcm", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") }, body: JSON.stringify({ userId: a.id, title: "Sounsouni Gestion", body: msg }) }).catch(() => {});
      }
      return json({ success: true, hasAccount: targets.length > 0 });
    }
    if (op === "member_update" || op === "member_remove") {
      const ph = digits(body.phone);
      const self = ph === myPhone;
      if (ph === digits(c.owner_phone)) return json({ success: false, error: "owner_locked" }, 403);
      if (!isChef && !(self && op === "member_remove")) return json({ success: false, error: "chef_only" }, 403);
      if (op === "member_remove") await db.from("gestion_members").delete().eq("company_id", cid).eq("phone", ph);
      else {
        const r = String(body.role || "");
        if (!ROLES.includes(r) || r === "chef") return json({ success: false, error: "bad_role" }, 400);
        await db.from("gestion_members").update({ role: r }).eq("company_id", cid).eq("phone", ph);
      }
      return json({ success: true });
    }
    if (op === "rename") {
      if (!isChef) return json({ success: false, error: "chef_only" }, 403);
      const name = String(body.name || "").trim().slice(0, 80);
      if (name.length < 2) return json({ success: false, error: "name_required" }, 400);
      await db.from("gestion_companies").update({ name, updated_at: new Date().toISOString() }).eq("id", cid);
      return json({ success: true });
    }

    if (op === "pull") {
      const since = Math.max(0, Math.floor(Number(body.since) || 0));
      const limit = Math.min(1000, Math.max(1, Math.floor(Number(body.limit) || 500)));
      const { data: rows, error } = await db.from("gestion_ops").select("seq, data").eq("company_id", cid).gt("seq", since).order("seq").limit(limit);
      if (error) throw error;
      const cfg = await getCfg();
      return json({ success: true, ops: (rows || []).map((r: any) => ({ ...r.data, s: Number(r.seq) })), more: (rows || []).length === limit, role, name: c.name, ...access(c, cfg) });
    }

    if (op === "push") {
      if (!canWrite(role, "sale") && role !== "chef") return json({ success: false, error: "read_only" }, 403);
      const cfg = await getCfg();
      if (access(c, cfg).expired) return json({ success: false, error: "subscription_required" }, 402);
      const list = Array.isArray(body.ops) ? body.ops.slice(0, 200) : [];
      const accepted: string[] = [], rejected: { id: string; reason: string }[] = [];
      const rows: any[] = [];
      const now = Date.now();
      for (const o of list) {
        const id = String(o && o.id || "");
        if (!/^[A-Za-z0-9_.:-]{6,80}$/.test(id)) { rejected.push({ id, reason: "bad_id" }); continue; }
        const k = String(o.k || ""), e = String(o.e || ""), a = o.a === "del" ? "del" : "put";
        if (!KINDS.includes(k) || !/^[A-Za-z0-9_.:-]{1,80}$/.test(e) || (o.f != null && typeof o.f !== "object")) { rejected.push({ id, reason: "bad_op" }); continue; }
        if (!canWrite(role, k)) { rejected.push({ id, reason: "forbidden" }); continue; }
        if (k === "settings" && role !== "chef" && role !== "comptable") { rejected.push({ id, reason: "forbidden" }); continue; }
        const data = { id, k, e, a, f: a === "del" ? null : (o.f || {}), at: Math.min(Number(o.at) || now, now + 5 * 60000), st: now, by: callerId, bn: String(me.name || "").slice(0, 60) };
        if (JSON.stringify(data).length > 12000) { rejected.push({ id, reason: "too_big" }); continue; }
        if (role === "caissier") {
          // Un caissier ajoute ; il ne modifie ni ne supprime le travail des autres.
          if (a === "del") { rejected.push({ id, reason: "forbidden" }); continue; }
          if (k === "payment" && o.f && o.f.side !== "client") { rejected.push({ id, reason: "forbidden" }); continue; }
          const { data: other } = await db.from("gestion_ops").select("seq").eq("company_id", cid).eq("entity", k + ":" + e).not("author_id", "in", "(" + callerIds.map((x) => '"' + x + '"').join(",") + ")").limit(1);
          if (other && other.length) { rejected.push({ id, reason: "forbidden" }); continue; }
        }
        rows.push({ company_id: cid, op_id: id, entity: k + ":" + e, author_id: callerId, data });
        accepted.push(id);
      }
      if (rows.length) {
        const { error } = await db.from("gestion_ops").upsert(rows, { onConflict: "company_id,op_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      return json({ success: true, accepted, rejected });
    }
    return json({ success: false, error: "unknown_operation" }, 400);
  } catch (e) {
    console.error("gestion-sync", e);
    return json({ success: false, error: "server_error" }, 500);
  }
});
