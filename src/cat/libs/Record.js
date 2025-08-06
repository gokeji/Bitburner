const getRecordValues = Object.values;
const getRecordKeys = Object.keys;
const getRecordEntries = Object.entries;
const createFullRecordFromEntries = Object.fromEntries;
const createPartialRecordFromEntries = Object.fromEntries;
function createEnumKeyedRecord(enumObj, valueFunction) {
  return createFullRecordFromEntries(Object.values(enumObj).map((member) => [member, valueFunction(member)]));
}
export {
  createEnumKeyedRecord,
  createFullRecordFromEntries,
  createPartialRecordFromEntries,
  getRecordEntries,
  getRecordKeys,
  getRecordValues
};
