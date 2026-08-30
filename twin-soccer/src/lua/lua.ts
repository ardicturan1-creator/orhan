/* ============================================================
 *  BYMEL SOCCER — Mini Lua 5.x yorumlayıcısı (Lua alt kümesi)
 *  Oyunun taktik / ekonomi / simülasyon yapay zekâsı Lua
 *  script'leri ile çalışır (src/lua/scripts.ts).
 * ============================================================ */

export class LuaTable {
  m = new Map<string | number, any>();
  get(k: any): any {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  set(k: any, v: any) {
    if (v === null || v === undefined) this.m.delete(k);
    else this.m.set(k, v);
  }
  length(): number {
    let n = 0;
    while (this.m.has(n + 1)) n++;
    return n;
  }
  entries(): [any, any][] {
    return [...this.m.entries()];
  }
}

export function luaToJS(v: any): any {
  if (v instanceof LuaTable) {
    const out: any = {};
    const len = v.length();
    const isArr = len > 0 && v.m.size === len;
    if (isArr) {
      const arr: any[] = [];
      for (let i = 1; i <= len; i++) arr.push(luaToJS(v.get(i)));
      return arr;
    }
    for (const [k, val] of v.m) out[String(k)] = luaToJS(val);
    return out;
  }
  return v === undefined ? null : v;
}

export function jsToLua(v: any): any {
  if (v === null || v === undefined) return null;
  if (v instanceof LuaTable) return v;
  if (Array.isArray(v)) {
    const t = new LuaTable();
    v.forEach((x, i) => t.set(i + 1, jsToLua(x)));
    return t;
  }
  if (typeof v === "object") {
    const t = new LuaTable();
    for (const k of Object.keys(v)) t.set(k, jsToLua(v[k]));
    return t;
  }
  return v;
}

class Env {
  vars = new Map<string, any>();
  constructor(public parent: Env | null) {}
  get(n: string): any {
    let e: Env | null = this;
    while (e) {
      if (e.vars.has(n)) return e.vars.get(n);
      e = e.parent;
    }
    return null;
  }
  setExisting(n: string, v: any): boolean {
    let e: Env | null = this;
    while (e) {
      if (e.vars.has(n)) {
        e.vars.set(n, v);
        return true;
      }
      e = e.parent;
    }
    return false;
  }
  declare(n: string, v: any) {
    this.vars.set(n, v);
  }
}

interface Closure {
  __fn: true;
  params: string[];
  body: any[];
  env: Env;
}
interface Builtin {
  __bi: true;
  name: string;
  fn: (a: any[]) => any;
}
type Callable = Closure | Builtin;
const isCallable = (v: any): v is Callable => !!v && (v.__fn === true || v.__bi === true);

/* ------------------------------- LEXER ------------------------------- */
const KW = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in",
  "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while",
]);

interface Tok {
  t: "num" | "str" | "name" | "kw" | "op";
  v: string;
  n?: number;
}

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const ops = [
    "...", "..", "==", "~=", "<=", ">=", "+", "-", "*", "/", "%", "#", "<", ">", "=", "(",
    ")", "{", "}", "[", "]", ";", ":", ",", ".",
  ];
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      i++;
      continue;
    }
    if (c === "-" && src[i + 1] === "-") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      let s = "";
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") {
          const nx = src[i + 1];
          if (nx === "n") s += "\n";
          else if (nx === "t") s += "\t";
          else if (nx === '"') s += '"';
          else if (nx === "'") s += "'";
          else if (nx === "\\") s += "\\";
          else s += nx;
          i += 2;
        } else s += src[i++];
      }
      i++;
      out.push({ t: "str", v: s });
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
      let s = "";
      while (i < src.length && /[0-9.eE]/.test(src[i])) {
        if ((src[i] === "e" || src[i] === "E") && !/[0-9+\-]/.test(src[i + 1] || "")) break;
        if (src[i] === "." && s.includes(".")) break;
        s += src[i++];
        if ((s.endsWith("e") || s.endsWith("E")) && (src[i] === "+" || src[i] === "-")) s += src[i++];
      }
      out.push({ t: "num", v: s, n: parseFloat(s) });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let s = "";
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) s += src[i++];
      out.push({ t: KW.has(s) ? "kw" : "name", v: s });
      continue;
    }
    const op = ops.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ t: "op", v: op });
      i += op.length;
      continue;
    }
    throw new Error("Lua lexer: bilinmeyen karakter '" + c + "'");
  }
  return out;
}

