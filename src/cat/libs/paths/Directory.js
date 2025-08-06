const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
const reHasRegExpChar = RegExp(reRegExpChar.source);
function escapeRegExp(string) {
  return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, "\\$&") : string || "";
}
const root = "";
const invalidCharacters = ["/", "*", "?", "[", "]", "!", "\\", "~", "|", "#", '"', "'", " "];
const oneValidCharacter = `[^${escapeRegExp(invalidCharacters.join(""))}]`;
const directoryRegexString = `^(?<directory>(?:${oneValidCharacter}+\\/)*)`;
const basicDirectoryRegex = new RegExp(directoryRegexString + "$");
function isDirectoryPath(path) {
  return basicDirectoryRegex.test(path);
}
const relativeRegex = /(?:^|\/)\.{1,2}\//;
function isAbsolutePath(path) {
  return !relativeRegex.test(path);
}
function resolveDirectory(path, base = root) {
  if (path.startsWith("/")) {
    base = root;
    path = path.substring(1);
  }
  if (path && !path.endsWith("/")) path = path + "/";
  if (!isDirectoryPath(path)) return null;
  return resolveValidatedDirectory(path, base);
}
function resolveValidatedDirectory(relative, absolute) {
  if (!relative) return absolute;
  const relativeArray = relative.split(/(?<=\/)/);
  const absoluteArray = absolute.split(/(?<=\/)/).filter(Boolean);
  while (relativeArray.length) {
    const nextDir = relativeArray.shift();
    switch (nextDir) {
      case "./":
        break;
      case "../":
        if (!absoluteArray.length) return null;
        absoluteArray.pop();
        break;
      default:
        absoluteArray.push(nextDir);
    }
  }
  return absoluteArray.join("");
}
function getFirstDirectoryInPath(path) {
  const firstSlashIndex = path.indexOf("/");
  if (firstSlashIndex === -1) return null;
  return path.substring(0, firstSlashIndex + 1);
}
if (!isDirectoryPath(root) || !isAbsolutePath(root)) throw new Error("Root failed to validate");
export {
  directoryRegexString,
  getFirstDirectoryInPath,
  isAbsolutePath,
  isDirectoryPath,
  oneValidCharacter,
  resolveDirectory,
  resolveValidatedDirectory,
  root
};
