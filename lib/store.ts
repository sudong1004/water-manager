import { promises as fs } from "fs";
import path from "path";

let queue: Promise<unknown> = Promise.resolve();
// 동시 쓰기 충돌 방지: 모든 파일 작업을 한 줄로 순서대로 실행
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
}

const file = (name: string) => path.join(process.cwd(), "data", `${name}.json`);

export async function readAll<T>(name: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(file(name), "utf-8"));
  } catch {
    return [];
  }
}

async function writeAll<T>(name: string, list: T[]) {
  await fs.mkdir(path.dirname(file(name)), { recursive: true });
  const tmp = file(name) + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(list, null, 1), "utf-8");
  await fs.rename(tmp, file(name));
}

/** 읽기-수정-쓰기를 원자적으로 */
export const mutate = <T, R>(name: string, fn: (list: T[]) => { list: T[]; result: R }) =>
  serial(async () => {
    const { list, result } = fn(await readAll<T>(name));
    await writeAll(name, list);
    return result;
  });

/** 여러 컬렉션을 한 번에 수정 (고객 삭제 시 수납/이력 함께 삭제 등) */

export function nextId(list: { id: string }[]) {
  const max = list.reduce((m, c) => Math.max(m, parseInt(c.id, 10) || 0), 0);
  return String(max + 1);
}
