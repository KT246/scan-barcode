'use client'

import Image from 'next/image'
import {
  ArrowDown,
  BadgeCheck,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  Globe2,
  Laptop,
  LockKeyhole,
  MonitorDown,
  QrCode,
  Radar,
  ScanBarcode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { downloadConfig } from './downloads'

type Locale = 'en' | 'lo'

const copy = {
  en: {
    navDownload: 'Download',
    navWorkflow: 'Workflow',
    navPrivacy: 'Privacy',
    badge: 'Local desktop barcode scanner',
    headline: 'Phone Scan',
    subhead: 'Scan from your phone and type barcodes directly into the focused field on your desktop.',
    primaryCta: 'Download for Windows',
    secondaryCta: 'See workflow',
    releaseNote: 'The installer downloads from the official GitHub Release asset.',
    platformTitle: 'Desktop receiver',
    platformBody: 'The desktop app opens a local scanner session and types each accepted barcode into the active input.',
    scannerTitle: 'Phone PWA scanner',
    scannerBody: 'Use the phone camera for 1D and 2D codes with sound and haptic feedback after each scan.',
    privacyTitle: 'Local Wi-Fi only',
    privacyBody: 'No account, cloud sync, or remote barcode storage. Your scans stay on your local connection.',
    downloadsTitle: 'Ready installer',
    downloadsBody: 'Install Phone Scan on Windows, open the app, then scan the QR code from your phone.',
    windows: 'Windows installer',
    windowsStatus: 'Windows 10/11',
    downloadWindows: 'Download installer',
    allReleases: 'View releases',
    workflowTitle: 'Three-step setup',
    stepOne: 'Install Phone Scan on desktop',
    stepTwo: 'Scan the desktop QR code with your phone',
    stepThree: 'Scan barcodes into any focused desktop field',
    metricOne: 'Local session',
    metricTwo: '1D + 2D codes',
    metricThree: 'Lao + English',
    powered: 'Powered by TJ',
    previewConnected: 'Desktop ready',
    previewReceiver: 'HTTPS 8787',
    previewScan: 'Scan to connect',
    previewPhone: 'Phone scanner',
    scroll: 'Scroll',
  },
  lo: {
    navDownload: 'ດາວໂຫຼດ',
    navWorkflow: 'ວິທີໃຊ້',
    navPrivacy: 'ຄວາມປອດໄພ',
    badge: 'ເຄື່ອງສະແກນ barcode ສຳລັບ desktop',
    headline: 'Phone Scan',
    subhead: 'ໃຊ້ກ້ອງໂທລະສັບສະແກນ barcode ແລ້ວພິມເຂົ້າຊ່ອງທີ່ເລືອກໃນ desktop ໄດ້ທັນທີ.',
    primaryCta: 'ດາວໂຫຼດສຳລັບ Windows',
    secondaryCta: 'ເບິ່ງວິທີໃຊ້',
    releaseNote: 'ຕົວຕິດຕັ້ງດາວໂຫຼດຈາກ GitHub Release ທາງການ.',
    platformTitle: 'ຕົວຮັບຢູ່ desktop',
    platformBody: 'ແອັບ desktop ຈະເປີດ session ໃນເຄືອຂ່າຍ local ແລະພິມ barcode ທີ່ຮັບແລ້ວເຂົ້າຊ່ອງທີ່ກຳລັງໃຊ້.',
    scannerTitle: 'PWA scanner ໃນໂທລະສັບ',
    scannerBody: 'ໃຊ້ກ້ອງໂທລະສັບສະແກນລະຫັດ 1D ແລະ 2D ພ້ອມສຽງແລະການສັ່ນຫຼັງສະແກນ.',
    privacyTitle: 'ໃຊ້ຜ່ານ Wi-Fi ໃນເຄືອຂ່າຍ',
    privacyBody: 'ບໍ່ຕ້ອງມີບັນຊີ, ບໍ່ sync ຂຶ້ນ cloud, ແລະບໍ່ເກັບ barcode ໄວ້ທີ່ server ພາຍນອກ.',
    downloadsTitle: 'ຕົວຕິດຕັ້ງພ້ອມໃຊ້',
    downloadsBody: 'ຕິດຕັ້ງ Phone Scan ໃນ Windows, ເປີດແອັບ, ແລ້ວສະແກນ QR ດ້ວຍໂທລະສັບ.',
    windows: 'ຕົວຕິດຕັ້ງ Windows',
    windowsStatus: 'Windows 10/11',
    downloadWindows: 'ດາວໂຫຼດຕົວຕິດຕັ້ງ',
    allReleases: 'ເບິ່ງ releases',
    workflowTitle: 'ຕັ້ງຄ່າ 3 ຂັ້ນຕອນ',
    stepOne: 'ຕິດຕັ້ງ Phone Scan ໃນ desktop',
    stepTwo: 'ສະແກນ QR ຈາກ desktop ດ້ວຍໂທລະສັບ',
    stepThree: 'ສະແກນ barcode ເຂົ້າຊ່ອງທີ່ເລືອກໃນ desktop',
    metricOne: 'Session local',
    metricTwo: 'ລະຫັດ 1D + 2D',
    metricThree: 'ລາວ + English',
    powered: 'Powered by TJ',
    previewConnected: 'Desktop ພ້ອມໃຊ້',
    previewReceiver: 'HTTPS 8787',
    previewScan: 'ສະແກນເພື່ອເຊື່ອມຕໍ່',
    previewPhone: 'Scanner ໃນໂທລະສັບ',
    scroll: 'ເລື່ອນ',
  },
} as const

export default function DownloadPage() {
  const [locale, setLocale] = useState<Locale>('en')
  const t = copy[locale]
  const metrics = useMemo(() => [t.metricOne, t.metricTwo, t.metricThree], [t])

  return (
    <main className="site-shell" lang={locale === 'lo' ? 'lo-LA' : 'en'}>
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Phone Scan home">
          <span className="brand-mark">
            <Image src="/app-logo-icon.png" alt="" width={34} height={34} priority />
          </span>
          <span>Phone Scan</span>
        </a>

        <div className="nav-links">
          <a href="#downloads">{t.navDownload}</a>
          <a href="#workflow">{t.navWorkflow}</a>
          <a href="#privacy">{t.navPrivacy}</a>
        </div>

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
            <Sparkles size={18} />
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

          <div className="metric-strip">
            {metrics.map((metric) => (
              <span key={metric}>
                <Check size={16} />
                {metric}
              </span>
            ))}
          </div>
        </div>

        <HeroVisual t={t} />

        <a className="scroll-cue" href="#downloads">
          <ArrowDown size={17} />
          {t.scroll}
        </a>
      </section>

      <section className="value-grid" aria-label="Key benefits">
        <FeatureCard icon={<Laptop />} title={t.platformTitle} body={t.platformBody} />
        <FeatureCard icon={<Smartphone />} title={t.scannerTitle} body={t.scannerBody} />
        <FeatureCard icon={<ShieldCheck />} title={t.privacyTitle} body={t.privacyBody} id="privacy" />
      </section>

      <section className="download-section" id="downloads">
        <div className="download-copy">
          <span className="section-kicker">
            <MonitorDown size={18} />
            {t.downloadsTitle}
          </span>
          <h2>{t.downloadsTitle}</h2>
          <p>{t.downloadsBody}</p>
        </div>

        <div className="download-panel">
          <span className="download-icon">
            <ScanBarcode size={34} />
          </span>
          <div>
            <strong>{t.windows}</strong>
            <span>{t.windowsStatus} · v{downloadConfig.appVersion}</span>
          </div>
          <a className="release-button" href={downloadConfig.windows.installerUrl}>
            <Download size={18} />
            {t.downloadWindows}
          </a>
          <a className="all-releases-link" href={downloadConfig.releasesUrl} target="_blank" rel="noreferrer">
            {t.allReleases}
            <ExternalLink size={15} />
          </a>
        </div>

        <p className="release-note">{t.releaseNote}</p>
      </section>

      <section className="workflow" id="workflow">
        <div className="workflow-heading">
          <span className="section-kicker">
            <Zap size={18} />
            Phone Scan
          </span>
          <h2>{t.workflowTitle}</h2>
        </div>

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

function HeroVisual({ t }: { t: typeof copy.en | typeof copy.lo }) {
  return (
    <div className="hero-visual" aria-label="Phone Scan desktop and phone preview">
      <div className="signal-rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="desktop-preview">
        <div className="preview-titlebar">
          <span className="preview-light" />
          <span className="preview-light" />
          <span className="preview-light" />
          <strong>Phone Scan</strong>
        </div>
        <div className="preview-body">
          <div className="receiver-card">
            <BadgeCheck size={31} />
            <div>
              <strong>{t.previewConnected}</strong>
              <span>{t.previewReceiver}</span>
            </div>
          </div>
          <div className="qr-preview">
            <span className="scan-beam" />
            <QrCode size={130} />
            <strong>{t.previewScan}</strong>
          </div>
        </div>
      </div>

      <div className="phone-preview">
        <div className="phone-speaker" />
        <div className="phone-screen">
          <ScanLine size={36} />
          <strong>{t.previewPhone}</strong>
          <span className="phone-laser" />
        </div>
      </div>

      <div className="floating-status">
        <Radar size={20} />
        <span>Wi-Fi local</span>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  body,
  id,
}: {
  icon: ReactNode
  title: string
  body: string
  id?: string
}) {
  return (
    <article className="feature-card" id={id}>
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