/* ------------------------------- PARSER ------------------------------- */
class Parser {
  p = 0;
  constructor(private toks: Tok[]) {}
  peek(k = 0) {
    return this.toks[this.p + k];
  }
  next() {
    return this.toks[this.p++];
  }
  isOp(v: string) {
    const t = this.peek();
    return t && t.t === "op" && t.v === v;
  }
  isKw(v: string) {
    const t = this.peek();
    return t && t.t === "kw" && t.v === v;
  }
  eatOp(v: string) {
    if (!this.isOp(v)) throw new Error("Lua parse: '" + v + "' bekleniyordu, gelen '" + (this.peek()?.v ?? "son") + "'");
    return this.next();
  }
  eatKw(v: string) {
    if (!this.isKw(v)) throw new Error("Lua parse: '" + v + "' bekleniyordu");
    return this.next();
  }
  name() {
    const t = this.next();
    if (!t || t.t !== "name") throw new Error("Lua parse: isim bekleniyordu");
    return t.v;
  }

  chunk(): any[] {
    const stmts: any[] = [];
    while (this.p < this.toks.length && !this.isKw("end") && !this.isKw("else") && !this.isKw("elseif") && !this.isKw("until")) {
      stmts.push(this.statement());
    }
    return stmts;
  }

  block(): any[] {
    this.eatKw("do");
    const s = this.chunk();
    this.eatKw("end");
    return s;
  }

  statement(): any {
    const t = this.peek();
    if (t.t === "op" && t.v === ";") {
      this.next();
      return { k: "nop" };
    }
    if (t.t === "kw") {
      switch (t.v) {
        case "local": {
          this.next();
          if (this.isKw("function")) {
            this.next();
            const nm = this.name();
            const fn = this.funcBody();
            return { k: "localfunc", name: nm, fn };
          }
          const names = [this.name()];
          while (this.isOp(",")) {
            this.next();
            names.push(this.name());
          }
          let exprs: any[] = [];
          if (this.isOp("=")) {
            this.next();
            exprs = this.exprList();
          }
          return { k: "local", names, exprs };
        }
        case "if": {
          this.next();
          const cond = this.expr();
          this.eatKw("then");
          const thenB = this.chunk();
          const clauses: any[] = [];
          while (this.isKw("elseif")) {
            this.next();
            const c2 = this.expr();
            this.eatKw("then");
            clauses.push({ cond: c2, body: this.chunk() });
          }
          let elseB: any[] | null = null;
          if (this.isKw("else")) {
            this.next();
            elseB = this.chunk();
          }
          this.eatKw("end");
          return { k: "if", cond, thenB, clauses, elseB };
        }
        case "while": {
          this.next();
          const cond = this.expr();
          this.eatKw("do");
          const body = this.chunk();
          this.eatKw("end");
          return { k: "while", cond, body };
        }
        case "repeat": {
          this.next();
          const body = this.chunk();
          this.eatKw("until");
          const cond = this.expr();
          return { k: "repeat", body, cond };
        }
        case "for": {
          this.next();
          const n1 = this.name();
          if (this.isOp("=")) {
            this.next();
            const a = this.expr();
            this.eatOp(",");
            const b = this.expr();
            let c: any = null;
            if (this.isOp(",")) {
              this.next();
              c = this.expr();
            }
            this.eatKw("do");
            const body = this.chunk();
            this.eatKw("end");
            return { k: "fornum", name: n1, a, b, c, body };
          }
          this.eatKw("in");
          const exprs = this.exprList();
          this.eatKw("do");
          const body = this.chunk();
          this.eatKw("end");
          return { k: "forin", names: [n1, ...(this.isOp(",") ? [this.next(), this.name()] : [])], exprs, body };
        }
        case "function": {
          this.next();
          // function a.b.c:d() ... end
          let target: any = { k: "var", name: this.name() };
          let fname = target.name;
          while (this.isOp(".") || this.isOp(":")) {
            const isColon = this.isOp(":");
            this.next();
            const nm = this.name();
            target = { k: "index", obj: target, key: { k: "str", v: nm }, colon: isColon };
            fname = nm;
          }
          const fn = this.funcBody();
          return { k: "assign", targets: [target], exprs: [{ k: "closure", fn, name: fname }] };
        }
        case "return": {
          this.next();
          let exprs: any[] = [];
          if (!this.isKw("end") && !this.isOp(";") && this.p < this.toks.length) exprs = this.exprList();
          if (this.isOp(";")) this.next();
          return { k: "return", exprs };
        }
        case "break":
          this.next();
          return { k: "break" };
        case "do":
          return { k: "block", body: this.block() };
      }
    }
    // ifade / atama
    const exprs = this.exprList();
    if (this.isOp("=")) {
      this.next();
      const vals = this.exprList();
      return { k: "assign", targets: exprs, exprs: vals };
    }
    if (this.isOp(",") || this.isKw("then") || this.isKw("do")) {
      // çoklu ifade ifadesi — sadece ilki kullanılır
      return { k: "exprstat", e: exprs[0] };
    }
    return { k: "exprstat", e: exprs[0] };
  }

