import * as core from '@actions/core'
import { parse } from 'shell-quote'
import { z } from 'zod'
import { Config, ArtifactType, APK_APP_TYPE, AAB_APP_TYPE } from '../types.js'
import { parseVariants } from '../utils.js'

// Zod schema for input validation
const InputSchema = z.object({
  projectLocation: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: 'Project location cannot be empty'
    }),

  variant: z.string().transform((val) => val.trim()),

  module: z.string().transform((val) => val.trim()),

  buildType: z.enum([APK_APP_TYPE, AAB_APP_TYPE]),

  arguments: z.string().transform((val) => val.trim())
})

type ValidatedInput = z.infer<typeof InputSchema>

export async function processConfig(): Promise<Config> {
  // Collect raw inputs from GitHub Actions
  const rawInput = {
    projectLocation: core.getInput('project-location') || '.',
    variant: core.getInput('variant') || '',
    module: core.getInput('module') || 'app',
    buildType: core.getInput('artifact-type') || 'apk',
    arguments: core.getInput('arguments') || ''
  }

  // Validate inputs using Zod schema
  let validatedInput: ValidatedInput
  try {
    validatedInput = InputSchema.parse(rawInput)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`).join(', ')
      throw new Error(`Input validation failed: ${errorMessages}`)
    }
    throw error
  }

  core.info('Configuration:')
  core.info(`  Project Location: ${validatedInput.projectLocation}`)
  core.info(`  Variants: ${validatedInput.variant}`)
  core.info(`  Module: ${validatedInput.module}`)
  core.info(`  Output Type: ${validatedInput.buildType}`)
  core.info(`  Arguments: ${validatedInput.arguments}`)

  // Parse arguments with shell-quote
  let args: string[] = []
  if (validatedInput.arguments) {
    const parsed = parse(validatedInput.arguments)
    args = parsed.filter((arg) => typeof arg === 'string') as string[]
  }

  return {
    projectLocation: validatedInput.projectLocation,
    variants: parseVariants(validatedInput.variant),
    module: validatedInput.module,
    artifactType: validatedInput.buildType as ArtifactType,
    arguments: args
  }
}
