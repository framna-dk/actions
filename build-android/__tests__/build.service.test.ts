import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { executeGradleBuild, gradleTaskName } from '../src/services/build.service.js'
import { Config } from '../src/types.js'

describe('Gradle execution', () => {
  let project: string
  let config: Config

  beforeEach(async () => {
    project = await mkdtemp(join(tmpdir(), 'android project with spaces-'))
    config = {
      projectLocation: project,
      module: ':apps:mobile',
      variants: ['demoDebug', 'demoRelease'],
      artifactType: 'apk',
      arguments: ['--stacktrace', '-Pmessage=hello world']
    }
    await writeFile(join(project, 'gradlew'), '#!/bin/sh\nprintf "%s\\n" "$@" > arguments.txt\n', { mode: 0o755 })
  })

  afterEach(async () => {
    await rm(project, { recursive: true, force: true })
  })

  it('executes the wrapper in a path containing spaces and preserves argument boundaries', async () => {
    await executeGradleBuild(config)

    expect(await readFile(join(project, 'arguments.txt'), 'utf8')).toBe(
      ':apps:mobile:assembleDemoDebug\n:apps:mobile:assembleDemoRelease\n--stacktrace\n-Pmessage=hello world\n'
    )
  })

  it('propagates a failed build', async () => {
    await writeFile(join(project, 'gradlew'), '#!/bin/sh\nexit 17\n')

    await expect(executeGradleBuild(config)).rejects.toThrow('exit code 17')
  })

  it.each([
    ['apk', 'app', 'debug', ':app:assembleDebug'],
    ['aab', ':apps:mobile', 'demoRelease', ':apps:mobile:bundleDemoRelease'],
    ['apk', 'app', '', ':app:assemble'],
    ['aab', '', 'release', 'bundleRelease']
  ])('builds the %s task for module %s and variant %s', (type, module, variant, task) => {
    expect(gradleTaskName(type, module, variant)).toBe(task)
  })
})
