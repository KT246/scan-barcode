import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import QRCode from 'qrcode'
import { Server as SocketServer } from 'socket.io'
import type { DesktopConnectInfo } from '../shared/desktop-api'
import { ensureLocalCertificate, type LocalCertificate } from './local-certificate'
import { getLocalIpAddress } from './network'

const DEFAULT_PORT = 8787
const BARCODE_SCANNED_EVENT = 'barcode:scanned'
const BARCODE_RECEIVED_EVENT = 'barcode:received'

type IncomingScanPayload = {
  token?: string
  value?: string
  type?: 'barcode' | 'qr' | 'manual'
  timestamp?: number
}

type NormalizedScanPayload = {
  value: string
  type: 'barcode' | 'qr' | 'manual'
  timestamp: number
}

type ScannerServerOptions = {
  scannerDistPath: string
  certificateDir: string
  onScan: (payload: NormalizedScanPayload) => Promise<{ ok: boolean; error?: string }>
  onConnectionChange: (info: DesktopConnectInfo) => void
}

export type ScannerServerHandle = {
  getConnectInfo: () => DesktopConnectInfo
  refreshToken: () => Promise<DesktopConnectInfo>
  close: () => Promise<void>
}

function createToken() {
  return crypto.randomBytes(18).toString('base64url')
}

