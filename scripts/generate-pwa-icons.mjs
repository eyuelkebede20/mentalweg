import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

if (!fs.existsSync(edgePath)) {
  console.error(`Edge executable not found at: ${edgePath}`);
  process.exit(1);
}

// 1. PUBLIC APP SVG
// Serene sanctuary aesthetic: Eucalyptus deep green, warm gold sanctuary ring, refined MW monogram & sage branch
function getPublicSvg(isMaskable = false) {
  const bgRadius = isMaskable ? 0 : 0; // maskable and regular both full bleed for crisp consistency
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="pubBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#11221b"/>
      <stop offset="60%" stop-color="#182e25"/>
      <stop offset="100%" stop-color="#1d382d"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fcedc9"/>
      <stop offset="50%" stop-color="#d6b26d"/>
      <stop offset="100%" stop-color="#ab8438"/>
    </linearGradient>
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a7f3d0"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
    <radialGradient id="auraGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.18"/>
      <stop offset="70%" stop-color="#34d399" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="512" height="512" rx="${bgRadius}" fill="url(#pubBg)"/>

  <!-- Subtle Ambient Glow -->
  <circle cx="256" cy="256" r="210" fill="url(#auraGlow)"/>

  <!-- Sanctuary Concentric Circles (Safe Zone: inner 400x400) -->
  <g filter="url(#softShadow)">
    <circle cx="256" cy="256" r="176" fill="none" stroke="url(#goldGrad)" stroke-width="4" stroke-opacity="0.6"/>
    <circle cx="256" cy="256" r="164" fill="#14261f" fill-opacity="0.8" stroke="url(#goldGrad)" stroke-width="2.5"/>

    <!-- Arch of Sanctuary -->
    <path d="M 176 310 C 176 210, 336 210, 336 310" fill="none" stroke="url(#goldGrad)" stroke-width="2.5" stroke-dasharray="4 4" stroke-opacity="0.7"/>

    <!-- Botanical Leaf Accent (Top) -->
    <path d="M 256 102 C 268 116, 268 134, 256 144 C 244 134, 244 116, 256 102 Z" fill="url(#leafGrad)"/>
    <path d="M 256 144 C 265 138, 276 138, 282 144 C 276 150, 265 150, 256 144 Z" fill="url(#leafGrad)" fill-opacity="0.85"/>
    <path d="M 256 144 C 247 138, 236 138, 230 144 C 236 150, 247 150, 256 144 Z" fill="url(#leafGrad)" fill-opacity="0.85"/>

    <!-- MW Monogram -->
    <g fill="#fcfaf7" font-family="'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif" font-weight="700">
      <text x="256" y="278" font-size="94" letter-spacing="4" text-anchor="middle">MW</text>
    </g>

    <!-- Subtitle: Sanctuary & Clinical Care -->
    <text x="256" y="340" fill="url(#goldGrad)" font-family="system-ui, -apple-system, sans-serif" font-size="19" font-weight="600" letter-spacing="7" text-anchor="middle">
      MENTALWEG
    </text>
    <text x="256" y="364" fill="#a7f3d0" fill-opacity="0.85" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="500" letter-spacing="4" text-anchor="middle">
      ADDIS ABABA
    </text>
  </g>
</svg>
`.trim();
}

// 2. ADMIN APP SVG
// Clinical management portal: Deep obsidian slate, clinical emerald/sage cross & pulse dot, MW emblem & CMS badge
function getAdminSvg(isMaskable = false) {
  const bgRadius = isMaskable ? 0 : 0;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="adminBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a100e"/>
      <stop offset="50%" stop-color="#101916"/>
      <stop offset="100%" stop-color="#16221e"/>
    </linearGradient>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6ee7b7"/>
      <stop offset="50%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5eead4"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <radialGradient id="adminGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.22"/>
      <stop offset="70%" stop-color="#10b981" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>
    <filter id="adminShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="512" height="512" rx="${bgRadius}" fill="url(#adminBg)"/>

  <!-- Glowing Aura -->
  <circle cx="256" cy="256" r="215" fill="url(#adminGlow)"/>

  <!-- Clinical Shield & Emblem (Safe Zone inner 400x400) -->
  <g filter="url(#adminShadow)">
    <!-- Hexagonal / Octagonal Clinical Ring -->
    <circle cx="256" cy="256" r="176" fill="none" stroke="url(#emeraldGrad)" stroke-width="4" stroke-opacity="0.8"/>
    <circle cx="256" cy="256" r="162" fill="#0d1512" stroke="url(#tealGrad)" stroke-width="2" stroke-opacity="0.6"/>

    <!-- Clinical Cross Accent (Top) -->
    <g transform="translate(256, 128)">
      <rect x="-3" y="-14" width="6" height="28" rx="2" fill="url(#emeraldGrad)"/>
      <rect x="-14" y="-3" width="28" height="6" rx="2" fill="url(#emeraldGrad)"/>
      <circle cx="0" cy="0" r="2" fill="#ffffff"/>
    </g>

    <!-- MW Monogram -->
    <g fill="#ffffff" font-family="'Inter', system-ui, -apple-system, sans-serif" font-weight="800">
      <text x="256" y="276" font-size="94" letter-spacing="4" text-anchor="middle">MW</text>
    </g>

    <!-- CMS Badge Pill -->
    <g transform="translate(256, 326)">
      <rect x="-85" y="-15" width="170" height="30" rx="15" fill="#064e3b" stroke="url(#emeraldGrad)" stroke-width="1.5"/>
      <circle cx="-62" cy="0" r="4" fill="#34d399"/>
      <text x="6" y="5" fill="#ecfdf5" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="4" text-anchor="middle">
        CLINICAL CMS
      </text>
    </g>

    <!-- Subtitle: Secure Portal -->
    <text x="256" y="375" fill="#6ee7b7" fill-opacity="0.8" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" letter-spacing="5" text-anchor="middle">
      ADMIN PORTAL
    </text>
  </g>
</svg>
`.trim();
}

