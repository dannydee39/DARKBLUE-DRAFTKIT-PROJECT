import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const NOTE_DIR =
  "C:/Users/Apple/Documents/Github/my-notes/CSE 416/Final Sprint/Push News Injury";
const NOTE_PATH = path.join(NOTE_DIR, "Feature Walkthrough - Push News Injury.md");
const PDF_PATH = path.join(NOTE_DIR, "Feature Walkthrough - Push News Injury.pdf");
const HTML_PATH = path.join(NOTE_DIR, "Feature Walkthrough - Push News Injury.html");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let inList = false;
  let inCode = false;
  let codeLines = [];

  function closeList() {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  }

  lines.forEach((line) => {
    const codeFence = line.match(/^```(?:\w+)?/);
    if (codeFence) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeLines.push(line);
      return;
    }

    const imageMatch = line.match(/^!\[\[([^\]]+)\]\]$/);
    if (imageMatch) {
      closeList();
      const imagePath = path.join(NOTE_DIR, imageMatch[1].replace(/\//g, path.sep));
      const normalized = imagePath.replace(/\\/g, "/");
      html.push(`<figure><img src="file:///${normalized}" /><figcaption>${escapeHtml(path.basename(imagePath))}</figcaption></figure>`);
      return;
    }

    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      return;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      return;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      closeList();
      html.push(`<p class="step">${inlineMarkdown(line)}</p>`);
      return;
    }

    if (!line.trim()) {
      closeList();
      return;
    }

    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  });

  closeList();
  return html.join("\n");
}

function buildHtml(content) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Push News Injury Feature Walkthrough</title>
  <style>
    @page { size: Letter; margin: 0.55in; }
    * { box-sizing: border-box; }
    body {
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11.5px;
      line-height: 1.48;
      margin: 0;
      background: white;
    }
    .cover {
      border-bottom: 3px solid #16a34a;
      margin-bottom: 22px;
      padding-bottom: 14px;
    }
    .eyebrow {
      color: #16a34a;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    h1 {
      color: #0f172a;
      font-size: 30px;
      line-height: 1.05;
      margin: 8px 0 8px;
    }
    .subtitle {
      color: #475569;
      font-size: 13px;
      max-width: 640px;
    }
    .meta-row {
      display: flex;
      gap: 8px;
      margin-top: 14px;
      flex-wrap: wrap;
    }
    .pill {
      background: #ecfdf5;
      border: 1px solid #bbf7d0;
      border-radius: 999px;
      color: #166534;
      font-size: 9.5px;
      font-weight: 800;
      padding: 4px 9px;
      text-transform: uppercase;
    }
    h2 {
      border-left: 4px solid #16a34a;
      color: #0f172a;
      font-size: 16px;
      line-height: 1.2;
      margin: 22px 0 8px;
      padding-left: 9px;
      break-after: avoid;
    }
    p { margin: 6px 0 9px; }
    ul { margin: 7px 0 10px 18px; padding: 0; }
    li { margin: 3px 0; }
    code {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      color: #0f172a;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 10px;
      padding: 1px 4px;
    }
    pre {
      background: #0f172a;
      border-radius: 7px;
      color: #e2e8f0;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 10px;
      line-height: 1.45;
      margin: 10px 0 12px;
      padding: 10px 12px;
      white-space: pre-wrap;
    }
    pre code {
      background: transparent;
      border: 0;
      color: inherit;
      padding: 0;
    }
    figure {
      border: 1px solid #dbe3ee;
      border-radius: 8px;
      margin: 12px 0 18px;
      padding: 8px;
      break-inside: avoid;
      background: #f8fafc;
    }
    img {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      display: block;
      width: 100%;
      max-height: 5.75in;
      object-fit: contain;
      background: #0b1120;
    }
    figcaption {
      color: #64748b;
      font-size: 9px;
      font-weight: 700;
      margin-top: 5px;
      text-align: right;
    }
    .step { margin-left: 8px; }
    .footer-note {
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 9px;
      margin-top: 24px;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <section class="cover">
    <div class="eyebrow">Dark Blue Draft Kit</div>
    <h1>Push News & Injury Feature Walkthrough</h1>
    <div class="subtitle">Production-style draft board workflow for publishing player injury/news context while keeping the live auction board in view.</div>
    <div class="meta-row">
      <span class="pill">Final Sprint</span>
      <span class="pill">Production Routes</span>
      <span class="pill">Valuation Integrated</span>
      <span class="pill">Board First UX</span>
    </div>
  </section>
  ${content}
  <div class="footer-note">Generated from the Obsidian walkthrough note with validated local screenshots.</div>
</body>
</html>`;
}

async function run() {
  const markdown = fs.readFileSync(NOTE_PATH, "utf8");
  const html = buildHtml(renderMarkdown(markdown));
  fs.writeFileSync(HTML_PATH, html, "utf8");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file:///${HTML_PATH.replace(/\\/g, "/")}`, {
    waitUntil: "networkidle",
  });
  await page.pdf({
    path: PDF_PATH,
    format: "Letter",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate:
      '<div style="width:100%;font-size:8px;color:#64748b;padding:0 0.55in;display:flex;justify-content:space-between;"><span>Dark Blue Draft Kit</span><span class="pageNumber"></span></div>',
    margin: { top: "0.55in", right: "0.55in", bottom: "0.55in", left: "0.55in" },
  });
  await browser.close();

  const stat = fs.statSync(PDF_PATH);
  if (stat.size < 50000) {
    throw new Error(`PDF appears too small: ${stat.size} bytes`);
  }
  console.log(`PDF=${PDF_PATH}`);
  console.log(`HTML=${HTML_PATH}`);
  console.log(`BYTES=${stat.size}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
