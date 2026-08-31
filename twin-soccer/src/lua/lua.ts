/**
 * Küçük, bağımlılıksız Lua yorumlayıcı (tree-walking).
 * Desteklenen: local/atama, fonksiyonlar, if/elseif/else, while, numeric & generic for,
 * break/return, tablo kurucuları, tüm aritmetik/karşılaştırma/mantık operatörleri,
 * .. concat, # uzunluk, math/string/tostring/tonumber/pairs/ipairs/type kütüphanesi.
 */

export type LuaVal = number | string | boolean | null | LuaTable | LuaFn;
export type LuaFn = (...a: LuaVal[]) => LuaVal;

export class LuaTable {
  m: Map<number | string | boolean | null, LuaVal> = new Map();
  get(k: LuaVal): LuaVal {
    return this.m.get(normKey(k)) ?? null;
  }
  set(k: LuaVal, v: LuaVal): void {
    const nk = normKey(k);
    if (v === null) this.m.delete(nk);
    else this.m.set(nk, v);
  }
  length(): number {
    let n = 0;
    while (this.m.get(n + 1) !== undefined) n++;
    return n;
  }
  static fromPairs(obj: Record<string, unknown>): LuaTable {
    const t = new LuaTable();
    for (const k of Object.keys(obj)) t.set(k, toLua(obj[k]));
    return t;
  }
  static fromArray(a: unknown[]): LuaTable {
    const t = new LuaTable();
    a.forEach((v, i) => t.set(i + 1, toLua(v)));
    return t;
  }
  toPlain(): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    for (const [k, v] of this.m) {
      const key = typeof k === "number" ? String(k) : String(k);
      o[key] = v instanceof LuaTable ? v.toPlain() : v;
    }
    return o;
  }
}

function normKey(k: LuaVal): number | string | boolean | null {
  if (typeof k === "number") return k;
  if (typeof k === "string" || typeof k === "boolean" || k === null) return k;
  return String(k);
}

export function toLua(v: unknown): LuaVal {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return LuaTable.fromArray(v);
  if (typeof v === "function") return v as LuaFn;
  if (typeof v === "object") return LuaTable.fromPairs(v as Record<string, unknown>);
  return null;
}

export function fromLua(v: LuaVal): unknown {
  if (v instanceof LuaTable) return v.toPlain();
  return v;
}

/* ------------------------- LEXER ------------------------- */

type Tok = { t: string; v: string };

const KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if",
  "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while",
]);

const OPS = [
  "...", "..", "==", "~=", "<=", ">=", "//", "+", "-", "*", "/", "%", "^", "#", "=",
  "<", ">", "(", ")", "{", "}", "[", "]", ";", ":", ",", ".",
];

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\r" || c === "\n") { i++; continue; }
    if (c === "-" && src[i + 1] === "-") {
      // uzun yorum (--[[ ]]) desteği
      if (src[i + 2] === "[" && src[i + 3] === "[") {
        const e = src.indexOf("]]", i + 4);
        i = e < 0 ? src.length : e + 2;
      } else {
        while (i < src.length && src[i] !== "\n") i++;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") {
          const n = src[j + 1];
          s += n === "n" ? "\n" : n === "t" ? "\t" : n === "\\" ? "\\" : n === '"' ? '"' : n;
          j += 2;
        } else s += src[j++];
      }
      out.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < src.length && /[0-9.eE]/.test(src[j])) {
        if ((src[j] === "e" || src[j] === "E") && !/[0-9+-]/.test(src[j + 1] ?? "")) break;
        j++;
      }
      out.push({ t: "num", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const w = src.slice(i, j);
      out.push({ t: KEYWORDS.has(w) ? w : "name", v: w });
      i = j;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) { out.push({ t: op, v: op }); i += op.length; continue; }
    throw new Error("Lua lexer: bilinmeyen karakter '" + c + "' @ " + i);
  }
  out.push({ t: "eof", v: "" });
  return out;
}

/* ------------------------- AST ------------------------- */

