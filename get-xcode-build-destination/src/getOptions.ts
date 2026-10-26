import * as core from "@actions/core"

export interface Options {
  readonly platform: string
  readonly os: string
  readonly device: string
  readonly generic: boolean
}

export default function getOptions(): Options {
  return {
    platform: core.getInput("platform") || "iOS",
    os: core.getInput("os").trim(),
    device: core.getInput("device").trim(),
    generic: core.getBooleanInput("generic")
  }
}
