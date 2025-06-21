import { PseudoIntervalParameters } from '@parameters';

export function pseudoInterval(pseudoIntervalParams: PseudoIntervalParameters) {
  const { executor, isRan, doExit, interval } = pseudoIntervalParams;
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
  }, interval || 0);
}
