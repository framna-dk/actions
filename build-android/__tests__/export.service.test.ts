import { exportResult } from '../src/services/export.service.js'
import {
  AAB_APP_TYPE,
  APK_APP_TYPE,
  ARTIFACT_ENV_KEY,
  ARTIFACT_LIST_ENV_KEY,
  MANIFEST_ENV_KEY,
  MANIFEST_LIST_ENV_KEY
} from '../src/types.js'
import * as core from '@actions/core'
import { jest } from '@jest/globals'

describe('exportResult', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('writes outputs for last artifact and manifest list', async () => {
    await exportResult({
      appFiles: [
        { path: '/tmp/app-1.apk', name: 'app-1.apk', type: APK_APP_TYPE },
        { path: '/tmp/app-2.apk', name: 'app-2.apk', type: APK_APP_TYPE },
        { path: '/tmp/app-3.aab', name: 'app-3.aab', type: AAB_APP_TYPE }
      ],
      manifestFiles: [
        { path: '/tmp/manifest-1.xml', name: 'AndroidManifest.xml' },
        { path: '/tmp/manifest-2.xml', name: 'AndroidManifest.xml' }
      ]
    })

    expect(core.setOutput).toHaveBeenCalledWith(ARTIFACT_ENV_KEY, '/tmp/app-3.aab')
    expect(core.setOutput).toHaveBeenCalledWith(ARTIFACT_LIST_ENV_KEY, '/tmp/app-1.apk|/tmp/app-2.apk|/tmp/app-3.aab')
    expect(core.setOutput).toHaveBeenCalledWith(MANIFEST_ENV_KEY, '/tmp/manifest-2.xml')
    expect(core.setOutput).toHaveBeenCalledWith(MANIFEST_LIST_ENV_KEY, '/tmp/manifest-1.xml|/tmp/manifest-2.xml')
  })

  it('rejects an empty artifact list', async () => {
    await expect(exportResult({ appFiles: [], manifestFiles: [] })).rejects.toThrow('Could not find any app artifacts')
    expect(core.setOutput).not.toHaveBeenCalled()
  })

  it('exports artifacts and warns when there is no merged manifest', async () => {
    await exportResult({ appFiles: [{ path: '/tmp/app.apk', name: 'app.apk', type: APK_APP_TYPE }], manifestFiles: [] })

    expect(core.setOutput).toHaveBeenCalledWith(ARTIFACT_ENV_KEY, '/tmp/app.apk')
    expect(core.setOutput).not.toHaveBeenCalledWith(MANIFEST_ENV_KEY, expect.anything())
    expect(core.warning).toHaveBeenCalledWith('No merged manifest files found to export.')
  })
})
