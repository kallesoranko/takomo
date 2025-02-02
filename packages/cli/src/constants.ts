export const OUTPUT_OPT = "output"
export const INTERACTIVE_OPT = "interactive"
export const EXPECT_NO_CHANGES_OPT = "expect-no-changes"
export const INTERACTIVE_ALIAS_OPT = "i"
export const IGNORE_DEPENDENCIES_OPT = "ignore-dependencies"
export const FEATURE_SET_OPT = "feature-set"
export const ACCOUNT_ID_OPT = "account-id"
export const ACCOUNT_ID_ALIAS_OPT = "a"
export const COMMAND_PATH_OPT = "command-path"
export const CONCURRENT_TARGETS_OPT = "concurrent-targets"
export const TARGET_OPT = "target"
export const EXCLUDE_TARGET_OPT = "exclude-target"
export const LABEL_OPT = "label"
export const EXCLUDE_LABEL_OPT = "exclude-label"
export const CONCURRENT_ACCOUNTS_OPT = "concurrent-accounts"
export const ORGANIZATIONAL_UNITS_OPT = "organizational-units"
export const ROLE_NAME_OPT = "role-name"
export const ALIAS_OPT = "alias"
export const CONFIG_FILE_OPT = "config-file"
export const CONFIG_SET_OPT = "config-set"
export const CONFIG_SET_TYPE_OPT = "config-set-type"

export const outputFormatOptions = {
  [OUTPUT_OPT]: {
    description: "Output format",
    choices: ["text", "json", "yaml"],
    default: "text",
    string: true,
    global: false,
    demandOption: false,
  },
}
