export type ArtifactType = typeof APK_APP_TYPE | typeof AAB_APP_TYPE

export interface Config {
  projectLocation: string
  variants: string[]
  module: string
  artifactType: ArtifactType
  arguments: string[]
}

export interface Result {
  appFiles: Artifact[]
  manifestFiles: ManifestFile[]
}

export interface Artifact {
  path: string
  name: string
  type: ArtifactType
}

export interface ManifestFile {
  path: string
  name: string
}

export const APK_APP_TYPE = 'apk'
export const AAB_APP_TYPE = 'aab'

export const ARTIFACT_ENV_KEY = 'artifact-path'
export const ARTIFACT_LIST_ENV_KEY = 'artifact-path-list'
export const MANIFEST_ENV_KEY = 'manifest-path'
export const MANIFEST_LIST_ENV_KEY = 'manifest-path-list'
