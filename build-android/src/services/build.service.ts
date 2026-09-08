import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as path from 'path'
import { AAB_APP_TYPE, APK_APP_TYPE, Config } from '../types.js'

export async function executeGradleBuild(config: Config): Promise<void> {
  core.info('Run build:')

  const tasks: string[] = []
  if (config.variants.length === 0) {
    // Run base task to build all variants when no variant is specified
    tasks.push(gradleTaskName(config.artifactType, config.module, ''))
  } else {
    for (const variant of config.variants) {
      const taskName = gradleTaskName(config.artifactType, config.module, variant)
      tasks.push(taskName)
    }
  }

  const cmdArgs = [...tasks, ...config.arguments]
  const absPath = path.resolve(config.projectLocation)
  const gradlewPath = path.join(absPath, 'gradlew')

  core.info('')
  core.info(`$ ${gradlewPath} ${cmdArgs.join(' ')}`)
  core.info('')

  // Resolve the wrapper relative to cwd so spaces in the project path are not
  // parsed as command-line argument separators by @actions/exec.
  const exitCode = await exec.exec('./gradlew', cmdArgs, {
    cwd: absPath
  })

  if (exitCode !== 0) {
    throw new Error(`Build task failed with exit code: ${exitCode}`)
  }
}

export function gradleTaskName(appType: string, module: string, variant: string): string {
  let task: string

  if (appType === APK_APP_TYPE) {
    task = 'assemble'
  } else if (appType === AAB_APP_TYPE) {
    task = 'bundle'
  } else {
    throw new Error(`Invalid app type: ${appType}`)
  }

  // If variant is not defined, Gradle will execute the task for all variants
  if (variant) {
    task = task + variant.charAt(0).toUpperCase() + variant.slice(1)
  }

  // If module is not defined, Gradle will execute the task on all modules in the project
  if (module) {
    const rawModule = module.startsWith(':') ? module.substring(1) : module
    task = `:${rawModule}:${task}`
  }

  return task
}
