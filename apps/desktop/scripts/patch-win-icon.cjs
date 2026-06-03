const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { rcedit } = require('rcedit')

function normalizeToolPath(input) {
  if (!input) {
    return null
  }

  const candidate = path.resolve(input)

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate
  }

  const names = ['rcedit-x64.exe', 'rcedit.exe']
  for (const name of names) {
    const nested = path.join(candidate, name)
    if (fs.existsSync(nested) && fs.statSync(nested).isFile()) {
      return nested
    }
  }

  return null
}

function walkForRcedit(dir, results) {
  if (!fs.existsSync(dir)) {
    return
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walkForRcedit(fullPath, results)
      continue
    }

    if (entry.isFile() && entry.name === 'rcedit-x64.exe') {
      const stat = fs.statSync(fullPath)
      if (stat.size > 100000) {
        results.push({ fullPath, mtimeMs: stat.mtimeMs })
      }
    }
  }
}

function findRcedit() {
  const envTool = normalizeToolPath(process.env.RCEDIT_PATH) || normalizeToolPath(process.env.ELECTRON_BUILDER_RCEDIT_PATH)

  if (envTool) {
    return envTool
  }

  const cacheRoot = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign')
    : null
  const results = []

  if (cacheRoot) {
    walkForRcedit(cacheRoot, results)
  }

  results.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return results[0]?.fullPath ?? null
}

exports.default = async function patchWinIcon(context) {
  const appInfo = context.packager.appInfo
  const exePath = path.join(context.appOutDir, `${appInfo.productFilename}.exe`)
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico')
  const version = `${appInfo.version}.0`

  if (!fs.existsSync(exePath)) {
    throw new Error(`Cannot patch icon because app exe was not found: ${exePath}`)
  }

  if (!fs.existsSync(iconPath)) {
    throw new Error(`Cannot patch icon because icon was not found: ${iconPath}`)
  }

  const options = {
    icon: iconPath,
    'version-string': {
      FileDescription: appInfo.description || appInfo.productName,
      ProductName: appInfo.productName,
      CompanyName: 'KT246',
      LegalCopyright: 'Copyright (c) 2026 KT246',
    },
    'file-version': version,
    'product-version': version,
    'requested-execution-level': 'asInvoker',
  }

  try {
    await rcedit(exePath, options)
  } catch (error) {
    const rceditPath = findRcedit()

    if (!rceditPath) {
      throw error
    }

    execFileSync(rceditPath, [
      exePath,
      '--set-icon',
      iconPath,
      '--set-version-string',
      'FileDescription',
      options['version-string'].FileDescription,
      '--set-version-string',
      'ProductName',
      options['version-string'].ProductName,
      '--set-version-string',
      'CompanyName',
      options['version-string'].CompanyName,
      '--set-version-string',
      'LegalCopyright',
      options['version-string'].LegalCopyright,
      '--set-file-version',
      version,
      '--set-product-version',
      version,
      '--set-requested-execution-level',
      'asInvoker',
    ], { stdio: 'inherit' })
  }
}
