import listFiles from "./list-files"
import findIconFiles from "./find-icon-files"

export interface AppIconFiles {
  iconFiles: string[]
  imageFiles: string[]
}

export default async function (dir: string): Promise<AppIconFiles> {
  const iconFiles = await findIconFiles(dir)

  if (iconFiles.length > 0) {
    return {
      iconFiles,
      imageFiles: []
    }
  }

  const files: string[] = await listFiles(dir)
  const imageFiles = files.filter(file => {
    var isInAppIconSet = file.indexOf(".appiconset") != -1
    var isImage = file.match(/.(png|jpg|jpeg|gif)$/)
    return isInAppIconSet && isImage
  })

  return {
    iconFiles: [],
    imageFiles
  }
}
