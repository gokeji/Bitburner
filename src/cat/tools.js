import { NetscriptExtension, parseAutoCompleteDataFromDefaultConfig } from "./libs/NetscriptExtension";
import { GROW_SCRIPT_NAME, HACK_SCRIPT_NAME, STOCK_HISTORY_LOGS_PREFIX, WEAKEN_SCRIPT_NAME } from "./libs/constants";
function autocomplete(data, flags) {
    return parseAutoCompleteDataFromDefaultConfig(data, defaultConfig);
}
const defaultConfig = [
    ["killall", false],
    ["sellAllStocks", false],
    ["deleteStockHistoryLogs", false],
    ["evalPrint", ""],
    ["resetController", false],
    ["eatNoodles", false],
    ["deleteAllScripts", false],
];
let nsx;
async function main(ns) {
    nsx = new NetscriptExtension(ns);
    ns.disableLog("ALL");
    const config = ns.flags(defaultConfig);
    if (config.killall) {
        nsx.scanBFS("home", (host) => {
            ns.killall(host.hostname, true);
        });
    }
    if (config.sellAllStocks) {
        ns.stock.getSymbols().forEach((symbol) => {
            const position = ns.stock.getPosition(symbol);
            ns.stock.sellStock(symbol, position[0]);
        });
    }
    if (config.deleteStockHistoryLogs) {
        ns.ls("home", STOCK_HISTORY_LOGS_PREFIX).forEach((filename) => {
            ns.rm(filename);
        });
    }
    if (config.evalPrint !== "") {
        ns.tprint(eval(config.evalPrint));
    }
    if (config.resetController) {
        ns.scriptKill("controller2.js", "home");
        nsx.scanBFS("home")
            .filter((host) => {
                return ns.getServerMaxRam(host.hostname) > 0 && ns.hasRootAccess(host.hostname);
            })
            .forEach((host) => {
                const hostname = host.hostname;
                ns.scriptKill(WEAKEN_SCRIPT_NAME, hostname);
                ns.scriptKill(GROW_SCRIPT_NAME, hostname);
                ns.scriptKill(HACK_SCRIPT_NAME, hostname);
            });
    }
    if (config.eatNoodles) {
        const doc = eval("document");
        const buttons = doc.querySelectorAll("#root > div:nth-of-type(2) > div:nth-of-type(2) > button");
        let eatNoodlesButton = null;
        for (const button of buttons) {
            if (button.textContent === "Eat noodles") {
                eatNoodlesButton = button;
                break;
            }
        }
        if (eatNoodlesButton === null) {
            return;
        }
        let count = 0;
        while (true) {
            ++count;
            eatNoodlesButton.click();
            if (count % 100 === 0) {
                await ns.sleep(200);
            }
            if (count > 1e5) {
                ns.print("Finish");
                break;
            }
        }
    }
    if (config.deleteAllScripts) {
        ns.ls("home", ".js").forEach((filename) => {
            ns.rm(filename);
        });
    }
}
export { autocomplete, main };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3Rvb2xzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQge0F1dG9jb21wbGV0ZURhdGEsIE5TfSBmcm9tIFwiQG5zXCI7XG5pbXBvcnQge1xuICAgIE5ldHNjcmlwdEV4dGVuc2lvbixcbiAgICBOZXRzY3JpcHRGbGFnc1NjaGVtYSxcbiAgICBwYXJzZUF1dG9Db21wbGV0ZURhdGFGcm9tRGVmYXVsdENvbmZpZ1xufSBmcm9tIFwiL2xpYnMvTmV0c2NyaXB0RXh0ZW5zaW9uXCI7XG5pbXBvcnQge0dST1dfU0NSSVBUX05BTUUsIEhBQ0tfU0NSSVBUX05BTUUsIFNUT0NLX0hJU1RPUllfTE9HU19QUkVGSVgsIFdFQUtFTl9TQ1JJUFRfTkFNRX0gZnJvbSBcIi9saWJzL2NvbnN0YW50c1wiO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlKGRhdGE6IEF1dG9jb21wbGV0ZURhdGEsIGZsYWdzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gcGFyc2VBdXRvQ29tcGxldGVEYXRhRnJvbURlZmF1bHRDb25maWcoZGF0YSwgZGVmYXVsdENvbmZpZyk7XG59XG5cbmNvbnN0IGRlZmF1bHRDb25maWc6IE5ldHNjcmlwdEZsYWdzU2NoZW1hID0gW1xuICAgIFtcImtpbGxhbGxcIiwgZmFsc2VdLFxuICAgIFtcInNlbGxBbGxTdG9ja3NcIiwgZmFsc2VdLFxuICAgIFtcImRlbGV0ZVN0b2NrSGlzdG9yeUxvZ3NcIiwgZmFsc2VdLFxuICAgIFtcImV2YWxQcmludFwiLCBcIlwiXSxcbiAgICBbXCJyZXNldENvbnRyb2xsZXJcIiwgZmFsc2VdLFxuICAgIFtcImVhdE5vb2RsZXNcIiwgZmFsc2VdLFxuICAgIFtcImRlbGV0ZUFsbFNjcmlwdHNcIiwgZmFsc2VdLFxuXTtcblxubGV0IG5zeDogTmV0c2NyaXB0RXh0ZW5zaW9uO1xuXG4vKipcbiAqIFVzYWdlOlxuICogcnVuIHRvb2xzLmpzIGtpbGxhbGxcbiAqXG4gKiBAcGFyYW0gbnNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4obnM6IE5TKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbnN4ID0gbmV3IE5ldHNjcmlwdEV4dGVuc2lvbihucyk7XG5cbiAgICBucy5kaXNhYmxlTG9nKFwiQUxMXCIpO1xuICAgIC8vIG5zLmNsZWFyTG9nKCk7XG4gICAgLy8gbnMudGFpbCgpO1xuXG4gICAgY29uc3QgY29uZmlnID0gbnMuZmxhZ3MoZGVmYXVsdENvbmZpZyk7XG4gICAgaWYgKGNvbmZpZy5raWxsYWxsKSB7XG4gICAgICAgIG5zeC5zY2FuQkZTKFwiaG9tZVwiLCBob3N0ID0+IHtcbiAgICAgICAgICAgIG5zLmtpbGxhbGwoaG9zdC5ob3N0bmFtZSwgdHJ1ZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoY29uZmlnLnNlbGxBbGxTdG9ja3MpIHtcbiAgICAgICAgbnMuc3RvY2suZ2V0U3ltYm9scygpLmZvckVhY2goc3ltYm9sID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uID0gbnMuc3RvY2suZ2V0UG9zaXRpb24oc3ltYm9sKTtcbiAgICAgICAgICAgIG5zLnN0b2NrLnNlbGxTdG9jayhzeW1ib2wsIHBvc2l0aW9uWzBdKTtcbiAgICAgICAgICAgIC8vIG5zLnN0b2NrLnNlbGxTaG9ydChzeW1ib2wsIHBvc2l0aW9uWzJdKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChjb25maWcuZGVsZXRlU3RvY2tIaXN0b3J5TG9ncykge1xuICAgICAgICBucy5scyhcImhvbWVcIiwgU1RPQ0tfSElTVE9SWV9MT0dTX1BSRUZJWCkuZm9yRWFjaChmaWxlbmFtZSA9PiB7XG4gICAgICAgICAgICBucy5ybShmaWxlbmFtZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoY29uZmlnLmV2YWxQcmludCAhPT0gXCJcIikge1xuICAgICAgICBucy50cHJpbnQoZXZhbCg8c3RyaW5nPmNvbmZpZy5ldmFsUHJpbnQpKTtcbiAgICB9XG4gICAgaWYgKGNvbmZpZy5yZXNldENvbnRyb2xsZXIpIHtcbiAgICAgICAgbnMuc2NyaXB0S2lsbChcImNvbnRyb2xsZXIyLmpzXCIsIFwiaG9tZVwiKTtcbiAgICAgICAgbnN4LnNjYW5CRlMoXCJob21lXCIpXG4gICAgICAgICAgICAuZmlsdGVyKGhvc3QgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBucy5nZXRTZXJ2ZXJNYXhSYW0oaG9zdC5ob3N0bmFtZSkgPiAwICYmIG5zLmhhc1Jvb3RBY2Nlc3MoaG9zdC5ob3N0bmFtZSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmZvckVhY2goaG9zdCA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaG9zdG5hbWUgPSBob3N0Lmhvc3RuYW1lO1xuICAgICAgICAgICAgICAgIG5zLnNjcmlwdEtpbGwoV0VBS0VOX1NDUklQVF9OQU1FLCBob3N0bmFtZSk7XG4gICAgICAgICAgICAgICAgbnMuc2NyaXB0S2lsbChHUk9XX1NDUklQVF9OQU1FLCBob3N0bmFtZSk7XG4gICAgICAgICAgICAgICAgbnMuc2NyaXB0S2lsbChIQUNLX1NDUklQVF9OQU1FLCBob3N0bmFtZSk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG4gICAgaWYgKGNvbmZpZy5lYXROb29kbGVzKSB7XG4gICAgICAgIGNvbnN0IGRvYzogRG9jdW1lbnQgPSBldmFsKFwiZG9jdW1lbnRcIik7XG4gICAgICAgIGNvbnN0IGJ1dHRvbnMgPSBkb2MucXVlcnlTZWxlY3RvckFsbDxIVE1MQnV0dG9uRWxlbWVudD4oXCIjcm9vdCA+IGRpdjpudGgtb2YtdHlwZSgyKSA+IGRpdjpudGgtb2YtdHlwZSgyKSA+IGJ1dHRvblwiKSE7XG4gICAgICAgIGxldCBlYXROb29kbGVzQnV0dG9uID0gbnVsbDtcbiAgICAgICAgZm9yIChjb25zdCBidXR0b24gb2YgYnV0dG9ucykge1xuICAgICAgICAgICAgaWYgKGJ1dHRvbi50ZXh0Q29udGVudCA9PT0gXCJFYXQgbm9vZGxlc1wiKSB7XG4gICAgICAgICAgICAgICAgZWF0Tm9vZGxlc0J1dHRvbiA9IGJ1dHRvbjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZWF0Tm9vZGxlc0J1dHRvbiA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICArK2NvdW50O1xuICAgICAgICAgICAgZWF0Tm9vZGxlc0J1dHRvbi5jbGljaygpO1xuICAgICAgICAgICAgaWYgKGNvdW50ICUgMTAwID09PSAwKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgbnMuc2xlZXAoMjAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjb3VudCA+IDFlNSkge1xuICAgICAgICAgICAgICAgIG5zLnByaW50KFwiRmluaXNoXCIpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChjb25maWcuZGVsZXRlQWxsU2NyaXB0cykge1xuICAgICAgICBucy5scyhcImhvbWVcIiwgXCIuanNcIikuZm9yRWFjaChmaWxlbmFtZSA9PiB7XG4gICAgICAgICAgICBucy5ybShmaWxlbmFtZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUNBO0FBQUEsRUFDSTtBQUFBLEVBRUE7QUFBQSxPQUNHO0FBQ1AsU0FBUSxrQkFBa0Isa0JBQWtCLDJCQUEyQiwwQkFBeUI7QUFHekYsU0FBUyxhQUFhLE1BQXdCLE9BQTJCO0FBQzVFLFNBQU8sdUNBQXVDLE1BQU0sYUFBYTtBQUNyRTtBQUVBLE1BQU0sZ0JBQXNDO0FBQUEsRUFDeEMsQ0FBQyxX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
