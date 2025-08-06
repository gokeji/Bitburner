function autocomplete(data, flags) {
  return ["--divisionName", "Agriculture"];
}
var CityName = /* @__PURE__ */ ((CityName2) => {
  CityName2["Aevum"] = "Aevum";
  CityName2["Chongqing"] = "Chongqing";
  CityName2["Sector12"] = "Sector-12";
  CityName2["NewTokyo"] = "New Tokyo";
  CityName2["Ishima"] = "Ishima";
  CityName2["Volhaven"] = "Volhaven";
  return CityName2;
})(CityName || {});
const cities = [
  "Sector-12" /* Sector12 */,
  "Aevum" /* Aevum */,
  "Chongqing" /* Chongqing */,
  "New Tokyo" /* NewTokyo */,
  "Ishima" /* Ishima */,
  "Volhaven" /* Volhaven */
];
const defaultConfig = [
  ["divisionName", "Agriculture"]
];
async function stockMaterials(ns, divisionName, cities2, materials) {
  while (true) {
    let finish = true;
    for (const city of cities2) {
      for (const material of materials) {
        const storedAmount = ns.corporation.getMaterial(divisionName, city, material.name).stored;
        if (storedAmount === material.amount) {
          ns.corporation.buyMaterial(divisionName, city, material.name, 0);
          ns.corporation.sellMaterial(divisionName, city, material.name, "0", "MP");
          continue;
        }
        if (storedAmount < material.amount) {
          ns.corporation.buyMaterial(divisionName, city, material.name, (material.amount - storedAmount) / 10);
          ns.corporation.sellMaterial(divisionName, city, material.name, "0", "MP");
          finish = false;
        }
      }
    }
    if (finish) {
      break;
    }
    await ns.corporation.nextUpdate();
  }
}
async function main(ns) {
  const config = ns.flags(defaultConfig);
  const divisionName = config.divisionName;
  const option = {
    aiCores: 2114,
    hardware: 2404,
    realEstate: 124960,
    robots: 23
  };
  for (const city of cities) {
    ns.corporation.sellMaterial(divisionName, city, "Plants", "MAX", "MP");
    ns.corporation.sellMaterial(divisionName, city, "Food", "MAX", "MP");
  }
  await stockMaterials(ns, divisionName, cities, [
    { name: "AI Cores", amount: option.aiCores },
    { name: "Hardware", amount: option.hardware },
    { name: "Real Estate", amount: option.realEstate },
    { name: "Robots", amount: option.robots }
  ]);
}
export {
  autocomplete,
  main
};
