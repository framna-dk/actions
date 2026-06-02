import listFiles from "./list-files"
import fs from "fs"
import path from "path"

export default async function (dir: string): Promise<string[]> {
  const files: string[] = await listFiles(dir)
  return files.filter(file => {
    if (path.basename(file) === "icon.json") {
      const parentDir = path.dirname(file)
      const parentName = path.basename(parentDir)
      if (parentName.endsWith(".icon")) {
        const assetsDir = path.join(parentDir, "Assets")
        return fs.existsSync(assetsDir) && fs.lstatSync(assetsDir).isDirectory()
      }
    }
    return false
  }).map(file => {
    return path.dirname(file)
  })
}
