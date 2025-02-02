import { executeDeployStacksCommand } from "@takomo/test-integration"

const stackName = "stack1",
  stackPath = "/stack1.yml/eu-north-1",
  projectDir = "configs/helpers-from-npm"

describe("Helpers from npm", () => {
  test("Deploy", () =>
    executeDeployStacksCommand({ projectDir })
      .expectCommandToSucceed()
      .expectStackCreateSuccess({
        stackName,
        stackPath,
      })
      .expectDeployedCfStackV2({
        stackPath,
        tags: {
          Tag1: "ONE",
          Tag2: "two",
          Tag3: "THREE",
        },
      })
      .assert())
})
