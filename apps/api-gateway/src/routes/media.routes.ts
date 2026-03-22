import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  Inject,
  OnModuleInit,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, map, Observable } from 'rxjs';
import { CurrentUser, Public } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { JwtVerifierService } from '../auth/jwt-verifier.service';
import { InitUploadDto } from '../dto/media.dto';
import * as http from 'http';
import * as https from 'https';

interface MediaServiceGrpc {
  InitUpload(req: { uploaderId: string; fileName: string; mimeType: string; fileSize: number }): Observable<unknown>;
  CompleteUpload(req: { uploadId: string; uploaderId: string }): Observable<unknown>;
  GetFile(req: { fileId: string }): Observable<unknown>;
  GetFileUrl(req: { fileId: string; userId: string }): Observable<unknown>;
}

@Controller('v1/media')
export class MediaRoutesController implements OnModuleInit {
  private mediaService!: MediaServiceGrpc;

  constructor(
    @Inject('MEDIA_SERVICE_PACKAGE') private readonly mediaClient: ClientGrpc,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  onModuleInit() {
    this.mediaService = this.mediaClient.getService<MediaServiceGrpc>('MediaService');
  }

  @Post('upload')
  initUpload(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Body(new ZodValidationPipe(InitUploadDto)) body: InitUploadDto,
  ) {
    let uploaderId = (user?.userId ?? '').trim();
    if (!uploaderId) {
      const token = this.extractToken(req);
      if (token) {
        const payload = this.jwtVerifier.verify(token);
        if (payload?.userId) uploaderId = payload.userId;
      }
    }
    if (!uploaderId) {
      throw new UnauthorizedException('Токен не предоставлен');
    }
    return firstValueFrom(
      this.mediaService.InitUpload({
        uploaderId,
        fileName: body.fileName,
        mimeType: body.mimeType ?? 'application/octet-stream',
        fileSize: body.fileSize,
      }).pipe(
        map((res: unknown) => {
          const r = res as { uploadId?: string; upload_id?: string; uploadUrl?: string; upload_url?: string };
          return { id: r.uploadId ?? r.upload_id, uploadUrl: r.uploadUrl ?? r.upload_url };
        }),
      ),
    );
  }

  @Post('upload/:id/complete')
  completeUpload(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Param('id') uploadId: string,
  ) {
    let uploaderId = (user?.userId ?? '').trim();
    if (!uploaderId) {
      const token = this.extractToken(req);
      if (token) {
        const payload = this.jwtVerifier.verify(token);
        if (payload?.userId) uploaderId = payload.userId;
      }
    }
    if (!uploaderId) throw new UnauthorizedException('Токен не предоставлен');
    return firstValueFrom(
      this.mediaService.CompleteUpload({ uploadId, uploaderId }),
    );
  }

  @Get('url/:id')
  @Public()
  getFileUrl(
    @Req() req: Request,
    @Param('id') fileId: string,
  ) {
    let userId = '';
    const token = this.extractToken(req);
    if (token) {
      try {
        const payload = this.jwtVerifier.verify(token);
        if (payload?.userId) userId = payload.userId;
      } catch {
        // Токен невалиден, пробуем без userId
      }
    }
    return firstValueFrom(
      this.mediaService.GetFileUrl({ fileId, userId }),
    );
  }

  @Get(':id')
  @Public()
  getFile(
    @Param('id') fileId: string,
  ) {
    // Иначе GET /v1/media/url (без UUID) совпадает с этим маршрутом и fileId = "url" → 500 в БД
    const reserved = new Set(['url', 'upload']);
    if (!fileId?.trim() || reserved.has(fileId.trim().toLowerCase())) {
      throw new BadRequestException(
        fileId?.trim().toLowerCase() === 'url'
          ? 'Укажите id файла: /api/v1/media/url/{uuid}'
          : 'Invalid media id',
      );
    }
    return firstValueFrom(
      this.mediaService.GetFile({ fileId }),
    );
  }

  private extractToken(req: Request): string | null {
    const auth = (req.headers.authorization ?? req.headers['authorization']) as string | undefined;
    if (auth && typeof auth === 'string') {
      const m = auth.trim().match(/^Bearer\s+([^\s,]+)/i);
      if (m) return m[1].trim();
    }
    const x = (req.headers['x-access-token'] ?? req.headers['X-Access-Token']) as string | undefined;
    if (x && typeof x === 'string') return x.trim().replace(/^Bearer\s+/i, '').trim();
    return null;
  }
}

/**
 * Контроллер для потоковой отдачи медиафайлов
 * Обрабатывает запросы на /api/media/:id/stream
 */
@Controller('media')
export class MediaStreamController implements OnModuleInit {
  private mediaService!: MediaServiceGrpc;

