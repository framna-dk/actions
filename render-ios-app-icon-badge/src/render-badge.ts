import path from "path"
import {
  recolorPixels,
  renderLayers,
  getPixelColor,
  getImageSize
} from "./utils/imagemagick"
import { hexToRgb } from "./utils/hex"
import makeTmpFile from "./utils/make-tmp-file"

export default async (options: { filePaths: string[], style: string, curlColor?: string }) => {
  return await Promise.all(options.filePaths.map(async filePath => {
    return await renderBadge({ filePath, style: options.style, curlColor: options.curlColor })
  }))
}

async function renderBadge(options: { filePath: string, style: string, curlColor?: string }) {
  const curlColor = await getCurlColor(options.filePath, options.curlColor)
  const resourcesDir = path.join(__dirname, "../resources", options.style)
  const backgroundFilePath = path.join(resourcesDir, "background.png")
  const gridFilePath = path.join(resourcesDir, "grid.png")
  const curlFilePath = path.join(resourcesDir, "curl.png")
  const curlShadowFilePath = path.join(resourcesDir, "curl_shadow.png")
  const curlHighlightsFilePath = path.join(resourcesDir, "curl_highlights.png")
  const curlInnerGlowFilePath = path.join(resourcesDir, "curl_inner_glow.png")
  const curlShadowOnGridFilePath = path.join(resourcesDir, "curl_shadow_on_grid.png")
  const tmpRecoloredCurlImage = makeTmpFile()
  await recolorPixels(curlFilePath, tmpRecoloredCurlImage.filePath, curlColor)
  const layers = [
    options.filePath,
    backgroundFilePath,
    curlShadowFilePath,
    tmpRecoloredCurlImage.filePath,
    curlHighlightsFilePath,
    gridFilePath,
    curlInnerGlowFilePath,
    curlShadowOnGridFilePath
  ]
  const targetSize = await getImageSize(options.filePath)
  await renderLayers(layers, options.filePath, targetSize)
  tmpRecoloredCurlImage.cleanUp()
}

async function getCurlColor(filePath: string, tintColor?: string) {
  const imageSize = await getImageSize(filePath)
  if (tintColor && typeof tintColor === 'string' && tintColor.length > 0) {
    return hexToRgb(tintColor)
  } else {
    return await getPixelColor(filePath, { x: imageSize.width - 1, y: 0 })
  }
}
