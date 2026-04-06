/**
 * Plan Watcher — task_plan.md 파일 변경을 감지하여 자동 온보딩 트리거
 *
 * chokidar로 지정된 디렉토리를 감시하고,
 * task_plan.md가 생성/수정되면 콜백을 호출한다.
 */

import { watch, type FSWatcher } from "chokidar";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface WatcherOptions {
  /** 감시할 디렉토리 목록 */
  watchPaths: string[];
  /** 파일 변경 시 호출할 콜백 */
  onPlanChanged: (filePath: string, content: string) => void | Promise<void>;
  /** 디바운스 시간 (ms, 기본: 2000) */
  debounceMs?: number;
}

// ---------------------------------------------------------------------------
// Plan Watcher
// ---------------------------------------------------------------------------

export function createPlanWatcher(options: WatcherOptions): {
  start: () => void;
  stop: () => Promise<void>;
} {
  let watcher: FSWatcher | null = null;
  const debounceMs = options.debounceMs ?? 2000;

  // 파일별 해시 캐시 (중복 트리거 방지)
  const hashCache = new Map<string, string>();
  // 파일별 디바운스 타이머
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async function handleChange(filePath: string): Promise<void> {
    // 디바운스: 짧은 시간 내 여러 번 저장해도 한 번만 실행
    if (debounceTimers.has(filePath)) {
      clearTimeout(debounceTimers.get(filePath));
    }

    debounceTimers.set(
      filePath,
      setTimeout(async () => {
        debounceTimers.delete(filePath);

        try {
          const content = await readFile(filePath, "utf-8");
          const hash = createHash("sha256")
            .update(content)
            .digest("hex")
            .slice(0, 16);

          // 해시가 같으면 실제 변경 없음 (에디터 저장 등)
          if (hashCache.get(filePath) === hash) return;
          hashCache.set(filePath, hash);

          await options.onPlanChanged(filePath, content);
        } catch (err) {
          console.error(
            `[plan-watcher] ${filePath} 처리 실패:`,
            err instanceof Error ? err.message : err,
          );
        }
      }, debounceMs),
    );
  }

  return {
    start() {
      const globPatterns = options.watchPaths.map(
        (dir) => `${dir}/**/task_plan.md`,
      );

      watcher = watch(globPatterns, {
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      });

      watcher.on("add", (path) => handleChange(path));
      watcher.on("change", (path) => handleChange(path));

      console.log(
        `[plan-watcher] 감시 시작: ${options.watchPaths.join(", ")}`,
      );
    },

    async stop() {
      // 디바운스 타이머 정리
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
      hashCache.clear();

      if (watcher) {
        await watcher.close();
        watcher = null;
        console.log("[plan-watcher] 감시 중지");
      }
    },
  };
}
