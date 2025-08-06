function unclickable() {
  const unclickableDiv = globalThis["document"].querySelector("#unclickable");
  unclickableDiv.style.display = "block";
  unclickableDiv.style.visibility = "visible";
  unclickableDiv.style.backgroundColor = "red";
  unclickableDiv.addEventListener("click", () => {
    unclickableDiv.style.display = "none";
    unclickableDiv.style.visibility = "hidden";
  });
}
function undocumented(ns) {
  ns.exploit();
}
function rainbow(ns) {
  ns.rainbow("noodles");
}
function bypass(ns) {
  ns.bypass(globalThis["document"]);
}
function alterReality() {
}
function prototypeTampering() {
  const originalFunction = Number.prototype.toExponential;
  Number.prototype.toExponential = function(fractionDigits) {
    return originalFunction.apply(this, [fractionDigits]) + " ";
  };
}
function timeCompression() {
  const originalFunction = globalThis["window"].setTimeout;
  globalThis["window"].setTimeout = function(handler, timeout, ...args) {
    if (timeout === 15e3) {
      timeout = 250;
    }
    return originalFunction.apply(this, [handler, timeout, ...args]);
  };
}
function trueRecursion() {
}
function main(ns) {
  unclickable();
  undocumented(ns);
  rainbow(ns);
  bypass(ns);
  prototypeTampering();
  timeCompression();
}
export {
  alterReality,
  main
};
