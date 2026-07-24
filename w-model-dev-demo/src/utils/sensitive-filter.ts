/**
 * DD-014 SensitiveFilter —— 敏感词过滤
 *
 * 内置 ≥20 词词库 + 管理员扩展。Aho-Corasick 简化版（按长度降序替换）。
 * 替换字符默认 ***。
 */
import { AppError } from './errors.js';
import type { Role } from '../types.js';

/** 内置敏感词词库（≥20 词） */
const BUILTIN_WORDS: readonly string[] = [
  '色情', '赌博', '毒品', '诈骗', '枪支', '弹药', '爆炸物',
  '反动', '传销', '洗钱', '黑客', '攻击', '入侵', '病毒',
  '恶意', '钓鱼', '木马', '勒索', '走私', '贩毒',
];

export interface FilterResult {
  filtered: string;
  hits: string[];
}

export class SensitiveFilter {
  private words: Set<string>;
  private readonly replacement: string;

  constructor(replacement = '***', builtinWords: readonly string[] = BUILTIN_WORDS) {
    this.replacement = replacement;
    this.words = new Set(builtinWords);
  }

  /**
   * 过滤文本：按词长度降序替换为 ***（对应 DD-014 filter 算法）。
   */
  filter(text: string): FilterResult {
    if (!text || text.length === 0) {
      return { filtered: '', hits: [] };
    }
    // 按长度降序排列，避免短词替换影响长词匹配
    const sortedWords = Array.from(this.words).sort((a, b) => b.length - a.length);
    let filtered = text;
    const hits: string[] = [];
    for (const word of sortedWords) {
      if (word.length === 0) continue;
      if (filtered.includes(word)) {
        hits.push(word);
        // 转义正则特殊字符
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escaped, 'g'), this.replacement);
      }
    }
    return { filtered, hits };
  }

  /** 添加敏感词（admin 角色，对应 DD-014 addWord） */
  addWord(word: string, actorRole: Role): void {
    if (actorRole !== 'admin' && actorRole !== 'super_admin') {
      throw new AppError(40301, '仅管理员可添加敏感词');
    }
    if (word && word.length > 0) {
      this.words.add(word);
    }
  }

  /** 移除敏感词（admin 角色，对应 DD-014 removeWord） */
  removeWord(word: string, actorRole: Role): void {
    if (actorRole !== 'admin' && actorRole !== 'super_admin') {
      throw new AppError(40301, '仅管理员可移除敏感词');
    }
    this.words.delete(word);
  }

  /** 批量加载（替换词库，对应 DD-014 loadWords） */
  loadWords(list: string[]): void {
    this.words = new Set(list.filter(w => w && w.length > 0));
  }

  /** 获取当前词库大小 */
  getWordCount(): number {
    return this.words.size;
  }

  /** 检查文本是否命中敏感词（不替换） */
  containsSensitive(text: string): boolean {
    for (const word of this.words) {
      if (word.length > 0 && text.includes(word)) {
        return true;
      }
    }
    return false;
  }
}
