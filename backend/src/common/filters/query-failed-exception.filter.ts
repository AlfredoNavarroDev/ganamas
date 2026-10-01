import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const NOT_NULL_VIOLATION = '23502';
const FOREIGN_KEY_VIOLATION = '23503';

@Catch(QueryFailedError)
export class QueryFailedExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const driverError = exception.driverError as
      | { code?: string }
      | undefined;

    const mapped = this.toHttpException(driverError?.code);
    response.status(mapped.getStatus()).json(mapped.getResponse());
  }

  private toHttpException(code: string | undefined): HttpException {
    switch (code) {
      case UNIQUE_VIOLATION:
        return new ConflictException('El registro ya existe.');
      case CHECK_VIOLATION:
      case NOT_NULL_VIOLATION:
      case FOREIGN_KEY_VIOLATION:
        return new BadRequestException('Los datos enviados no son válidos.');
      default:
        return new BadRequestException('No se pudo procesar la solicitud.');
    }
  }
}