function getTokenPreview(token: string) {
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

function normalizePayload(payload: IncomingScanPayload, activeToken: string): NormalizedScanPayload | null {
  if (!payload || payload.token !== activeToken || typeof payload.value !== 'string') {
    return null
  }

  const value = payload.value.trim()

  if (!value) {
    return null
  }

  return {
    value,
    type: payload.type ?? 'barcode',
    timestamp: payload.timestamp ?? Date.now(),
  }
}

function fallbackScannerHtml(info: DesktopConnectInfo) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Phone Scan</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Segoe UI, Arial, sans-serif; background: #f4f8ff; color: #111827; }
      main { width: min(420px, calc(100vw - 32px)); padding: 28px; border: 1px solid #dbe5f2; border-radius: 12px; background: #fff; box-shadow: 0 20px 50px rgba(22, 36, 58, .12); }
      h1 { margin: 0 0 10px; font-size: 24px; }
      p { margin: 0 0 16px; color: #526174; line-height: 1.5; }
      code { display: block; padding: 12px; border-radius: 8px; background: #eef5ff; color: #0759e4; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <main>
      <h1>Phone Scan PWA is not built yet</h1>
      <p>Run <strong>pnpm build:pwa</strong> from the repo root, then restart the desktop app.</p>
      <p>If the phone camera is blocked, open the certificate page and install the Phone Scan local certificate.</p>
      <code>${info.scannerUrl}</code>
      <p><a href="${info.trustUrl}">Open certificate setup</a></p>
    </main>
  </body>
</html>`
}

function trustCertificateHtml(info: DesktopConnectInfo) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Phone Scan Certificate</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Segoe UI, Arial, sans-serif; background: #f4f8ff; color: #111827; }
      main { width: min(520px, calc(100vw - 32px)); padding: 28px; border: 1px solid #dbe5f2; border-radius: 12px; background: #fff; box-shadow: 0 20px 50px rgba(22, 36, 58, .12); }
      h1 { margin: 0 0 10px; font-size: 24px; }
      p, li { color: #526174; line-height: 1.5; }
      a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px; border-radius: 8px; color: #fff; background: #0759e4; text-decoration: none; font-weight: 700; }
      code { display: block; margin-top: 14px; padding: 12px; border-radius: 8px; background: #eef5ff; color: #0759e4; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <main>
      <h1>Trust Phone Scan Local Certificate</h1>
      <p>The camera scanner needs HTTPS. Install this local certificate on your phone, then reopen the scanner link.</p>
      <ol>
        <li>Tap Download Certificate.</li>
        <li>Install the downloaded profile/certificate in phone settings.</li>
        <li>Mark it as trusted if your phone asks.</li>
        <li>Return to the scanner page.</li>
      </ol>
      <p><a href="${info.certificateUrl}">Download Certificate</a></p>
      <code>${info.scannerUrl}</code>
    </main>
  </body>
</html>`
}

async function generateQrDataUrl(url: string) {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 12,
    color: {
      dark: '#050505',
      light: '#ffffff',
    },
  })
}

async function createFastifyServer(options: ScannerServerOptions, requestedPort: number) {
  let token = createToken()
  let ipAddress = getLocalIpAddress()
  let certificate: LocalCertificate = await ensureLocalCertificate(options.certificateDir, ipAddress)
  const fastify = Fastify({
    logger: false,
    https: {
      key: certificate.key,
      cert: certificate.cert,
    },
  })
  let actualPort = requestedPort
  let connectedClients = 0
  let qrDataUrl = ''

  const scannerIndexPath = path.join(options.scannerDistPath, 'index.html')
  const hasScannerBuild = fs.existsSync(scannerIndexPath)

  const buildBaseUrl = () => `https://${ipAddress}:${actualPort}`
  const buildScannerUrl = () => `${buildBaseUrl()}/scan?token=${encodeURIComponent(token)}`
  const buildCertificateUrl = () => `${buildBaseUrl()}/cert/phone-scan-local-cert.pem`
  const buildTrustUrl = () => `${buildBaseUrl()}/trust?token=${encodeURIComponent(token)}`

  const getConnectInfo = (): DesktopConnectInfo => ({
    status: 'running',
    computerName: os.hostname(),
    ipAddress,
    port: actualPort,
    protocol: 'https',
    scannerUrl: buildScannerUrl(),
    certificateUrl: buildCertificateUrl(),
    trustUrl: buildTrustUrl(),
    qrDataUrl,
    tokenPreview: getTokenPreview(token),
    connectedClients,
  })

  const refreshQr = async () => {
    qrDataUrl = await generateQrDataUrl(buildScannerUrl())
  }

  fastify.addHook('onRequest', (request, reply, done) => {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type')
    reply.header('Access-Control-Allow-Private-Network', 'true')

    if (request.method === 'OPTIONS') {
      reply.send()
      return
    }

    done()
  })

  fastify.get('/api/connect-info', async () => getConnectInfo())

  fastify.get('/cert/phone-scan-local-cert.pem', async (_request, reply) => {
    reply.header('Content-Disposition', 'attachment; filename="phone-scan-local-cert.pem"')
    reply.type('application/x-x509-ca-cert')
    return fs.createReadStream(certificate.certPath)
  })

  fastify.get('/trust', async (_request, reply) => {
    reply.type('text/html')
    return trustCertificateHtml(getConnectInfo())
  })

  fastify.post('/api/scan', async (request, reply) => {
    const payload = normalizePayload(request.body as IncomingScanPayload, token)

    if (!payload) {
      reply.code(401)
      return { ok: false, error: 'Invalid token or barcode value.' }
    }

    const result = await options.onScan(payload)
    return result
  })

  if (hasScannerBuild) {
    await fastify.register(fastifyStatic, {
      root: options.scannerDistPath,
      prefix: '/',
      index: false,
      wildcard: false,
    })
  }

  fastify.get('/', async (_request, reply) => {
    reply.redirect(`/scan?token=${encodeURIComponent(token)}`)
  })

  fastify.get('/scan', async (request, reply) => {
    const requestToken = (request.query as { token?: string }).token

    if (requestToken !== token) {
      reply.redirect(`/scan?token=${encodeURIComponent(token)}`)
      return
    }

    if (hasScannerBuild) {
      return reply.sendFile('index.html')
    }

    reply.type('text/html')
    return fallbackScannerHtml(getConnectInfo())
  })

  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/socket.io/')) {
      reply.code(404).send({ ok: false, error: 'Not found.' })
      return
    }

    if (hasScannerBuild) {
      reply.sendFile('index.html')
      return
    }

    reply.type('text/html').send(fallbackScannerHtml(getConnectInfo()))
  })

  const io = new SocketServer(fastify.server, {
    cors: {
      origin: true,
    },
  })

  io.use((socket, next) => {
    const socketToken = socket.handshake.auth.token ?? socket.handshake.query.token

    if (socketToken !== token) {
      next(new Error('Invalid token.'))
      return
    }

    next()
  })

  io.on('connection', (socket) => {
    connectedClients += 1
    options.onConnectionChange(getConnectInfo())
    socket.emit('desktop:ready', getConnectInfo())

    socket.on(BARCODE_SCANNED_EVENT, async (payload: IncomingScanPayload, acknowledge?: (result: unknown) => void) => {
      const normalized = normalizePayload(payload, token)

      if (!normalized) {
        acknowledge?.({ ok: false, error: 'Invalid token or barcode value.' })
        return
      }

      const result = await options.onScan(normalized)
      socket.emit(BARCODE_RECEIVED_EVENT, result)
      acknowledge?.(result)
    })

    socket.on('disconnect', () => {
      connectedClients = Math.max(0, connectedClients - 1)
      options.onConnectionChange(getConnectInfo())
    })
  })

  await fastify.listen({ host: '0.0.0.0', port: requestedPort })
  const address = fastify.server.address()
  actualPort = typeof address === 'object' && address ? address.port : requestedPort
  await refreshQr()

  return {
    getConnectInfo,
    refreshToken: async () => {
      token = createToken()
      connectedClients = 0
      io.disconnectSockets(true)
      await refreshQr()
      const info = getConnectInfo()
      options.onConnectionChange(info)
      return info
    },
    close: async () => {
      io.close()
      await fastify.close()
    },
  }
}

export async function startScannerServer(options: ScannerServerOptions): Promise<ScannerServerHandle> {
  try {
    return await createFastifyServer(options, DEFAULT_PORT)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code

    if (code !== 'EADDRINUSE') {
      throw error
    }

    return createFastifyServer(options, 0)
  }
}
