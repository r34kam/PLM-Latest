/* Registers a DOM for `bun test`.
 *
 * The copilot's file cards carry no href and no stable class, so the only way to resolve a
 * click to a file is by walking the tree (see `features/copilot/artifactCards.ts`). That
 * logic is worth testing, and testing it needs a real DOM rather than a hand-rolled fake —
 * a fake that got `contains` or `parentElement` subtly wrong would pass while the real
 * thing failed, which is the exact failure this code exists to prevent.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()
