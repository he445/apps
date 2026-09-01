import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { JwtUser } from './auth';

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
   * Teto de rotas distintas rastreadas. O projeto tem ~33 rotas; o excedente só
   * aparece se a normalização deixar passar algo variável, e aí o Map não pode
   * crescer sem limite dentro de um processo de vida longa.
   */
  private static readonly MAX_ROUTES = 200;
  private static totalRequests = 0;

  /** Descarta a rota chamada há mais tempo para manter o Map dentro do teto. */
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

  /**
   * Reduz a URL a um template estável. Além de agrupar as estatísticas, isto é um
   * controle de segurança: tokens de convite são segredos de uso único e não podem
   * virar chave do Map — de onde vazariam para GET /admin/telemetry/routes.
   *
   * A última regra é a rede de proteção: qualquer segmento longo o bastante para ser
   * identificador ou segredo (o token de convite tem 43 caracteres) é descartado,
   * mesmo que não case com os formatos conhecidos. Nomes reais de rota no projeto
   * têm no máximo 13 caracteres ("consultations"), bem abaixo do limite.
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
          const statusCode = err instanceof HttpException ? err.getStatus() : 500;
          TelemetryService.recordRequest(
            method,
            url,
            duration,
            statusCode,
            err,
            request.user,
            request.ip
          );
        } catch {
          // Never fail error propagation
        }
        return throwError(() => err);
      })
    );
  }
}
