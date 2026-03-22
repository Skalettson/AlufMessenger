import {
  Controller,
  Get,
  Query,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { SearchQueryDto } from '../dto/search.dto';

interface SearchServiceGrpc {
  Search(req: SearchQueryDto & { userId: string }): Observable<unknown>;
}

@Controller('v1/search')
export class SearchRoutesController implements OnModuleInit {
  private searchService!: SearchServiceGrpc;

  constructor(
    @Inject('SEARCH_SERVICE_PACKAGE') private readonly searchClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.searchService = this.searchClient.getService<SearchServiceGrpc>('SearchService');
  }

  @Get()
  search(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(SearchQueryDto)) query: SearchQueryDto) {
    return firstValueFrom(
      this.searchService.Search({ ...query, userId: user.userId }),
    );
  }
}
