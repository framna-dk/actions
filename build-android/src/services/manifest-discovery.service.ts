import * as core from '@actions/core'
import { Config, ManifestFile } from '../types.js'
import { generateManifestPathPatterns, getBaseName } from '../utils.js'
import { findOutputFiles } from './file-discovery.service.js'

export async function discoverManifests(config: Config): Promise<{ manifestFiles: ManifestFile[] }> {
  core.info('')
  core.info('Export Merged Manifests:')

  const patterns = generateManifestPathPatterns(config.module, config.variants)
  const files = await findOutputFiles(config.projectLocation, patterns)
  const manifestFiles = files.map((file) => ({ path: file, name: getBaseName(file) }))

  core.info(`Found merged manifests: ${manifestFiles.length}`)
  files.forEach((file) => core.info(`  - ${file}`))

  if (manifestFiles.length === 0) {
    core.warning('No merged manifests found for the requested module and variants.')
    core.warning('The merged manifest location can vary across AGP versions; please verify your build outputs.')
  }

  return { manifestFiles }
}
