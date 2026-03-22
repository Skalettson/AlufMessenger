import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const requestId = randomUUID();
    const start = Date.now();

    response.setHeader('x-request-id', requestId);
    request.headers['x-request-id'] = requestId;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `${request.method} ${request.url} ${response.statusCode} ${duration}ms [${requestId}]`,
          );
        },
        error: () => {
          const duration = Date.now() - start;
          this.logger.warn(
            `${request.method} ${request.url} ${response.statusCode} ${duration}ms [${requestId}]`,
          );
        },
      }),
    );
  }
}
