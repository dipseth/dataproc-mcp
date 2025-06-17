/**
 * Object utility functions
 */

/**
 * Performs a deep merge of two or more objects.
 * Recursively merges properties, ensuring that nested objects are augmented rather than replaced.
 * Arrays are replaced entirely (not merged).
 *
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @returns A new object with deeply merged properties
 */
export function deepMerge<T extends object, U extends object>(target: T, source: U): T & U {
  const output = { ...target } as T & U;

  if (target && typeof target === 'object' && source && typeof source === 'object') {
    Object.keys(source).forEach((key) => {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        // Recursively merge nested objects
        output[key] = deepMerge(target[key] as object, source[key] as object) as (T & U)[Extract<
          keyof T & keyof U,
          string
        >];
      } else {
        // Replace primitive values and arrays
        output[key] = source[key] as (T & U)[Extract<keyof T & keyof U, string>];
      }
    });
  }

  return output;
}

/**
 * Performs a deep merge of multiple objects.
 *
 * @param objects - Array of objects to merge
 * @returns A new object with all properties deeply merged
 */
export function deepMergeMultiple<T extends object>(...objects: T[]): T {
  return objects.reduce((result, obj) => deepMerge(result, obj), {} as T);
}