  funcBody(): any {
    this.eatOp("(");
    const params: string[] = [];
    while (!this.isOp(")")) {
      params.push(this.name());
      if (this.isOp(",")) this.next();
    }
    this.eatOp(")");
    const body = this.chunk();
    this.eatKw("end");
    return { params, body };
  }

  exprList(): any[] {
    const list = [this.expr()];
    while (this.isOp(",")) {
      this.next();
      list.push(this.expr());
    }
    return list;
  }

  expr(): any {
    return this.orExpr();
  }
  orExpr(): any {
    let l = this.andExpr();
    while (this.isKw("or")) {
      this.next();
      l = { k: "bin", op: "or", l, r: this.andExpr() };
    }
    return l;
  }
  andExpr(): any {
    let l = this.cmpExpr();
    while (this.isKw("and")) {
      this.next();
      l = { k: "bin", op: "and", l, r: this.cmpExpr() };
    }
    return l;
  }
  cmpExpr(): any {
    let l = this.concatExpr();
    const t = this.peek();
    if (t && t.t === "op" && ["==", "~=", "<", ">", "<=", ">="].includes(t.v)) {
      this.next();
      l = { k: "bin", op: t.v, l, r: this.concatExpr() };
    }
    return l;
  }
  concatExpr(): any {
    let l = this.addExpr();
    while (this.isOp("..")) {
      this.next();
      l = { k: "bin", op: "..", l, r: this.addExpr() };
    }
    return l;
  }
  addExpr(): any {
    let l = this.mulExpr();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().v;
      l = { k: "bin", op, l, r: this.mulExpr() };
    }
    return l;
  }
  mulExpr(): any {
    let l = this.unary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
      const op = this.next().v;
      l = { k: "bin", op, l, r: this.unary() };
    }
    return l;
  }
  unary(): any {
    if (this.isOp("-")) {
      this.next();
      return { k: "un", op: "-", e: this.unary() };
    }
    if (this.isKw("not")) {
      this.next();
      return { k: "un", op: "not", e: this.unary() };
    }
    if (this.isOp("#")) {
      this.next();
      return { k: "un", op: "#", e: this.unary() };
    }
    return this.postfix();
  }
  postfix(): any {
    let e = this.primary();
    for (;;) {
      if (this.isOp(".")) {
        this.next();
        e = { k: "index", obj: e, key: { k: "str", v: this.name() } };
      } else if (this.isOp("[")) {
        this.next();
        const key = this.expr();
        this.eatOp("]");
        e = { k: "index", obj: e, key };
      } else if (this.isOp("(")) {
        const args = this.callArgs();
        e = { k: "call", fn: e, args };
      } else if (this.isOp(":")) {
        this.next();
        const nm = this.name();
        const args = this.callArgs();
        e = { k: "mcall", obj: e, name: nm, args };
      } else break;
    }
    return e;
  }
  callArgs(): any[] {
    this.eatOp("(");
    const args: any[] = [];
    while (!this.isOp(")")) {
      args.push(this.expr());
      if (this.isOp(",")) this.next();
    }
    this.eatOp(")");
    return args;
  }
  primary(): any {
    const t = this.peek();
    if (t.t === "num") {
      this.next();
      return { k: "num", v: t.n! };
    }
    if (t.t === "str") {
      this.next();
      return { k: "str", v: t.v };
    }
    if (t.t === "kw") {
      if (t.v === "true") {
        this.next();
        return { k: "true" };
      }
      if (t.v === "false") {
        this.next();
        return { k: "false" };
      }
      if (t.v === "nil") {
        this.next();
        return { k: "nil" };
      }
      if (t.v === "function") {
        this.next();
        return { k: "closure", fn: this.funcBody(), name: null };
      }
    }
    if (t.t === "name") {
      this.next();
      return { k: "var", name: t.v };
    }
    if (t.t === "op" && t.v === "(") {
      this.next();
      const e = this.expr();
      this.eatOp(")");
      return e;
    }
    if (t.t === "op" && t.v === "{") return this.tableCons();
    throw new Error("Lua parse: beklenmeyen token '" + t.v + "'");
  }
  tableCons(): any {
    this.eatOp("{");
    const items: any[] = [];
    while (!this.isOp("}")) {
      if (this.isOp("[")) {
        this.next();
        const key = this.expr();
        this.eatOp("]");
        this.eatOp("=");
        items.push({ key, val: this.expr() });
      } else if (this.peek().t === "name" && this.peek(1).t === "op" && this.peek(1).v === "=") {
        const nm = this.name();
        this.eatOp("=");
        items.push({ key: { k: "str", v: nm }, val: this.expr() });
      } else {
        items.push({ key: null, val: this.expr() });
      }
      if (this.isOp(",") || this.isOp(";")) this.next();
    }
    this.eatOp("}");
    return { k: "table", items };
  }
}

