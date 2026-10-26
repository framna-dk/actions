import * as core from '@actions/core'
import { Config, Artifact } from '../types.js'
import { generateAppPathPatterns, getBaseName } from '../utils.js'
import { findOutputFiles } from './file-discovery.service.js'

export async function discoverArtifacts(config: Config): Promise<{ appFiles: Artifact[] }> {
  core.info('')
  core.info('Export Artifacts:')

  const patterns = generateAppPathPatterns(config.module, config.variants, config.artifactType)
  const files = await findOutputFiles(config.projectLocation, patterns)
  const appFiles = files.map((file) => ({ path: file, name: getBaseName(file), type: config.artifactType }))

  core.info(`Found app artifacts: ${appFiles.length}`)
  files.forEach((file) => core.info(`  - ${file}`))

  if (appFiles.length === 0) {
    core.warning('No app artifacts found for the requested module and variants.')
    core.warning('If you have customized APK/AAB output paths in your Gradle files, automatic discovery may not find your artifacts.')
  }

  return { appFiles }
}
