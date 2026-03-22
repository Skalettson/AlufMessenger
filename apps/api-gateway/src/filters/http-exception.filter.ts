import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { AlufError } from '@aluf/shared';

interface GrpcError {
  code?: number;
  message?: string;
  details?: string;
}

const GRPC_TO_HTTP: Record<number, number> = {
  [GrpcStatus.OK]: HttpStatus.OK,
  [GrpcStatus.CANCELLED]: 499,
  [GrpcStatus.INVALID_ARGUMENT]: HttpStatus.BAD_REQUEST,
  [GrpcStatus.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [GrpcStatus.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [GrpcStatus.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
  [GrpcStatus.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
  [GrpcStatus.RESOURCE_EXHAUSTED]: HttpStatus.TOO_MANY_REQUESTS,
  [GrpcStatus.FAILED_PRECONDITION]: HttpStatus.PRECONDITION_FAILED,
  [GrpcStatus.ABORTED]: HttpStatus.CONFLICT,
  [GrpcStatus.OUT_OF_RANGE]: HttpStatus.BAD_REQUEST,
  [GrpcStatus.UNIMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,
  [GrpcStatus.INTERNAL]: HttpStatus.INTERNAL_SERVER_ERROR,
  [GrpcStatus.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [GrpcStatus.DATA_LOSS]: HttpStatus.INTERNAL_SERVER_ERROR,
  [GrpcStatus.DEADLINE_EXCEEDED]: HttpStatus.GATEWAY_TIMEOUT,
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { statusCode, code, message, details } = this.resolveException(exception);

    if (statusCode >= 500) {
      this.logger.error(`[${code}] ${message}`, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(`[${code}] ${message}`);
    }

    response.status(statusCode).json({
      error: { code, message, ...(details ? { details } : {}) },
    });
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof AlufError) {
      const err = exception;
      return {
        statusCode: err.statusCode,
        code: err.code,
        message: err.message,
        details: err.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'error' in res) {
        const errorBody = res as { error: { code?: string; message?: string; details?: unknown } };
        return {
          statusCode: status,
          code: errorBody.error.code || 'HTTP_ERROR',
          message: errorBody.error.message || exception.message,
          details: errorBody.error.details,
        };
      }
      return {
        statusCode: status,
        code: 'HTTP_ERROR',
        message: typeof res === 'string' ? res : exception.message,
      };
    }

    if (this.isGrpcError(exception)) {
      const httpStatus = GRPC_TO_HTTP[exception.code!] || HttpStatus.INTERNAL_SERVER_ERROR;
      return {
        statusCode: httpStatus,
        code: 'GRPC_ERROR',
        message: exception.details || exception.message || 'Ошибка сервиса',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера',
    };
  }

  private isGrpcError(err: unknown): err is GrpcError {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      typeof (err as GrpcError).code === 'number'
    );
  }
}
