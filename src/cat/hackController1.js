import { NetscriptExtension } from "./libs/NetscriptExtension";
function autocomplete(data, flags) {
    return [...data.servers];
}
let nsx;
function main(ns) {
    nsx = new NetscriptExtension(ns);
    nsx.killProcessesSpawnFromSameScript();
    const target = ns.args[0];
    const scriptName = "simpleHack.js";
    nsx.scanBFS("home", function (host) {
        if (host.hostname === "home") {
            return;
        }
        if (!ns.hasRootAccess(host.hostname)) {
            ns.tprint(`Skip ${host.hostname}. No root access.`);
            return;
        }
        const numberOfThread = Math.floor(
            (ns.getServerMaxRam(host.hostname) - ns.getServerUsedRam(host.hostname)) / ns.getScriptRam(scriptName),
        );
        if (numberOfThread === 0) {
            ns.tprint(`Skip ${host.hostname}. Not enough RAM.`);
            return;
        }
        ns.scriptKill(scriptName, host.hostname);
        ns.scp(scriptName, host.hostname);
        ns.exec(scriptName, host.hostname, numberOfThread, target);
        ns.tprint(`Host: ${host.hostname}. Threads: ${numberOfThread}`);
    });
}
export { autocomplete, main };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2hhY2tDb250cm9sbGVyMS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtBdXRvY29tcGxldGVEYXRhLCBOU30gZnJvbSBcIkBuc1wiO1xuaW1wb3J0IHtOZXRzY3JpcHRFeHRlbnNpb259IGZyb20gXCIvbGlicy9OZXRzY3JpcHRFeHRlbnNpb25cIjtcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuZXhwb3J0IGZ1bmN0aW9uIGF1dG9jb21wbGV0ZShkYXRhOiBBdXRvY29tcGxldGVEYXRhLCBmbGFnczogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIFsuLi5kYXRhLnNlcnZlcnNdO1xufVxuXG5sZXQgbnN4OiBOZXRzY3JpcHRFeHRlbnNpb247XG5cbmV4cG9ydCBmdW5jdGlvbiBtYWluKG5zOiBOUyk6IHZvaWQge1xuICAgIG5zeCA9IG5ldyBOZXRzY3JpcHRFeHRlbnNpb24obnMpO1xuICAgIG5zeC5raWxsUHJvY2Vzc2VzU3Bhd25Gcm9tU2FtZVNjcmlwdCgpO1xuXG4gICAgY29uc3QgdGFyZ2V0ID0gbnMuYXJnc1swXTtcblxuICAgIGNvbnN0IHNjcmlwdE5hbWUgPSBcInNpbXBsZUhhY2suanNcIjtcbiAgICBuc3guc2NhbkJGUyhcImhvbWVcIiwgZnVuY3Rpb24gKGhvc3QpIHtcbiAgICAgICAgLy8gU2tpcCBob21lIHNlcnZlclxuICAgICAgICBpZiAoaG9zdC5ob3N0bmFtZSA9PT0gXCJob21lXCIpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW5zLmhhc1Jvb3RBY2Nlc3MoaG9zdC5ob3N0bmFtZSkpIHtcbiAgICAgICAgICAgIG5zLnRwcmludChgU2tpcCAke2hvc3QuaG9zdG5hbWV9LiBObyByb290IGFjY2Vzcy5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBudW1iZXJPZlRocmVhZCA9IE1hdGguZmxvb3IoXG4gICAgICAgICAgICAobnMuZ2V0U2VydmVyTWF4UmFtKGhvc3QuaG9zdG5hbWUpIC0gbnMuZ2V0U2VydmVyVXNlZFJhbShob3N0Lmhvc3RuYW1lKSkgLyBucy5nZXRTY3JpcHRSYW0oc2NyaXB0TmFtZSlcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKG51bWJlck9mVGhyZWFkID09PSAwKSB7XG4gICAgICAgICAgICBucy50cHJpbnQoYFNraXAgJHtob3N0Lmhvc3RuYW1lfS4gTm90IGVub3VnaCBSQU0uYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbnMuc2NyaXB0S2lsbChzY3JpcHROYW1lLCBob3N0Lmhvc3RuYW1lKTtcbiAgICAgICAgbnMuc2NwKHNjcmlwdE5hbWUsIGhvc3QuaG9zdG5hbWUpO1xuICAgICAgICBucy5leGVjKHNjcmlwdE5hbWUsIGhvc3QuaG9zdG5hbWUsIG51bWJlck9mVGhyZWFkLCB0YXJnZXQpO1xuICAgICAgICBucy50cHJpbnQoYEhvc3Q6ICR7aG9zdC5ob3N0bmFtZX0uIFRocmVhZHM6ICR7bnVtYmVyT2ZUaHJlYWR9YCk7XG4gICAgfSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFDQSxTQUFRLDBCQUF5QjtBQUcxQixTQUFTLGFBQWEsTUFBd0IsT0FBMkI7QUFDNUUsU0FBTyxDQUFDLEdBQUcsS0FBSyxPQUFPO0FBQzNCO0FBRUEsSUFBSTtBQUVHLFNBQVMsS0FBSyxJQUFjO0FBQy9CLFFBQU0sSUFBSSxtQkFBbUIsRUFBRTtBQUMvQixNQUFJLGlDQUFpQztBQUVyQyxRQUFNLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFFeEIsUUFBTSxhQUFhO0FBQ25CLE1BQUksUUFBUSxRQUFRLFNBQVUsTUFBTTtBQUVoQyxRQUFJLEtBQUssYUFBYSxRQUFRO0FBQzFCO0FBQUEsSUFDSjtBQUNBLFFBQUksQ0FBQyxHQUFHLGNBQWMsS0FBSyxRQUFRLEdBQUc7QUFDbEMsU0FBRyxPQUFPLFFBQVEsS0FBSyxRQUFRLG1CQUFtQjtBQUNsRDtBQUFBLElBQ0o7QUFDQSxVQUFNLGlCQUFpQixLQUFLO0FBQUEsT0FDdkIsR0FBRyxnQkFBZ0IsS0FBSyxRQUFRLElBQUksR0FBRyxpQkFBaUIsS0FBSyxRQUFRLEtBQUssR0FBRyxhQUFhLFVBQVU7QUFBQSxJQUN6RztBQUNBLFFBQUksbUJBQW1CLEdBQUc7QUFDdEIsU0FBRyxPQUFPLFFBQVEsS0FBSyxRQUFRLG1CQUFtQjtBQUNsRDtBQUFBLElBQ0o7QUFDQSxPQUFHLFdBQVcsWUFBWSxLQUFLLFFBQVE7QUFDdkMsT0FBRyxJQUFJLFlBQVksS0FBSyxRQUFRO0FBQ2hDLE9BQUcsS0FBSyxZQUFZLEtBQUssVUFBVSxnQkFBZ0IsTUFBTTtBQUN6RCxPQUFHLE9BQU8sU0FBUyxLQUFLLFFBQVEsY0FBYyxjQUFjLEVBQUU7QUFBQSxFQUNsRSxDQUFDO0FBQ0w7IiwKICAibmFtZXMiOiBbXQp9Cg==
