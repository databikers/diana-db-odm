/**
 * Set on errors raised by requests, so callers can branch without parsing messages:
 * - SERVER: the server rejected the request (validation, access, missing collection...); nothing was changed.
 * - DURABILITY: the server applied the change in memory but could not write it to its write-ahead log.
 *   The change is visible now and may be lost if the server crashes before its next snapshot.
 * - TIMEOUT: no answer within the request timeout. The request may or may not have been applied.
 * - CONNECTION: not connected, or the connection closed before the answer. May or may not have been applied.
 */
export type DianaDbErrorCode = 'SERVER' | 'DURABILITY' | 'TIMEOUT' | 'CONNECTION';

export type DianaDbError = Error & { code: DianaDbErrorCode };

// Prefix of the server's error text when the write-ahead log could not be written (server >= 2.x with WAL).
const DURABILITY_ERROR_PREFIX: string = 'The change was applied but could not be written to disk';

export class ErrorFactory {
  protected static construct(message: string) {
    return new Error(message);
  }

  protected static coded(message: string, code: DianaDbErrorCode): DianaDbError {
    const error = new Error(message) as DianaDbError;
    error.code = code;
    return error;
  }

  /** An error string returned by the server for one request. */
  public static serverError(message: string): DianaDbError {
    return message.startsWith(DURABILITY_ERROR_PREFIX)
      ? ErrorFactory.coded(`Durability Error: ${message}`, 'DURABILITY')
      : ErrorFactory.coded(message, 'SERVER');
  }

  public static connectionError(message: string): DianaDbError {
    return ErrorFactory.coded(`Connection Error: ${message}`, 'CONNECTION');
  }

  public static timeoutError(message: string): DianaDbError {
    return ErrorFactory.coded(`Request Error: ${message}`, 'TIMEOUT');
  }

  public static modelOptionsError(message: string) {
    return ErrorFactory.construct(`Model Options Error: ${message}`);
  }

  public static argumentError(message: string) {
    return ErrorFactory.construct(`Invalid argument: ${message}`);
  }

  public static findQueryError(message: string) {
    return ErrorFactory.construct(`Find Query Error: ${message}`);
  }

  public static sortingError(message: string) {
    return ErrorFactory.construct(`Sorting Error: ${message}`);
  }

  public static skipError(message: string) {
    return ErrorFactory.construct(`Skip Error: ${message}`);
  }

  public static limitError(message: string) {
    return ErrorFactory.construct(`Limit Error: ${message}`);
  }

  public static schemaError(message: string, key: string) {
    return ErrorFactory.construct(`Schema Error(${key}): ${message}`);
  }

  public static remoteSchemaError(message: string) {
    return ErrorFactory.construct(`Schema Config Error: ${message}`);
  }

  public static configurationError(message: string) {
    return ErrorFactory.construct(`000 Configuration Error: ${message}`);
  }

  public static requiredFieldError(message: string) {
    return ErrorFactory.construct(`Required Field Error: ${message}`);
  }

  public static nonMutableFieldError(message: string) {
    return ErrorFactory.construct(`Non-Mutable Field Error: ${message}`);
  }

  public static transformQueryError(message: string) {
    return ErrorFactory.construct(`Transform Query Error: ${message}`);
  }

  public static requestError(message: string) {
    return ErrorFactory.construct(`Request Error: ${message}`);
  }

  public static migrationError(message: string) {
    return ErrorFactory.construct(`Migration Error: ${message}`);
  }
}
