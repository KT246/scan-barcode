import os from 'node:os'
import dgram from 'node:dgram'

type IpCandidate = {
  address: string
  interfaceName: string
}

const virtualInterfacePatterns = [
  /bluetooth/i,
  /docker/i,
  /hyper-v/i,
  /loopback/i,
  /tailscale/i,
  /virtual/i,
  /vmware/i,
  /vbox/i,
  /wsl/i,
  /zerotier/i,
]

const preferredInterfacePatterns = [
  /ethernet/i,
  /lan/i,
  /ndis/i,
  /rndis/i,
  /usb/i,
  /wi-?fi/i,
  /wireless/i,
  /wlan/i,
]

function isUsableIpv4(address: string) {
  return address !== '0.0.0.0' && !address.startsWith('127.')
}

function isPrivateLanIpv4(address: string) {
  const parts = address.split('.').map((part) => Number(part))

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  const [first, second] = parts

  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)
}

function isLikelyVirtualInterface(interfaceName: string) {
  return virtualInterfacePatterns.some((pattern) => pattern.test(interfaceName))
}

function isPreferredInterface(interfaceName: string) {
  return preferredInterfacePatterns.some((pattern) => pattern.test(interfaceName))
}

function getInterfaceCandidates() {
  const interfaces = os.networkInterfaces()
  const candidates: IpCandidate[] = []

  for (const [interfaceName, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        candidates.push({
          address: entry.address,
          interfaceName,
        })
      }
    }
  }

  return candidates
}

function scoreCandidate(candidate: IpCandidate) {
  let score = 0

  if (isPrivateLanIpv4(candidate.address)) {
    score += 100
  }

  if (isPreferredInterface(candidate.interfaceName)) {
    score += 30
  }

  if (isLikelyVirtualInterface(candidate.interfaceName)) {
    score -= 80
  }

  return score
}

function getBestInterfaceAddress() {
  const candidates = getInterfaceCandidates().filter((candidate) => isUsableIpv4(candidate.address))

  if (candidates.length === 0) {
    return '127.0.0.1'
  }

  return [...candidates].sort((left, right) => scoreCandidate(right) - scoreCandidate(left))[0].address
}

async function getRoutedLocalIpAddress(host: string) {
  return new Promise<string | null>((resolve) => {
    const socket = dgram.createSocket('udp4')
    let resolved = false

    const finish = (address: string | null) => {
      if (resolved) {
        return
      }

      resolved = true
      socket.close()
      resolve(address)
    }

    socket.once('error', () => finish(null))
    socket.connect(443, host, () => {
      const address = socket.address()
      finish(typeof address === 'object' && isUsableIpv4(address.address) ? address.address : null)
    })
  })
}

export async function getLocalIpAddress() {
  const routedAddress = await getRoutedLocalIpAddress('8.8.8.8')

  if (routedAddress && isPrivateLanIpv4(routedAddress)) {
    return routedAddress
  }

  return getBestInterfaceAddress()
}
