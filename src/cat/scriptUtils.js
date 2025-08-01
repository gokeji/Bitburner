import * as acorn from "./libs/acorn";
import * as walk from "./libs/walk";
import { hasScriptExtension, resolveScriptFilePath } from "./libs/paths/ScriptFilePath";
import { root } from "./libs/paths/Directory";
class Script {
    filename;
    code;
    blobUrl;
    constructor(filename, code) {
        this.filename = filename;
        this.code = code;
    }
}
const homeScripts = /* @__PURE__ */ new Map();
function generateBlobUrl(ns, scriptFilePath) {
    ns.ls("home")
        .filter((filename) => hasScriptExtension(filename))
        .forEach((filename) => {
            const scriptPath = filename;
            if (!homeScripts.has(scriptPath)) {
                homeScripts.set(scriptPath, new Script(scriptPath, ns.read(filename)));
            }
        });
    const script = homeScripts.get(scriptFilePath);
    if (!script) {
        throw new Error(`Invalid script path: ${scriptFilePath}`);
    }
    return generateBlobUrlForScript(ns, script, homeScripts);
}
function generateBlobUrlForScript(ns, script, scripts) {
    if (script.blobUrl) {
        return script.blobUrl;
    }
    const ast = acorn.parse(script.code, { sourceType: "module", ecmaVersion: "latest", ranges: true });
    const importNodes = [];
    walk.simple(ast, {
        ImportDeclaration(node) {
            if (!node.source) {
                return;
            }
            importNodes.push({
                filename: node.source.value,
                start: node.source.range[0] + 1,
                end: node.source.range[1] - 1,
            });
        },
        ExportNamedDeclaration(node) {
            if (!node.source) {
                return;
            }
            importNodes.push({
                filename: node.source.value,
                start: node.source.range[0] + 1,
                end: node.source.range[1] - 1,
            });
        },
        ExportAllDeclaration(node) {
            if (!node.source) {
                return;
            }
            importNodes.push({
                filename: node.source.value,
                start: node.source.range[0] + 1,
                end: node.source.range[1] - 1,
            });
        },
    });
    importNodes.sort((a, b) => b.start - a.start);
    let newCode = script.code;
    for (const node of importNodes) {
        const filename = resolveScriptFilePath(node.filename, root, ".js");
        if (!filename) {
            throw new Error(`Failed to parse import: ${node.filename}`);
        }
        const importedScript = scripts.get(filename);
        if (!importedScript) {
            throw new Error(`Invalid script path: ${filename}`);
        }
        importedScript.blobUrl = generateBlobUrlForScript(ns, importedScript, scripts);
        newCode = newCode.substring(0, node.start) + importedScript.blobUrl + newCode.substring(node.end);
    }
    const adjustedCode =
        newCode +
        `
//# sourceURL=home/${script.filename}`;
    const blobUrl = URL.createObjectURL(new Blob([adjustedCode], { type: "text/javascript" }));
    script.blobUrl = blobUrl;
    return blobUrl;
}
export { generateBlobUrl };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3NjcmlwdFV0aWxzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQge05TfSBmcm9tIFwiQG5zXCI7XG5pbXBvcnQgKiBhcyBhY29ybiBmcm9tIFwiL2xpYnMvYWNvcm5cIjtcbmltcG9ydCAqIGFzIHdhbGsgZnJvbSBcIi9saWJzL3dhbGtcIjtcbmltcG9ydCB7aGFzU2NyaXB0RXh0ZW5zaW9uLCByZXNvbHZlU2NyaXB0RmlsZVBhdGgsIFNjcmlwdEZpbGVQYXRofSBmcm9tIFwiL2xpYnMvcGF0aHMvU2NyaXB0RmlsZVBhdGhcIjtcbmltcG9ydCB7cm9vdH0gZnJvbSBcIi9saWJzL3BhdGhzL0RpcmVjdG9yeVwiO1xuXG5jbGFzcyBTY3JpcHQge1xuICAgIHB1YmxpYyBmaWxlbmFtZTogU2NyaXB0RmlsZVBhdGg7XG4gICAgcHVibGljIGNvZGU6IHN0cmluZztcbiAgICBwdWJsaWMgYmxvYlVybD86IHN0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKGZpbGVuYW1lOiBTY3JpcHRGaWxlUGF0aCwgY29kZTogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuZmlsZW5hbWUgPSBmaWxlbmFtZTtcbiAgICAgICAgdGhpcy5jb2RlID0gY29kZTtcbiAgICB9XG59XG5cbmludGVyZmFjZSBJbXBvcnROb2RlIHtcbiAgICBmaWxlbmFtZTogc3RyaW5nO1xuICAgIHN0YXJ0OiBudW1iZXI7XG4gICAgZW5kOiBudW1iZXI7XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG50eXBlIE5vZGUgPSBhbnk7XG5cbmNvbnN0IGhvbWVTY3JpcHRzID0gbmV3IE1hcDxTY3JpcHRGaWxlUGF0aCwgU2NyaXB0PigpO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVCbG9iVXJsKG5zOiBOUywgc2NyaXB0RmlsZVBhdGg6IFNjcmlwdEZpbGVQYXRoKTogc3RyaW5nIHtcbiAgICBucy5scyhcImhvbWVcIilcbiAgICAgICAgLmZpbHRlcihmaWxlbmFtZSA9PiBoYXNTY3JpcHRFeHRlbnNpb24oZmlsZW5hbWUpKVxuICAgICAgICAuZm9yRWFjaChmaWxlbmFtZSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHRQYXRoID0gZmlsZW5hbWUgYXMgU2NyaXB0RmlsZVBhdGg7XG4gICAgICAgICAgICBpZiAoIWhvbWVTY3JpcHRzLmhhcyhzY3JpcHRQYXRoKSkge1xuICAgICAgICAgICAgICAgIGhvbWVTY3JpcHRzLnNldChzY3JpcHRQYXRoLCBuZXcgU2NyaXB0KHNjcmlwdFBhdGgsIG5zLnJlYWQoZmlsZW5hbWUpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIGNvbnN0IHNjcmlwdCA9IGhvbWVTY3JpcHRzLmdldChzY3JpcHRGaWxlUGF0aCk7XG4gICAgaWYgKCFzY3JpcHQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNjcmlwdCBwYXRoOiAke3NjcmlwdEZpbGVQYXRofWApO1xuICAgIH1cbiAgICByZXR1cm4gZ2VuZXJhdGVCbG9iVXJsRm9yU2NyaXB0KG5zLCBzY3JpcHQsIGhvbWVTY3JpcHRzKTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVCbG9iVXJsRm9yU2NyaXB0KG5zOiBOUywgc2NyaXB0OiBTY3JpcHQsIHNjcmlwdHM6IE1hcDxTY3JpcHRGaWxlUGF0aCwgU2NyaXB0Pik6IHN0cmluZyB7XG4gICAgaWYgKHNjcmlwdC5ibG9iVXJsKSB7XG4gICAgICAgIHJldHVybiBzY3JpcHQuYmxvYlVybDtcbiAgICB9XG5cbiAgICBjb25zdCBhc3QgPSBhY29ybi5wYXJzZShzY3JpcHQuY29kZSwge3NvdXJjZVR5cGU6IFwibW9kdWxlXCIsIGVjbWFWZXJzaW9uOiBcImxhdGVzdFwiLCByYW5nZXM6IHRydWV9KTtcbiAgICBjb25zdCBpbXBvcnROb2RlczogSW1wb3J0Tm9kZVtdID0gW107XG4gICAgd2Fsay5zaW1wbGUoYXN0LCB7XG4gICAgICAgIEltcG9ydERlY2xhcmF0aW9uKG5vZGU6IE5vZGUpIHtcbiAgICAgICAgICAgIGlmICghbm9kZS5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpbXBvcnROb2Rlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBmaWxlbmFtZTogbm9kZS5zb3VyY2UudmFsdWUsXG4gICAgICAgICAgICAgICAgc3RhcnQ6IG5vZGUuc291cmNlLnJhbmdlWzBdICsgMSxcbiAgICAgICAgICAgICAgICBlbmQ6IG5vZGUuc291cmNlLnJhbmdlWzFdIC0gMSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBFeHBvcnROYW1lZERlY2xhcmF0aW9uKG5vZGU6IE5vZGUpIHtcbiAgICAgICAgICAgIGlmICghbm9kZS5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpbXBvcnROb2Rlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBmaWxlbmFtZTogbm9kZS5zb3VyY2UudmFsdWUsXG4gICAgICAgICAgICAgICAgc3RhcnQ6IG5vZGUuc291cmNlLnJhbmdlWzBdICsgMSxcbiAgICAgICAgICAgICAgICBlbmQ6IG5vZGUuc291cmNlLnJhbmdlWzFdIC0gMSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBFeHBvcnRBbGxEZWNsYXJhdGlvbihub2RlOiBOb2RlKSB7XG4gICAgICAgICAgICBpZiAoIW5vZGUuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaW1wb3J0Tm9kZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgZmlsZW5hbWU6IG5vZGUuc291cmNlLnZhbHVlLFxuICAgICAgICAgICAgICAgIHN0YXJ0OiBub2RlLnNvdXJjZS5yYW5nZVswXSArIDEsXG4gICAgICAgICAgICAgICAgZW5kOiBub2RlLnNvdXJjZS5yYW5nZVsxXSAtIDEsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICB9KTtcbiAgICBpbXBvcnROb2Rlcy5zb3J0KChhLCBiKSA9PiBiLnN0YXJ0IC0gYS5zdGFydCk7XG4gICAgbGV0IG5ld0NvZGUgPSBzY3JpcHQuY29kZTtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2YgaW1wb3J0Tm9kZXMpIHtcbiAgICAgICAgY29uc3QgZmlsZW5hbWUgPSByZXNvbHZlU2NyaXB0RmlsZVBhdGgobm9kZS5maWxlbmFtZSwgcm9vdCwgXCIuanNcIik7XG4gICAgICAgIGlmICghZmlsZW5hbWUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIGltcG9ydDogJHtub2RlLmZpbGVuYW1lfWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGltcG9ydGVkU2NyaXB0ID0gc2NyaXB0cy5nZXQoZmlsZW5hbWUpO1xuICAgICAgICBpZiAoIWltcG9ydGVkU2NyaXB0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc2NyaXB0IHBhdGg6ICR7ZmlsZW5hbWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaW1wb3J0ZWRTY3JpcHQuYmxvYlVybCA9IGdlbmVyYXRlQmxvYlVybEZvclNjcmlwdChucywgaW1wb3J0ZWRTY3JpcHQsIHNjcmlwdHMpO1xuICAgICAgICBuZXdDb2RlID0gbmV3Q29kZS5zdWJzdHJpbmcoMCwgbm9kZS5zdGFydCkgKyBpbXBvcnRlZFNjcmlwdC5ibG9iVXJsICsgbmV3Q29kZS5zdWJzdHJpbmcobm9kZS5lbmQpO1xuICAgIH1cbiAgICBjb25zdCBhZGp1c3RlZENvZGUgPSBuZXdDb2RlICsgYFxcbi8vIyBzb3VyY2VVUkw9aG9tZS8ke3NjcmlwdC5maWxlbmFtZX1gO1xuICAgIGNvbnN0IGJsb2JVcmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyBCbG9iKFthZGp1c3RlZENvZGVdLCB7dHlwZTogXCJ0ZXh0L2phdmFzY3JpcHRcIn0pKTtcbiAgICBzY3JpcHQuYmxvYlVybCA9IGJsb2JVcmw7XG4gICAgcmV0dXJuIGJsb2JVcmw7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFDQSxZQUFZLFdBQVc7QUFDdkIsWUFBWSxVQUFVO0FBQ3RCLFNBQVEsb0JBQW9CLDZCQUE0QztBQUN4RSxTQUFRLFlBQVc7QUFFbkIsTUFBTSxPQUFPO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFFUCxZQUFZLFVBQTBCLE1BQWM7QUFDaEQsU0FBSyxXQUFXO0FBQ2hCLFNBQUssT0FBTztBQUFBLEVBQ2hCO0FBQ0o7QUFXQSxNQUFNLGNBQWMsb0JBQUksSUFBNEI7QUFFN0MsU0FBUyxnQkFBZ0IsSUFBUSxnQkFBd0M7QUFDNUUsS0FBRyxHQUFHLE1BQU0sRUFDUCxPQUFPLGNBQVksbUJBQW1CLFFBQVEsQ0FBQyxFQUMvQyxRQUFRLGNBQVk7QUFDakIsVUFBTSxhQUFhO0FBQ25CLFFBQUksQ0FBQyxZQUFZLElBQUksVUFBVSxHQUFHO0FBQzlCLGtCQUFZLElBQUksWUFBWSxJQUFJLE9BQU8sWUFBWSxHQUFHLEtBQUssUUFBUSxDQUFDLENBQUM7QUFBQSxJQUN6RTtBQUFBLEVBQ0osQ0FBQztBQUNMLFFBQU0sU0FBUyxZQUFZLElBQUksY0FBYztBQUM3QyxNQUFJLENBQUMsUUFBUTtBQUNULFVBQU0sSUFBSSxNQUFNLHdCQUF3QixjQUFjLEVBQUU7QUFBQSxFQUM1RDtBQUNBLFNBQU8seUJBQXlCLElBQUksUUFBUSxXQUFXO0FBQzNEO0FBRUEsU0FBUyx5QkFBeUIsSUFBUSxRQUFnQixTQUE4QztBQUNwRyxNQUFJLE9BQU8sU0FBUztBQUNoQixXQUFPLE9BQU87QUFBQSxFQUNsQjtBQUVBLFFBQU0sTUFBTSxNQUFNLE1BQU0sT0FBTyxNQUFNLEVBQUMsWUFBWSxVQUFVLGFBQWEsVUFBVSxRQUFRLEtBQUksQ0FBQztBQUNoRyxRQUFNLGNBQTRCLENBQUM7QUFDbkMsT0FBSyxPQUFPLEtBQUs7QUFBQSxJQUNiLGtCQUFrQixNQUFZO0FBQzFCLFVBQUksQ0FBQyxLQUFLLFFBQVE7QUFDZDtBQUFBLE1BQ0o7QUFDQSxrQkFBWSxLQUFLO0FBQUEsUUFDYixVQUFVLEtBQUssT0FBTztBQUFBLFFBQ3RCLE9BQU8sS0FBSyxPQUFPLE1BQU0sQ0FBQyxJQUFJO0FBQUEsUUFDOUIsS0FBSyxLQUFLLE9BQU8sTUFBTSxDQUFDLElBQUk7QUFBQSxNQUNoQyxDQUFDO0FBQUEsSUFDTDtBQUFBLElBQ0EsdUJBQXVCLE1BQVk7QUFDL0IsVUFBSSxDQUFDLEtBQUssUUFBUTtBQUNkO0FBQUEsTUFDSjtBQUNBLGtCQUFZLEtBQUs7QUFBQSxRQUNiLFVBQVUsS0FBSyxPQUFPO0FBQUEsUUFDdEIsT0FBTyxLQUFLLE9BQU8sTUFBTSxDQUFDLElBQUk7QUFBQSxRQUM5QixLQUFLLEtBQUssT0FBTyxNQUFNLENBQUMsSUFBSTtBQUFBLE1BQ2hDLENBQUM7QUFBQSxJQUNMO0FBQUEsSUFDQSxxQkFBcUIsTUFBWTtBQUM3QixVQUFJLENBQUMsS0FBSyxRQUFRO0FBQ2Q7QUFBQSxNQUNKO0FBQ0Esa0JBQVksS0FBSztBQUFBLFFBQ2IsVUFBVSxLQUFLLE9BQU87QUFBQSxRQUN0QixPQUFPLEtBQUssT0FBTyxNQUFNLENBQUMsSUFBSTtBQUFBLFFBQzlCLEtBQUssS0FBSyxPQUFPLE1BQU0sQ0FBQyxJQUFJO0FBQUEsTUFDaEMsQ0FBQztBQUFBLElBQ0w7QUFBQSxFQUNKLENBQUM7QUFDRCxjQUFZLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxRQUFRLEVBQUUsS0FBSztBQUM1QyxNQUFJLFVBQVUsT0FBTztBQUNyQixhQUFXLFFBQVEsYUFBYTtBQUM1QixVQUFNLFdBQVcsc0JBQXNCLEtBQUssVUFBVSxNQUFNLEtBQUs7QUFDakUsUUFBSSxDQUFDLFVBQVU7QUFDWCxZQUFNLElBQUksTUFBTSwyQkFBMkIsS0FBSyxRQUFRLEVBQUU7QUFBQSxJQUM5RDtBQUNBLFVBQU0saUJBQWlCLFFBQVEsSUFBSSxRQUFRO0FBQzNDLFFBQUksQ0FBQyxnQkFBZ0I7QUFDakIsWUFBTSxJQUFJLE1BQU0sd0JBQXdCLFFBQVEsRUFBRTtBQUFBLElBQ3REO0FBQ0EsbUJBQWUsVUFBVSx5QkFBeUIsSUFBSSxnQkFBZ0IsT0FBTztBQUM3RSxjQUFVLFFBQVEsVUFBVSxHQUFHLEtBQUssS0FBSyxJQUFJLGVBQWUsVUFBVSxRQUFRLFVBQVUsS0FBSyxHQUFHO0FBQUEsRUFDcEc7QUFDQSxRQUFNLGVBQWUsVUFBVTtBQUFBLHFCQUF3QixPQUFPLFFBQVE7QUFDdEUsUUFBTSxVQUFVLElBQUksZ0JBQWdCLElBQUksS0FBSyxDQUFDLFlBQVksR0FBRyxFQUFDLE1BQU0sa0JBQWlCLENBQUMsQ0FBQztBQUN2RixTQUFPLFVBQVU7QUFDakIsU0FBTztBQUNYOyIsCiAgIm5hbWVzIjogW10KfQo=
