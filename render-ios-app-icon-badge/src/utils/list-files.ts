import fs from "fs"
import path from "path"

// Returns the paths of all files beneath `dir`.
export default async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter(entry => entry.isFile())
    .map(entry => path.join(entry.parentPath, entry.name))
}
