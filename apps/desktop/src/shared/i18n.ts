import type { DesktopLanguage } from './desktop-api'

export const languageOptions: Array<{
  code: DesktopLanguage
  label: string
  nativeLabel: string
  description: string
}> = [
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    description: 'Use Phone Scan in English.',
  },
  {
    code: 'lo',
    label: 'Lao',
    nativeLabel: 'ພາສາລາວ',
    description: 'ໃຊ້ Phone Scan ເປັນພາສາລາວ.',
  },
]

export const desktopCopy = {
  en: {
    language: {
      eyebrow: 'Language setup',
      title: 'Choose your language',
      description: 'Select the language Phone Scan should use before you start.',
      continue: 'Continue',
      selected: 'Selected',
    },
    status: {
      localServer: 'Local Server Status:',
      running: 'Running',
      error: 'Error',
      starting: 'Starting',
      pcIpAddress: 'PC IP Address',
      port: 'Port',
      connectionMethod: 'Connection Method',
      connectionMethodValue: 'Wi-Fi / USB Tethering',
    },
    instructions: {
      title: 'Quick Instructions',
      openTool: 'Open this tool',
      scanQr: 'Scan the QR with your phone',
      scanBarcodes: 'Start scanning barcodes',
    },
    qr: {
      title: 'Scan with your phone to connect',
      refresh: 'Refresh QR',
      copyLink: 'Copy Link',
      openScanner: 'Open Scanner Page',
    },
    phone: {
      status: 'Phone Status:',
      connected: 'Connected',
      notConnected: 'Not connected',
      willAppear: 'Your phone will appear here',
      onceConnected: 'once connected.',
      phoneConnected: 'phone connected',
    },
    flow: {
      title: 'Live Flow',
      phoneConnected: 'Phone connected',
      phoneOnline: 'phone online',
      scanQrFromPhone: 'Scan the QR from your phone',
      barcodeReceived: 'Barcode received',
      noBarcode: 'No barcode received yet',
      typedResult: 'Typed result',
      typedIntoInput: 'Typed into focused input',
      clickInput: 'Click a target input before scanning',
      waiting: 'Waiting',
      received: 'Received',
      typed: 'Typed',
      failed: 'Failed',
    },
    footer: {
      privacy: 'No cloud server. No login. Local connection only.',
      poweredBy: 'Powered by',
    },
  },
  lo: {
    language: {
      eyebrow: 'ຕັ້ງຄ່າພາສາ',
      title: 'ເລືອກພາສາ',
      description: 'ເລືອກພາສາທີ່ Phone Scan ຈະໃຊ້ກ່ອນເລີ່ມໃຊ້ງານ.',
      continue: 'ດໍາເນີນການຕໍ່',
      selected: 'ເລືອກແລ້ວ',
    },
    status: {
      localServer: 'ສະຖານະເຊີບເວີທ້ອງຖິ່ນ:',
      running: 'ເຮັດວຽກຢູ່',
      error: 'ຜິດພາດ',
      starting: 'ກໍາລັງເລີ່ມ',
      pcIpAddress: 'ທີ່ຢູ່ IP ຂອງ PC',
      port: 'ພອດ',
      connectionMethod: 'ວິທີເຊື່ອມຕໍ່',
      connectionMethodValue: 'Wi-Fi / USB Tethering',
    },
    instructions: {
      title: 'ຄໍາແນະນໍາດ່ວນ',
      openTool: 'ເປີດເຄື່ອງມືນີ້',
      scanQr: 'ສະແກນ QR ດ້ວຍໂທລະສັບ',
      scanBarcodes: 'ເລີ່ມສະແກນບາໂຄດ',
    },
    qr: {
      title: 'ສະແກນດ້ວຍໂທລະສັບເພື່ອເຊື່ອມຕໍ່',
      refresh: 'ໂຫຼດ QR ໃໝ່',
      copyLink: 'ຄັດລອກລິ້ງ',
      openScanner: 'ເປີດໜ້າສະແກນ',
    },
    phone: {
      status: 'ສະຖານະໂທລະສັບ:',
      connected: 'ເຊື່ອມຕໍ່ແລ້ວ',
      notConnected: 'ຍັງບໍ່ເຊື່ອມຕໍ່',
      willAppear: 'ໂທລະສັບຂອງທ່ານຈະສະແດງຢູ່ນີ້',
      onceConnected: 'ເມື່ອເຊື່ອມຕໍ່ແລ້ວ',
      phoneConnected: 'ໂທລະສັບເຊື່ອມຕໍ່ແລ້ວ',
    },
    flow: {
      title: 'ການເຮັດວຽກປັດຈຸບັນ',
      phoneConnected: 'ໂທລະສັບເຊື່ອມຕໍ່',
      phoneOnline: 'ໂທລະສັບອອນໄລນ໌',
      scanQrFromPhone: 'ສະແກນ QR ຈາກໂທລະສັບ',
      barcodeReceived: 'ໄດ້ຮັບບາໂຄດ',
      noBarcode: 'ຍັງບໍ່ໄດ້ຮັບບາໂຄດ',
      typedResult: 'ຜົນການພິມ',
      typedIntoInput: 'ພິມໃສ່ຊ່ອງທີ່ເລືອກແລ້ວ',
      clickInput: 'ຄລິກຊ່ອງປ້ອນຂໍ້ມູນກ່ອນສະແກນ',
      waiting: 'ລໍຖ້າ',
      received: 'ໄດ້ຮັບແລ້ວ',
      typed: 'ພິມແລ້ວ',
      failed: 'ລົ້ມເຫຼວ',
    },
    footer: {
      privacy: 'ບໍ່ມີ cloud server. ບໍ່ຕ້ອງ login. ເຊື່ອມຕໍ່ທ້ອງຖິ່ນເທົ່ານັ້ນ.',
      poweredBy: 'ສ້າງໂດຍ',
    },
  },
} as const

export type DesktopCopy = (typeof desktopCopy)[DesktopLanguage]