type Node = any;

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  private peek(k = 0): Tok { return this.toks[Math.min(this.p + k, this.toks.length - 1)]; }
  private next(): Tok { return this.toks[this.p++]; }
  private is(t: string): boolean { return this.peek().t === t; }
  private eat(t: string): boolean { if (this.is(t)) { this.p++; return true; } return false; }
  private expect(t: string): Tok {
    if (!this.is(t)) throw new Error(`Lua parser: '${t}' bekleniyordu, '${this.peek().t}/${this.peek().v}' geldi`);
    return this.next();
  }
  private name(): string {
    const t = this.peek();
    if (t.t !== "name") throw new Error("Lua parser: isim bekleniyordu: " + t.v);
    this.p++;
    return t.v;
  }

  chunk(): Node {
    const body: Node[] = [];
    while (!this.is("eof") && !this.is("end") && !this.is("else") && !this.is("elseif") && !this.is("until")) {
      body.push(this.statement());
      this.eat(";");
    }
    return { k: "block", body };
  }

  private block(): Node {
    const body: Node[] = [];
    while (!this.is("end") && !this.is("else") && !this.is("elseif") && !this.is("until") && !this.is("eof")) {
      body.push(this.statement());
      this.eat(";");
    }
    return { k: "block", body };
  }

  private statement(): Node {
    if (this.eat("local")) {
      if (this.is("function")) {
        this.next();
        const nm = this.name();
        const params = this.params();
        const body = this.block();
        this.expect("end");
        return { k: "localfunc", name: nm, params, body };
      }
      const names = [this.name()];
      while (this.eat(",")) names.push(this.name());
      const exps = this.eat("=") ? this.explist() : [];
      return { k: "local", names, exps };
    }
    if (this.eat("if")) {
      const clauses: { c: Node; b: Node }[] = [];
      const c = this.expr();
      this.expect("then");
      clauses.push({ c, b: this.block() });
      while (this.eat("elseif")) {
        const c2 = this.expr();
        this.expect("then");
        clauses.push({ c: c2, b: this.block() });
      }
      let els: Node | null = null;
      if (this.eat("else")) els = this.block();
      this.expect("end");
      return { k: "if", clauses, els };
    }
    if (this.eat("while")) {
      const c = this.expr();
      this.expect("do");
      const b = this.block();
      this.expect("end");
      return { k: "while", c, b };
    }
    if (this.eat("for")) {
      const n1 = this.name();
      if (this.eat("=")) {
        const a = this.expr();
        this.expect(",");
        const b = this.expr();
        const c = this.eat(",") ? this.expr() : { k: "num", v: 1 };
        this.expect("do");
        const body = this.block();
        this.expect("end");
        return { k: "fornum", name: n1, a, b, c, body };
      }
      const names = [n1];
      while (this.eat(",")) names.push(this.name());
      this.expect("in");
      const exps = this.explist();
      this.expect("do");
      const body = this.block();
      this.expect("end");
      return { k: "forin", names, exps, body };
    }
    if (this.eat("return")) {
      if (this.is("end") || this.is("else") || this.is("elseif") || this.is("eof") || this.is(";")) {
        return { k: "return", exps: [] };
      }
      return { k: "return", exps: this.explist() };
    }
    if (this.eat("break")) return { k: "break" };
    if (this.eat("function")) {
      // function a.b.c(...) | function a:b(...)
      let target: Node = { k: "var", name: this.name() };
      let isMethod = false;
      while (this.is(".") || this.is(":")) {
        isMethod = this.eat(":");
        const key = isMethod ? this.name() : this.name();
        target = { k: "index", obj: target, key: { k: "str", v: key }, method: isMethod };
      }
      const params = this.params();
      const body = this.block();
      this.expect("end");
      const fn: Node = { k: "func", params, body, name: null, self: isMethod };
      return { k: "assign", targets: [target], exps: [fn] };
    }
    if (this.eat("do")) {
      const b = this.block();
      this.expect("end");
      return b;
    }
    // atama ya da ifade-ifadesi
    const e = this.suffixed();
    if (this.is("=") || this.is(",")) {
      const targets = [e];
      while (this.eat(",")) targets.push(this.suffixed());
      this.expect("=");
      const exps = this.explist();
      return { k: "assign", targets, exps };
    }
    if (e.k !== "call") throw new Error("Lua parser: geçersiz ifade ifadesi");
    return { k: "callstat", e };
  }

  private params(): string[] {
    this.expect("(");
    const ps: string[] = [];
    while (!this.is(")")) {
      if (this.is("name")) ps.push(this.name());
      else if (this.eat("...")) ps.push("...");
      else this.next();
      if (!this.eat(",")) break;
    }
    this.expect(")");
    return ps;
  }

  private explist(): Node[] {
    const out = [this.expr()];
    while (this.eat(",")) out.push(this.expr());
    return out;
  }

  private primary(): Node {
    const t = this.peek();
    if (t.t === "num") { this.p++; return { k: "num", v: parseFloat(t.v) }; }
    if (t.t === "str") { this.p++; return { k: "str", v: t.v }; }
    if (t.t === "true") { this.p++; return { k: "true" }; }
    if (t.t === "false") { this.p++; return { k: "false" }; }
    if (t.t === "nil") { this.p++; return { k: "nil" }; }
    if (t.t === "...") { this.p++; return { k: "vararg" }; }
    if (t.t === "name") { this.p++; return { k: "var", name: t.v }; }
    if (t.t === "(") {
      this.p++;
      const e = this.expr();
      this.expect(")");
      return { k: "paren", e };
    }
    if (t.t === "{") return this.tablecons();
    if (t.t === "function") {
      this.p++;
      const params = this.params();
      const body = this.block();
      this.expect("end");
      return { k: "func", params, body, name: null };
    }
    throw new Error("Lua parser: beklenmeyen token '" + t.t + "' '" + t.v + "'");
  }

  private suffixed(): Node {
    let e = this.primary();
    for (;;) {
      if (this.is(".")) { this.p++; const key = this.name(); e = { k: "index", obj: e, key: { k: "str", v: key } }; continue; }
      if (this.is("[")) { this.p++; const key = this.expr(); this.expect("]"); e = { k: "index", obj: e, key }; continue; }
      if (this.is(":")) { this.p++; const m = this.name(); const args = this.callargs(); e = { k: "mcall", obj: e, m, args }; continue; }
      if (this.is("(") || this.is("str") || this.is("{")) { const args = this.callargs(); e = { k: "call", fn: e, args }; continue; }
      break;
    }
    return e;
  }

  private callargs(): Node[] {
    const t = this.peek();
    if (t.t === "str") { this.p++; return [{ k: "str", v: t.v }]; }
    if (t.t === "{") return [this.tablecons()];
    this.expect("(");
    const args: Node[] = [];
    if (!this.is(")")) {
      args.push(...this.explist());
    }
    this.expect(")");
    return args;
  }

  private tablecons(): Node {
    this.expect("{");
    const items: { key: Node | null; val: Node }[] = [];
    while (!this.is("}")) {
      if (this.is("[")) {
        this.p++;
        const key = this.expr();
        this.expect("]");
        this.expect("=");
        items.push({ key, val: this.expr() });
      } else if (this.peek().t === "name" && this.peek(1).t === "=") {
        const key = { k: "str", v: this.next().v };
        this.next();
        items.push({ key, val: this.expr() });
      } else {
        items.push({ key: null, val: this.expr() });
      }
      if (!this.eat(",") && !this.eat(";")) break;
    }
    this.expect("}");
    return { k: "table", items };
  }

  private expr(): Node { return this.orExpr(); }

  private orExpr(): Node {
    let l = this.andExpr();
    while (this.eat("or")) l = { k: "or", l, r: this.andExpr() };
    return l;
  }
  private andExpr(): Node {
    let l = this.cmpExpr();
    while (this.eat("and")) l = { k: "and", l, r: this.cmpExpr() };
    return l;
  }
  private cmpExpr(): Node {
    let l = this.concatExpr();
    for (;;) {
      const t = this.peek().t;
      if (t === "==" || t === "~=" || t === "<" || t === ">" || t === "<=" || t === ">=") {
        this.p++;
        l = { k: "cmp", op: t, l, r: this.concatExpr() };
      } else break;
    }
    return l;
  }
  private concatExpr(): Node {
    let l = this.addExpr();
    while (this.is("..")) { this.p++; l = { k: "bin", op: "..", l, r: this.addExpr() }; }
    return l;
  }
  private addExpr(): Node {
    let l = this.mulExpr();
    for (;;) {
      if (this.is("+") || this.is("-")) { const op = this.next().t; l = { k: "bin", op, l, r: this.mulExpr() }; }
      else break;
    }
    return l;
  }
  private mulExpr(): Node {
    let l = this.unaryExpr();
    for (;;) {
      if (this.is("*") || this.is("/") || this.is("%") || this.is("//")) {
        const op = this.next().t;
        l = { k: "bin", op, l, r: this.unaryExpr() };
      } else break;
    }
    return l;
  }
  private unaryExpr(): Node {
    if (this.is("-")) { this.p++; return { k: "un", op: "-", e: this.unaryExpr() }; }
    if (this.is("not")) { this.p++; return { k: "un", op: "not", e: this.unaryExpr() }; }
    if (this.is("#")) { this.p++; return { k: "un", op: "#", e: this.unaryExpr() }; }
    return this.powExpr();
  }
  private powExpr(): Node {
    const l = this.suffixed();
    if (this.is("^")) { this.p++; return { k: "bin", op: "^", l, r: this.unaryExpr() }; }
    return l;
  }
}

