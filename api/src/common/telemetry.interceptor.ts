import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { JwtUser } from './auth';
import { PrismaService } from './prisma.service';
import { mapPrismaError } from './prisma-exception.filter';

/**
 * Resolves the real HTTP status of an error before PrismaExceptionFilter gets a chance
 * to act (interceptors see the error first in Nest's chain). Without this, a Prisma
 * error the client receives as 409/404 was recorded as 500 here.
 */
function resolveStatusCode(err: unknown): number {
  if (err instanceof HttpException) return err.getStatus();
  if (err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientValidationError) {
    return mapPrismaError(err).getStatus();
  }
  return 500;
}

export interface RouteTelemetry {
  method: string;
  path: string;
  hits: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  errorHits: number;
  lastCalledAt: Date;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  method: string;
  path: string;
  statusCode: number;
  message: string;
  userId?: string;
  userRole?: string;
  ip?: string;
}

@Injectable()
export class TelemetryService {
  private static routeStats = new Map<string, RouteTelemetry>();
  private static recentErrors: ErrorLogEntry[] = [];
  private static readonly MAX_ERRORS = 100;
  /**
   * Cap on distinct tracked routes. The project has ~33; anything beyond that only
   * shows up if normalisation lets something variable through, and then the Map cannot
   * cannot grow without bound inside a long-lived process.
   */
  private static readonly MAX_ROUTES = 200;
  private static totalRequests = 0;

  /** Drops the least recently called route to keep the Map under the cap. */
  private static evictOldestRoute() {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [key, stat] of this.routeStats) {
      const calledAt = stat.lastCalledAt.getTime();
      if (calledAt < oldestAt) {
        oldestAt = calledAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) this.routeStats.delete(oldestKey);
  }

