import * as core from '@actions/core'
import { Config, Result } from './types.js'
import { processConfig, executeGradleBuild, discoverArtifacts, discoverManifests, exportResult } from './services/index.js'

async function run(): Promise<void> {
  try {
    const config: Config = await processConfig()
    await executeGradleBuild(config)
    const { appFiles } = await discoverArtifacts(config)
    const { manifestFiles } = await discoverManifests(config)
    const result: Result = {
      appFiles,
      manifestFiles
    }
    await exportResult(result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    core.setFailed(errorMessage)
  }
}

run()