  constructor(
    @Inject('MEDIA_SERVICE_PACKAGE') private readonly mediaClient: ClientGrpc,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  onModuleInit() {
    this.mediaService = this.mediaClient.getService<MediaServiceGrpc>('MediaService');
  }

  @Get(':id/stream')
  @Public()
  async streamFile(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') fileId: string,
  ) {
    if (!fileId || !fileId.trim()) {
      throw new BadRequestException('File ID is required');
    }

    // Извлекаем токен
    let userId: string | undefined;
    const token = this.extractToken(req);
    if (token) {
      try {
        const payload = this.jwtVerifier.verify(token);
        if (payload?.userId) userId = payload.userId;
      } catch {
        // Токен невалиден, пробуем без userId
      }
    }

    try {
      // Получаем URL файла из MinIO
      const fileData = await firstValueFrom(
        this.mediaService.GetFileUrl({ fileId, userId: userId || '' }),
      ) as { url?: string };

      const fileUrl = fileData?.url;
      if (!fileUrl) {
        throw new NotFoundException('File not found');
      }

      // Парсим URL для определения протокола
      const parsedUrl = new URL(fileUrl);
      const httpModule = parsedUrl.protocol === 'https:' ? https : http;

      // Делаем запрос к MinIO и стримим ответ клиенту
      const minioReq = httpModule.get(fileUrl, (minioRes: http.IncomingMessage) => {
        if (minioRes.statusCode === 404) {
          res.status(404).json({ error: 'File not found' });
          return;
        }

        if (minioRes.statusCode !== 200) {
          res.status(minioRes.statusCode || 500).json({ 
            error: 'Failed to fetch file from storage' 
          });
          return;
        }

        // Копируем заголовки
        const contentType = minioRes.headers['content-type'] || 'application/octet-stream';
        const contentLength = minioRes.headers['content-length'];
        const lastModified = minioRes.headers['last-modified'];
        const etag = minioRes.headers['etag'];

        res.setHeader('Content-Type', contentType);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        if (lastModified) res.setHeader('Last-Modified', lastModified);
        if (etag) res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Стримим данные
        minioRes.pipe(res);
      });

      minioReq.on('error', (err) => {
        console.error(`[MediaStream] Error fetching file ${fileId}:`, err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Failed to fetch file' });
        }
      });

      minioReq.setTimeout(30000, () => {
        minioReq.destroy();
        if (!res.headersSent) {
          res.status(504).json({ error: 'Storage timeout' });
        }
      });

    } catch (err: any) {
      console.error(`[MediaStream] Error for file ${fileId}:`, err?.message ?? err);
      if (!res.headersSent) {
        if (err instanceof NotFoundException) {
          res.status(404).json({ error: 'File not found' });
        } else if (err instanceof UnauthorizedException) {
          res.status(401).json({ error: 'Unauthorized' });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    }
  }

  private extractToken(req: Request): string | null {
    const auth = (req.headers.authorization ?? req.headers['authorization']) as string | undefined;
    if (auth && typeof auth === 'string') {
      const m = auth.trim().match(/^Bearer\s+([^\s,]+)/i);
      if (m) return m[1].trim();
    }
    const x = (req.headers['x-access-token'] ?? req.headers['X-Access-Token']) as string | undefined;
    if (x && typeof x === 'string') return x.trim().replace(/^Bearer\s+/i, '').trim();
    return null;
  }
}

/**
 * Контроллер-заглушка для /api/proxy-image
 * Нужен только для того, чтобы NestJS зарегистрировал маршрут для Middleware
 */
@Controller('proxy-image')
export class ProxyImageController {
  @Get()
  @Public()
  proxyImage(@Res() res: Response) {
    // Этот контроллер ничего не делает - всю работу выполняет MediaProxyMiddleware
    // Если мы здесь, значит Middleware не обработал запрос
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy middleware not working' });
    }
  }
}
