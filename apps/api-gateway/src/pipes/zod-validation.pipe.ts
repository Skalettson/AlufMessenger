import { PipeTransform, Injectable, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details = this.formatErrors(result.error);
      if (_metadata.type === 'body') {
        console.warn(
          '[ZodValidationPipe] Validation failed. Issues:',
          JSON.stringify(result.error.issues, null, 2),
          'Received:',
          JSON.stringify(value),
        );
      }
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Ошибка валидации',
          details,
        },
      });
    }
    return result.data;
  }

  private formatErrors(error: ZodError): Record<string, string[]> {
    const details: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_root';
      if (!details[path]) {
        details[path] = [];
      }
      details[path].push(issue.message);
    }
    return details;
  }
}
