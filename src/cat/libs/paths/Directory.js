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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vc3JjL2xpYnMvcGF0aHMvRGlyZWN0b3J5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgdHlwZSB7RmlsZVBhdGh9IGZyb20gXCIvbGlicy9wYXRocy9GaWxlUGF0aFwiO1xuXG4vKipcbiAqIFVzZWQgdG8gbWF0Y2ggYFJlZ0V4cGBcbiAqIFtzeW50YXggY2hhcmFjdGVyc10oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNy4wLyNzZWMtcGF0dGVybnMpLlxuICovXG5jb25zdCByZVJlZ0V4cENoYXIgPSAvW1xcXFxeJC4qKz8oKVtcXF17fXxdL2c7XG5jb25zdCByZUhhc1JlZ0V4cENoYXIgPSBSZWdFeHAocmVSZWdFeHBDaGFyLnNvdXJjZSk7XG5cbi8qKlxuICogRXNjYXBlcyB0aGUgYFJlZ0V4cGAgc3BlY2lhbCBjaGFyYWN0ZXJzIFwiXlwiLCBcIiRcIiwgXCJcXFwiLCBcIi5cIiwgXCIqXCIsIFwiK1wiLFxuICogXCI/XCIsIFwiKFwiLCBcIilcIiwgXCJbXCIsIFwiXVwiLCBcIntcIiwgXCJ9XCIsIGFuZCBcInxcIiBpbiBgc3RyaW5nYC5cbiAqXG4gKiBAc2luY2UgMy4wLjBcbiAqIEBjYXRlZ29yeSBTdHJpbmdcbiAqIEBwYXJhbSB7c3RyaW5nfSBbc3RyaW5nPScnXSBUaGUgc3RyaW5nIHRvIGVzY2FwZS5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGVzY2FwZWQgc3RyaW5nLlxuICogQHNlZSBlc2NhcGUsIGVzY2FwZVJlZ0V4cCwgdW5lc2NhcGVcbiAqIEBleGFtcGxlXG4gKlxuICogZXNjYXBlUmVnRXhwKCdbbG9kYXNoXShodHRwczovL2xvZGFzaC5jb20vKScpXG4gKiAvLyA9PiAnXFxbbG9kYXNoXFxdXFwoaHR0cHM6Ly9sb2Rhc2hcXC5jb20vXFwpJ1xuICovXG5mdW5jdGlvbiBlc2NhcGVSZWdFeHAoc3RyaW5nOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nICYmIHJlSGFzUmVnRXhwQ2hhci50ZXN0KHN0cmluZylcbiAgICAgICAgPyBzdHJpbmcucmVwbGFjZShyZVJlZ0V4cENoYXIsIFwiXFxcXCQmXCIpXG4gICAgICAgIDogc3RyaW5nIHx8IFwiXCI7XG59XG5cbi8qKiBUaGUgZGlyZWN0b3J5IHBhcnQgb2YgYSBCYXNpY0ZpbGVQYXRoLiBFdmVyeXRoaW5nIHVwIHRvIGFuZCBpbmNsdWRpbmcgdGhlIGxhc3QgL1xuICogZS5nLiBcImZpbGUuanNcIiA9PiBcIlwiLCBvciBcImRpci9maWxlLmpzXCIgPT4gXCJkaXIvXCIsIG9yIFwiLi4vdGVzdC5qc1wiID0+IFwiLi4vXCIgKi9cbmV4cG9ydCB0eXBlIEJhc2ljRGlyZWN0b3J5ID0gc3RyaW5nICYgeyBfX3R5cGU6IFwiRGlyZWN0b3J5XCI7IH07XG5cbi8qKiBUeXBlIGZvciB1c2UgaW4gRGlyZWN0b3J5IGFuZCBGaWxlUGF0aCB0byBpbmRpY2F0ZSBwYXRoIGlzIGFic29sdXRlICovXG5leHBvcnQgdHlwZSBBYnNvbHV0ZVBhdGggPSBzdHJpbmcgJiB7IF9fYWJzb2x1dGVQYXRoOiB0cnVlOyB9O1xuXG4vKiogQSBkaXJlY3RvcnkgcGF0aCB0aGF0IGlzIGFsc28gYWJzb2x1dGUuIEFic29sdXRlIFJ1bGVzIChGaWxlUGF0aCBhbmQgRGlyZWN0b3J5UGF0aCk6XG4gKiAxLiBTcGVjaWZpYyBkaXJlY3RvcnkgbmFtZXMgXCIuXCIgYW5kIFwiLi5cIiBhcmUgZGlzYWxsb3dlZCAqL1xuZXhwb3J0IHR5cGUgRGlyZWN0b3J5ID0gQmFzaWNEaXJlY3RvcnkgJiBBYnNvbHV0ZVBhdGg7XG5leHBvcnQgY29uc3Qgcm9vdCA9IFwiXCIgYXMgRGlyZWN0b3J5O1xuXG4vKiogSW52YWxpZCBjaGFyYWN0ZXJzIGluIGFjdHVhbCBmaWxlcGF0aHMgYW5kIGRpcmVjdG9yeSBuYW1lczpcbiAqIC86IEludmFsaWQgYmVjYXVzZSBpdCBpcyB0aGUgZGlyZWN0b3J5IHNlcGFyYXRvci4gSXQncyBhbGxvd2VkIGluIHRoZSBkaXJlY3RvcnkgcGFydCwgYnV0IG9ubHkgYXMgdGhlIHNlcGFyYXRvci5cbiAqICosID8sIFssIGFuZCBdOiBJbnZhbGlkIGluIGFjdHVhbCBwYXRocyBiZWNhdXNlIHRoZXkgYXJlIHVzZWQgZm9yIGdsb2JiaW5nLlxuICogITogSW52YWxpZCBiZWNhdXNlIGl0IGNvbmZsaWN0cyB3aXRoIHRlcm1pbmFsIGhpc3RvcnkgZmV0Y2hpbmdcbiAqIFxcOiBJbnZhbGlkIHRvIGF2b2lkIGNvbmZ1c2lvbiB3aXRoIGFuIGVzY2FwZSBjaGFyYWN0ZXJcbiAqIH46IEludmFsaWQgYmVjYXVzZSBpdCBtaWdodCBoYXZlIGEgdXNlIGluIHRoZSB0ZXJtaW5hbCBpbiB0aGUgZnV0dXJlLlxuICogfDogSW52YWxpZCBiZWNhdXNlIGl0IG1pZ2h0IGhhdmUgYSB1c2UgaW4gdGhlIHRlcm1pbmFsIGluIHRoZSBmdXR1cmUuXG4gKiAjOiBJbnZhbGlkIGJlY2F1c2UgaXQgbWlnaHQgaGF2ZSBhIHVzZSBpbiB0aGUgdGVybWluYWwgaW4gdGhlIGZ1dHVyZS5cbiAqIChxdW90ZSBtYXJrcyk6IEludmFsaWQgdG8gYXZvaWQgY29uZmxpY3Qgd2l0aCBxdW90ZSBtYXJrcyB1c2VkIGluIHRoZSB0ZXJtaW5hbC5cbiAqIChzcGFjZSk6IEludmFsaWQgdG8gYXZvaWQgY29uZnVzaW9uIHdpdGggdGVybWluYWwgY29tbWFuZCBzZXBhcmF0b3IgKi9cbmNvbnN0IGludmFsaWRDaGFyYWN0ZXJzID0gW1wiL1wiLCBcIipcIiwgXCI/XCIsIFwiW1wiLCBcIl1cIiwgXCIhXCIsIFwiXFxcXFwiLCBcIn5cIiwgXCJ8XCIsIFwiI1wiLCBcIlxcXCJcIiwgXCInXCIsIFwiIFwiXTtcblxuLyoqIEEgdmFsaWQgY2hhcmFjdGVyIGlzIGFueSBjaGFyYWN0ZXIgdGhhdCBpcyBub3Qgb25lIG9mIHRoZSBpbnZhbGlkIGNoYXJhY3RlcnMgKi9cbmV4cG9ydCBjb25zdCBvbmVWYWxpZENoYXJhY3RlciA9IGBbXiR7ZXNjYXBlUmVnRXhwKGludmFsaWRDaGFyYWN0ZXJzLmpvaW4oXCJcIikpfV1gO1xuXG4vKiogUmVnZXggc3RyaW5nIGZvciBtYXRjaGluZyB0aGUgZGlyZWN0b3J5IHBhcnQgb2YgYSB2YWxpZCBmaWxlcGF0aCAqL1xuZXhwb3J0IGNvbnN0IGRpcmVjdG9yeVJlZ2V4U3RyaW5nID0gYF4oPzxkaXJlY3Rvcnk+KD86JHtvbmVWYWxpZENoYXJhY3Rlcn0rXFxcXC8pKilgO1xuXG4vKiogQWN0dWFsIFJlZ0V4cCBmb3IgdmFsaWRhdGluZyB0aGF0IGFuIGVudGlyZSBzdHJpbmcgaXMgYSBCYXNpY0RpcmVjdG9yeSAqL1xuY29uc3QgYmFzaWNEaXJlY3RvcnlSZWdleCA9IG5ldyBSZWdFeHAoZGlyZWN0b3J5UmVnZXhTdHJpbmcgKyBcIiRcIik7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RpcmVjdG9yeVBhdGgocGF0aDogc3RyaW5nKTogcGF0aCBpcyBCYXNpY0RpcmVjdG9yeSB7XG4gICAgcmV0dXJuIGJhc2ljRGlyZWN0b3J5UmVnZXgudGVzdChwYXRoKTtcbn1cblxuLyoqIFJlZ2V4IHRvIGNoZWNrIGlmIHJlbGF0aXZlIHBhcnRzIGFyZSBpbmNsdWRlZCAoZGlyZWN0b3J5IG5hbWVzIFwiLi5cIiBhbmQgXCIuXCIpICovXG5jb25zdCByZWxhdGl2ZVJlZ2V4ID0gLyg/Ol58XFwvKVxcLnsxLDJ9XFwvLztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzQWJzb2x1dGVQYXRoKHBhdGg6IHN0cmluZyk6IHBhdGggaXMgQWJzb2x1dGVQYXRoIHtcbiAgICByZXR1cm4gIXJlbGF0aXZlUmVnZXgudGVzdChwYXRoKTtcbn1cblxuLyoqIFNhbml0aXplIGFuZCByZXNvbHZlIGEgcGxheWVyLXByb3ZpZGVkIHBvdGVudGlhbGx5LXJlbGF0aXZlIHBhdGggdG8gYW4gYWJzb2x1dGUgcGF0aC5cbiAqIEBwYXJhbSBwYXRoIFRoZSBwbGF5ZXItcHJvdmlkZWQgZGlyZWN0b3J5IHBhdGgsIGUuZy4gMm5kIGFyZ3VtZW50IGZvciB0ZXJtaW5hbCBjcCBjb21tYW5kXG4gKiBAcGFyYW0gYmFzZSBUaGUgc3RhcnRpbmcgZGlyZWN0b3J5LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVEaXJlY3RvcnkocGF0aDogc3RyaW5nLCBiYXNlID0gcm9vdCk6IERpcmVjdG9yeSB8IG51bGwge1xuICAgIC8vIEFsd2F5cyB1c2UgYWJzb2x1dGUgcGF0aCBpZiBwbGF5ZXItcHJvdmlkZWQgcGF0aCBzdGFydHMgd2l0aCAvXG4gICAgaWYgKHBhdGguc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICAgICAgYmFzZSA9IHJvb3Q7XG4gICAgICAgIHBhdGggPSBwYXRoLnN1YnN0cmluZygxKTtcbiAgICB9XG4gICAgLy8gQWRkIGEgdHJhaWxpbmcgLyBpZiBpdCBpcyBub3QgcHJlc2VudFxuICAgIGlmIChwYXRoICYmICFwYXRoLmVuZHNXaXRoKFwiL1wiKSkgcGF0aCA9IHBhdGggKyBcIi9cIjtcbiAgICBpZiAoIWlzRGlyZWN0b3J5UGF0aChwYXRoKSkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIHJlc29sdmVWYWxpZGF0ZWREaXJlY3RvcnkocGF0aCwgYmFzZSk7XG59XG5cbi8qKiBSZXNvbHZlIGFuIGFscmVhZHktdHlwZWNoZWNrZWQgZGlyZWN0b3J5IHBhdGggd2l0aCByZXNwZWN0IHRvIGFuIGFic29sdXRlIHBhdGggKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlVmFsaWRhdGVkRGlyZWN0b3J5KHJlbGF0aXZlOiBCYXNpY0RpcmVjdG9yeSwgYWJzb2x1dGU6IERpcmVjdG9yeSk6IERpcmVjdG9yeSB8IG51bGwge1xuICAgIGlmICghcmVsYXRpdmUpIHJldHVybiBhYnNvbHV0ZTtcbiAgICBjb25zdCByZWxhdGl2ZUFycmF5ID0gcmVsYXRpdmUuc3BsaXQoLyg/PD1cXC8pLyk7XG4gICAgY29uc3QgYWJzb2x1dGVBcnJheSA9IGFic29sdXRlLnNwbGl0KC8oPzw9XFwvKS8pLmZpbHRlcihCb29sZWFuKTtcbiAgICB3aGlsZSAocmVsYXRpdmVBcnJheS5sZW5ndGgpIHtcbiAgICAgICAgLy8gV2UganVzdCBjaGVja2VkIGxlbmd0aCBzbyB3ZSBrbm93IHRoaXMgaXMgYSBzdHJpbmdcbiAgICAgICAgY29uc3QgbmV4dERpciA9IHJlbGF0aXZlQXJyYXkuc2hpZnQoKSBhcyBzdHJpbmc7XG4gICAgICAgIHN3aXRjaCAobmV4dERpcikge1xuICAgICAgICAgICAgY2FzZSBcIi4vXCI6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiLi4vXCI6XG4gICAgICAgICAgICAgICAgaWYgKCFhYnNvbHV0ZUFycmF5Lmxlbmd0aCkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgYWJzb2x1dGVBcnJheS5wb3AoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYWJzb2x1dGVBcnJheS5wdXNoKG5leHREaXIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhYnNvbHV0ZUFycmF5LmpvaW4oXCJcIikgYXMgRGlyZWN0b3J5O1xufVxuXG4vKiogUmV0dXJucyB0aGUgZmlyc3QgZGlyZWN0b3J5LCBvdGhlciB0aGFuIHJvb3QsIGluIGEgZmlsZSBwYXRoLiBJZiBpbiByb290LCByZXR1cm5zIG51bGwuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0Rmlyc3REaXJlY3RvcnlJblBhdGgocGF0aDogRmlsZVBhdGggfCBEaXJlY3RvcnkpOiBEaXJlY3RvcnkgfCBudWxsIHtcbiAgICBjb25zdCBmaXJzdFNsYXNoSW5kZXggPSBwYXRoLmluZGV4T2YoXCIvXCIpO1xuICAgIGlmIChmaXJzdFNsYXNoSW5kZXggPT09IC0xKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gcGF0aC5zdWJzdHJpbmcoMCwgZmlyc3RTbGFzaEluZGV4ICsgMSkgYXMgRGlyZWN0b3J5O1xufVxuXG4vLyBUaGlzIGlzIHRvIHZhbGlkYXRlIHRoZSBhc3NlcnRpb24gZWFybGllciB0aGF0IHJvb3QgaXMgaW4gZmFjdCBhIERpcmVjdG9yeVxuaWYgKCFpc0RpcmVjdG9yeVBhdGgocm9vdCkgfHwgIWlzQWJzb2x1dGVQYXRoKHJvb3QpKSB0aHJvdyBuZXcgRXJyb3IoXCJSb290IGZhaWxlZCB0byB2YWxpZGF0ZVwiKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLE1BQU0sZUFBZTtBQUNyQixNQUFNLGtCQUFrQixPQUFPLGFBQWEsTUFBTTtBQWdCbEQsU0FBUyxhQUFhLFFBQWdCO0FBQ2xDLFNBQU8sVUFBVSxnQkFBZ0IsS0FBSyxNQUFNLElBQ3RDLE9BQU8sUUFBUSxjQUFjLE1BQU0sSUFDbkMsVUFBVTtBQUNwQjtBQVlPLE1BQU0sT0FBTztBQVlwQixNQUFNLG9CQUFvQixDQUFDLEtBQUssS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLE1BQU0sS0FBSyxLQUFLLEtBQUssS0FBTSxLQUFLLEdBQUc7QUFHckYsTUFBTSxvQkFBb0IsS0FBSyxhQUFhLGtCQUFrQixLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBR3ZFLE1BQU0sdUJBQXVCLG9CQUFvQixpQkFBaUI7QUFHekUsTUFBTSxzQkFBc0IsSUFBSSxPQUFPLHVCQUF1QixHQUFHO0FBRTFELFNBQVMsZ0JBQWdCLE1BQXNDO0FBQ2xFLFNBQU8sb0JBQW9CLEtBQUssSUFBSTtBQUN4QztBQUdBLE1BQU0sZ0JBQWdCO0FBRWYsU0FBUyxlQUFlLE1BQW9DO0FBQy9ELFNBQU8sQ0FBQyxjQUFjLEtBQUssSUFBSTtBQUNuQztBQUtPLFNBQVMsaUJBQWlCLE1BQWMsT0FBTyxNQUF3QjtBQUUxRSxNQUFJLEtBQUssV0FBVyxHQUFHLEdBQUc7QUFDdEIsV0FBTztBQUNQLFdBQU8sS0FBSyxVQUFVLENBQUM7QUFBQSxFQUMzQjtBQUVBLE1BQUksUUFBUSxDQUFDLEtBQUssU0FBUyxHQUFHLEVBQUcsUUFBTyxPQUFPO0FBQy9DLE1BQUksQ0FBQyxnQkFBZ0IsSUFBSSxFQUFHLFFBQU87QUFDbkMsU0FBTywwQkFBMEIsTUFBTSxJQUFJO0FBQy9DO0FBR08sU0FBUywwQkFBMEIsVUFBMEIsVUFBdUM7QUFDdkcsTUFBSSxDQUFDLFNBQVUsUUFBTztBQUN0QixRQUFNLGdCQUFnQixTQUFTLE1BQU0sU0FBUztBQUM5QyxRQUFNLGdCQUFnQixTQUFTLE1BQU0sU0FBUyxFQUFFLE9BQU8sT0FBTztBQUM5RCxTQUFPLGNBQWMsUUFBUTtBQUV6QixVQUFNLFVBQVUsY0FBYyxNQUFNO0FBQ3BDLFlBQVEsU0FBUztBQUFBLE1BQ2IsS0FBSztBQUNEO0FBQUEsTUFDSixLQUFLO0FBQ0QsWUFBSSxDQUFDLGNBQWMsT0FBUSxRQUFPO0FBQ2xDLHNCQUFjLElBQUk7QUFDbEI7QUFBQSxNQUNKO0FBQ0ksc0JBQWMsS0FBSyxPQUFPO0FBQUEsSUFDbEM7QUFBQSxFQUNKO0FBQ0EsU0FBTyxjQUFjLEtBQUssRUFBRTtBQUNoQztBQUdPLFNBQVMsd0JBQXdCLE1BQThDO0FBQ2xGLFFBQU0sa0JBQWtCLEtBQUssUUFBUSxHQUFHO0FBQ3hDLE1BQUksb0JBQW9CLEdBQUksUUFBTztBQUNuQyxTQUFPLEtBQUssVUFBVSxHQUFHLGtCQUFrQixDQUFDO0FBQ2hEO0FBR0EsSUFBSSxDQUFDLGdCQUFnQixJQUFJLEtBQUssQ0FBQyxlQUFlLElBQUksRUFBRyxPQUFNLElBQUksTUFBTSx5QkFBeUI7IiwKICAibmFtZXMiOiBbXQp9Cg==
