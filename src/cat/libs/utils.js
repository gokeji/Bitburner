function assertIsNumber(value, errorMessage = "Not a number") {
  if (typeof value !== "number") {
    throw new Error(errorMessage);
  }
}
function assertIsString(value, errorMessage = "Not a string") {
  if (typeof value !== "string") {
    throw new Error(errorMessage);
  }
}
function removeItemFromArray(array, item) {
  array.forEach((value, index) => {
    if (value === item) {
      array.splice(index, 1);
    }
  });
}
function parseNumber(input) {
  if (input === null || input === "") {
    return NaN;
  }
  return Number(input);
}
function mapToJson(map) {
  return JSON.stringify(map, (_key, value) => value instanceof Map ? [...value] : value);
}
function downloadData(data, filename = Date.now().toString()) {
  const file = new Blob([data], { type: "text/plain" });
  const element = document.createElement("a");
  const url = URL.createObjectURL(file);
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  setTimeout(function() {
    document.body.removeChild(element);
    window.URL.revokeObjectURL(url);
  }, 0);
}
function scaleValueToRange(value, currentMin, currentMax, newMin, newMax) {
  return (value - currentMin) * (newMax - newMin) / (currentMax - currentMin) + newMin;
}
function sum(numbers) {
  return numbers.reduce((sum2, value) => sum2 + value, 0);
}
function mean(numbers) {
  return sum(numbers) / numbers.length;
}
function median(numbers) {
  const sorted = numbers.toSorted();
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}
function getRandomIntegerLessThan(range) {
  const maxRange = 4294967296;
  const randLimit = maxRange - maxRange % range;
  let sample;
  let count = 0;
  const maxIter = 100;
  do {
    sample = self.crypto.getRandomValues(new Uint32Array(1))[0];
    if (count >= maxIter) {
      throw new Error("Too many iterations. Check your source of randomness.");
    }
    count++;
  } while (sample >= randLimit);
  return sample % range;
}
function getRandomInteger(min, max) {
  if (min > max) {
    throw new Error(`Min is larger than max. Min: ${min}. Max: ${max}.`);
  }
  if (min === 0 && max === 0) {
    throw new Error(`Invalid range. Min and max must not be both 0.`);
  }
  return min + getRandomIntegerLessThan(max - min);
}
export {
  assertIsNumber,
  assertIsString,
  downloadData,
  getRandomInteger,
  getRandomIntegerLessThan,
  mapToJson,
  mean,
  median,
  parseNumber,
  removeItemFromArray,
  scaleValueToRange,
  sum
};
