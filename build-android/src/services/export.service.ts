import * as core from '@actions/core'
import { Result, ARTIFACT_ENV_KEY, ARTIFACT_LIST_ENV_KEY, MANIFEST_ENV_KEY, MANIFEST_LIST_ENV_KEY } from '../types.js'

export async function exportResult(result: Result): Promise<void> {
  if (result.appFiles.length === 0) {
    throw new Error('Could not find any app artifacts')
  }

  const lastArtifact = result.appFiles[result.appFiles.length - 1]
  core.setOutput(ARTIFACT_ENV_KEY, lastArtifact.path)

  const artifactPaths = result.appFiles.map((artifact) => artifact.path).join('|')
  core.setOutput(ARTIFACT_LIST_ENV_KEY, artifactPaths)
  core.info('')
  core.info('Exported Outputs:')
  core.info(`  - ${ARTIFACT_ENV_KEY}: ${lastArtifact.path}`)
  core.info(`  - ${ARTIFACT_LIST_ENV_KEY}: ${artifactPaths}`)

  if (result.manifestFiles.length > 0) {
    const lastManifest = result.manifestFiles[result.manifestFiles.length - 1]
    core.setOutput(MANIFEST_ENV_KEY, lastManifest.path)

    const manifestPaths = result.manifestFiles.map((manifest) => manifest.path).join('|')
    core.setOutput(MANIFEST_LIST_ENV_KEY, manifestPaths)
    core.info(`  - ${MANIFEST_ENV_KEY}: ${lastManifest.path}`)
    core.info(`  - ${MANIFEST_LIST_ENV_KEY}: ${manifestPaths}`)
  } else {
    core.warning('No merged manifest files found to export.')
  }

  // Log summary
  core.info('')
  core.info(`Total artifacts exported: ${result.appFiles.length}`)
  core.info(`Total merged manifests exported: ${result.manifestFiles.length}`)
}