/* ------------------------------- RUNTIME ------------------------------- */
const truthy = (v: any) => !(v === null || v === undefined || v === false);

function toStr(v: any): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  if (v instanceof LuaTable) return "table";
  if (isCallable(v)) return "function";
  return String(v);
}
function tonum(v: any): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}

export class LuaRuntime {
  globals = new Env(null);
  private seed = 20260101;

  constructor() {
    this.installStd();
  }

  private installStd() {
    const g = this.globals;
    const bi = (name: string, fn: (a: any[]) => any) => g.declare(name, { __bi: true, name, fn } as Builtin);

    bi("print", () => null);
    bi("tostring", (a) => toStr(a[0]));
    bi("tonumber", (a) => tonum(a[0]));
    bi("type", (a) => {
      const v = a[0];
      if (v === null) return "nil";
      if (typeof v === "boolean") return "boolean";
      if (typeof v === "number") return "number";
      if (typeof v === "string") return "string";
      if (v instanceof LuaTable) return "table";
      return "function";
    });
    bi("pairs", (a) => ({ __iter: "pairs", table: a[0] }));
    bi("ipairs", (a) => ({ __iter: "ipairs", table: a[0] }));
    bi("assert", (a) => {
      if (!truthy(a[0])) throw new Error("Lua assert: " + toStr(a[1]));
      return a[0];
    });

    const math = new LuaTable();
    const mset = (n: string, f: (x: number[]) => any) => math.set(n, { __bi: true, name: "math." + n, fn: (a) => f(a.map((_, i) => tonum(a[i]) ?? 0)) } as Builtin);
    mset("floor", (x) => Math.floor(x[0]));
    mset("ceil", (x) => Math.ceil(x[0]));
    mset("abs", (x) => Math.abs(x[0]));
    mset("sqrt", (x) => Math.sqrt(x[0]));
    mset("max", (x) => Math.max(...x));
    mset("min", (x) => Math.min(...x));
    mset("fmod", (x) => x[0] % x[1]);
    mset("sin", (x) => Math.sin(x[0]));
    mset("cos", (x) => Math.cos(x[0]));
    mset("exp", (x) => Math.exp(x[0]));
    mset("log", (x) => Math.log(x[0]));
    mset("pow", (x) => Math.pow(x[0], x[1]));
    math.set("pi", Math.PI);
    math.set("huge", Infinity);
    mset("random", (x) => {
      const r = this.rand();
      if (x.length === 0) return r;
      if (x.length === 1) return Math.floor(r * x[0]) + 1;
      return Math.floor(r * (x[1] - x[0] + 1)) + x[0];
    });
    mset("randomseed", (x) => {
      this.seed = Math.floor(x[0]) || 1;
      return null;
    });
    g.declare("math", math);

    const str = new LuaTable();
    const sset = (n: string, f: (a: any[]) => any) => str.set(n, { __bi: true, name: "string." + n, fn: f } as Builtin);
    sset("format", (a) => {
      let f = toStr(a[0]);
      let ai = 1;
      f = f.replace(/%%/g, "\u0000");
      f = f.replace(/%[-+ #0]*\d*(?:\.\d+)?[difsxX]/g, (m) => {
        const spec = m[m.length - 1];
        const num = tonum(a[ai]) ?? 0;
        const val = spec === "d" || spec === "i" ? String(Math.round(num)) : spec === "f" ? num.toFixed((m.split(".")[1] || "6").replace(/[^0-9]/g, "").length || 6) : spec === "x" ? Math.round(num).toString(16) : toStr(a[ai]);
        ai++;
        const w = /^%[-+ #0]*(\d+)/.exec(m);
        let out = val;
        if (w) {
          const width = parseInt(w[1], 10);
          out = m.includes("-") ? out.padEnd(width) : out.padStart(width, m.includes("0") ? "0" : " ");
        }
        return out;
      });
      return f.replace(/\u0000/g, "%");
    });
    sset("sub", (a) => {
      const s = toStr(a[0]);
      const i = tonum(a[1]) ?? 1;
      const j = tonum(a[2]) ?? -1;
      const from = i < 0 ? s.length + i + 1 : i;
      const to = j < 0 ? s.length + j + 1 : j;
      return s.slice(Math.max(0, from - 1), to);
    });
    sset("len", (a) => toStr(a[0]).length);
    sset("upper", (a) => toStr(a[0]).toUpperCase());
    sset("lower", (a) => toStr(a[0]).toLowerCase());
    sset("rep", (a) => toStr(a[0]).repeat(Math.max(0, tonum(a[1]) ?? 1)));
    // basit desen desteği: %s %d %a %% ve düz metin
    sset("gsub", (a) => {
      const s = toStr(a[0]);
      const pat = toStr(a[1]);
      const rep = toStr(a[2]);
      const rx = new RegExp(
        pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%s/g, "[\\s\\S]+?").replace(/%d/g, "\\d+").replace(/%%/g, "%"),
        "g"
      );
      return s.replace(rx, rep);
    });
    sset("gmatch", () => null);
    g.declare("string", str);

    const tab = new LuaTable();
    const tset = (n: string, f: (a: any[]) => any) => tab.set(n, { __bi: true, name: "table." + n, fn: f } as Builtin);
    tset("insert", (a) => {
      const t = a[0] as LuaTable;
      if (!(t instanceof LuaTable)) return null;
      if (a.length >= 3) {
        const pos = tonum(a[1]) ?? t.length() + 1;
        const len = t.length();
        for (let i = len; i >= pos; i--) t.set(i + 1, t.get(i));
        t.set(pos, a[2]);
      } else t.set(t.length() + 1, a[1]);
      return null;
    });
    tset("remove", (a) => {
      const t = a[0] as LuaTable;
      if (!(t instanceof LuaTable)) return null;
      const pos = tonum(a[1]) ?? t.length();
      const v = t.get(pos);
      for (let i = pos; i < t.length(); i++) t.set(i, t.get(i + 1));
      t.set(t.length(), null);
      return v;
    });
    tset("concat", (a) => {
      const t = a[0] as LuaTable;
      const sep = a.length > 1 ? toStr(a[1]) : "";
      const out: string[] = [];
      for (let i = 1; i <= t.length(); i++) out.push(toStr(t.get(i)));
      return out.join(sep);
    });
    g.declare("table", tab);
  }

