export { parsePlanFile, parsePlanContent } from "./plan-parser.js";
export { parseFrontmatter } from "./parse-frontmatter.js";
export {
  composeTeam,
  composeWithRules,
  computePlanHash,
  clearCompositionCache,
  type TeamComposition,
  type TeamMember,
} from "./team-composer.js";
export {
  onboardFromPlan,
  previewOnboarding,
  type OnboardingOptions,
  type OnboardingPlan,
} from "./orchestrator.js";
export {
  createPlanWatcher,
  type WatcherOptions,
} from "./plan-watcher.js";
export { startPlanWatcher } from "./start-watcher.js";
