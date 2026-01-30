/**
 * Serialize parameters for Moodle Web Services API
 *
 * Moodle expects parameters in a specific format:
 * - Arrays: param[0][key]=value, param[1][key]=value
 * - Objects: param[key]=value
 * - Primitives: param=value
 */

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export type SerializableParams = Record<string, SerializableValue>;

/**
 * Recursively serialize an object into URLSearchParams format for Moodle
 */
export function serializeParams(
  params: SerializableParams,
  prefix: string = ""
): URLSearchParams {
  const searchParams = new URLSearchParams();

  function appendParam(key: string, value: SerializableValue): void {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === "boolean") {
      searchParams.append(key, value ? "1" : "0");
    } else if (typeof value === "number") {
      searchParams.append(key, String(value));
    } else if (typeof value === "string") {
      searchParams.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const arrayKey = `${key}[${index}]`;
        if (typeof item === "object" && item !== null) {
          Object.entries(item as Record<string, SerializableValue>).forEach(
            ([subKey, subValue]) => {
              appendParam(`${arrayKey}[${subKey}]`, subValue);
            }
          );
        } else {
          appendParam(arrayKey, item);
        }
      });
    } else if (typeof value === "object") {
      Object.entries(value).forEach(([subKey, subValue]) => {
        appendParam(`${key}[${subKey}]`, subValue);
      });
    }
  }

  Object.entries(params).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    appendParam(fullKey, value);
  });

  return searchParams;
}

/**
 * Merge URLSearchParams with base parameters
 */
export function mergeParams(
  base: URLSearchParams,
  additional: URLSearchParams
): URLSearchParams {
  const merged = new URLSearchParams(base);
  additional.forEach((value, key) => {
    merged.append(key, value);
  });
  return merged;
}