  private rand(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return (this.seed % 100000) / 100000;
  }
  setRandomSeed(s: number) {
    this.seed = Math.max(1, Math.floor(s) || 1);
  }

  run(src: string) {
    const ast = new Parser(lex(src)).chunk();
    const env = new Env(this.globals);
    this.exec(ast, env);
  }

  call(name: string, ...args: any[]): any {
    const f = this.globals.get(name);
    if (!isCallable(f)) throw new Error("Lua fonksiyonu bulunamadı: " + name);
    return luaToJS(this.callValue(f, args.map(jsToLua)));
  }

  private callValue(f: any, args: any[]): any {
    if (f.__bi) return f.fn(args);
    const env = new Env(f.env);
    f.params.forEach((p: string, i: number) => env.declare(p, args[i] ?? null));
    const sig = this.exec(f.body, env);
    if (sig && sig.type === "return") return sig.v;
    return null;
  }

  private eval(node: any, env: Env): any {
    switch (node.k) {
      case "num": return node.v;
      case "str": return node.v;
      case "true": return true;
      case "false": return false;
      case "nil": return null;
      case "var": return env.get(node.name);
      case "closure": return { __fn: true, params: node.fn.params, body: node.fn.body, env } as Closure;
      case "table": {
        const t = new LuaTable();
        let idx = 1;
        for (const it of node.items) {
          if (it.key) t.set(this.eval(it.key, env), this.eval(it.val, env));
          else t.set(idx++, this.eval(it.val, env));
        }
        return t;
      }
      case "index": {
        const obj = this.eval(node.obj, env);
        const key = this.eval(node.key, env);
        if (obj instanceof LuaTable) return obj.get(key);
        if (typeof obj === "string") {
          const st = this.globals.get("string") as LuaTable;
          return st.get(key);
        }
        return null;
      }
      case "call": {
        const f = this.eval(node.fn, env);
        if (!isCallable(f)) throw new Error("Lua: çağrılabilir olmayan değer (" + toStr(node.fn.name ?? "?") + ")");
        const args = node.args.map((a: any) => this.eval(a, env));
        return this.callValue(f, args);
      }
      case "mcall": {
        const obj = this.eval(node.obj, env);
        const f =
          obj instanceof LuaTable
            ? obj.get(node.name)
            : typeof obj === "string"
              ? (this.globals.get("string") as LuaTable).get(node.name)
              : null;
        const args = node.args.map((a: any) => this.eval(a, env));
        if (!isCallable(f)) return null;
        return this.callValue(f, [obj, ...args]);
      }
      case "un": {
        if (node.op === "-") return -(tonum(this.eval(node.e, env)) ?? 0);
        if (node.op === "not") return !truthy(this.eval(node.e, env));
        const v = this.eval(node.e, env);
        if (v instanceof LuaTable) return v.length();
        if (typeof v === "string") return v.length;
        return 0;
      }
      case "bin": {
        if (node.op === "and") {
          const l = this.eval(node.l, env);
          return truthy(l) ? this.eval(node.r, env) : l;
        }
        if (node.op === "or") {
          const l = this.eval(node.l, env);
          return truthy(l) ? l : this.eval(node.r, env);
        }
        const l = this.eval(node.l, env);
        const r = this.eval(node.r, env);
        switch (node.op) {
          case "..": return toStr(l) + toStr(r);
          case "+": return (tonum(l) ?? 0) + (tonum(r) ?? 0);
          case "-": return (tonum(l) ?? 0) - (tonum(r) ?? 0);
          case "*": return (tonum(l) ?? 0) * (tonum(r) ?? 0);
          case "/": {
            const d = tonum(r) ?? 0;
            return d === 0 ? Infinity : (tonum(l) ?? 0) / d;
          }
          case "%": {
            const a = tonum(l) ?? 0;
            const b = tonum(r) ?? 0;
            return b === 0 ? Infinity : ((a % b) + b) % b;
          }
          case "==": return this.eq(l, r);
          case "~=": return !this.eq(l, r);
          case "<": return this.cmp(l, r) < 0;
          case ">": return this.cmp(l, r) > 0;
          case "<=": return this.cmp(l, r) <= 0;
          case ">=": return this.cmp(l, r) >= 0;
        }
        return null;
      }
    }
    throw new Error("Lua eval: bilinmeyen düğüm " + node.k);
  }

