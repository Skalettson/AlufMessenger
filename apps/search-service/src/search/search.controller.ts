import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { AlufError, BadRequestError, NotFoundError } from '@aluf/shared';
import { SearchService } from './search.service';

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    return new RpcException({ code, message: err.message });
  }
  return new RpcException({
    code: GrpcStatus.INTERNAL,
    message: err instanceof Error ? err.message : 'Internal server error',
  });
}

@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @GrpcMethod('SearchService', 'Search')
  async search(data: {
    query: string;
    type: string;
    chatId: string;
    fromDate: { seconds: number; nanos: number };
    toDate: { seconds: number; nanos: number };
    limit: number;
    offset: number;
  }) {
    try {
      const fromDate = data.fromDate?.seconds
        ? new Date(data.fromDate.seconds * 1000)
        : undefined;
      const toDate = data.toDate?.seconds
        ? new Date(data.toDate.seconds * 1000)
        : undefined;

      const result = await this.searchService.search(
        data.query,
        data.type || undefined,
        data.chatId || undefined,
        fromDate,
        toDate,
        data.limit || 20,
        data.offset || 0,
      );

      return {
        results: result.results,
        total: result.total,
        processingTimeMs: result.processingTimeMs,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('SearchService', 'IndexDocument')
  async indexDocument(data: { type: string; id: string; data: string }) {
    try {
      const parsed = JSON.parse(data.data || '{}');
      await this.searchService.indexDocument(data.type, data.id, parsed);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('SearchService', 'DeleteDocument')
  async deleteDocument(data: { type: string; id: string }) {
    try {
      await this.searchService.deleteDocument(data.type, data.id);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
