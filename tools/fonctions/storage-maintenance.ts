// ============================================================
// Fonction serveur : storage-maintenance (créée le 28/10/2026, audit sécurité)
// Outils de maintenance du stockage, réservés à Claude (même clé x-claude-key
// et même interrupteur « Accès Claude » que claude-admin) :
// - migrate_verif : crée le coffre privé « verif », y copie les pièces
//   d'identité/selfies, met à jour les références, efface les copies publiques ;
// - storage_cleanup : liste (ou efface avec apply:true) les photos d'articles
//   qui ne servent plus depuis plus de 7 jours.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-claude-key" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
async function sha256(s: string) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
function sameStr(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function getDoc(c: string, id: string) { const { data } = await db.from("app_data").select("data").eq("collection", c).eq("id", id).maybeSingle(); return data ? (data as any).data : null; }
async function log(op: string, target: string, summary: string) {
  const cur = (await getDoc("settings", "claude_log")) || { id: "claude_log", entries: [] };
  const entries = Array.isArray(cur.entries) ? cur.entries : [];
  entries.unshift({ at: Date.now(), op, target: String(target).slice(0, 80), summary: String(summary).slice(0, 240) });
  await db.from("app_data").upsert({ collection: "settings", id: "claude_log", data: { id: "claude_log", entries: entries.slice(0, 300) }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = req.headers.get("x-claude-key") || "";
    const rec = await getDoc("digitalSecrets", "sys_claude_key");
    if (!key || !rec || !rec.hash || !sameStr(await sha256(key), String(rec.hash))) { await new Promise((r) => setTimeout(r, 900)); return json({ success: false, error: "bad_key" }, 401); }
    const access = await getDoc("settings", "claude_access");
    if (!access || access.enabled !== true) return json({ success: false, error: "access_disabled" }, 403);
    const body = await req.json().catch(() => ({}));
    const op = String(body.op || "");
    // ---- Audit 28/10/2026 (BDD-1) : coffre privé « verif » pour les pièces d'identité ----
    if (op === "migrate_verif") {
      const { data: buckets } = await db.storage.listBuckets();
      if (!(buckets || []).some((b: any) => b.id === "verif")) {
        const { error: be } = await db.storage.createBucket("verif", { public: false, fileSizeLimit: 10485760, allowedMimeTypes: ["image/*"] });
        if (be) throw be;
      }
      const moved: string[] = [], failed: string[] = [];
      for (const dir of ["verification/docs", "verification/selfies"]) {
        const { data: files } = await db.storage.from("photo").list(dir, { limit: 1000 });
        for (const f of (files || []) as any[]) {
          const p = dir + "/" + f.name;
          try {
            const { data: blob, error: e1 } = await db.storage.from("photo").download(p); if (e1 || !blob) throw e1 || new Error("dl");
            const { error: e2 } = await db.storage.from("verif").upload(p, blob, { contentType: blob.type || "image/jpeg", upsert: true }); if (e2) throw e2;
            moved.push(p);
          } catch (_) { failed.push(p); }
        }
      }
      // Références en base : adresse publique → « verif:<chemin> » (seulement pour les fichiers copiés).
      const toRef = (u: unknown) => { if (typeof u !== "string") return u; const m = /\/storage\/v1\/object\/public\/photo\/(verification\/[^?#]+)/.exec(u); if (!m) return u; const p = decodeURIComponent(m[1]); return moved.includes(p) ? "verif:" + p : u; };
      const { data: rows } = await db.from("verification_documents").select("doc_key, selfie_photo, verification_docs");
      let updated = 0;
      for (const r of (rows || []) as any[]) {
        const s2 = toRef(r.selfie_photo), d2 = Array.isArray(r.verification_docs) ? r.verification_docs.map(toRef) : r.verification_docs;
        if (s2 !== r.selfie_photo || JSON.stringify(d2) !== JSON.stringify(r.verification_docs)) {
          const { error: e3 } = await db.from("verification_documents").update({ selfie_photo: s2, verification_docs: d2 }).eq("doc_key", r.doc_key); if (!e3) updated++;
        }
      }
      // Copies publiques effacées seulement si TOUT a été copié et référencé.
      let removed = 0;
      if (body.removePublic === true && !failed.length) {
        const pub = moved.concat(moved.map((p) => "thumbs/" + p + ".webp"));
        const { data: rm } = await db.storage.from("photo").remove(pub); removed = (rm || []).length;
      }
      await log("coffre_verif", String(moved.length), moved.length + " pièce(s) déplacée(s), " + updated + " dossier(s) mis à jour, " + removed + " copie(s) publique(s) effacée(s)");
      return json({ success: true, moved: moved.length, failed, updated, removed });
    }
    if (op === "storage_cleanup") {
      // Photos d'articles qui ne servent plus à rien (article supprimé, photo retirée) depuis plus de 7 jours.
      const used = new Set<string>();
      const { data: allRows } = await db.from("app_data").select("data").in("collection", ["products", "accounts", "publicProfiles", "vipAds", "settings", "conversationMessages", "boosts"]).limit(20000);
      const re = /\/storage\/v1\/object\/public\/photo\/([^"?#\\]+)/g;
      for (const r of (allRows || []) as any[]) { const t = JSON.stringify(r.data); let m; while ((m = re.exec(t))) used.add(decodeURIComponent(m[1])); }
      const cutoff = Date.now() - 7 * 86400000, orphans: string[] = [];
      for (const dir of ["products/images", "claude"]) {
        let offset = 0;
        for (;;) {
          const { data: files } = await db.storage.from("photo").list(dir, { limit: 1000, offset });
          if (!files || !files.length) break;
          for (const f of files as any[]) { const p = dir + "/" + f.name; if (!used.has(p) && Date.parse(f.created_at || "") < cutoff) orphans.push(p); }
          if (files.length < 1000) break; offset += 1000;
        }
      }
      if (body.apply !== true) return json({ success: true, dryRun: true, usedCount: used.size, orphans: orphans.length, sample: orphans.slice(0, 5) });
      let removed = 0;
      for (let i = 0; i < orphans.length; i += 100) { const batch = orphans.slice(i, i + 100); const { data: rm } = await db.storage.from("photo").remove(batch.concat(batch.map((p) => "thumbs/" + p + ".webp"))); removed += (rm || []).length; }
      await log("nettoyage_photos", String(orphans.length), orphans.length + " photo(s) inutilisée(s) effacée(s)");
      return json({ success: true, orphans: orphans.length, removed });
    }

    return json({ success: false, error: "unknown_op" }, 400);
  } catch (e) {
    console.error("storage-maintenance", e);
    return json({ success: false, error: e instanceof Error ? e.message : "server_error" }, 500);
  }
});
