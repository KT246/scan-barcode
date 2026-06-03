# Phone Scan Web

This is the public download/landing page for Phone Scan. It is separate from the scanner PWA.

## Vercel

- Root Directory: `apps/web`
- Framework Preset: `Next.js`
- Build Command: `pnpm build`
- Install Command: `pnpm install`

The scanner PWA remains in `apps/scanner-pwa`.

## Direct Download Asset

The download button points to a GitHub Release asset configured in `app/downloads.ts`.

For version `0.1.0`:

1. Build the desktop installer:
   ```bash
   pnpm run dist
   ```
2. Upload this file to GitHub Releases under tag `v0.1.0`:
   ```txt
   apps/desktop/release/Phone-Scan-Setup-0.1.0.exe
   ```
3. The public download URL is:
   ```txt
   https://github.com/KT246/scan-barcode/releases/download/v0.1.0/Phone-Scan-Setup-0.1.0.exe
   ```

When publishing a new version, update `app/downloads.ts` with the new version, tag, filename, and URL.
