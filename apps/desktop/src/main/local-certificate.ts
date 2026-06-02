import fs from 'node:fs/promises'
import path from 'node:path'
import { generate } from 'selfsigned'

type CertificateMeta = {
  ipAddress: string
  createdAt: string
}

export type LocalCertificate = {
  key: string
  cert: string
  certPath: string
}

const CERT_FILE = 'phone-scan-local-cert.pem'
const KEY_FILE = 'phone-scan-local-key.pem'
const META_FILE = 'phone-scan-local-cert.json'

async function readCertificateFiles(certificateDir: string, ipAddress: string): Promise<LocalCertificate | null> {
  try {
    const certPath = path.join(certificateDir, CERT_FILE)
    const keyPath = path.join(certificateDir, KEY_FILE)
    const metaPath = path.join(certificateDir, META_FILE)
    const [cert, key, metaRaw] = await Promise.all([
      fs.readFile(certPath, 'utf8'),
      fs.readFile(keyPath, 'utf8'),
      fs.readFile(metaPath, 'utf8'),
    ])
    const meta = JSON.parse(metaRaw) as CertificateMeta

    if (meta.ipAddress !== ipAddress) {
      return null
    }

    return { cert, key, certPath }
  } catch {
    return null
  }
}

export async function ensureLocalCertificate(certificateDir: string, ipAddress: string): Promise<LocalCertificate> {
  await fs.mkdir(certificateDir, { recursive: true })

  const existing = await readCertificateFiles(certificateDir, ipAddress)

  if (existing) {
    return existing
  }

  const certPath = path.join(certificateDir, CERT_FILE)
  const keyPath = path.join(certificateDir, KEY_FILE)
  const metaPath = path.join(certificateDir, META_FILE)
  const pems = await generate(
    [
      {
        name: 'commonName',
        value: ipAddress,
      },
      {
        name: 'organizationName',
        value: 'Phone Scan Local',
      },
    ],
    {
      keySize: 2048,
      algorithm: 'sha256',
      notAfterDate: new Date(Date.now() + 825 * 24 * 60 * 60 * 1000),
      extensions: [
        {
          name: 'basicConstraints',
          cA: true,
          critical: true,
        },
        {
          name: 'keyUsage',
          digitalSignature: true,
          keyEncipherment: true,
          keyCertSign: true,
          cRLSign: true,
          critical: true,
        },
        {
          name: 'extKeyUsage',
          serverAuth: true,
        },
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: ipAddress },
          ],
        },
      ],
    },
  )
  const meta: CertificateMeta = {
    ipAddress,
    createdAt: new Date().toISOString(),
  }

  await Promise.all([
    fs.writeFile(certPath, pems.cert, 'utf8'),
    fs.writeFile(keyPath, pems.private, 'utf8'),
    fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8'),
  ])

  return {
    cert: pems.cert,
    key: pems.private,
    certPath,
  }
}
