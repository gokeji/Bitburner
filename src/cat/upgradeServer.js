import { PRIVATE_SERVER_NAME_PREFIX } from "./libs/constants";
import { NetscriptExtension } from "./libs/NetscriptExtension";
let nsx;
const defaultConfig = {
    reservedMoney: 1e6,
    limitPurchasableRAMBasedOnHomeServerRAM: false,
    useCustomMaxPurchasableRAM: true,
    customMaxPurchasableRAM: 8192,
};
let customConfig = null;
customConfig = {
    reservedMoney: 25e9,
    limitPurchasableRAMBasedOnHomeServerRAM: false,
    useCustomMaxPurchasableRAM: true,
    customMaxPurchasableRAM: 8192 * 128,
};
async function main(ns) {
    nsx = new NetscriptExtension(ns);
    nsx.killProcessesSpawnFromSameScript();
    const config = customConfig !== null ? customConfig : defaultConfig;
    ns.disableLog("ALL");
    const reservedMoney = config.reservedMoney;
    const limitPurchasableRAMBasedOnHomeServerRAM = config.limitPurchasableRAMBasedOnHomeServerRAM;
    let maxPurchasableRAM = ns.getPurchasedServerMaxRam();
    if (config.useCustomMaxPurchasableRAM) {
        maxPurchasableRAM = config.customMaxPurchasableRAM;
    }
    if (limitPurchasableRAMBasedOnHomeServerRAM) {
        maxPurchasableRAM = Math.min(maxPurchasableRAM, ns.getServerMaxRam("home"));
    }
    if (ns.getPurchasedServers().length === 0 && ns.getServerMoneyAvailable("home") < reservedMoney) {
        ns.tprint("Reserved money is set too high while we have not purchased any server");
        return;
    }
    const maxNumberOfPurchasedServer = ns.getPurchasedServerLimit();
    while (ns.getPurchasedServers().length < maxNumberOfPurchasedServer) {
        const availableMoney = ns.getServerMoneyAvailable("home") - reservedMoney;
        const ram = 2;
        if (availableMoney >= ns.getPurchasedServerCost(ram)) {
            const newServerHostname = ns.purchaseServer(
                `${PRIVATE_SERVER_NAME_PREFIX}${ns.getPurchasedServers().length}`,
                ram,
            );
            ns.print(
                `Purchase new server: ${newServerHostname !== "" ? `Success. New server's hostname: ${newServerHostname}` : "Fail"}`,
            );
        }
    }
    let ramTier = Number.MAX_SAFE_INTEGER;
    for (const hostname of ns.getPurchasedServers()) {
        ramTier = Math.min(ramTier, Math.log2(ns.getServerMaxRam(hostname)));
    }
    while (true) {
        ++ramTier;
        const newRAM = 2 ** ramTier;
        if (newRAM > maxPurchasableRAM) {
            ns.tprint("All servers have been upgraded");
            break;
        }
        for (const hostname of ns.getPurchasedServers()) {
            if (ns.getServerMaxRam(hostname) >= newRAM) {
                continue;
            }
            while (true) {
                const availableMoney = ns.getServerMoneyAvailable("home") - reservedMoney;
                const upgradeCost = ns.getPurchasedServerUpgradeCost(hostname, newRAM);
                if (availableMoney >= upgradeCost) {
                    ns.print(
                        `Upgrade server ${hostname} with new RAM ${ns.formatRam(newRAM)}. Cost: ${ns.formatNumber(upgradeCost)}. Result: ${ns.upgradePurchasedServer(hostname, newRAM) ? "Success" : "Fail"}`,
                    );
                    break;
                }
                await ns.sleep(1e3);
            }
        }
        await ns.sleep(1e3);
    }
}
export { main };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3VwZ3JhZGVTZXJ2ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7TlN9IGZyb20gXCJAbnNcIjtcbmltcG9ydCB7UFJJVkFURV9TRVJWRVJfTkFNRV9QUkVGSVh9IGZyb20gXCIvbGlicy9jb25zdGFudHNcIjtcbmltcG9ydCB7TmV0c2NyaXB0RXh0ZW5zaW9ufSBmcm9tIFwiL2xpYnMvTmV0c2NyaXB0RXh0ZW5zaW9uXCI7XG5cbmludGVyZmFjZSBDb25maWcge1xuICAgIHJlc2VydmVkTW9uZXk6IG51bWJlcjtcbiAgICBsaW1pdFB1cmNoYXNhYmxlUkFNQmFzZWRPbkhvbWVTZXJ2ZXJSQU06IGJvb2xlYW47XG4gICAgdXNlQ3VzdG9tTWF4UHVyY2hhc2FibGVSQU06IGJvb2xlYW47XG4gICAgY3VzdG9tTWF4UHVyY2hhc2FibGVSQU06IG51bWJlcjtcbn1cblxubGV0IG5zeDogTmV0c2NyaXB0RXh0ZW5zaW9uO1xuXG5jb25zdCBkZWZhdWx0Q29uZmlnOiBDb25maWcgPSB7XG4gICAgcmVzZXJ2ZWRNb25leTogMWU2LFxuICAgIGxpbWl0UHVyY2hhc2FibGVSQU1CYXNlZE9uSG9tZVNlcnZlclJBTTogZmFsc2UsXG4gICAgdXNlQ3VzdG9tTWF4UHVyY2hhc2FibGVSQU06IHRydWUsXG4gICAgY3VzdG9tTWF4UHVyY2hhc2FibGVSQU06IDgxOTJcbn07XG5cbmxldCBjdXN0b21Db25maWc6IENvbmZpZyB8IG51bGwgPSBudWxsO1xuY3VzdG9tQ29uZmlnID0gPENvbmZpZz57XG4gICAgcmVzZXJ2ZWRNb25leTogMjVlOSxcbiAgICBsaW1pdFB1cmNoYXNhYmxlUkFNQmFzZWRPbkhvbWVTZXJ2ZXJSQU06IGZhbHNlLFxuICAgIHVzZUN1c3RvbU1heFB1cmNoYXNhYmxlUkFNOiB0cnVlLFxuICAgIGN1c3RvbU1heFB1cmNoYXNhYmxlUkFNOiA4MTkyICogMTI4XG59O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbihuczogTlMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBuc3ggPSBuZXcgTmV0c2NyaXB0RXh0ZW5zaW9uKG5zKTtcbiAgICBuc3gua2lsbFByb2Nlc3Nlc1NwYXduRnJvbVNhbWVTY3JpcHQoKTtcblxuICAgIGNvbnN0IGNvbmZpZyA9IChjdXN0b21Db25maWcgIT09IG51bGwpID8gY3VzdG9tQ29uZmlnIDogZGVmYXVsdENvbmZpZztcblxuICAgIG5zLmRpc2FibGVMb2coXCJBTExcIik7XG5cbiAgICBjb25zdCByZXNlcnZlZE1vbmV5ID0gY29uZmlnLnJlc2VydmVkTW9uZXk7XG4gICAgY29uc3QgbGltaXRQdXJjaGFzYWJsZVJBTUJhc2VkT25Ib21lU2VydmVyUkFNID0gY29uZmlnLmxpbWl0UHVyY2hhc2FibGVSQU1CYXNlZE9uSG9tZVNlcnZlclJBTTtcbiAgICBsZXQgbWF4UHVyY2hhc2FibGVSQU0gPSBucy5nZXRQdXJjaGFzZWRTZXJ2ZXJNYXhSYW0oKTtcbiAgICBpZiAoY29uZmlnLnVzZUN1c3RvbU1heFB1cmNoYXNhYmxlUkFNKSB7XG4gICAgICAgIG1heFB1cmNoYXNhYmxlUkFNID0gY29uZmlnLmN1c3RvbU1heFB1cmNoYXNhYmxlUkFNO1xuICAgIH1cbiAgICBpZiAobGltaXRQdXJjaGFzYWJsZVJBTUJhc2VkT25Ib21lU2VydmVyUkFNKSB7XG4gICAgICAgIG1heFB1cmNoYXNhYmxlUkFNID0gTWF0aC5taW4obWF4UHVyY2hhc2FibGVSQU0sIG5zLmdldFNlcnZlck1heFJhbShcImhvbWVcIikpO1xuICAgIH1cblxuICAgIGlmIChucy5nZXRQdXJjaGFzZWRTZXJ2ZXJzKCkubGVuZ3RoID09PSAwXG4gICAgICAgICYmIG5zLmdldFNlcnZlck1vbmV5QXZhaWxhYmxlKFwiaG9tZVwiKSA8IHJlc2VydmVkTW9uZXkpIHtcbiAgICAgICAgbnMudHByaW50KFwiUmVzZXJ2ZWQgbW9uZXkgaXMgc2V0IHRvbyBoaWdoIHdoaWxlIHdlIGhhdmUgbm90IHB1cmNoYXNlZCBhbnkgc2VydmVyXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVHJ5IGJ1eWluZyB0byBsaW1pdCBudW1iZXIgb2Ygc2VydmVycyB3aXRoIDJHQiBSQU1cbiAgICBjb25zdCBtYXhOdW1iZXJPZlB1cmNoYXNlZFNlcnZlciA9IG5zLmdldFB1cmNoYXNlZFNlcnZlckxpbWl0KCk7XG4gICAgd2hpbGUgKG5zLmdldFB1cmNoYXNlZFNlcnZlcnMoKS5sZW5ndGggPCBtYXhOdW1iZXJPZlB1cmNoYXNlZFNlcnZlcikge1xuICAgICAgICBjb25zdCBhdmFpbGFibGVNb25leSA9IG5zLmdldFNlcnZlck1vbmV5QXZhaWxhYmxlKFwiaG9tZVwiKSAtIHJlc2VydmVkTW9uZXk7XG4gICAgICAgIGNvbnN0IHJhbSA9IDI7XG4gICAgICAgIGlmIChhdmFpbGFibGVNb25leSA+PSBucy5nZXRQdXJjaGFzZWRTZXJ2ZXJDb3N0KHJhbSkpIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld1NlcnZlckhvc3RuYW1lID0gbnMucHVyY2hhc2VTZXJ2ZXIoYCR7UFJJVkFURV9TRVJWRVJfTkFNRV9QUkVGSVh9JHtucy5nZXRQdXJjaGFzZWRTZXJ2ZXJzKCkubGVuZ3RofWAsIHJhbSk7XG4gICAgICAgICAgICBucy5wcmludChgUHVyY2hhc2UgbmV3IHNlcnZlcjogYFxuICAgICAgICAgICAgICAgICsgYCR7KG5ld1NlcnZlckhvc3RuYW1lICE9PSBcIlwiID8gYFN1Y2Nlc3MuIE5ldyBzZXJ2ZXIncyBob3N0bmFtZTogJHtuZXdTZXJ2ZXJIb3N0bmFtZX1gIDogXCJGYWlsXCIpfWBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBGaW5kIHN1aXRhYmxlIHRpZXJcbiAgICBsZXQgcmFtVGllciA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuICAgIGZvciAoY29uc3QgaG9zdG5hbWUgb2YgbnMuZ2V0UHVyY2hhc2VkU2VydmVycygpKSB7XG4gICAgICAgIHJhbVRpZXIgPSBNYXRoLm1pbihyYW1UaWVyLCBNYXRoLmxvZzIobnMuZ2V0U2VydmVyTWF4UmFtKGhvc3RuYW1lKSkpO1xuICAgIH1cblxuICAgIC8vIFRyeSB1cGdyYWRpbmcgcHVyY2hhc2VkIHNlcnZlcnNcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICArK3JhbVRpZXI7XG4gICAgICAgIGNvbnN0IG5ld1JBTSA9IDIgKiogcmFtVGllcjtcbiAgICAgICAgaWYgKG5ld1JBTSA+IG1heFB1cmNoYXNhYmxlUkFNKSB7XG4gICAgICAgICAgICBucy50cHJpbnQoXCJBbGwgc2VydmVycyBoYXZlIGJlZW4gdXBncmFkZWRcIik7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGhvc3RuYW1lIG9mIG5zLmdldFB1cmNoYXNlZFNlcnZlcnMoKSkge1xuICAgICAgICAgICAgLy8gVGhpcyBzZXJ2ZXIncyBSQU0gaXMgYmlnZ2VyIHRoYW4gdmFsdWUgb2YgY3VycmVudCB0aWVyXG4gICAgICAgICAgICBpZiAobnMuZ2V0U2VydmVyTWF4UmFtKGhvc3RuYW1lKSA+PSBuZXdSQU0pIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFRoaXMgc2VydmVyIG5lZWRzIHRvIGJlIHVwZ3JhZGVkLCBsb29wIHVudGlsIHdlIGhhdmUgZW5vdWdoIG1vbmV5XG4gICAgICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGF2YWlsYWJsZU1vbmV5ID0gbnMuZ2V0U2VydmVyTW9uZXlBdmFpbGFibGUoXCJob21lXCIpIC0gcmVzZXJ2ZWRNb25leTtcbiAgICAgICAgICAgICAgICBjb25zdCB1cGdyYWRlQ29zdCA9IG5zLmdldFB1cmNoYXNlZFNlcnZlclVwZ3JhZGVDb3N0KGhvc3RuYW1lLCBuZXdSQU0pO1xuICAgICAgICAgICAgICAgIGlmIChhdmFpbGFibGVNb25leSA+PSB1cGdyYWRlQ29zdCkge1xuICAgICAgICAgICAgICAgICAgICBucy5wcmludChgVXBncmFkZSBzZXJ2ZXIgJHtob3N0bmFtZX0gd2l0aCBuZXcgUkFNICR7bnMuZm9ybWF0UmFtKG5ld1JBTSl9YFxuICAgICAgICAgICAgICAgICAgICAgICAgKyBgLiBDb3N0OiAke25zLmZvcm1hdE51bWJlcih1cGdyYWRlQ29zdCl9YFxuICAgICAgICAgICAgICAgICAgICAgICAgKyBgLiBSZXN1bHQ6ICR7KG5zLnVwZ3JhZGVQdXJjaGFzZWRTZXJ2ZXIoaG9zdG5hbWUsIG5ld1JBTSkpID8gXCJTdWNjZXNzXCIgOiBcIkZhaWxcIn1gXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBhd2FpdCBucy5zbGVlcCgxMDAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBucy5zbGVlcCgxMDAwKTtcbiAgICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFDQSxTQUFRLGtDQUFpQztBQUN6QyxTQUFRLDBCQUF5QjtBQVNqQyxJQUFJO0FBRUosTUFBTSxnQkFBd0I7QUFBQSxFQUMxQixlQUFlO0FBQUEsRUFDZix5Q0FBeUM7QUFBQSxFQUN6Qyw0QkFBNEI7QUFBQSxFQUM1Qix5QkFBeUI7QUFDN0I7QUFFQSxJQUFJLGVBQThCO0FBQ2xDLGVBQXVCO0FBQUEsRUFDbkIsZUFBZTtBQUFBLEVBQ2YseUNBQXlDO0FBQUEsRUFDekMsNEJBQTRCO0FBQUEsRUFDNUIseUJBQXlCLE9BQU87QUFDcEM7QUFFQSxlQUFzQixLQUFLLElBQXVCO0FBQzlDLFFBQU0sSUFBSSxtQkFBbUIsRUFBRTtBQUMvQixNQUFJLGlDQUFpQztBQUVyQyxRQUFNLFNBQVUsaUJBQWlCLE9BQVEsZUFBZTtBQUV4RCxLQUFHLFdBQVcsS0FBSztBQUVuQixRQUFNLGdCQUFnQixPQUFPO0FBQzdCLFFBQU0sMENBQTBDLE9BQU87QUFDdkQsTUFBSSxvQkFBb0IsR0FBRyx5QkFBeUI7QUFDcEQsTUFBSSxPQUFPLDRCQUE0QjtBQUNuQyx3QkFBb0IsT0FBTztBQUFBLEVBQy9CO0FBQ0EsTUFBSSx5Q0FBeUM7QUFDekMsd0JBQW9CLEtBQUssSUFBSSxtQkFBbUIsR0FBRyxnQkFBZ0IsTUFBTSxDQUFDO0FBQUEsRUFDOUU7QUFFQSxNQUFJLEdBQUcsb0JBQW9CLEVBQUUsV0FBVyxLQUNqQyxHQUFHLHdCQUF3QixNQUFNLElBQUksZUFBZTtBQUN2RCxPQUFHLE9BQU8sdUVBQXVFO0FBQ2pGO0FBQUEsRUFDSjtBQUdBLFFBQU0sNkJBQTZCLEdBQUcsd0JBQXdCO0FBQzlELFNBQU8sR0FBRyxvQkFBb0IsRUFBRSxTQUFTLDRCQUE0QjtBQUNqRSxVQUFNLGlCQUFpQixHQUFHLHdCQUF3QixNQUFNLElBQUk7QUFDNUQsVUFBTSxNQUFNO0FBQ1osUUFBSSxrQkFBa0IsR0FBRyx1QkFBdUIsR0FBRyxHQUFHO0FBQ2xELFlBQU0sb0JBQW9CLEdBQUcsZUFBZSxHQUFHLDBCQUEwQixHQUFHLEdBQUcsb0JBQW9CLEVBQUUsTUFBTSxJQUFJLEdBQUc7QUFDbEgsU0FBRztBQUFBLFFBQU0sd0JBQ0Msc0JBQXNCLEtBQUssbUNBQW1DLGlCQUFpQixLQUFLLE1BQU87QUFBQSxNQUNyRztBQUFBLElBQ0o7QUFBQSxFQUNKO0FBR0EsTUFBSSxVQUFVLE9BQU87QUFDckIsYUFBVyxZQUFZLEdBQUcsb0JBQW9CLEdBQUc7QUFDN0MsY0FBVSxLQUFLLElBQUksU0FBUyxLQUFLLEtBQUssR0FBRyxnQkFBZ0IsUUFBUSxDQUFDLENBQUM7QUFBQSxFQUN2RTtBQUdBLFNBQU8sTUFBTTtBQUNULE1BQUU7QUFDRixVQUFNLFNBQVMsS0FBSztBQUNwQixRQUFJLFNBQVMsbUJBQW1CO0FBQzVCLFNBQUcsT0FBTyxnQ0FBZ0M7QUFDMUM7QUFBQSxJQUNKO0FBQ0EsZUFBVyxZQUFZLEdBQUcsb0JBQW9CLEdBQUc7QUFFN0MsVUFBSSxHQUFHLGdCQUFnQixRQUFRLEtBQUssUUFBUTtBQUN4QztBQUFBLE1BQ0o7QUFFQSxhQUFPLE1BQU07QUFDVCxjQUFNLGlCQUFpQixHQUFHLHdCQUF3QixNQUFNLElBQUk7QUFDNUQsY0FBTSxjQUFjLEdBQUcsOEJBQThCLFVBQVUsTUFBTTtBQUNyRSxZQUFJLGtCQUFrQixhQUFhO0FBQy9CLGFBQUc7QUFBQSxZQUFNLGtCQUFrQixRQUFRLGlCQUFpQixHQUFHLFVBQVUsTUFBTSxDQUFDLFdBQ3ZELEdBQUcsYUFBYSxXQUFXLENBQUMsYUFDekIsR0FBRyx1QkFBdUIsVUFBVSxNQUFNLElBQUssWUFBWSxNQUFNO0FBQUEsVUFDckY7QUFDQTtBQUFBLFFBQ0o7QUFDQSxjQUFNLEdBQUcsTUFBTSxHQUFJO0FBQUEsTUFDdkI7QUFBQSxJQUNKO0FBQ0EsVUFBTSxHQUFHLE1BQU0sR0FBSTtBQUFBLEVBQ3ZCO0FBQ0o7IiwKICAibmFtZXMiOiBbXQp9Cg==
