import { initDefaultCredentialManager } from "@takomo/aws-clients"
import { deploymentTargetsOperationCommand } from "@takomo/deployment-targets-commands"
import { createConsoleLogger, createTimer } from "@takomo/util"
import { basename } from "path"
import { createTestUndeployTargetsIO } from "../../io"
import { createCtxAndConfigRepository } from "./common"
import {
  createTargetsOperationOutputMatcher,
  ExecuteDeployTargetsCommandProps,
  TargetsOperationOutputMatcher,
} from "./targets-operation"

export const executeUndeployTargetsCommand = (
  props: ExecuteDeployTargetsCommandProps,
): TargetsOperationOutputMatcher =>
  createTargetsOperationOutputMatcher(async () => {
    const logLevel = props.logLevel ?? "info"

    const ctxAndConfig = await createCtxAndConfigRepository({
      projectDir: props.projectDir,
      autoConfirmEnabled: props.autoConfirmEnabled ?? true,
      ignoreDependencies: props.ignoreDependencies ?? false,
      var: props.var ?? [],
      varFile: props.varFile ?? [],
      pathToDeploymentConfigFile: props.configFile,
      feature: props.feature ?? [],
      logLevel,
    })

    const logger = createConsoleLogger({
      logLevel,
      name: basename(expect.getState().testPath),
    })

    const credentialManager = await initDefaultCredentialManager(
      () => Promise.resolve(""),
      logger,
      ctxAndConfig.ctx.awsClientProvider,
      ctxAndConfig.ctx.credentials,
    )

    return deploymentTargetsOperationCommand({
      ...ctxAndConfig,
      credentialManager,
      io: createTestUndeployTargetsIO(logger),
      input: {
        timer: createTimer("total"),
        configSetType: "standard",
        operation: "undeploy",
        groups: props.groups ?? [],
        targets: props.targets ?? [],
        excludeTargets: props.excludeTargets ?? [],
        labels: props.labels ?? [],
        excludeLabels: props.excludeLabels ?? [],
        concurrentTargets: props.concurrentTargets ?? 1,
        commandPath: props.commandPath,
        configSetName: props.configSetName,
        expectNoChanges: props.expectNoChanges ?? false,
        prune: props.prune ?? false,
        outputFormat: "text",
      },
    })
  })