  private eq(l: any, r: any): boolean {
    if (l instanceof LuaTable && r instanceof LuaTable) return l === r;
    return l === r || (l === null && r === undefined) || (l === undefined && r === null);
  }
  private cmp(l: any, r: any): number {
    if (typeof l === "string" || typeof r === "string") return String(l).localeCompare(String(r));
    return (tonum(l) ?? 0) - (tonum(r) ?? 0);
  }

  private exec(stmts: any[], env: Env): { type: string; v?: any } | null {
    for (const s of stmts) {
      const r = this.exec1(s, env);
      if (r) return r;
    }
    return null;
  }

  private exec1(s: any, env: Env): { type: string; v?: any } | null {
    switch (s.k) {
      case "nop": return null;
      case "block": return this.exec(s.body, new Env(env));
      case "local": {
        const vals = s.exprs.map((e: any) => this.eval(e, env));
        s.names.forEach((n: string, i: number) => env.declare(n, vals[i] ?? null));
        return null;
      }
      case "localfunc": {
        env.declare(s.name, { __fn: true, params: s.fn.params, body: s.fn.body, env } as Closure);
        return null;
      }
      case "assign": {
        const vals = s.exprs.map((e: any) => this.eval(e, env));
        s.targets.forEach((t: any, i: number) => {
          const v = vals[i] ?? null;
          if (t.k === "var") {
            if (!env.setExisting(t.name, v)) this.globals.declare(t.name, v);
          } else if (t.k === "index") {
            const obj = this.eval(t.obj, env);
            if (obj instanceof LuaTable) obj.set(this.eval(t.key, env), v);
          }
        });
        return null;
      }
      case "exprstat": {
        this.eval(s.e, env);
        return null;
      }
      case "if": {
        if (truthy(this.eval(s.cond, env))) return this.exec(s.thenB, env);
        for (const c of s.clauses) {
          if (truthy(this.eval(c.cond, env))) return this.exec(c.body, env);
        }
        if (s.elseB) return this.exec(s.elseB, env);
        return null;
      }
      case "while": {
        let guard = 0;
        while (truthy(this.eval(s.cond, env))) {
          if (++guard > 200000) throw new Error("Lua: sonsuz döngü");
          const r = this.exec(s.body, env);
          if (r) {
            if (r.type === "break") break;
            return r;
          }
        }
        return null;
      }
      case "repeat": {
        for (;;) {
          const r = this.exec(s.body, env);
          if (r) {
            if (r.type === "break") break;
            return r;
          }
          if (truthy(this.eval(s.cond, env))) break;
        }
        return null;
      }
      case "fornum": {
        let a = tonum(this.eval(s.a, env)) ?? 0;
        const b = tonum(this.eval(s.b, env)) ?? 0;
        const step = s.c ? (tonum(this.eval(s.c, env)) ?? 1) : 1;
        if (step === 0) throw new Error("Lua: adım 0");
        for (let i = a; step > 0 ? i <= b : i >= b; i += step) {
          const e2 = new Env(env);
          e2.declare(s.name, i);
          const r = this.exec(s.body, e2);
          if (r) {
            if (r.type === "break") break;
            return r;
          }
        }
        return null;
      }
      case "forin": {
        const vals = s.exprs.map((e: any) => this.eval(e, env));
        const it = vals[0];
        if (it && it.__iter === "pairs") {
          const t = it.table as LuaTable;
          for (const [k, v] of [...t.m.entries()]) {
            const e2 = new Env(env);
            e2.declare(s.names[0], k);
            if (s.names[1]) e2.declare(s.names[1], v);
            const r = this.exec(s.body, e2);
            if (r) {
              if (r.type === "break") break;
              return r;
            }
          }
        } else if (it && it.__iter === "ipairs") {
          const t = it.table as LuaTable;
          const n = t.length();
          for (let i = 1; i <= n; i++) {
            const e2 = new Env(env);
            e2.declare(s.names[0], i);
            if (s.names[1]) e2.declare(s.names[1], t.get(i));
            const r = this.exec(s.body, e2);
            if (r) {
              if (r.type === "break") break;
              return r;
            }
          }
        }
        return null;
      }
      case "return":
        return { type: "return", v: s.exprs.length ? this.eval(s.exprs[0], env) : null };
      case "break":
        return { type: "break" };
    }
    throw new Error("Lua exec: bilinmeyen düğüm " + s.k);
  }
}
