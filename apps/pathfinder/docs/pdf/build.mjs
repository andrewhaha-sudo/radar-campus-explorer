// Build branded PDFs from the Pathfinder doc set.
// Usage: node build.mjs   (run from docs/pdf/)  -> requires weasyprint on PATH.
import { marked } from 'marked';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DOCS_DIR = '..';            // docs/
const OUT = '.';                  // docs/pdf/

const MANIFEST = [
  { file: '01-specification.md',          kicker: 'Product & Technical Specification', title: 'Specification',          sub: 'Architecture, data model, requirements, and detailed design for the Pathfinder Portal.' },
  { file: '02-user-stories.md',           kicker: 'Requirements',                      title: 'User Stories',           sub: '70 user stories across 14 epics, with the Epic to Story to Criterion to Test traceability chain.' },
  { file: '03-acceptance-criteria.md',    kicker: 'Requirements',                      title: 'Acceptance Criteria',    sub: '97 Given / When / Then criteria, each independently testable and mapped to a test.' },
  { file: '04-tdd-plan.md',               kicker: 'Quality',                           title: 'TDD Plan',               sub: 'Test-writing prompts - one per acceptance criterion - enforcing test-first, screenshot-verified delivery.' },
  { file: '05-sprint-plan.md',            kicker: 'Delivery',                          title: 'Sprint Plan',            sub: 'Retroactive baseline plus an eight-sprint roadmap from foundation to launch.' },
  { file: '06-editions-and-integrations.md', kicker: 'Product Strategy',               title: 'Editions & Integrations', sub: 'The open-core model (Community Edition and Pathfinder Pro) and third-party services.' },
];

const META = { version: '0.1', date: '2026-06-15', owner: 'Pathfinder LiDAR Solutions', project: 'Pathfinder Portal v2' };

marked.setOptions({ gfm: true, breaks: false });

function slug(s, i) {
  return 'h' + i + '-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function buildOne(doc) {
  const md = readFileSync(`${DOCS_DIR}/${doc.file}`, 'utf8');

  // Drop the leading H1 and the metadata blockquote (cover carries them).
  const lines = md.split('\n');
  let start = 0;
  if (lines[0].startsWith('# ')) {
    start = 1;
    while (start < lines.length && (lines[start].trim() === '' || lines[start].startsWith('>'))) start++;
  }
  const body = lines.slice(start).join('\n');

  // Tokenize to collect headings (h2/h3) and assign ids.
  const tokens = marked.lexer(body);
  const toc = [];
  let hi = 0;
  for (const t of tokens) {
    if (t.type === 'heading' && (t.depth === 2 || t.depth === 3)) {
      const id = slug(t.text, ++hi);
      toc.push({ depth: t.depth, text: t.text.replace(/[*`_]/g, ''), id });
      t._id = id;
    }
  }
  // Custom renderer to stamp ids on h2/h3 in render order.
  let ri = 0;
  const renderer = new marked.Renderer();
  renderer.heading = function (text, level) {
    const clean = text.replace(/<[^>]+>/g, '');
    if (level === 2 || level === 3) {
      const id = slug(clean, ++ri);
      return `<h${level} id="${id}">${text}</h${level}>\n`;
    }
    return `<h${level}>${text}</h${level}>\n`;
  };
  const contentHtml = marked.parse(body, { renderer });

  const tocHtml = toc.length
    ? `<section class="toc"><h2>Contents</h2><ul>${toc.map(e =>
        `<li class="lvl${e.depth}"><a href="#${e.id}"><span>${e.text}</span></a></li>`).join('')}</ul></section>`
    : '';

  const cover = `
  <div class="cover"><div class="cover-inner">
    <div class="cover-top">
      <div class="cover-mark">PATHFINDER<span class="dot">.</span></div>
      <div class="cover-by">by ${META.owner}</div>
    </div>
    <div class="cover-block">
      <div class="cover-kicker">${doc.kicker}</div>
      <h1 class="cover-title">${doc.title}</h1>
      <div class="cover-sub">${doc.sub}</div>
      <div class="cover-rule"></div>
      <div class="cover-meta">
        <div><b>Project</b>&nbsp;&nbsp;${META.project}</div>
        <div><b>Version</b>&nbsp;&nbsp;${META.version}&nbsp;&nbsp;(Draft for review)</div>
        <div><b>Date</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${META.date}</div>
        <div><b>Owner</b>&nbsp;&nbsp;&nbsp;&nbsp;${META.owner}</div>
      </div>
    </div>
    <div class="cover-foot">CONFIDENTIAL - Sensitive but unclassified. Do not distribute without authorization.</div>
  </div></div>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>@import url("fonts-local.css");</style>
<link rel="stylesheet" href="template.css">
<title>Pathfinder - ${doc.title}</title></head><body>
${cover}
${tocHtml}
<section class="doc content" data-title="Pathfinder - ${doc.title}">
${contentHtml}
</section>
</body></html>`;

  const htmlPath = `${OUT}/.render-${doc.file.replace('.md', '')}.html`;
  writeFileSync(htmlPath, html);
  const pdfPath = `${OUT}/Pathfinder-${doc.title.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
  execFileSync('weasyprint', ['-e', 'utf-8', htmlPath, pdfPath], { stdio: 'pipe' });
  return { pdfPath, headings: toc.length };
}

let ok = 0;
for (const doc of MANIFEST) {
  try {
    const r = buildOne(doc);
    console.log(`OK  ${r.pdfPath}  (${r.headings} sections)`);
    ok++;
  } catch (e) {
    console.error(`FAIL ${doc.file}: ${e.message}\n${(e.stderr || '').toString().slice(0, 600)}`);
  }
}
console.log(`\n${ok}/${MANIFEST.length} PDFs built.`);
