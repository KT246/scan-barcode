import { spawn } from 'node:child_process'

export type TypingResult = {
  ok: boolean
  error?: string
}

type TypingOptions = {
  autoEnter?: boolean
  autoTab?: boolean
}

function quotePowerShellString(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

export async function typeIntoFocusedWindow(value: string, options: TypingOptions = {}): Promise<TypingResult> {
  if (process.platform !== 'win32') {
    return {
      ok: false,
      error: 'Desktop auto typing is currently implemented for Windows only.',
    }
  }

  const suffix = options.autoTab ? '{TAB}' : options.autoEnter ? '{ENTER}' : ''
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    `Set-Clipboard -Value ${quotePowerShellString(value)}`,
    'Start-Sleep -Milliseconds 80',
    '[System.Windows.Forms.SendKeys]::SendWait("^v")',
    suffix ? `[System.Windows.Forms.SendKeys]::SendWait("${suffix}")` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'pipe'],
    })

    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (error) => {
      resolve({ ok: false, error: error.message })
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true })
        return
      }

      resolve({
        ok: false,
        error: stderr.trim() || `PowerShell exited with code ${code ?? 'unknown'}.`,
      })
    })

    child.stdin.end(script)
  })
}
