import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as path from 'path'

export async function findOutputFiles(projectLocation: string, patterns: string[]): Promise<string[]> {
  const projectRoot = path.resolve(projectLocation).replace(/\\/g, '/').replace(/\/+$/u, '')
  const scopedPatterns = patterns.map((pattern) =>
    pattern.startsWith('!') ? `!${projectRoot}/${pattern.slice(1)}` : `${projectRoot}/${pattern}`
  )

  core.info('Generated search patterns:')
  scopedPatterns.forEach((pattern) => core.info(`  ${pattern}`))

  const globber = await glob.create(scopedPatterns.join('\n'), {
    followSymbolicLinks: false,
    implicitDescendants: false,
    matchDirectories: false
  })

  // Gradle can leave valid UP-TO-DATE outputs untouched. Select by module and
  // variant, not modification time, so a partly rebuilt set stays complete.
  return [...new Set(await globber.glob())].sort()
}