/* ------------------------- INTERPRETER ------------------------- */

class BreakSig { }
class ReturnSig { constructor(readonly v: LuaVal[]) { } }

class Scope {
  vars = new Map<string, LuaVal>();
  constructor(readonly parent: Scope | null) { }
  get(n: string): LuaVal {
    let s: Scope | null = this;
    while (s) { const v = s.vars.get(n); if (v !== undefined) return v; s = s.parent; }
    return null;
  }
  has(n: string): boolean {
    let s: Scope | null = this;
    while (s) { if (s.vars.has(n)) return true; s = s.parent; }
    return false;
  }
  setExisting(n: string, v: LuaVal): boolean {
    let s: Scope | null = this;
    while (s) { if (s.vars.has(n)) { s.vars.set(n, v); return true; } s = s.parent; }
    return false;
  }
  declare(n: string, v: LuaVal): void { this.vars.set(n, v); }
}

export class LuaRuntime {
  private globals = new Scope(null);
  private chunks = new Map<string, Node>();
  private seedState = 123456789;

  constructor() { this.installStd(); }

  setRandomSeed(s: number): void { this.seedState = (s >>> 0) || 1; }
  private rnd(): number {
    // xorshift32 — deterministik
    let x = this.seedState;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    this.seedState = x;
    return x / 4294967296;
  }

