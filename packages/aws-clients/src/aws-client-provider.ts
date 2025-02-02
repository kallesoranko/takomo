import { Region } from "@takomo/aws-model"
import { checksum, createScheduler, Scheduler, TkmLogger } from "@takomo/util"
import { IPolicy, Policy } from "cockatiel"
import {
  CloudFormationClient,
  createCloudFormationClient,
} from "./cloudformation/client"
import { CloudTrailClient, createCloudTrailClient } from "./cloudtrail/client"
import { ApiCallProps, AwsClientProps } from "./common/client"
import { createApiRequestListenerPlugin } from "./common/request-listener"
import { createS3Client, S3Client } from "./s3/client"
import { createSecretsClient, SecretsClient } from "./secrets/client"
import { createSsmClient, SsmClient } from "./ssm/client"
import { createStsClient, StsClient } from "./sts/client"

const makeCredentialsRegionHash = async ({
  region,
  credentialProvider,
  identity,
}: AwsClientProps): Promise<string> => {
  if (identity) {
    return checksum([region, identity.accountId].join(":"))
  }

  const { accessKeyId, secretAccessKey, sessionToken } =
    await credentialProvider()

  return checksum(
    [region, accessKeyId, secretAccessKey, sessionToken].join(":"),
  )
}

export interface AwsClientProvider {
  readonly createCloudFormationClient: (
    props: AwsClientProps,
  ) => Promise<CloudFormationClient>
  readonly createCloudTrailClient: (
    props: AwsClientProps,
  ) => Promise<CloudTrailClient>
  readonly createS3Client: (props: AwsClientProps) => Promise<S3Client>
  readonly createStsClient: (props: AwsClientProps) => Promise<StsClient>
  readonly createSsmClient: (props: AwsClientProps) => Promise<SsmClient>
  readonly createSecretsClient: (
    props: AwsClientProps,
  ) => Promise<SecretsClient>
}

/**
 * @hidden
 */
export interface InternalAwsClientProvider extends AwsClientProvider {
  readonly getApiCalls: () => ReadonlyArray<ApiCallProps>
  readonly getRegions: () => ReadonlyArray<Region>
}

interface AwsClientProviderProps {
  readonly logger: TkmLogger
}

const createDescribeEventsBulkhead = (): IPolicy => {
  const limit = 2
  const queue = 1000
  return Policy.bulkhead(limit, queue)
}

const createGetTemplateSummaryScheduler = (logger: TkmLogger): Scheduler =>
  createScheduler({
    logger,
    id: "GetTemplateSummary",
    intervalCap: 2,
    concurrency: 5,
    intervalInMillis: 200,
  })

const createValidateTemplateBulkhead = (): IPolicy => {
  const limit = 4
  const queue = 1000
  return Policy.bulkhead(limit, queue)
}

interface ConcurrencyControls {
  readonly describeEventsBulkhead: IPolicy
  readonly getTemplateSummaryScheduler: Scheduler
  readonly validateTemplateBulkhead: IPolicy
}

/**
 * @hidden
 */
export const createAwsClientProvider = ({
  logger,
}: AwsClientProviderProps): InternalAwsClientProvider => {
  const apiCalls = new Array<ApiCallProps>()
  const regions = new Set<Region>()

  const concurrencyControls = new Map<string, ConcurrencyControls>()

  const getConcurrencyControls = (key: string): ConcurrencyControls => {
    if (concurrencyControls.has(key)) {
      return concurrencyControls.get(key)!
    }

    const controls = {
      describeEventsBulkhead: createDescribeEventsBulkhead(),
      getTemplateSummaryScheduler: createGetTemplateSummaryScheduler(logger),
      validateTemplateBulkhead: createValidateTemplateBulkhead(),
    }

    concurrencyControls.set(key, controls)

    return controls
  }

  const listener = {
    onApiCall: (props: ApiCallProps): void => {
      apiCalls.push(props)
    },
  }

  return {
    getRegions: (): ReadonlyArray<Region> => Array.from(regions),
    getApiCalls: (): ReadonlyArray<ApiCallProps> => apiCalls.slice(),
    createCloudFormationClient: async (
      props: AwsClientProps,
    ): Promise<CloudFormationClient> => {
      const hash = await makeCredentialsRegionHash(props)
      const controls = getConcurrencyControls(hash)

      const client = createCloudFormationClient({
        ...props,
        ...controls,
        waitStackDeployToCompletePollInterval: 2000,
        waitStackDeleteToCompletePollInterval: 2000,
        waitStackRollbackToCompletePollInterval: 2000,
        middleware: createApiRequestListenerPlugin(props.id, listener),
      })

      regions.add(props.region)

      return client
    },
    createCloudTrailClient: async (
      props: AwsClientProps,
    ): Promise<CloudTrailClient> => {
      const client = createCloudTrailClient({
        ...props,
        middleware: createApiRequestListenerPlugin(props.id, listener),
      })
      regions.add(props.region)
      return client
    },
    createS3Client: async (props: AwsClientProps): Promise<S3Client> => {
      const client = createS3Client({
        ...props,
        middleware: createApiRequestListenerPlugin(props.id, listener),
      })
      regions.add(props.region)
      return client
    },
    createStsClient: async (props: AwsClientProps): Promise<StsClient> => {
      const client = createStsClient({
        ...props,
        middleware: createApiRequestListenerPlugin(props.id, listener),
      })
      regions.add(props.region)
      return client
    },
    createSsmClient: async (props: AwsClientProps): Promise<SsmClient> => {
      const client = createSsmClient({
        ...props,
        middleware: createApiRequestListenerPlugin(props.id, listener),
      })
      regions.add(props.region)
      return client
    },
    createSecretsClient: async (
      props: AwsClientProps,
    ): Promise<SecretsClient> => {
      const client = createSecretsClient({
        ...props,
        middleware: createApiRequestListenerPlugin(props.id, listener),
      })
      regions.add(props.region)
      return client
    },
  }
}
