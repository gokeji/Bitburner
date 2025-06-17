export async function main(ns) {
    // w0r1d_d43m0n
    if (ns.args.length == 1) {
        const target = ns.args[0];
        ns.print("Searching network path to " + target);

        let networkPath = ["home"];
        networkPath = scanAll(ns, "home", target, networkPath);

        for (let server of networkPath) {
            ns.singularity.connect(server);
            if (server == target) {
                let backdoorSuccess = await ns.singularity.installBackdoor();
                ns.tprint("Installed backdoor on " + server + " - " + backdoorSuccess);
                ns.singularity.connect("home");
                return backdoorSuccess;
            }
        }
    } else {
        ns.tprint("Usage: specify target server like: backdoor CSEC");
    }
    return false;
}

function scanAll(ns, start, target, path) {
    let connectedHosts = ns.scan(start);
    let finalPath = null;
    for (let host of connectedHosts) {
        if (!path.includes(host)) {
            path.push(host);
            if (host == target) {
                ns.print("Found path: " + path);
                return path;
            }
            finalPath = scanAll(ns, host, target, path);
            if (finalPath != null) {
                return finalPath;
            } else {
                // we did not find the target followint the network map of this server.
                path.pop();
            }
        }
    }
}