  setGlobal(n: string, v: LuaVal): void { this.globals.declare(n, v); }
  getGlobal(n: string): LuaVal { return this.globals.get(n); }

  run(script: string, chunkName = "chunk"): void {
    let ast = this.chunks.get(script);
    if (!ast) {
      ast = new Parser(lex(script)).chunk();
      this.chunks.set(script, ast);
    }
    try {
      this.execBlock(ast.body, new Scope(this.globals), null);
    } catch (e) {
      if (e instanceof ReturnSig) return;
      throw new Error(`Lua[${chunkName}]: ${(e as Error).message}`);
    }
  }

  /** global fonksiyonu çağırır; hata durumunda exception fırlatır. */
  call(fnName: string, ...args: LuaVal[]): LuaVal {
    const f = this.globals.get(fnName);
    if (typeof f !== "function") throw new Error("Lua: fonksiyon yok → " + fnName);
    return f(...args);
  }

  private installStd(): void {
    const g = this.globals;
    const math = new LuaTable();
    math.set("floor", (x: LuaVal) => Math.floor(num(x)));
    math.set("ceil", (x: LuaVal) => Math.ceil(num(x)));
    math.set("abs", (x: LuaVal) => Math.abs(num(x)));
    math.set("sqrt", (x: LuaVal) => Math.sqrt(num(x)));
    math.set("max", (...a: LuaVal[]) => Math.max(...a.map(num)));
    math.set("min", (...a: LuaVal[]) => Math.min(...a.map(num)));
    math.set("random", (...a: LuaVal[]) => {
      if (a.length === 0) return this.rnd();
      if (a.length === 1) return Math.floor(this.rnd() * num(a[0])) + 1;
      const lo = num(a[0]); const hi = num(a[1]);
      return Math.floor(lo + this.rnd() * (hi - lo + 1));
    });
    math.set("pow", (a: LuaVal, b: LuaVal) => Math.pow(num(a), num(b)));
    math.set("exp", (x: LuaVal) => Math.exp(num(x)));
    math.set("huge", Number.MAX_VALUE);
    math.set("pi", Math.PI);
    g.declare("math", math);

    const str = new LuaTable();
    str.set("format", (...a: LuaVal[]) => {
      const f = String(a[0] ?? "");
      let i = 1;
      return f.replace(/%[-+ #0]*\d*(?:\.\d+)?[difsx]/g, (m) => {
        const v = a[i++];
        if (m[m.length - 1] === "d") return String(Math.round(num(v)));
        if (m[m.length - 1] === "f") {
          const dec = m.includes(".") ? parseInt(m.split(".")[1], 10) : 6;
          return num(v).toFixed(dec);
        }
        if (m[m.length - 1] === "i") return String(Math.trunc(num(v)));
        if (m[m.length - 1] === "x") return Math.round(num(v)).toString(16);
        return String(v ?? "nil");
      });
    });
    str.set("sub", (s: LuaVal, a: LuaVal, b: LuaVal) => String(s ?? "").substring(num(a) - 1, b === null || b === undefined ? undefined : num(b)));
    str.set("len", (s: LuaVal) => String(s ?? "").length);
    str.set("upper", (s: LuaVal) => String(s ?? "").toUpperCase());
    str.set("lower", (s: LuaVal) => String(s ?? "").toLowerCase());
    g.declare("string", str);

    g.declare("tostring", (v: LuaVal) => (v instanceof LuaTable ? "table" : String(v ?? "nil")));
    g.declare("tonumber", (v: LuaVal) => {
      const n = parseFloat(String(v ?? ""));
      return Number.isFinite(n) ? n : null;
    });
    g.declare("type", (v: LuaVal) => (v === null ? "nil" : v instanceof LuaTable ? "table" : typeof v === "function" ? "function" : typeof v === "number" ? "number" : typeof v === "string" ? "string" : "boolean"));
    g.declare("pairs", (t: LuaVal) => {
      const tt = t instanceof LuaTable ? t : new LuaTable();
      const entries = [...tt.m.entries()];
      let i = 0;
      const iter: LuaFn = () => {
        // çoklu dönüş desteklenmediği için pairs yalnızca forin özel durumunda çalışır
        return i < entries.length ? new LuaTable() : null;
      };
      return iter;
    });
    g.declare("ipairs", (t: LuaVal) => {
      const tt = t instanceof LuaTable ? t : new LuaTable();
      const iter: LuaFn = () => null;
      (iter as unknown as { src?: LuaTable }).src = tt;
      return iter;
    });
    g.declare("print", () => null);
  }

