import { CliError, CliParameterError } from '../../error/cli-error.mjs';
import { printer } from '../output/index.mjs';

export function withErrorHandler<T extends (...args: any[]) => Promise<void>>(actionFn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      await actionFn(...args);
    } catch (e: unknown) {
      if (e instanceof CliError || e instanceof CliParameterError) {
        printer.error(e.message);
      } else {
        printer.error((e as any)?.message ?? 'Unknown error occurred');
      }
      process.exitCode = 1
    }
  }) as T;
}
