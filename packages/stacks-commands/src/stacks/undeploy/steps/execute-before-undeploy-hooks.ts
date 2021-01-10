import { executeHooks } from "@takomo/stacks-hooks"
import { StackOperationStep } from "../../common/steps"
import { CurrentStackHolder } from "../states"

/**
 * @hidden
 */
export const executeBeforeUndeployHooks: StackOperationStep<CurrentStackHolder> = async (
  state,
) => {
  const { stack, ctx, variables, logger, transitions } = state

  const { success, message } = await executeHooks(
    ctx,
    variables,
    stack.hooks,
    "delete",
    "before",
    logger,
  )

  if (!success) {
    logger.error(`Before undeploy hooks failed with message: ${message}`)
    return transitions.failStackOperation({ ...state, message, events: [] })
  }

  return transitions.initiateStackDelete(state)
}
