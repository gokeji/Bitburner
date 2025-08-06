import { resolveFilePath } from "./FilePath";
const validScriptExtensions = [".js", ".script"];
function resolveScriptFilePath(path, base = "", extensionToAdd) {
    if (extensionToAdd && !path.endsWith(extensionToAdd)) path = path + extensionToAdd;
    const result = resolveFilePath(path, base);
    return result && hasScriptExtension(result) ? result : null;
}
function hasScriptExtension(path) {
    return validScriptExtensions.some((extension) => path.endsWith(extension));
}
export { hasScriptExtension, resolveScriptFilePath, validScriptExtensions };
