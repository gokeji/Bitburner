import { NetscriptExtension } from "libs/NetscriptExtension";
import { PRIVATE_SERVER_NAME_PREFIX } from "./libs/constants";
function autocomplete(data, flags) {
    return ["simple", "full"];
}
let nsx;
function main(ns) {
    nsx = new NetscriptExtension(ns);
    const useDFS = false;
    const startingHostname = "home";
    let mode = ns.args[0];
    if (!mode) {
        mode = "full";
    }
    const hosts = useDFS ? nsx.scanDFS(startingHostname) : nsx.scanBFS(startingHostname);
    if (mode === "full") {
        const analyze = function (startingHost) {
            hosts.forEach((host) => {
                if (host.canAccessFrom !== startingHost.hostname) {
                    return;
                }
                let prefix = "";
                for (let i = 0; i < host.depth - 1; i++) {
                    prefix += "  ";
                }
                ns.tprintf(`${prefix} \u2523 ${host.hostname}`);
                ns.tprintf(
                    `${prefix} \u2503    Root access: ${ns.hasRootAccess(host.hostname)}. Ports: ${ns.getServerNumPortsRequired(host.hostname)}. RAM: ${ns.getServerMaxRam(host.hostname)}. Hacking skill: ${ns.getServerRequiredHackingLevel(host.hostname)}`,
                );
                ns.tprintf(
                    `${prefix} \u2503    Max money: ${ns.formatNumber(ns.getServerMaxMoney(host.hostname))}. Difficulty: ${ns.getServerMinSecurityLevel(host.hostname)} - ${ns.getServerBaseSecurityLevel(host.hostname)}. Growth: ${ns.getServerGrowth(host.hostname)}. Hack chance: ${ns.hackAnalyzeChance(host.hostname)}`,
                );
                analyze(host);
            });
        };
        if (hosts.length === 0) {
            return;
        }
        analyze(hosts[0]);
    } else {
        hosts.sort((a, b) => {
            return ns.getServerRequiredHackingLevel(b.hostname) - ns.getServerRequiredHackingLevel(a.hostname);
        });
        hosts.forEach((host) => {
            if (host.hostname === startingHostname || host.hostname.startsWith(PRIVATE_SERVER_NAME_PREFIX)) {
                return;
            }
            ns.tprintf(`${host.hostname}`);
            ns.tprintf(
                `    Root access: ${ns.hasRootAccess(host.hostname)}. Ports: ${ns.getServerNumPortsRequired(host.hostname)}. RAM: ${ns.getServerMaxRam(host.hostname)}. Hacking skill: ${ns.getServerRequiredHackingLevel(host.hostname)}`,
            );
            ns.tprintf(
                `    Max money: ${ns.formatNumber(ns.getServerMaxMoney(host.hostname))}. Difficulty: ${ns.getServerMinSecurityLevel(host.hostname)} - ${ns.getServerBaseSecurityLevel(host.hostname)}. Growth: ${ns.getServerGrowth(host.hostname)}. Hack chance: ${ns.hackAnalyzeChance(host.hostname)}`,
            );
        });
    }
}
export { autocomplete, main };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3NjYW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7QXV0b2NvbXBsZXRlRGF0YSwgTlN9IGZyb20gXCJAbnNcIjtcbmltcG9ydCB7TmV0c2NyaXB0RXh0ZW5zaW9uLCBTY2FuU2VydmVySW5mb30gZnJvbSBcImxpYnMvTmV0c2NyaXB0RXh0ZW5zaW9uXCI7XG5pbXBvcnQge1BSSVZBVEVfU0VSVkVSX05BTUVfUFJFRklYfSBmcm9tIFwiL2xpYnMvY29uc3RhbnRzXCI7XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbmV4cG9ydCBmdW5jdGlvbiBhdXRvY29tcGxldGUoZGF0YTogQXV0b2NvbXBsZXRlRGF0YSwgZmxhZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBbXCJzaW1wbGVcIiwgXCJmdWxsXCJdO1xufVxuXG5sZXQgbnN4OiBOZXRzY3JpcHRFeHRlbnNpb247XG5cbmV4cG9ydCBmdW5jdGlvbiBtYWluKG5zOiBOUyk6IHZvaWQge1xuICAgIG5zeCA9IG5ldyBOZXRzY3JpcHRFeHRlbnNpb24obnMpO1xuXG4gICAgY29uc3QgdXNlREZTID0gZmFsc2U7XG4gICAgY29uc3Qgc3RhcnRpbmdIb3N0bmFtZSA9IFwiaG9tZVwiO1xuXG4gICAgbGV0IG1vZGUgPSBucy5hcmdzWzBdO1xuICAgIGlmICghbW9kZSkge1xuICAgICAgICBtb2RlID0gXCJmdWxsXCI7XG4gICAgfVxuXG4gICAgY29uc3QgaG9zdHMgPSAodXNlREZTKSA/IG5zeC5zY2FuREZTKHN0YXJ0aW5nSG9zdG5hbWUpIDogbnN4LnNjYW5CRlMoc3RhcnRpbmdIb3N0bmFtZSk7XG5cbiAgICBpZiAobW9kZSA9PT0gXCJmdWxsXCIpIHtcbiAgICAgICAgY29uc3QgYW5hbHl6ZSA9IGZ1bmN0aW9uIChzdGFydGluZ0hvc3Q6IFNjYW5TZXJ2ZXJJbmZvKSB7XG4gICAgICAgICAgICBob3N0cy5mb3JFYWNoKGhvc3QgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChob3N0LmNhbkFjY2Vzc0Zyb20gIT09IHN0YXJ0aW5nSG9zdC5ob3N0bmFtZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCBwcmVmaXggPSBcIlwiO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaG9zdC5kZXB0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBwcmVmaXggKz0gXCIgIFwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBucy50cHJpbnRmKGAke3ByZWZpeH0gXHUyNTIzICR7aG9zdC5ob3N0bmFtZX1gKTtcbiAgICAgICAgICAgICAgICBucy50cHJpbnRmKFxuICAgICAgICAgICAgICAgICAgICBgJHtwcmVmaXh9IFx1MjUwMyAgICBSb290IGFjY2VzczogJHtucy5oYXNSb290QWNjZXNzKGhvc3QuaG9zdG5hbWUpfWBcbiAgICAgICAgICAgICAgICAgICAgKyBgLiBQb3J0czogJHtucy5nZXRTZXJ2ZXJOdW1Qb3J0c1JlcXVpcmVkKGhvc3QuaG9zdG5hbWUpfWBcbiAgICAgICAgICAgICAgICAgICAgKyBgLiBSQU06ICR7bnMuZ2V0U2VydmVyTWF4UmFtKGhvc3QuaG9zdG5hbWUpfWBcbiAgICAgICAgICAgICAgICAgICAgKyBgLiBIYWNraW5nIHNraWxsOiAke25zLmdldFNlcnZlclJlcXVpcmVkSGFja2luZ0xldmVsKGhvc3QuaG9zdG5hbWUpfWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIG5zLnRwcmludGYoXG4gICAgICAgICAgICAgICAgICAgIGAke3ByZWZpeH0gXHUyNTAzICAgIE1heCBtb25leTogJHtucy5mb3JtYXROdW1iZXIobnMuZ2V0U2VydmVyTWF4TW9uZXkoaG9zdC5ob3N0bmFtZSkpfWBcbiAgICAgICAgICAgICAgICAgICAgKyBgLiBEaWZmaWN1bHR5OiAke25zLmdldFNlcnZlck1pblNlY3VyaXR5TGV2ZWwoaG9zdC5ob3N0bmFtZSl9IC0gJHtucy5nZXRTZXJ2ZXJCYXNlU2VjdXJpdHlMZXZlbChob3N0Lmhvc3RuYW1lKX1gXG4gICAgICAgICAgICAgICAgICAgICsgYC4gR3Jvd3RoOiAke25zLmdldFNlcnZlckdyb3d0aChob3N0Lmhvc3RuYW1lKX1gXG4gICAgICAgICAgICAgICAgICAgICsgYC4gSGFjayBjaGFuY2U6ICR7bnMuaGFja0FuYWx5emVDaGFuY2UoaG9zdC5ob3N0bmFtZSl9YFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgYW5hbHl6ZShob3N0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBpZiAoaG9zdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgYW5hbHl6ZShob3N0c1swXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaG9zdHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5zLmdldFNlcnZlclJlcXVpcmVkSGFja2luZ0xldmVsKGIuaG9zdG5hbWUpIC0gbnMuZ2V0U2VydmVyUmVxdWlyZWRIYWNraW5nTGV2ZWwoYS5ob3N0bmFtZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBob3N0cy5mb3JFYWNoKGhvc3QgPT4ge1xuICAgICAgICAgICAgaWYgKGhvc3QuaG9zdG5hbWUgPT09IHN0YXJ0aW5nSG9zdG5hbWUgfHwgaG9zdC5ob3N0bmFtZS5zdGFydHNXaXRoKFBSSVZBVEVfU0VSVkVSX05BTUVfUFJFRklYKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5zLnRwcmludGYoYCR7aG9zdC5ob3N0bmFtZX1gKTtcbiAgICAgICAgICAgIG5zLnRwcmludGYoXG4gICAgICAgICAgICAgICAgYCAgICBSb290IGFjY2VzczogJHtucy5oYXNSb290QWNjZXNzKGhvc3QuaG9zdG5hbWUpfWBcbiAgICAgICAgICAgICAgICArIGAuIFBvcnRzOiAke25zLmdldFNlcnZlck51bVBvcnRzUmVxdWlyZWQoaG9zdC5ob3N0bmFtZSl9YFxuICAgICAgICAgICAgICAgICsgYC4gUkFNOiAke25zLmdldFNlcnZlck1heFJhbShob3N0Lmhvc3RuYW1lKX1gXG4gICAgICAgICAgICAgICAgKyBgLiBIYWNraW5nIHNraWxsOiAke25zLmdldFNlcnZlclJlcXVpcmVkSGFja2luZ0xldmVsKGhvc3QuaG9zdG5hbWUpfWBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBucy50cHJpbnRmKFxuICAgICAgICAgICAgICAgIGAgICAgTWF4IG1vbmV5OiAke25zLmZvcm1hdE51bWJlcihucy5nZXRTZXJ2ZXJNYXhNb25leShob3N0Lmhvc3RuYW1lKSl9YFxuICAgICAgICAgICAgICAgICsgYC4gRGlmZmljdWx0eTogJHtucy5nZXRTZXJ2ZXJNaW5TZWN1cml0eUxldmVsKGhvc3QuaG9zdG5hbWUpfSAtICR7bnMuZ2V0U2VydmVyQmFzZVNlY3VyaXR5TGV2ZWwoaG9zdC5ob3N0bmFtZSl9YFxuICAgICAgICAgICAgICAgICsgYC4gR3Jvd3RoOiAke25zLmdldFNlcnZlckdyb3d0aChob3N0Lmhvc3RuYW1lKX1gXG4gICAgICAgICAgICAgICAgKyBgLiBIYWNrIGNoYW5jZTogJHtucy5oYWNrQW5hbHl6ZUNoYW5jZShob3N0Lmhvc3RuYW1lKX1gXG4gICAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFDQSxTQUFRLDBCQUF5QztBQUNqRCxTQUFRLGtDQUFpQztBQUdsQyxTQUFTLGFBQWEsTUFBd0IsT0FBMkI7QUFDNUUsU0FBTyxDQUFDLFVBQVUsTUFBTTtBQUM1QjtBQUVBLElBQUk7QUFFRyxTQUFTLEtBQUssSUFBYztBQUMvQixRQUFNLElBQUksbUJBQW1C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
