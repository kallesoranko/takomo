import { AccountId } from "@takomo/aws-model"
import { ConfigSetType } from "@takomo/config-sets"
import {
  OrganizationAccountConfig,
  OrganizationalUnitConfig,
} from "@takomo/organization-config"
import {
  OrganizationContext,
  OrganizationState,
} from "@takomo/organization-context"
import { OrganizationalUnitPath } from "@takomo/organization-model"
import { collectFromHierarchy, TkmLogger } from "@takomo/util"
import flatten from "lodash.flatten"
import uniqBy from "lodash.uniqby"
import { AccountsLaunchPlan } from "../model"
import { OrganizationStateHolder } from "../states"
import { AccountsOperationStep } from "../steps"

const planAccountsDeploy = async (
  ctx: OrganizationContext,
  logger: TkmLogger,
  organizationState: OrganizationState,
  organizationalUnits: ReadonlyArray<OrganizationalUnitPath>,
  accountIds: ReadonlyArray<AccountId>,
  configSetType: ConfigSetType,
): Promise<AccountsLaunchPlan> => {
  const { accounts } = organizationState
  logger.debugObject("Plan accounts deploy with parameters:", {
    organizationalUnits,
    accountIds,
    configSetType,
  })

  const organizationalUnitsToLaunch =
    organizationalUnits.length === 0
      ? [ctx.getOrganizationalUnit("Root")]
      : organizationalUnits.reduce((collected, path) => {
          return [...collected, ctx.getOrganizationalUnit(path)]
        }, new Array<OrganizationalUnitConfig>())

  const sortOus = (
    a: OrganizationalUnitConfig,
    b: OrganizationalUnitConfig,
  ): number => {
    const order = a.priority - b.priority
    return order !== 0 ? order : a.name.localeCompare(b.name)
  }

  const ousToLaunch: OrganizationalUnitConfig[] = flatten(
    organizationalUnitsToLaunch.map((ou) =>
      flatten(
        collectFromHierarchy(ou, (o) => o.children, {
          sortSiblings: sortOus,
          filter: (o) => o.status === "active",
        }),
      ),
    ),
  )

  const uniqueOusToLaunch = uniqBy(ousToLaunch, (o) => o.path).filter(
    (o) => o.status === "active",
  )

  const accountsById = new Map(accounts.map((a) => [a.id, a]))

  const hasConfigSets = (a: OrganizationAccountConfig) => {
    switch (configSetType) {
      case "bootstrap":
        return a.bootstrapConfigSets.length > 0
      case "standard":
        return a.configSets.length > 0
      default:
        throw new Error(`Unsupported config set type: ${configSetType}`)
    }
  }

  const ous = uniqueOusToLaunch
    .map((ou) => {
      return {
        path: ou.path,
        accountAdminRoleName: ou.accountAdminRoleName,
        accountBootstrapRoleName: ou.accountBootstrapRoleName,
        configSets: ou.configSets,
        bootstrapConfigSets: ou.bootstrapConfigSets,
        vars: ou.vars,
        accounts: ou.accounts.filter(
          (a) =>
            a.status === "active" &&
            hasConfigSets(a) &&
            (accountIds.length === 0 || accountIds.includes(a.id)),
        ),
      }
    })
    .filter((ou) => ou.accounts.length > 0)
    .map((ou) => {
      const accounts = ou.accounts.map((config) => {
        const account = accountsById.get(config.id)!
        return {
          account,
          config,
        }
      })

      return {
        ...ou,
        accounts,
      }
    })

  logger.debugObject(
    `Organizational units to deploy:`,
    ous.map((o) => o.path),
  )

  return {
    hasChanges: ous.length > 0,
    organizationalUnits: ous,
    configSetType,
  }
}

export const planOperation: AccountsOperationStep<OrganizationStateHolder> = async (
  state,
) => {
  const {
    transitions,
    io,
    ctx,
    organizationState,
    input: { organizationalUnits, accountIds, configSetType },
  } = state

  io.info("Plan operation")

  const plan = await planAccountsDeploy(
    ctx,
    io,
    organizationState,
    organizationalUnits,
    accountIds,
    configSetType,
  )

  if (!plan.hasChanges) {
    const message = "No accounts to process"
    return transitions.skipAccountsOperation({ ...state, message })
  }

  return transitions.confirmOperation({ ...state, accountsLaunchPlan: plan })
}