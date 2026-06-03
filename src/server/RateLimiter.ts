export interface RateLimitConfig {
    requestsPerWindow: number;
    windowMs: number;
}

interface RequestRecord {
    count: number;
    startTime: number;
}

export class RateLimiter {
  private records: Map<string, RequestRecord> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = {
    requestsPerWindow: 60,
    windowMs: 60000,
  }) {
    this.config = config;
  }

  checkLimit(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    let record = this.records.get(key);

    if (!record || now - record.startTime >= this.config.windowMs) {
      record = { count: 1, startTime: now };
      this.records.set(key, record);
      return {
        allowed: true,
        remaining: this.config.requestsPerWindow - 1,
        resetTime: now + this.config.windowMs,
      };
    }

    if (record.count >= this.config.requestsPerWindow) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.startTime + this.config.windowMs,
      };
    }

    record.count += 1;
    return {
      allowed: true,
      remaining: this.config.requestsPerWindow - record.count,
      resetTime: record.startTime + this.config.windowMs,
    };
  }

  reset(key: string): void {
    this.records.delete(key);
  }

  resetAll(): void {
    this.records.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now - record.startTime >= this.config.windowMs) {
        this.records.delete(key);
      }
    }
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
