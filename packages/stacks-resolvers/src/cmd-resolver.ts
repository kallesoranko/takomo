import {
  Resolver,
  ResolverInput,
  ResolverProvider,
  ResolverProviderSchemaProps,
} from "@takomo/stacks-model"
import { deepCopy, executeShellCommand, expandFilePath } from "@takomo/util"
import { ObjectSchema } from "joi"
import R from "ramda"

type Capture = "last-line" | "all"

const captureValue = (capture: Capture, output: string): string => {
  switch (capture) {
    case "all":
      return output
    case "last-line":
      return R.last(output.split("\n")) ?? ""
    default:
      throw new Error(`Unknown value for capture: ${capture}`)
  }
}

const init = async ({
  command,
  exposeStackCredentials,
  exposeStackRegion,
  capture = "all",
  cwd,
}: any): Promise<Resolver> => {
  if (!command) {
    throw new Error("command is required property")
  }

  return {
    resolve: async ({
      logger,
      parameterName,
      stack,
      ctx,
    }: ResolverInput): Promise<any> => {
      logger.debug(
        `Resolving value for parameter '${parameterName}' with command: ${command}`,
      )

      const env = deepCopy(process.env)

      if (exposeStackCredentials === true) {
        const credentials = await stack.credentialManager.getCredentials()
        env.AWS_ACCESS_KEY_ID = credentials.accessKeyId
        env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey
        env.AWS_SESSION_TOKEN = credentials.sessionToken
        env.AWS_SECURITY_TOKEN = credentials.sessionToken
      }

      if (exposeStackRegion === true) {
        env.AWS_DEFAULT_REGION = stack.region
      }

      const { stdout, success, error } = await executeShellCommand({
        command,
        env,
        cwd: cwd ? expandFilePath(ctx.projectDir, cwd) : ctx.projectDir,
        stdoutListener: (data: string) => logger.info(data),
        stderrListener: (data: string) => logger.error(data),
      })

      if (success) {
        return captureValue(capture, (stdout ?? "").trim())
      }

      throw error
    },
  }
}

const name = "cmd"

const schema = ({ joi, base }: ResolverProviderSchemaProps): ObjectSchema =>
  base.keys({
    command: joi.string().required(),
    exposeStackCredentials: joi.boolean(),
    exposeStackRegion: joi.boolean(),
    cwd: joi.string(),
    capture: joi.string().valid("all", "last-line"),
  })

export const createCmdResolverProvider = (): ResolverProvider => ({
  name,
  init,
  schema,
})
