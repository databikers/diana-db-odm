export class ErrorFactory {
  protected static construct(message: string) {
    return new Error(message);
  }

  public static modelOptionsError(message: string) {
    return ErrorFactory.construct(`Model Options Error: ${message}`);
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
