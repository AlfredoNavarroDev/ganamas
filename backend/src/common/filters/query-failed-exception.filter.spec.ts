import { ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { QueryFailedExceptionFilter } from './query-failed-exception.filter';

function hostWith(response: { status: jest.Mock; json: jest.Mock }) {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
}

function queryFailedError(code: string | undefined) {
  const error = new QueryFailedError('SELECT 1', [], new Error('boom'));
  (error as unknown as { driverError: { code?: string } }).driverError = {
    code,
  };
  return error;
}

describe('QueryFailedExceptionFilter', () => {
  let filter: QueryFailedExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let response: { status: jest.Mock; json: jest.Mock };

  beforeEach(() => {
    filter = new QueryFailedExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    response = { status, json };
  });

  it('maps a unique violation (23505) to 409', () => {
    filter.catch(queryFailedError('23505'), hostWith(response));

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'El registro ya existe.' }),
    );
  });

  it('maps a check violation (23514) to 400', () => {
    filter.catch(queryFailedError('23514'), hostWith(response));

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Los datos enviados no son válidos.' }),
    );
  });

  it('maps a not-null violation (23502) to 400', () => {
    filter.catch(queryFailedError('23502'), hostWith(response));

    expect(status).toHaveBeenCalledWith(400);
  });

  it('maps a foreign key violation (23503) to 400', () => {
    filter.catch(queryFailedError('23503'), hostWith(response));

    expect(status).toHaveBeenCalledWith(400);
  });

  it('defaults unknown codes to 400', () => {
    filter.catch(queryFailedError(undefined), hostWith(response));

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No se pudo procesar la solicitud.' }),
    );
  });
});
