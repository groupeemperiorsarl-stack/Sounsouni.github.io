// Faux client Supabase en mémoire, pour tester les fonctions serveur sans toucher la vraie base.
export type Row = { collection: string; id: string; data: any; updated_at: string };
export const DB: { rows: Row[] } = { rows: [] };
const clone = (x: any) => JSON.parse(JSON.stringify(x));
function getField(r: Row, col: string): any {
  if (col === "collection") return r.collection;
  if (col === "id") return r.id;
  const m = /^data->>(.+)$/.exec(col);
  if (m) { const v = r.data ? r.data[m[1]] : undefined; return v === undefined || v === null ? null : (typeof v === "object" ? JSON.stringify(v) : String(v)); }
  throw new Error("col " + col);
}
function contains(a: any, b: any): boolean {
  if (b === null || typeof b !== "object") return a === b;
  if (Array.isArray(b)) return Array.isArray(a) && b.every((x) => a.some((y: any) => contains(y, x)));
  if (!a || typeof a !== "object") return false;
  return Object.keys(b).every((k) => contains(a[k], b[k]));
}
class Q {
  filters: Array<(r: Row) => boolean> = [];
  mode = "select"; payload: any = null; opts: any = null; sel: string | null = null; single = false; lim: number | null = null; from_ = 0; to_: number | null = null; wantSelect = false;
  constructor(public table: string) {}
  select(s: string) { if (this.mode === "select") this.sel = s; else this.wantSelect = true; return this; }
  eq(c: string, v: any) { this.filters.push((r) => { const f = getField(r, c); return f !== null && String(f) === String(v); }); return this; }
  neq(c: string, v: any) { this.filters.push((r) => String(getField(r, c)) !== String(v)); return this; }
  in(c: string, arr: any[]) { this.filters.push((r) => arr.map(String).includes(String(getField(r, c)))); return this; }
  contains(_c: string, obj: any) { this.filters.push((r) => contains(r.data, obj)); return this; }
  not(c: string, op: string, val: string) { const list = val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")); this.filters.push((r) => !list.includes(String(getField(r, c)))); return this; }
  lt(c: string, v: any) { this.filters.push((r) => String(getField(r, c)) < String(v)); return this; }
  ilike(c: string, pat: string) { const re = new RegExp("^" + pat.replace(/%/g, ".*") + "$", "i"); this.filters.push((r) => re.test(String(getField(r, c) || ""))); return this; }
  order() { return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.from_ = a; this.to_ = b; return this; }
  maybeSingle() { this.single = true; return this; }
  upsert(p: any, o?: any) { this.mode = "upsert"; this.payload = p; this.opts = o; return this; }
  insert(p: any) { this.mode = "insert"; this.payload = p; return this; }
  update(p: any) { this.mode = "update"; this.payload = p; return this; }
  delete() { this.mode = "delete"; return this; }
  match() { return DB.rows.filter((r) => this.filters.every((f) => f(r))); }
  project(r: Row) {
    const s = (this.sel || "data").split(",").map((x) => x.trim());
    const o: any = {};
    for (const k of s) o[k] = clone((r as any)[k]);
    return o;
  }
  exec(): { data: any; error: any } {
    const now = new Date().toISOString();
    if (this.mode === "select") {
      let rows = this.match();
      if (this.to_ !== null) rows = rows.slice(this.from_, this.to_ + 1);
      if (this.lim !== null) rows = rows.slice(0, this.lim);
      if (this.single) return { data: rows[0] ? this.project(rows[0]) : null, error: null };
      return { data: rows.map((r) => this.project(r)), error: null };
    }
    if (this.mode === "upsert" || this.mode === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const p of list) {
        const ex = DB.rows.find((r) => r.collection === p.collection && r.id === p.id);
        if (ex && this.mode === "insert") return { data: null, error: { message: "duplicate key" } };
        if (ex) { ex.data = clone(p.data); ex.updated_at = now; } else DB.rows.push({ collection: p.collection, id: p.id, data: clone(p.data), updated_at: now });
      }
      return { data: null, error: null };
    }
    if (this.mode === "update") {
      const rows = this.match();
      for (const r of rows) { if (this.payload.data !== undefined) r.data = clone(this.payload.data); r.updated_at = now; }
      return { data: this.wantSelect ? rows.map((r) => ({ id: r.id })) : null, error: null };
    }
    if (this.mode === "delete") {
      const rows = this.match();
      DB.rows = DB.rows.filter((r) => !rows.includes(r));
      return { data: this.wantSelect ? rows.map((r) => ({ id: r.id })) : null, error: null };
    }
    throw new Error("mode");
  }
  then(res: any, rej: any) { try { return Promise.resolve(this.exec()).then(res, rej); } catch (e) { return Promise.reject(e).then(res, rej); } }
}
const norm = (p: string) => String(p || "").replace(/[\s.\-()]/g, "");
function walletBatch(ops: any[]) {
  const snapshot = clone(DB.rows);
  try {
    const out: any = {};
    for (const op of ops) {
      const wid = norm(op.phone);
      if (!["wallets", "earningsLedgers"].includes(op.coll) || !wid) throw new Error("invalid_target");
      let r = DB.rows.find((x) => x.collection === op.coll && x.id === wid);
      if (!r) { r = { collection: op.coll, id: wid, data: op.coll === "wallets" ? { id: wid, phone: op.phone, balance: 0, transactions: [] } : { id: wid, phone: op.phone, total: 0, transactions: [] }, updated_at: "" }; DB.rows.push(r); }
      const fld = op.coll === "wallets" ? "balance" : "total";
      const tx = r.data.transactions || [];
      if (op.key && tx.some((t: any) => t.uniqueKey === op.key)) throw new Error("duplicate");
      const val = (Number(r.data[fld]) || 0) + Number(op.delta || 0);
      if (op.coll === "wallets" && val < 0) throw new Error("insufficient_balance");
      r.data[fld] = val;
      r.data.transactions = [...tx, { ...(op.txn || {}), ...(op.key ? { uniqueKey: op.key } : {}) }];
      out[op.coll + ":" + wid] = val;
    }
    return { data: { ok: true, balances: out }, error: null };
  } catch (e) {
    DB.rows = snapshot;
    return { data: null, error: { message: (e as Error).message } };
  }
}
export const CALLS: any[] = [];
export function createClient(..._a: any[]): any {
  return {
    from: (t: string) => new Q(t),
    rpc: async (name: string, args: any) => {
      CALLS.push({ name, args: clone(args) });
      if (name === "sns_wallet_batch") return walletBatch(args.p_ops);
      if (name === "sns_doc_patch") {
        const r = DB.rows.find((x) => x.collection === args.p_collection && x.id === args.p_id);
        if (!r || (args.p_expect && !contains(r.data, args.p_expect))) return { data: null, error: null };
        r.data = { ...r.data, ...clone(args.p_patch) };
        return { data: clone(r.data), error: null };
      }
      throw new Error("rpc " + name);
    },
    storage: {}
  };
}
