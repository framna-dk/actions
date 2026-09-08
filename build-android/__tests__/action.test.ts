import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const action = fileURLToPath(new URL('../dist/index.js', import.meta.url))

describe('bundled action', () => {
  let project: string
  let outputFile: string

  beforeEach(async () => {
    project = await mkdtemp(join(tmpdir(), 'android action with spaces-'))
    outputFile = join(project, 'github-output.txt')
    await writeFile(outputFile, '')
    await writeFile(join(project, 'gradlew'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  })

  afterEach(async () => {
    await rm(project, { recursive: true, force: true })
  })

  function run(type = 'apk'): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, [action], {
      cwd: project,
      env: {
        ...process.env,
        GITHUB_OUTPUT: outputFile,
        'INPUT_PROJECT-LOCATION': project,
        INPUT_MODULE: ':apps:mobile',
        INPUT_VARIANT: 'demoDebug',
        'INPUT_ARTIFACT-TYPE': type,
        INPUT_ARGUMENTS: '--stacktrace'
      },
      encoding: 'utf8',
      timeout: 10000
    })
  }

  function outputValue(contents: string, name: string): string | undefined {
    return contents.match(new RegExp(`^${name}<<([^\\n]+)\\n([^\\n]*)\\n\\1$`, 'm'))?.[2]
  }

  it.each([
    ['apk', 'apk/demo/debug'],
    ['aab', 'bundle/demoDebug']
  ])('exports %s and manifest paths through GITHUB_OUTPUT', async (type, directory) => {
    const artifact = join(project, `apps/mobile/build/outputs/${directory}/app.${type}`)
    const manifest = join(
      project,
      'apps/mobile/build/intermediates/merged_manifests/demoDebug/processDemoDebugManifest/AndroidManifest.xml'
    )
    for (const file of [artifact, manifest]) {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, 'fixture')
    }

    const result = run(type)
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    const output = await readFile(outputFile, 'utf8')
    expect(outputValue(output, 'artifact-path')).toBe(artifact)
    expect(outputValue(output, 'artifact-path-list')).toBe(artifact)
    expect(outputValue(output, 'manifest-path')).toBe(manifest)
    expect(outputValue(output, 'manifest-path-list')).toBe(manifest)
  })

  it('fails the action when Gradle fails', async () => {
    await writeFile(join(project, 'gradlew'), '#!/bin/sh\nexit 7\n')

    const result = run()
    expect(result.status).toBe(1)
    expect(String(result.stdout)).toContain('exit code 7')
    expect(await readFile(outputFile, 'utf8')).toBe('')
  })

  it('fails the action when the build produces no matching artifact', async () => {
    const result = run()
    expect(result.status).toBe(1)
    expect(String(result.stdout)).toContain('Could not find any app artifacts')
    expect(await readFile(outputFile, 'utf8')).toBe('')
  })
})
