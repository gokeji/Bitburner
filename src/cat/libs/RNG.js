class RNG0 {
  x;
  m = 1024;
  a = 341;
  c = 1;
  constructor() {
    this.x = 0;
    this.reset();
  }
  step() {
    this.x = (this.a * this.x + this.c) % this.m;
  }
  random() {
    this.step();
    return this.x / this.m;
  }
  reset() {
    this.x = (/* @__PURE__ */ new Date()).getTime() % this.m;
  }
}
const BadRNG = new RNG0();
class WHRNG {
  s1 = 0;
  s2 = 0;
  s3 = 0;
  constructor(totalPlaytime) {
    const v = totalPlaytime / 1e3 % 3e4;
    this.s1 = v;
    this.s2 = v;
    this.s3 = v;
  }
  step() {
    this.s1 = 171 * this.s1 % 30269;
    this.s2 = 172 * this.s2 % 30307;
    this.s3 = 170 * this.s3 % 30323;
  }
  random() {
    this.step();
    return (this.s1 / 30269 + this.s2 / 30307 + this.s3 / 30323) % 1;
  }
}
function SFC32RNG(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  const genSeed = () => {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  let a = genSeed();
  let b = genSeed();
  let c = genSeed();
  let d = genSeed();
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = a + b | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = c << 21 | c >>> 11;
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}
export {
  BadRNG,
  SFC32RNG,
  WHRNG
};