  static recordRequest(
    method: string,
    path: string,
    durationMs: number,
    statusCode: number,
    error?: any,
    user?: JwtUser,
    ip?: string
  ) {
    this.totalRequests++;
    
    // Normalize path (group params like /care/consultations/uuid or /users/uuid)
    const normalizedPath = this.normalizePath(path);
    const key = `${method.toUpperCase()} ${normalizedPath}`;

    const existing = this.routeStats.get(key);
    if (!existing) {
      if (this.routeStats.size >= this.MAX_ROUTES) this.evictOldestRoute();
      this.routeStats.set(key, {
        method: method.toUpperCase(),
        path: normalizedPath,
        hits: 1,
        totalDurationMs: durationMs,
        avgDurationMs: durationMs,
        minDurationMs: durationMs,
        maxDurationMs: durationMs,
        errorHits: statusCode >= 400 ? 1 : 0,
        lastCalledAt: new Date(),
      });
    } else {
      existing.hits++;
      existing.totalDurationMs += durationMs;
      existing.avgDurationMs = Math.round((existing.totalDurationMs / existing.hits) * 10) / 10;
      existing.minDurationMs = Math.min(existing.minDurationMs, durationMs);
      existing.maxDurationMs = Math.max(existing.maxDurationMs, durationMs);
      if (statusCode >= 400) existing.errorHits++;
      existing.lastCalledAt = new Date();
    }

    if (statusCode >= 400 || error) {
      let errorMessage = 'Erro desconhecido';
      if (error instanceof HttpException) {
        const res = error.getResponse();
        errorMessage = typeof res === 'object' && res !== null ? (res as any).message || JSON.stringify(res) : String(res);
      } else if (error?.message) {
        errorMessage = error.message;
      }

      const errorEntry: ErrorLogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date(),
        method: method.toUpperCase(),
        path: normalizedPath,
        statusCode,
        message: Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage,
        userId: user?.sub,
        userRole: user?.role,
        ip,
      };

      this.recentErrors.unshift(errorEntry);
      if (this.recentErrors.length > this.MAX_ERRORS) {
        this.recentErrors.pop();
      }
    }
  }

  static getRouteStats(): RouteTelemetry[] {
    return Array.from(this.routeStats.values()).sort((a, b) => b.hits - a.hits);
  }

  static getRecentErrors(): ErrorLogEntry[] {
    return [...this.recentErrors];
  }

  static getSummary() {
    const stats = Array.from(this.routeStats.values());
    const totalHits = stats.reduce((acc, curr) => acc + curr.hits, 0);
    const totalDuration = stats.reduce((acc, curr) => acc + curr.totalDurationMs, 0);
    const totalErrors = stats.reduce((acc, curr) => acc + curr.errorHits, 0);
    const avgLatency = totalHits > 0 ? Math.round((totalDuration / totalHits) * 10) / 10 : 0;

    return {
      totalRequests: totalHits,
      avgLatencyMs: avgLatency,
      totalErrors,
      errorRatePercent: totalHits > 0 ? Math.round((totalErrors / totalHits) * 1000) / 10 : 0,
      activeRoutesCount: stats.length,
    };
  }

  /** Exposed so the interceptor stores the same scrubbed path it reports. */
  static normalize(path: string): string {
    return this.normalizePath(path);
  }

  /**
   * Reduces the URL to a stable template. Besides grouping statistics this is a
   * security control: invitation tokens are single-use secrets and must not
   * become a Map key, from where they would leak into GET /admin/telemetry/routes.
   *
   * The last rule is the safety net: any segment long enough to be an identifier or a
   * secret (the invitation token is 43 characters) is dropped even when it matches no
   * known format. Real route names in this project are at most 13 characters
   * ("consultations"), comfortably under the limit.
   */
  private static normalizePath(path: string): string {
    return path
      .split('?')[0]
      .replace(/\/[0-9a-fA-F-]{36}(?=\/|$)/g, '/:id')
      .replace(/\/[0-9a-fA-F]{6}(?=\/|$)/g, '/:token')
      .replace(/\/[A-Za-z0-9_-]{16,}(?=\/|$)/g, '/:param');
  }
}

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists an error so it survives a restart — the in-memory ring above used to lose
   * everything whenever Render recycled the process, which is exactly when the log
   * matters. Only errors are written: route statistics are high-frequency and not worth
   * a row per request.
   *
   * Fire-and-forget on purpose: telemetry must never fail or delay the response, the
   * same invariant the counters above already respect.
   */
  private persistError(entry: Omit<ErrorLogEntry, 'id' | 'timestamp'>) {
    this.prisma.errorLog
      .create({
        data: {
          method: entry.method,
          path: entry.path.slice(0, 300),
          statusCode: entry.statusCode,
          message: entry.message.slice(0, 2000),
          userId: entry.userId,
          userRole: entry.userRole,
          ipAddress: entry.ip,
        },
      })
      .catch(() => {
        // A telemetry write failing is not worth turning into a request failure.
      });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ method: string; originalUrl?: string; url: string; ip?: string; user?: JwtUser }>();
    const response = http.getResponse<{ statusCode?: number }>();

    const startTime = Date.now();
    const method = request.method;
    const url = request.originalUrl || request.url;

    // Ignore health check or static docs polling
    if (url.includes('/health') || url.includes('/docs')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        try {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode || 200;
          TelemetryService.recordRequest(
            method,
            url,
            duration,
            statusCode,
            undefined,
            request.user,
            request.ip
          );
        } catch {
          // Never fail the request if telemetry recording errors
        }
      }),
      catchError((err) => {
        try {
          const duration = Date.now() - startTime;
          const statusCode = resolveStatusCode(err);
          TelemetryService.recordRequest(
            method,
            url,
            duration,
            statusCode,
            err,
            request.user,
            request.ip
          );
          this.persistError({
            method: method.toUpperCase(),
            path: TelemetryService.normalize(url),
            statusCode,
            message: err instanceof Error ? err.message : String(err),
            userId: request.user?.sub,
            userRole: request.user?.role,
            ip: request.ip,
          });
        } catch {
          // Never fail error propagation
        }
        return throwError(() => err);
      })
    );
  }
}