  /* ---- yürütme ---- */

  private execBlock(body: Node[], scope: Scope, varargs: LuaVal[] | null): void {
    for (const st of body) this.exec(st, scope, varargs);
  }

  private exec(n: Node, s: Scope, va: LuaVal[] | null): void {
    switch (n.k) {
      case "block": this.execBlock(n.body, s, va); return;
      case "local": {
        const vals = n.exps.map((e: Node) => this.eval(e, s, va));
        n.names.forEach((nm: string, i: number) => s.declare(nm, nm === "..." ? null : (vals[i] ?? null)));
        return;
      }
      case "localfunc": {
        s.declare(n.name, null);
        const fn = this.mkFunc(n.params, n.body, s, va, n.name);
        s.declare(n.name, fn);
        return;
      }
      case "assign": {
        const vals = n.exps.map((e: Node) => this.eval(e, s, va));
        n.targets.forEach((t: Node, i: number) => this.assign(t, vals[i] ?? null, s, va));
        return;
      }
      case "callstat": this.eval(n.e, s, va); return;
      case "if": {
        for (const cl of n.clauses) {
          if (truthy(this.eval(cl.c, s, va))) { this.execBlock(cl.b.body, new Scope(s), va); return; }
        }
        if (n.els) this.execBlock(n.els.body, new Scope(s), va);
        return;
      }
      case "while": {
        let guard = 0;
        while (truthy(this.eval(n.c, s, va))) {
          if (++guard > 200000) throw new Error("Lua: sonsuz döngü koruması");
          try { this.execBlock(n.b.body, new Scope(s), va); } catch (e) { if (e instanceof BreakSig) break; throw e; }
        }
        return;
      }
      case "fornum": {
        const a = num(this.eval(n.a, s, va));
        const b = num(this.eval(n.b, s, va));
        const c = num(this.eval(n.c, s, va)) || 1;
        if (c === 0) throw new Error("Lua: for adımı 0");
        let guard = 0;
        for (let i = a; c > 0 ? i <= b : i >= b; i += c) {
          if (++guard > 200000) throw new Error("Lua: for döngü limiti");
          const inner = new Scope(s);
          inner.declare(n.name, i);
          try { this.execBlock(n.body.body, inner, va); } catch (e) { if (e instanceof BreakSig) break; throw e; }
        }
        return;
      }
      case "forin": {
        // yalnızca pairs/ipairs benzeri tablo dolaşımı desteklenir
        const src = this.eval(n.exps[0], s, va);
        let tab: LuaTable | null = null;
        if (src instanceof LuaTable) tab = src;
        else {
          const hidden = (src as unknown as { src?: LuaTable }).src;
          if (hidden instanceof LuaTable) tab = hidden;
        }
        if (!tab) return;
        const entries = [...tab.m.entries()];
        let guard = 0;
        for (const [k, v] of entries) {
          if (++guard > 200000) break;
          const inner = new Scope(s);
          if (n.names[0]) inner.declare(n.names[0], k as LuaVal);
          if (n.names[1]) inner.declare(n.names[1], v);
          try { this.execBlock(n.body.body, inner, va); } catch (e) { if (e instanceof BreakSig) break; throw e; }
        }
        return;
      }
      case "return": throw new ReturnSig(n.exps.map((e: Node) => this.eval(e, s, va)));
      case "break": throw new BreakSig();
      default: throw new Error("Lua: bilinmeyen deyim " + n.k);
    }
  }

