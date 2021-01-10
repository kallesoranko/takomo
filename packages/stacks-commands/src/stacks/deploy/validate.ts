import { StackStatus } from "@takomo/aws-model"
import { TakomoError } from "@takomo/util"
import { StackDeployOperation, StacksDeployPlan } from "./plan"

/**
 * @hidden
 */
export const isStackReadyForDeploy = (stackStatus: StackStatus): boolean =>
  [
    "CREATE_COMPLETE",
    "UPDATE_COMPLETE",
    "UPDATE_ROLLBACK_COMPLETE",
    "REVIEW_IN_PROGRESS",
    "CREATE_FAILED",
    "ROLLBACK_COMPLETE",
    "IMPORT_COMPLETE",
    "IMPORT_ROLLBACK_COMPLETE",
  ].includes(stackStatus)

/**
 * @hidden
 */
export const validateStacksStatus = (
  operations: ReadonlyArray<StackDeployOperation>,
): void => {
  const stacksInInvalidStatus = []
  for (const operation of operations) {
    const { currentStack } = operation
    if (currentStack && !isStackReadyForDeploy(currentStack.status)) {
      stacksInInvalidStatus.push(operation)
    }
  }

  if (stacksInInvalidStatus.length > 0) {
    throw new TakomoError(
      "Can't deploy stacks because following stacks are in invalid status:\n\n" +
        stacksInInvalidStatus
          .map(
            (s) =>
              `  - ${s.stack.path} in invalid status: ${s.currentStack?.status}`,
          )
          .join("\n"),
    )
  }
}

/**
 * @hidden
 */
export const validateStacksDeployPlan = (plan: StacksDeployPlan): void => {
  const { operations } = plan
  validateStacksStatus(operations)
}
