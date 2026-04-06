/**
 * YAML frontmatter 파서 — 외부 의존성 없이 간단한 파싱
 *
 * task_plan.md 맨 위의 --- 블록을 파싱한다.
 * 지원: string, number, boolean, string[] (YAML flow sequence)
 */

export interface RawFrontmatter {
  [key: string]: string | number | boolean | string[];
}

/**
 * 마크다운 파일에서 frontmatter를 추출한다.
 * @returns { data: 파싱된 객체, content: frontmatter 제외 본문 }
 */
export function parseFrontmatter(raw: string): {
  data: RawFrontmatter;
  content: string;
} {
  const trimmed = raw.trimStart();

  // frontmatter가 없는 경우
  if (!trimmed.startsWith("---")) {
    return { data: {}, content: raw };
  }

  // 두 번째 --- 찾기
  const endIdx = trimmed.indexOf("\n---", 3);
  if (endIdx === -1) {
    return { data: {}, content: raw };
  }

  const yamlBlock = trimmed.slice(4, endIdx); // "---\n" 이후부터
  const content = trimmed.slice(endIdx + 4).trimStart(); // 닫는 "---\n" 이후

  const data: RawFrontmatter = {};

  for (const line of yamlBlock.split("\n")) {
    const trimLine = line.trim();
    if (!trimLine || trimLine.startsWith("#")) continue;

    const colonIdx = trimLine.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimLine.slice(0, colonIdx).trim();
    const rawValue = trimLine.slice(colonIdx + 1).trim();

    data[key] = parseYamlValue(rawValue);
  }

  return { data, content };
}

/** 단순 YAML 값 파서 */
function parseYamlValue(raw: string): string | number | boolean | string[] {
  // boolean
  if (raw === "true") return true;
  if (raw === "false") return false;

  // number
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^\d+\.\d+$/.test(raw)) return parseFloat(raw);

  // array: [item1, item2] (YAML flow sequence)
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1);
    if (!inner.trim()) return [];
    return inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
  }

  // string (따옴표 제거)
  return raw.replace(/^["']|["']$/g, "");
}
