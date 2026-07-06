import { GlobalExceptionFilter } from './global-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockResponse: any;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockResponse = {
      status: mockStatus,
      getResponse: jest.fn().mockReturnThis(),
    };
  });

  function createHost(exception: unknown) {
    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/test' }),
      }),
    } as any;
  }

  it('should handle Prisma P2002 unique constraint as 409', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '5.0' },
    );
    (error.meta as any) = { target: ['email'] };

    filter.catch(error, createHost(error));

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409 }),
    );
  });

  it('should handle Prisma P2025 not found as 404', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      { code: 'P2025', clientVersion: '5.0' },
    );

    filter.catch(error, createHost(error));

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('should handle Prisma P2003 foreign key as 400', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint',
      { code: 'P2003', clientVersion: '5.0' },
    );

    filter.catch(error, createHost(error));

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('should handle HttpException', () => {
    const error = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(error, createHost(error));

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
  });

  it('should handle unknown errors as 500', () => {
    const error = new Error('Something went wrong');

    filter.catch(error, createHost(error));

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('should handle PrismaClientValidationError as 400', () => {
    const error = new Prisma.PrismaClientValidationError('Invalid data', { clientVersion: '5.0' });

    filter.catch(error, createHost(error));

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });
});
