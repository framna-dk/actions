import { extname, basename } from 'path'
import { promises as fs } from 'fs'
import { APK_APP_TYPE, AAB_APP_TYPE } from './types.js'

export function parseVariants(input: string): string[] {
  if (!input.trim()) {
    return []
  }

  // Split by comma and clean up each variant
  const variants = input
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)

  return variants
}

export function capitalizeVariant(variant: string): string {
  if (!variant) {
    return variant
  }

  return variant.charAt(0).toUpperCase() + variant.slice(1)
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export function generateTimestamp(): string {
  const now = new Date()
  return now.toISOString().replace(/[-:T]/g, '').split('.')[0]
}

export function getFileExtension(filePath: string): string {
  return extname(filePath)
}

export function getBaseName(filePath: string): string {
  return basename(filePath)
}

export function removeExtension(fileName: string): string {
  const ext = extname(fileName)
  return fileName.substring(0, fileName.length - ext.length)
}

function modulePath(module: string): string {
  return module.replace(/^:/u, '').replace(/:/g, '/') || '**'
}

export function generateAppPathPatterns(module: string, variants: string[], appType: string): string[] {
  const prefix = `${modulePath(module)}/build/outputs`
  const patterns: string[] = []

  if (appType === AAB_APP_TYPE) {
    for (const variant of variants.length > 0 ? variants : ['*']) {
      patterns.push(`${prefix}/bundle/${variant}/*.aab`)
    }
  } else if (appType === APK_APP_TYPE) {
    if (variants.length === 0) {
      patterns.push(`${prefix}/apk/**/*.apk`)
    }
    for (const variant of variants) {
      patterns.push(`${prefix}/apk/${variant}/*.apk`)
      // AGP separates the combined flavor name and build type with a slash.
      // Try each camel-case boundary because both names can contain capitals.
      for (let index = 1; index < variant.length; index++) {
        if (/[A-Z]/u.test(variant[index])) {
          const flavor = variant.slice(0, index)
          const buildType = variant[index].toLowerCase() + variant.slice(index + 1)
          patterns.push(`${prefix}/apk/${flavor}/${buildType}/*.apk`)
        }
      }
    }
    patterns.push(`!${prefix}/apk/androidTest/**`)
  }

  return [...new Set(patterns)]
}

export function generateManifestPathPatterns(module: string, variants: string[]): string[] {
  const prefix = `${modulePath(module)}/build/intermediates`
  const patterns: string[] = []

  for (const variant of variants.length > 0 ? variants : ['*']) {
    patterns.push(`${prefix}/merged_manifest/${variant}/**/AndroidManifest.xml`)
    patterns.push(`${prefix}/merged_manifests/${variant}/**/AndroidManifest.xml`)
  }

  return [...new Set(patterns)]
}
