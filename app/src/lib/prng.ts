
/* deterministic pseudo-random so the demo data is identical on every load */
let _s = 20260911;
const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
const pick = (a: any) => a[Math.floor(rnd() * a.length)];
const pickN = (a: any, n: any) => { const c = [...a], o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; };
const intIn = (lo: any, hi: any) => lo + Math.floor(rnd() * (hi - lo + 1));
const initials = (n: any) => n.split(" ").map((x: any) => x[0]).join("").slice(0, 2).toUpperCase();

export { _s, rnd, pick, pickN, intIn, initials }


