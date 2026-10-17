import { PseudoIntervalParameters } from '@parameters';

export function pseudoInterval(pseudoIntervalParams: PseudoIntervalParameters) {
  const { executor, isRan, doExit, interval } = pseudoIntervalParams;
  // unref: housekeeping timers must not keep the process alive once the app is done (e.g. after disconnect()).
  setTimeout(async () => {
    if (isRan) {
      executor().finally(() => {
        if (!doExit) {
          pseudoInterval(pseudoIntervalParams);
        }
      });
    } else if (!doExit) {
      pseudoInterval(pseudoIntervalParams);
    }
  }, interval || 0).unref();
}
