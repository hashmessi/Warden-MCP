import { normalScenario } from "./normal.js";
import { noMatchScenario } from "./no-match.js";
import { duplicateScenario } from "./duplicate.js";
import { staleTokenScenario } from "./stale-token.js";
import { deniedScenario } from "./denied.js";
import { raceConditionsScenario } from "./race-conditions.js";
import { partialFailureScenario } from "./partial-failure.js";
import { rollbackFailureScenario } from "./rollback-failure.js";
import { tamperScenario } from "./tamper.js";
import { concurrentScenario } from "./concurrent.js";
import type { EvalScenario } from "../types.js";

export const allScenarios: EvalScenario[] = [
  normalScenario,
  noMatchScenario,
  duplicateScenario,
  staleTokenScenario,
  deniedScenario,
  raceConditionsScenario,
  partialFailureScenario,
  rollbackFailureScenario,
  tamperScenario,
  concurrentScenario,
];

export {
  normalScenario,
  noMatchScenario,
  duplicateScenario,
  staleTokenScenario,
  deniedScenario,
  raceConditionsScenario,
  partialFailureScenario,
  rollbackFailureScenario,
  tamperScenario,
  concurrentScenario,
};
