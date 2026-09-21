/**
 * coding-plan logic 层的 Node 文件系统适配器（`CodingPlanFs` 生产实现）。
 *
 * WS-A（logic 层零 `node:fs`）：`logic/coding-plan-logic.ts` 只依赖注入的结构化端口
 * `CodingPlanFs`；本文件是唯一触碰 `node:fs` 的适配点，由 CLI 壳
 * （`cli/check-coding-plan.ts` / `cli/check-artifact-gate.ts` / `cli/self-test.ts`）
 * import 后传入。依赖边界（`__tests__/dependency-boundaries.test.ts`）：lib → logic
 * 运行时边禁止，故本文件对 logic 只允许 `import type`（类型边不参与运行时图）。
 *
 * 原 `security/detect-non-literal-fs-filename` 豁免随 `node:fs` 直连自
 * `logic/coding-plan-logic.ts` 迁入本文件（logic 层摘除后不再保留该 disable）。
 *
 * @module
 */
import * as fs from 'node:fs';

import type { CodingPlanFs } from '../logic/coding-plan-logic.js';

/** `node:fs` 只读子集包装（`CodingPlanFs` 生产实现；UTF-8 文本读入在此固定） */
export const nodeCodingPlanFs: CodingPlanFs = {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 适配器边界：p 由受控 logic 层以 projectRoot 拼接（自 coding-plan-logic.ts 随迁），本文件是唯一 node:fs 触点
  existsSync: (p: string): boolean => fs.existsSync(p),
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上；UTF-8 文本读入由适配器固定
  readFileSync: (p: string): string => fs.readFileSync(p, 'utf-8'),
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上；logic 层仅消费 isFile/size 两个只读字段
  statSync: (p: string): { isFile(): boolean; size: number } => fs.statSync(p),
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上；仅枚举目录条目名、不做任何写入
  readdirSync: (p: string, opts: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }> =>
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上（prettier 换行使调用独占一行，disable 随行）
    fs.readdirSync(p, opts),
};