  private assign(t: Node, v: LuaVal, s: Scope, va: LuaVal[] | null): void {
    if (t.k === "var") {
      if (!s.setExisting(t.name, v)) this.globals.declare(t.name, v);
      return;
    }
    if (t.k === "index") {
      const obj = this.eval(t.obj, s, va);
      const key = this.eval(t.key, s, va);
      if (obj instanceof LuaTable) obj.set(key, v);
      else throw new Error("Lua: tablo olmayana indeks ataması");
      return;
    }
    throw new Error("Lua: geçersiz atama hedefi");
  }

  private mkFunc(params: string[], body: Node, defScope: Scope, defVa: LuaVal[] | null, name: string | null): LuaFn {
    const fn = (...args: LuaVal[]): LuaVal => {
      const sc = new Scope(defScope);
      params.forEach((p, i) => {
        if (p === "...") sc.declare("...", null);
        else sc.declare(p, args[i] ?? null);
      });
      // ... için args'u closure'a taşı
      (fn as unknown as { __args?: LuaVal[] }).__args = args;
      try {
        this.execBlock(body.body, sc, args);
      } catch (e) {
        if (e instanceof ReturnSig) {
          const r = e.v;
          return r.length === 0 ? null : r[0];
        }
        if (e instanceof BreakSig) return null;
        throw e;
      }
      return null;
    };
    (fn as unknown as { __name?: string }).__name = name ?? "anonymous";
    void defVa;
    return fn;
  }

