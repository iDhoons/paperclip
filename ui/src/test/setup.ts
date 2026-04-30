import "@testing-library/jest-dom/vitest";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
}

function readStorage(target: typeof globalThis, key: "localStorage" | "sessionStorage"): Storage | null {
  try {
    const value = target[key];
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function ensureStorage(target: typeof globalThis, key: "localStorage" | "sessionStorage") {
  const current = readStorage(target, key);
  if (current && typeof current.clear === "function" && typeof current.getItem === "function") {
    return;
  }

  Object.defineProperty(target, key, {
    configurable: true,
    value: createMemoryStorage(),
  });
}

ensureStorage(globalThis, "localStorage");
ensureStorage(globalThis, "sessionStorage");

if (typeof window !== "undefined") {
  ensureStorage(window, "localStorage");
  ensureStorage(window, "sessionStorage");
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
