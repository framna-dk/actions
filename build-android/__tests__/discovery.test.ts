import { mkdtemp, mkdir, writeFile, utimes, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { discoverArtifacts } from '../src/services/artifact-discovery.service.js'
import { discoverManifests } from '../src/services/manifest-discovery.service.js'
import { Config } from '../src/types.js'

describe('output discovery', () => {
  let project: string
  let config: Config

  beforeEach(async () => {
    project = await mkdtemp(join(tmpdir(), 'android-discovery-'))
    config = { projectLocation: project, module: 'app', variants: ['release'], artifactType: 'apk', arguments: [] }
  })

  afterEach(async () => {
    await rm(project, { recursive: true, force: true })
  })

  async function file(name: string, modified = new Date(0)): Promise<void> {
    const path = join(project, name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, 'fixture')
    await utimes(path, modified, modified)
  }

  async function paths(): Promise<{ artifacts: string[]; manifests: string[] }> {
    const { appFiles } = await discoverArtifacts(config)
    const { manifestFiles } = await discoverManifests(config)
    return {
      artifacts: appFiles.map(({ path }) => relative(project, path)),
      manifests: manifestFiles.map(({ path }) => relative(project, path))
    }
  }

  it.each(['apk', 'aab'] as const)('excludes other modules and variants from %s and manifest outputs', async (type) => {
    config.artifactType = type
    const output = type === 'apk' ? 'apk' : 'bundle'
    const selectedArtifact = `app/build/outputs/${output}/release/app-release.${type}`
    const selectedManifest = 'app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml'
    await file(selectedArtifact)
    await file(selectedManifest)
    await file(`other/build/outputs/${output}/debug/other-debug.${type}`)
    await file(`app/build/outputs/${output}/debug/app-debug.${type}`)
    await file('other/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml')
    await file('app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml')

    await expect(paths()).resolves.toEqual({ artifacts: [selectedArtifact], manifests: [selectedManifest] })
  })

  it.each([
    ['freeRelease', 'free/release'],
    ['minApi24DemoRelease', 'minApi24Demo/release'],
    ['paidInternalRelease', 'paid/internalRelease']
  ])('discovers the flavored APK for %s', async (variant, directory) => {
    config.variants = [variant]
    const artifact = `app/build/outputs/apk/${directory}/app.apk`
    const manifest = `app/build/intermediates/merged_manifests/${variant}/AndroidManifest.xml`
    await file(artifact)
    await file(manifest)
    await file('app/build/outputs/apk/other/release/other.apk')

    await expect(paths()).resolves.toEqual({ artifacts: [artifact], manifests: [manifest] })
  })

  it('discovers flavored bundles using the exact variant name', async () => {
    config.artifactType = 'aab'
    config.variants = ['demoRelease']
    const artifact = 'app/build/outputs/bundle/demoRelease/app.aab'
    await file(artifact)
    await file('app/build/outputs/bundle/demoReleaseExtra/other.aab')

    await expect(paths()).resolves.toEqual({ artifacts: [artifact], manifests: [] })
  })

  it.each(['apps:mobile', ':apps:mobile'])('resolves nested module %s', async (module) => {
    config.module = module
    const artifact = 'apps/mobile/build/outputs/apk/release/app.apk'
    const manifest = 'apps/mobile/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml'
    await file(artifact)
    await file(manifest)

    await expect(paths()).resolves.toEqual({ artifacts: [artifact], manifests: [manifest] })
  })

  it('keeps both up-to-date and newly generated variants', async () => {
    config.variants = ['debug', 'release']
    const artifacts = ['app/build/outputs/apk/debug/app.apk', 'app/build/outputs/apk/release/app.apk']
    const manifests = [
      'app/build/intermediates/merged_manifests/debug/AndroidManifest.xml',
      'app/build/intermediates/merged_manifests/release/AndroidManifest.xml'
    ]
    await file(artifacts[0])
    await file(manifests[0])
    await file(artifacts[1], new Date(Date.now() + 1000))
    await file(manifests[1], new Date(Date.now() + 1000))

    await expect(paths()).resolves.toEqual({ artifacts, manifests })
  })

  it('returns no matches when only unrelated artifacts exist', async () => {
    await file('other/build/outputs/apk/release/other.apk')
    await file('app/build/outputs/apk/debug/app.apk')
    await file('other/build/intermediates/merged_manifests/release/AndroidManifest.xml')

    await expect(paths()).resolves.toEqual({ artifacts: [], manifests: [] })
  })

  it('deduplicates variants and includes all APK splits', async () => {
    config.variants = ['release', 'release']
    const artifacts = ['app/build/outputs/apk/release/app-arm64.apk', 'app/build/outputs/apk/release/app-x86.apk']
    const manifest = 'app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml'
    await file(artifacts[0])
    await file(artifacts[1])
    await file(manifest)

    await expect(paths()).resolves.toEqual({ artifacts, manifests: [manifest] })
  })

  it('discovers all variants in the selected module when the variant is empty', async () => {
    config.variants = []
    const artifacts = ['app/build/outputs/apk/demo/debug/app.apk', 'app/build/outputs/apk/release/app.apk']
    await file(artifacts[0])
    await file(artifacts[1])
    await file('app/build/outputs/apk/androidTest/debug/app-test.apk')
    await file('other/build/outputs/apk/release/other.apk')

    await expect(paths()).resolves.toEqual({ artifacts, manifests: [] })
  })
})