  private eval(n: Node, s: Scope, va: LuaVal[] | null): LuaVal {
    switch (n.k) {
      case "num": return n.v;
      case "str": return n.v;
      case "true": return true;
      case "false": return false;
      case "nil": return null;
      case "paren": return this.eval(n.e, s, va);
      case "vararg": return (va && va[0]) ?? null;
      case "var": return s.get(n.name);
      case "index": {
        const o = this.eval(n.obj, s, va);
        const k = this.eval(n.key, s, va);
        if (o instanceof LuaTable) return o.get(k);
        if (typeof o === "string") {
          const st = this.globals.get("string");
          if (st instanceof LuaTable) return st.get(k);
        }
        return null;
      }
      case "table": {
        const t = new LuaTable();
        let idx = 1;
        for (const it of n.items) {
          if (it.key) t.set(this.eval(it.key, s, va), this.eval(it.val, s, va));
          else t.set(idx++, this.eval(it.val, s, va));
        }
        return t;
      }
      case "func": return this.mkFunc(n.params, n.body, s, va, n.name);
      case "or": return truthy(this.eval(n.l, s, va)) ? this.eval(n.l, s, va) : this.eval(n.r, s, va);
      case "and": {
        const l = this.eval(n.l, s, va);
        return truthy(l) ? this.eval(n.r, s, va) : l;
      }
      case "cmp": {
        const a = this.eval(n.l, s, va);
        const b = this.eval(n.r, s, va);
        switch (n.op) {
          case "==": return eq(a, b);
          case "~=": return !eq(a, b);
          case "<": return typeof a === "number" && typeof b === "number" ? a < b : String(a) < String(b);
          case ">": return typeof a === "number" && typeof b === "number" ? a > b : String(a) > String(b);
          case "<=": return typeof a === "number" && typeof b === "number" ? a <= b : String(a) <= String(b);
          case ">=": return typeof a === "number" && typeof b === "number" ? a >= b : String(a) >= String(b);
        }
        return false;
      }
      case "bin": {
        const a = this.eval(n.l, s, va);
        const b = this.eval(n.r, s, va);
        if (n.op === "..") return String(a ?? "nil") + String(b ?? "nil");
        const x = num(a); const y = num(b);
        switch (n.op) {
          case "+": return x + y;
          case "-": return x - y;
          case "*": return x * y;
          case "/": return y === 0 ? 0 : x / y;
          case "%": return y === 0 ? 0 : x % y;
          case "//": return y === 0 ? 0 : Math.floor(x / y);
          case "^": return Math.pow(x, y);
        }
        return 0;
      }
      case "un": {
        if (n.op === "-") return -num(this.eval(n.e, s, va));
        if (n.op === "not") return !truthy(this.eval(n.e, s, va));
        if (n.op === "#") {
          const v = this.eval(n.e, s, va);
          return v instanceof LuaTable ? v.length() : typeof v === "string" ? v.length : 0;
        }
        return null;
      }
      case "call": {
        const f = this.eval(n.fn, s, va);
        const args = n.args.map((a: Node) => this.eval(a, s, va));
        return this.invoke(f, args);
      }
      case "mcall": {
        const o = this.eval(n.obj, s, va);
        const m = o instanceof LuaTable ? o.get(n.m) : null;
        const args = n.args.map((a: Node) => this.eval(a, s, va));
        return this.invoke(typeof m === "function" ? m : null, [o, ...args]);
      }
    }
    throw new Error("Lua: bilinmeyen ifade " + n.k);
  }

  private invoke(f: LuaVal, args: LuaVal[]): LuaVal {
    if (typeof f !== "function") return null;
    return f(...args);
  }
}

function truthy(v: LuaVal): boolean { return !(v === null || v === false); }
function num(v: LuaVal): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
  return 0;
}
function eq(a: LuaVal, b: LuaVal): boolean {
  if (a instanceof LuaTable || b instanceof LuaTable) return a === b;
  return a === b || (a === null && b === null);
}
