'use client'

import Image from 'next/image'
import {
  BadgeCheck,
  Cable,
  Check,
  ChevronRight,
  Download,
  Globe2,
  Laptop,
  LockKeyhole,
  MonitorDown,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Wifi,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { downloadConfig } from './downloads'

type Locale = 'en' | 'lo'

const copy = {
  en: {
    badge: 'Local desktop barcode scanner',
    headline: 'Phone Scan',
    subhead: 'Use your phone camera as a fast barcode scanner for any focused input on your desktop.',
    primaryCta: 'Download for Windows',
    secondaryCta: 'How it works',
    releaseNote: 'The installer is hosted as the official release asset. If the download does not start, view all releases.',
    platformTitle: 'Desktop tool',
    platformBody: 'Install on your computer, scan the QR with your phone, then every barcode is typed into the active input.',
    scannerTitle: 'Phone scanner',
    scannerBody: 'The phone opens the scanner PWA and connects to the desktop session through your local Wi-Fi network.',
    privacyTitle: 'Local only',
    privacyBody: 'No login and no cloud server. Your scans stay on your local connection.',
    downloadsTitle: 'Download options',
    downloadsBody: 'Download the desktop tool directly. No account or cloud setup is required.',
    windows: 'Windows installer',
    windowsStatus: 'Windows 10/11',
    downloadWindows: 'Download for Windows',
    allReleases: 'View all releases',
    stepsTitle: 'Setup flow',
    stepOne: 'Install Phone Scan on desktop',
    stepTwo: 'Open the app and scan the QR from your phone',
    stepThree: 'Scan barcodes and type into the focused desktop field',
    featureOne: 'Wi-Fi local connection',
    featureTwo: '1D and 2D barcode scanning',
    featureThree: 'Lao and English interface',
    powered: 'Powered by TJ',
  },
  lo: {
    badge: 'ເຄື່ອງສະແກນ barcode ສໍາລັບ desktop',
    headline: 'Phone Scan',
    subhead: 'ໃຊ້ກ້ອງໂທລະສັບເປັນເຄື່ອງສະແກນ barcode ເຂົ້າຊ່ອງຂໍ້ມູນໃນຄອມພິວເຕີ.',
    primaryCta: 'ດາວໂຫຼດສໍາລັບ Windows',
    secondaryCta: 'ວິທີໃຊ້',
    releaseNote: 'ຕົວຕິດຕັ້ງຖືກເກັບເປັນ release asset ທາງການ. ຖ້າດາວໂຫຼດບໍ່ເລີ່ມ ໃຫ້ເບິ່ງ release ທັງໝົດ.',
    platformTitle: 'ເຄື່ອງມື Desktop',
    platformBody: 'ຕິດຕັ້ງໃນຄອມພິວເຕີ, ສະແກນ QR ດ້ວຍໂທລະສັບ, ແລ້ວ barcode ຈະຖືກພິມເຂົ້າຊ່ອງທີ່ເລືອກ.',
    scannerTitle: 'ເຄື່ອງສະແກນໃນໂທລະສັບ',
    scannerBody: 'ໂທລະສັບເປີດ PWA scanner ແລະເຊື່ອມຕໍ່ກັບ desktop ຜ່ານ Wi-Fi ໃນເຄືອຂ່າຍດຽວກັນ.',
    privacyTitle: 'ໃຊ້ງານພາຍໃນເຄືອຂ່າຍ',
    privacyBody: 'ບໍ່ຕ້ອງ login ແລະບໍ່ໃຊ້ cloud server. ຂໍ້ມູນສະແກນຢູ່ໃນການເຊື່ອມຕໍ່ local.',
    downloadsTitle: 'ຕົວເລືອກດາວໂຫຼດ',
    downloadsBody: 'ດາວໂຫຼດເຄື່ອງມື desktop ໂດຍກົງ. ບໍ່ຕ້ອງມີ account ຫຼື cloud setup.',
    windows: 'ຕົວຕິດຕັ້ງ Windows',
    windowsStatus: 'Windows 10/11',
    downloadWindows: 'ດາວໂຫຼດສໍາລັບ Windows',
    allReleases: 'ເບິ່ງ release ທັງໝົດ',
    stepsTitle: 'ຂັ້ນຕອນໃຊ້ງານ',
    stepOne: 'ຕິດຕັ້ງ Phone Scan ໃນ desktop',
    stepTwo: 'ເປີດ app ແລະສະແກນ QR ດ້ວຍໂທລະສັບ',
    stepThree: 'ສະແກນ barcode ແລະພິມເຂົ້າຊ່ອງໃນ desktop',
    featureOne: 'ເຊື່ອມຕໍ່ຜ່ານ Wi-Fi',
    featureTwo: 'ສະແກນ barcode 1D ແລະ 2D',
    featureThree: 'ຮອງຮັບພາສາລາວ ແລະ English',
    powered: 'Powered by TJ',
  },
}

export default function DownloadPage() {
  const [locale, setLocale] = useState<Locale>('en')
  const t = copy[locale]
  const features = useMemo(() => [t.featureOne, t.featureTwo, t.featureThree], [t])

  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Phone Scan home">
          <span className="brand-mark">
            <Image src="/app-logo-icon.png" alt="" width={32} height={32} priority />
          </span>
          <span>Phone Scan</span>
        </a>
        <div className="language-switch" aria-label="Language">
          <Globe2 size={18} />
          <button className={locale === 'en' ? 'active' : ''} type="button" onClick={() => setLocale('en')}>
            EN
          </button>
          <button className={locale === 'lo' ? 'active' : ''} type="button" onClick={() => setLocale('lo')}>
            ລາວ
          </button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">
            <ScanLine size={18} />
            {t.badge}
          </span>
          <h1>{t.headline}</h1>
          <p>{t.subhead}</p>
          <div className="hero-actions">
            <a className="primary-button" href={downloadConfig.windows.installerUrl}>
              <Download size={20} />
              {t.primaryCta}
            </a>
            <a className="secondary-button" href="#workflow">
              {t.secondaryCta}
              <ChevronRight size={20} />
            </a>
          </div>
          <div className="feature-row">
            {features.map((feature) => (
              <span key={feature}>
                <Check size={16} />
                {feature}
              </span>
            ))}
          </div>
        </div>

        <div className="product-panel" aria-label="Phone Scan preview">
          <div className="desktop-window">
            <div className="window-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="window-body">
              <div className="qr-card">
                <QrCode size={84} />
                <strong>Scan to connect</strong>
              </div>
              <div className="status-card">
                <BadgeCheck size={28} />
                <div>
                  <strong>Running</strong>
                  <span>HTTPS 8787</span>
                </div>
              </div>
            </div>
          </div>
          <div className="phone-card">
            <Smartphone size={42} />
            <span>Scanner PWA</span>
          </div>
        </div>
      </section>

      <section className="value-grid" aria-label="Key benefits">
        <FeatureCard icon={<Laptop />} title={t.platformTitle} body={t.platformBody} />
        <FeatureCard icon={<Wifi />} title={t.scannerTitle} body={t.scannerBody} />
        <FeatureCard icon={<ShieldCheck />} title={t.privacyTitle} body={t.privacyBody} />
      </section>

      <section className="download-section" id="downloads">
        <div>
          <span className="section-kicker">
            <MonitorDown size={18} />
            {t.downloadsTitle}
          </span>
          <p>{t.downloadsBody}</p>
        </div>
        <div className="download-card">
          <div className="download-icon">
            <Cable size={32} />
          </div>
          <div>
            <strong>{t.windows}</strong>
            <span>{t.windowsStatus} · v{downloadConfig.appVersion}</span>
          </div>
          <div className="download-actions">
            <a className="release-button" href={downloadConfig.windows.installerUrl}>
              <Download size={18} />
              {t.downloadWindows}
            </a>
            <a className="all-releases-link" href={downloadConfig.releasesUrl} target="_blank" rel="noreferrer">
              {t.allReleases}
            </a>
          </div>
        </div>
        <p className="release-note">{t.releaseNote}</p>
      </section>

      <section className="workflow" id="workflow">
        <h2>{t.stepsTitle}</h2>
        <div className="steps">
          <Step number="1" text={t.stepOne} />
          <Step number="2" text={t.stepTwo} />
          <Step number="3" text={t.stepThree} />
        </div>
      </section>

      <footer>
        <LockKeyhole size={18} />
        <span>{t.powered}</span>
      </footer>
    </main>
  )
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <article className="feature-card">
      <span className="feature-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </article>
  )
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="step">
      <span>{number}</span>
      <p>{text}</p>
    </div>
  )
}
