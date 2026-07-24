/**
 * DD-012 CrossRefService —— 交叉引用服务
 *
 * 文章间引用、反向链接、引用图谱、引用通知。
 * 依赖：DD-007 ArticleService、DD-015 NotificationService、DD-024 WalWriter。
 * 循环引用检测：detectCycle（DFS 三色染色）。
 */
import type { Article } from '../../types.js';
import { articleStore } from '../../stores/article-store.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';

export interface RefResult {
  articleId: string;
  addedCiteIds: string[];
  skippedCiteIds: string[];
}

export interface GraphNode {
  id: string;
  title: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface ReferenceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CrossRefServiceDeps {
  walWriter: WalWriter;
  notifyReference: (articleId: string, citeId: string) => Promise<void>;
}

export class CrossRefService {
  private forward: Map<string, Set<string>> = new Map(); // articleId -> 引用集合
  private backward: Map<string, Set<string>> = new Map(); // articleId -> 被引用集合
  private deps: CrossRefServiceDeps;

  constructor(deps: CrossRefServiceDeps) {
    this.deps = deps;
  }

  /** 检测循环引用（DFS 三色染色） */
  detectCycle(startId: string, targetId: string): boolean {
    if (startId === targetId) return true;
    const color = new Map<string, number>(); // 0=WHITE,1=GRAY,2=BLACK
    const stack: string[] = [targetId];
    while (stack.length > 0) {
      const node = stack.pop()!;
      const c = color.get(node) ?? 0;
      if (c === 2) continue; // BLACK
      if (c === 1) {
        // 回到 GRAY = 环
        if (node === startId) return true;
        color.set(node, 2);
        continue;
      }
      color.set(node, 1);
      stack.push(node); // 再次入栈以便标记 BLACK
      const refs = this.forward.get(node) ?? new Set<string>();
      for (const next of refs) {
        const nc = color.get(next) ?? 0;
        if (nc === 1) {
          if (next === startId) return true;
        }
        if (nc === 0) stack.push(next);
      }
    }
    return false;
  }

  /** 添加引用（对应 DD-012 addReference） */
  async addReference(articleId: string, citeIds: string[], actorId: string): Promise<RefResult> {
    if (!citeIds || citeIds.length === 0) {
      throw new AppError(40003, 'citeIds 不能为空');
    }
    if (citeIds.length > 20) {
      throw new AppError(40003, '引用文章至多 20 个', { count: citeIds.length });
    }
    const article = articleStore.findById(articleId);
    if (!article) {
      throw new AppError(40401, `文章不存在: ${articleId}`, { articleId });
    }
    if (article.authorId !== actorId) {
      throw new AppError(40302, '所有权校验失败', { articleId, actorId, ownerId: article.authorId });
    }
    const added: string[] = [];
    const skipped: string[] = [];
    for (const citeId of citeIds) {
      if (citeId === articleId) {
        skipped.push(citeId);
        continue;
      }
      const cited = articleStore.findById(citeId);
      if (!cited) {
        skipped.push(citeId);
        continue;
      }
      // 临时加入引用后检测环
      const existing = this.forward.get(articleId) ?? new Set<string>();
      if (existing.has(citeId)) {
        skipped.push(citeId);
        continue;
      }
      existing.add(citeId);
      this.forward.set(articleId, existing);
      if (this.detectCycle(articleId, citeId)) {
        // 回滚
        existing.delete(citeId);
        throw new AppError(60005, `检测到循环引用: ${articleId} -> ${citeId}`, { articleId, citeId });
      }
      // 反向索引
      let back = this.backward.get(citeId);
      if (!back) {
        back = new Set();
        this.backward.set(citeId, back);
      }
      back.add(articleId);
      // 同步 article.citeArticleIds
      const newCites = Array.from(new Set([...article.citeArticleIds, citeId]));
      articleStore.update(articleId, { citeArticleIds: newCites });
      added.push(citeId);
      await this.deps.notifyReference(articleId, citeId);
    }
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'crossref.add',
      payload: { articleId, added, skipped, actorId },
      timestamp: now,
    });
    return { articleId, addedCiteIds: added, skippedCiteIds: skipped };
  }

  /** 移除引用（对应 DD-012 removeReference） */
  async removeReference(articleId: string, citeId: string, actorId: string): Promise<void> {
    const article = articleStore.findById(articleId);
    if (!article) {
      throw new AppError(40401, `文章不存在: ${articleId}`, { articleId });
    }
    const existing = this.forward.get(articleId);
    if (!existing || !existing.has(citeId)) {
      throw new AppError(40401, '引用不存在', { articleId, citeId });
    }
    existing.delete(citeId);
    if (existing.size === 0) this.forward.delete(articleId);
    const back = this.backward.get(citeId);
    back?.delete(articleId);
    if (back && back.size === 0) this.backward.delete(citeId);
    // 同步 article.citeArticleIds
    const newCites = article.citeArticleIds.filter(c => c !== citeId);
    articleStore.update(articleId, { citeArticleIds: newCites });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'crossref.remove',
      payload: { articleId, citeId, actorId },
      timestamp: now,
    });
  }

  /** 反向引用列表（对应 DD-012 getBackReferences） */
  getBackReferences(articleId: string): Article[] {
    const back = this.backward.get(articleId) ?? new Set<string>();
    return Array.from(back)
      .map(id => articleStore.findById(id))
      .filter((a): a is Article => a !== null);
  }

  /** 引用图谱（对应 DD-012 getReferenceGraph） */
  getReferenceGraph(articleId: string, depth: number): ReferenceGraph {
    if (depth < 1 || depth > 3) {
      throw new AppError(40003, 'depth 必须 ∈ [1,3]', { depth });
    }
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();
    const queue: { id: string; d: number }[] = [{ id: articleId, d: 0 }];
    while (queue.length > 0) {
      const { id, d } = queue.shift()!;
      if (visited.has(id)) continue;
      if (d > depth) continue;
      visited.add(id);
      const article = articleStore.findById(id);
      if (article) {
        nodes.set(id, { id, title: article.title });
      } else {
        nodes.set(id, { id, title: '(unknown)' });
      }
      if (d < depth) {
        const refs = this.forward.get(id) ?? new Set<string>();
        for (const next of refs) {
          edges.push({ from: id, to: next });
          if (!visited.has(next)) queue.push({ id: next, d: d + 1 });
        }
      }
    }
    return { nodes: Array.from(nodes.values()), edges };
  }

  /** 测试重置 */
  clear(): void {
    this.forward.clear();
    this.backward.clear();
  }
}
