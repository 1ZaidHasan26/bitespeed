import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private logger = new Logger(HttpExceptionFilter.name);
  catch(exception: HttpException, host: ArgumentsHost) {
    let err = exception['response'];
    err = err.response ? err.response : err;
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const status = exception.getStatus();
    this.logger.log(`error on API ${context.getRequest().url} `);
    const error =
      typeof exception.getResponse() === 'string'
        ? exception.getResponse()
        : exception.getResponse() &&
          typeof exception.getResponse()['message'] === 'object'
        ? exception.getResponse()['message'].join(', ')
        : exception.getResponse()['message'];
    if (
      err.code &&
      err.code === 'ER_DUP_ENTRY' &&
      err.sql.split(' ').includes('UPDATE')
    ) {
      const operationType = err.sql.split(' ')[1];
      const tableName = err.sql.split(' ')[3];
      const value = err.parameters[0];
      const temp = `${operationType} with ${tableName}: ${value} already exists in bin. Please contact your admin or use some other unique value`;
      response.status(status).json({
        isSuccess: false,
        error: temp,
        data: {},
      });
    } else if (
      err.code &&
      err.code === 'ER_DUP_ENTRY' &&
      err.sql.split(' ').includes('INSERT')
    ) {
      response.status(status).json({
        isSuccess: false,
        error: err.sqlMessage.split(' ').slice(0, -3).join(' '),
        data: {},
      });
    } else if (
      err.code &&
      err.code.includes('ER_NO_REFERENCED_ROW') &&
      (err.sql.split(' ').includes('INSERT') ||
        err.sql.split(' ').includes('UPDATE'))
    ) {
      const errorMsg =
        'Invalid ' +
        err.sqlMessage
          .split(':')[1]
          .split(',')[1]
          .split('REFERENCES')[1]
          .split(' ')[1];

      response.status(status).json({
        isSuccess: false,
        error: errorMsg,
        data: {},
      });
    } else if (
      err.code &&
      err.code.includes('ER_ROW_IS_REFERENCED') &&
      err.sql.split(' ').includes('DELETE')
    ) {
      const errorRawMsg = err.sqlMessage;
      const errorMsg = `${errorRawMsg
        .split(':')[0]
        .split(' ')
        .slice(0, -3)
        .join(' ')}. First remove ${
        errorRawMsg.split('REFERENCES')[1].split(' ')[1]
      } association with ${
        errorRawMsg.split('(')[1].split('.')[1].split(',')[0]
      }`;

      response.status(status).json({
        isSuccess: false,
        error: errorMsg,
        data: {},
      });
    } else {
      response.status(status).json({
        isSuccess: false,
        error: error,
        data: {},
      });
    }
  }
}