// Convert HTML wrapper to screenshot using Edge headless
function renderPng(htmlContent, outPngPath, width, height) {
  const tmpHtml = path.join(rootDir, `tmp-render-${Date.now()}-${Math.floor(Math.random()*1000)}.html`);
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    svg {
      width: ${width}px;
      height: ${height}px;
      display: block;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

  fs.writeFileSync(tmpHtml, fullHtml, 'utf8');

  try {
    execFileSync(edgePath, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${outPngPath}`,
      tmpHtml
    ], { stdio: 'pipe' });
  } finally {
    if (fs.existsSync(tmpHtml)) {
      fs.unlinkSync(tmpHtml);
    }
  }

  if (fs.existsSync(outPngPath)) {
    const stat = fs.statSync(outPngPath);
    console.log(`Generated: ${path.relative(rootDir, outPngPath)} (${stat.size} bytes)`);
  } else {
    throw new Error(`Failed to generate: ${outPngPath}`);
  }
}

async function run() {
  console.log('Generating PWA icons for Public App and Admin App...');

  const targets = [
    {
      dir: path.join(rootDir, 'public-app', 'public'),
      name: 'Public App',
      getSvg: getPublicSvg,
    },
    {
      dir: path.join(rootDir, 'admin', 'public'),
      name: 'Admin App',
      getSvg: getAdminSvg,
    }
  ];

  for (const t of targets) {
    if (!fs.existsSync(t.dir)) {
      fs.mkdirSync(t.dir, { recursive: true });
    }

    console.log(`\nProcessing ${t.name} -> ${path.relative(rootDir, t.dir)}`);

    // 1. Write favicon.svg
    const svgPath = path.join(t.dir, 'favicon.svg');
    fs.writeFileSync(svgPath, t.getSvg(false), 'utf8');
    console.log(`Generated: ${path.relative(rootDir, svgPath)}`);

    // 2. Render 192x192 PNG
    renderPng(t.getSvg(false), path.join(t.dir, 'pwa-192x192.png'), 192, 192);

    // 3. Render 512x512 PNG
    renderPng(t.getSvg(false), path.join(t.dir, 'pwa-512x512.png'), 512, 512);

    // 4. Render 512x512 Maskable PNG
    renderPng(t.getSvg(true), path.join(t.dir, 'pwa-maskable-512x512.png'), 512, 512);

    // 5. Render 180x180 Apple Touch Icon
    renderPng(t.getSvg(false), path.join(t.dir, 'apple-touch-icon.png'), 180, 180);
  }

  console.log('\nAll PWA icons generated successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
