export function toBool(value: string): boolean {
  return value === 'true';
}

export function getUniqueValuesFromObjectArray(array: any[], key: string) {
  let valuesArray = [];
  array.forEach((value) => {
    valuesArray.push(value[key]);
  });
  return Array.from(new Set(valuesArray));
}

export function findAndUnshiftElement(array: any[], value: any) {
  return array.unshift(array.splice(array.indexOf(value), 1)[0]);
}
