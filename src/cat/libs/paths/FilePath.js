import { directoryRegexString, isAbsolutePath, oneValidCharacter, resolveValidatedDirectory } from "./Directory";
const filenameRegexString = `(?<file>${oneValidCharacter}+\\.${oneValidCharacter}+)$`;
const basicFilePathRegex = new RegExp(directoryRegexString + filenameRegexString);
function isFilePath(path) {
    return basicFilePathRegex.test(path);
}
function asFilePath(input) {
    if (isFilePath(input) && isAbsolutePath(input)) return input;
    throw new Error(`${input} failed to validate as a FilePath.`);
}
function getFilenameOnly(path) {
    const start = path.lastIndexOf("/") + 1;
    return path.substring(start);
}
function getFileParts(path) {
    const result = basicFilePathRegex.exec(path);
    return result ? result.groups : null;
}
function resolveFilePath(path, base = "") {
    if (isAbsolutePath(path)) {
        if (path.startsWith("/")) path = path.substring(1);
        return isFilePath(path) ? path : null;
    }
    base = getBaseDirectory(base);
    const pathParts = getFileParts(path);
    if (!pathParts) return null;
    const directory = resolveValidatedDirectory(pathParts.directory, base);
    return directory === null ? null : combinePath(directory, pathParts.file);
}
function getBaseDirectory(path) {
    return path.replace(/[^/]+\.[^/]+$/, "");
}
function combinePath(directory, file) {
    return directory + file;
}
function removeDirectoryFromPath(directory, path) {
    if (!path.startsWith(directory)) return null;
    return path.substring(directory.length);
}
export { asFilePath, combinePath, getFilenameOnly, isFilePath, removeDirectoryFromPath, resolveFilePath };
