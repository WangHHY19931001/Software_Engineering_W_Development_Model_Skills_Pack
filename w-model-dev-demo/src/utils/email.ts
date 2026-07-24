/**
 * DD-016 EmailSender —— 邮件发送器
 *
 * SMTP 发送 + 不可用时降级记录（fallbackLog）。
 * 单测通过 mock transporter 隔离，不依赖真实 SMTP。
 */

export interface EmailRecord {
  to: string;
  subject: string;
  body: string;
  timestamp: number;
  error?: string;
}

export interface SendResult {
  success: boolean;
  fallback: boolean;
  messageId?: string;
  error?: string;
}

export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  failures: EmailRecord[];
}

/** Transporter 接口（便于 mock，不直接依赖 nodemailer 类型） */
export interface SmtpTransporter {
  sendMail(opts: { to: string; subject: string; html?: string; text?: string }): Promise<{ messageId: string }>;
}

export class EmailSender {
  private transporter: SmtpTransporter | null;
  private fallbackLog: Map<string, EmailRecord> = new Map();
  private fallbackCounter = 0;

  constructor(transporter: SmtpTransporter | null = null) {
    this.transporter = transporter;
  }

  /** 设置 transporter（供测试注入） */
  setTransporter(transporter: SmtpTransporter | null): void {
    this.transporter = transporter;
  }

  /**
   * 发送邮件（对应 DD-016 sendMail）。
   * SMTP 不可用时降级记录到 fallbackLog（50201 降级）。
   */
  async sendMail(to: string, subject: string, body: string): Promise<SendResult> {
    if (!this.transporter) {
      return this.fallback(to, subject, body, 'SMTP 未配置');
    }
    try {
      const result = await this.transporter.sendMail({ to, subject, text: body });
      return { success: true, fallback: false, messageId: result.messageId };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.fallback(to, subject, body, errorMsg);
    }
  }

  /**
   * 批量发送（对应 DD-016 sendBatch）。
   */
  async sendBatch(list: EmailRecord[]): Promise<BatchResult> {
    let success = 0;
    const failures: EmailRecord[] = [];
    for (const record of list) {
      const result = await this.sendMail(record.to, record.subject, record.body);
      if (result.success) {
        success++;
      } else {
        failures.push({ ...record, error: result.error });
      }
    }
    return {
      total: list.length,
      success,
      failed: failures.length,
      failures,
    };
  }

  /** 降级记录（对应 DD-016 fallback 私有方法） */
  private fallback(to: string, subject: string, body: string, error: string): SendResult {
    const key = `fb-${++this.fallbackCounter}`;
    this.fallbackLog.set(key, {
      to,
      subject,
      body,
      timestamp: Math.floor(Date.now() / 1000),
      error,
    });
    return { success: false, fallback: true, error };
  }

  /** 获取降级记录数（供测试验证） */
  getFallbackCount(): number {
    return this.fallbackLog.size;
  }

  /** 获取降级日志（供测试验证） */
  getFallbackLog(): EmailRecord[] {
    return Array.from(this.fallbackLog.values());
  }
}
