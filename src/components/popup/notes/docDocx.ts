/**
 * DocModel → Word document (.docx). A real Office Open XML package (zipped
 * with the extension's own STORE zip), so Word, Google Docs, Pages and
 * LibreOffice open it without conversion warnings. Lists are real Word
 * lists, headings use Word's heading styles (navigation pane works).
 * Pure string/byte building — no browser APIs.
 */
import { zipStore, strToU8 } from "../../../browser/backup/zip";
import {
  BASE_HALF_POINTS,
  BULLETS,
  COLORS,
  KIND_HALF_POINTS,
  LINE_240,
  LIST_INDENT,
  SIZE_HALF_POINTS,
  contentWidth,
  imageTwips,
  indentOf,
  spacingOf,
  tableGrid,
} from "./docModel";

import type { DocImage, DocModel, DocParagraph, DocRun, DocTable, PageSetup } from "./docModel";

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const DRAWING_NS =
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
/** EMUs per twip. */
const EMU = 635;

/** Text → XML: escaped, and characters XML can't hold are dropped. */
export function xmlEscape(text: string): string {
  const allowed = Array.from(text, (ch) => {
    const c = ch.charCodeAt(0);
    return (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0xfffe || c === 0xffff ? "" : ch;
  }).join("");
  return allowed
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLE_ID: Partial<Record<DocParagraph["kind"], string>> = {
  title: "Title",
  h1: "Heading1",
  h2: "Heading2",
  h3: "Heading3",
};

class Writer {
  constructor(private page: PageSetup) {}
  private links: string[] = [];
  /** Pictures, in order: word/media/image<N>.<ext>. */
  media: DocImage[] = [];
  /** listId → numId for ordered lists (each restarts at its own start). */
  private orderedNums = new Map<number, { numId: number; level: number; start: number }>();
  private nextNumId = 2; // 1 = every bulleted list

  linkRels(): string[] {
    return this.links;
  }

  orderedLists() {
    return [...this.orderedNums.values()];
  }

  private linkId(href: string): string {
    let i = this.links.indexOf(href);
    if (i < 0) i = this.links.push(href) - 1;
    return `rIdLink${i + 1}`;
  }

  private numId(p: DocParagraph): number {
    const list = p.list!;
    if (!list.ordered) return 1;
    let entry = this.orderedNums.get(list.listId);
    if (!entry) {
      entry = { numId: this.nextNumId++, level: list.level, start: list.number };
      this.orderedNums.set(list.listId, entry);
    }
    return entry.numId;
  }

  private run(run: DocRun, p: DocParagraph): string {
    if (run.lineBreak) return "<w:r><w:br/></w:r>";
    const code = run.code || p.kind === "code";
    const size = run.size ? SIZE_HALF_POINTS[run.size] : p.kind === "meta" || p.kind === "code" ? KIND_HALF_POINTS[p.kind] : undefined;
    let rPr = "";
    if (run.href) rPr += '<w:rStyle w:val="Hyperlink"/>';
    if (code) rPr += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>';
    if (run.bold) rPr += "<w:b/><w:bCs/>";
    if (run.italic) rPr += "<w:i/><w:iCs/>";
    if (run.strike) rPr += "<w:strike/>";
    if (run.muted && !run.href) rPr += `<w:color w:val="${COLORS.muted}"/>`;
    if (size) rPr += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
    if (run.highlight) rPr += '<w:highlight w:val="yellow"/>';
    if (run.underline) rPr += '<w:u w:val="single"/>';
    if (run.code && p.kind !== "code") rPr += `<w:shd w:val="clear" w:color="auto" w:fill="${COLORS.codeBg}"/>`;
    const body = run.text
      .split("\t")
      .map((t) => (t ? `<w:t xml:space="preserve">${xmlEscape(t)}</w:t>` : ""))
      .join("<w:tab/>");
    return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}${body}</w:r>`;
  }

  private runs(p: DocParagraph): string {
    let out = "";
    let i = 0;
    while (i < p.runs.length) {
      const href = p.runs[i].href;
      if (!href || p.runs[i].lineBreak) {
        out += this.run(p.runs[i], p);
        i++;
        continue;
      }
      let inner = "";
      while (i < p.runs.length && p.runs[i].href === href && !p.runs[i].lineBreak) {
        inner += this.run(p.runs[i], p);
        i++;
      }
      out += `<w:hyperlink r:id="${this.linkId(href)}" w:history="1">${inner}</w:hyperlink>`;
    }
    return out;
  }

  private drawing(image: DocImage, maxWidth: number): string {
    this.media.push(image);
    const n = this.media.length;
    const { width, height } = imageTwips(image, maxWidth);
    const cx = width * EMU;
    const cy = height * EMU;
    const alt = xmlEscape(image.alt);
    return (
      `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:docPr id="${n}" name="Picture ${n}" descr="${alt}"/>` +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
      `<pic:nvPicPr><pic:cNvPr id="${n}" name="image${n}.${image.mime === "jpeg" ? "jpg" : image.mime}" descr="${alt}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="rIdImg${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
      "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>"
    );
  }

  /** Equal columns across `width`, light borders, shaded header cells. */
  table(table: DocTable, width: number): string {
    const grid = tableGrid(table);
    const colW = Math.floor(width / grid.cols);
    const line = `w:val="single" w:sz="4" w:space="0" w:color="${COLORS.border}"`;
    let xml =
      "<w:tbl><w:tblPr>" +
      `<w:tblW w:w="${colW * grid.cols}" w:type="dxa"/>` +
      `<w:tblBorders><w:top ${line}/><w:left ${line}/><w:bottom ${line}/><w:right ${line}/><w:insideH ${line}/><w:insideV ${line}/></w:tblBorders>` +
      '<w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>' +
      '<w:tblLook w:val="0000"/>' +
      `</w:tblPr><w:tblGrid>${`<w:gridCol w:w="${colW}"/>`.repeat(grid.cols)}</w:tblGrid>`;
    grid.rows.forEach((row, ri) => {
      const header = ri === 0 && row.every((s) => !s.cell || s.cell.header) && row.some((s) => s.cell?.header);
      xml += `<w:tr>${header ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}`;
      for (const slot of row) {
        let tcPr = `<w:tcW w:w="${colW * slot.span}" w:type="dxa"/>`;
        if (slot.span > 1) tcPr += `<w:gridSpan w:val="${slot.span}"/>`;
        if (slot.vmerge === "restart") tcPr += '<w:vMerge w:val="restart"/>';
        if (slot.vmerge === "continue") tcPr += "<w:vMerge/>";
        if (slot.cell?.header) tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${COLORS.codeBg}"/>`;
        const inner = colW * slot.span - 200;
        const paras = (slot.cell?.paragraphs ?? [])
          .map((p) => {
            const q = slot.cell?.header ? { ...p, runs: p.runs.map((r) => ({ ...r, bold: true })) } : p;
            return this.paragraph({ ...q, blockStart: false }, inner, true);
          })
          .join("");
        // Every cell needs at least one paragraph, and must end with one.
        xml += `<w:tc><w:tcPr>${tcPr}</w:tcPr>${paras && !paras.endsWith("</w:tbl>") ? paras : `${paras}<w:p/>`}</w:tc>`;
      }
      xml += "</w:tr>";
    });
    return `${xml}</w:tbl>`;
  }

  paragraph(p: DocParagraph, maxWidth = contentWidth(this.page), inTable = false): string {
    if (p.kind === "table" && p.table) return this.table(p.table, maxWidth);
    const spacing = spacingOf(p);
    const { before, after } = inTable ? { before: 0, after: 0 } : spacing;
    const { left, hanging } = indentOf(p);
    const style = STYLE_ID[p.kind];

    let pPr = "";
    if (style) pPr += `<w:pStyle w:val="${style}"/>`;
    if (p.keepNext) pPr += "<w:keepNext/>";
    if (p.list?.marker) pPr += `<w:numPr><w:ilvl w:val="${p.list.level}"/><w:numId w:val="${this.numId(p)}"/></w:numPr>`;
    const borders: string[] = [];
    if (p.quote) borders.push(`<w:left w:val="single" w:sz="12" w:space="8" w:color="${COLORS.border}"/>`);
    if (p.callout) borders.push(`<w:left w:val="single" w:sz="18" w:space="6" w:color="${COLORS.callout[p.callout].line}"/>`);
    if (p.kind === "divider") borders.push(`<w:bottom w:val="single" w:sz="6" w:space="1" w:color="${COLORS.border}"/>`);
    if (borders.length) pPr += `<w:pBdr>${borders.join("")}</w:pBdr>`;
    const fill = p.callout ? COLORS.callout[p.callout].fill : p.kind === "code" ? COLORS.codeBg : undefined;
    if (fill) pPr += `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;
    pPr += `<w:spacing w:before="${before}" w:after="${after}" w:line="${LINE_240[p.spacing ?? "normal"]}" w:lineRule="auto"/>`;
    if (left || hanging) pPr += `<w:ind w:left="${left}"${hanging ? ` w:hanging="${hanging}"` : ""}/>`;
    if (p.align) pPr += `<w:jc w:val="${p.align === "justify" ? "both" : p.align}"/>`;

    let marker = "";
    if (p.check) {
      const color = p.check.done ? COLORS.link : COLORS.muted;
      marker =
        `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol"/><w:color w:val="${color}"/></w:rPr>` +
        `<w:t>${p.check.done ? "☑" : "☐"}</w:t></w:r><w:r><w:tab/></w:r>`;
    }
    const content = p.kind === "image" && p.image ? this.drawing(p.image, maxWidth - left) : this.runs(p);
    return `<w:p><w:pPr>${pPr}</w:pPr>${marker}${content}</w:p>`;
  }
}

function documentXml(body: string, page: PageSetup): string {
  const m = page.margin;
  return (
    XML_DECL +
    `<w:document ${W_NS} ${DRAWING_NS}><w:body>${body}` +
    `<w:sectPr><w:pgSz w:w="${page.width}" w:h="${page.height}"/>` +
    `<w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>` +
    "</w:body></w:document>"
  );
}

function stylesXml(): string {
  const heading = (n: number, size: number, before: number, after: number) =>
    `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/>` +
    `<w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>` +
    `<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${before}" w:after="${after}"/><w:outlineLvl w:val="${n - 1}"/></w:pPr>` +
    `<w:rPr><w:b/><w:bCs/><w:color w:val="171717"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
  return (
    XML_DECL +
    `<w:styles ${W_NS}>` +
    "<w:docDefaults><w:rPrDefault><w:rPr>" +
    '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>' +
    `<w:color w:val="${COLORS.text}"/><w:sz w:val="${BASE_HALF_POINTS}"/><w:szCs w:val="${BASE_HALF_POINTS}"/>` +
    '<w:lang w:val="en-US"/></w:rPr></w:rPrDefault>' +
    `<w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="${LINE_240.normal}" w:lineRule="auto"/></w:pPr></w:pPrDefault>` +
    "</w:docDefaults>" +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="10"/><w:qFormat/>' +
    `<w:pPr><w:keepNext/><w:spacing w:after="40"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="171717"/><w:sz w:val="${KIND_HALF_POINTS.title}"/><w:szCs w:val="${KIND_HALF_POINTS.title}"/></w:rPr></w:style>` +
    heading(1, KIND_HALF_POINTS.h1!, 280, 80) +
    heading(2, KIND_HALF_POINTS.h2!, 240, 60) +
    heading(3, KIND_HALF_POINTS.h3!, 200, 40) +
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/>' +
    `<w:rPr><w:color w:val="${COLORS.link}"/><w:u w:val="single"/></w:rPr></w:style>` +
    "</w:styles>"
  );
}

const ORDERED_FORMATS = ["decimal", "lowerLetter", "lowerRoman"];

function numberingXml(ordered: { numId: number; level: number; start: number }[]): string {
  const levels = (kind: "bullet" | "ordered") =>
    Array.from({ length: 9 }, (_, l) => {
      const fmt = kind === "bullet" ? "bullet" : ORDERED_FORMATS[l % 3];
      const text = kind === "bullet" ? BULLETS[l % BULLETS.length] : `%${l + 1}.`;
      return (
        `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/>` +
        `<w:pPr><w:ind w:left="${LIST_INDENT * (l + 2)}" w:hanging="${LIST_INDENT}"/></w:pPr></w:lvl>`
      );
    }).join("");
  return (
    XML_DECL +
    `<w:numbering ${W_NS}>` +
    `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${levels("bullet")}</w:abstractNum>` +
    `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${levels("ordered")}</w:abstractNum>` +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    ordered
      .map(
        (o) =>
          `<w:num w:numId="${o.numId}"><w:abstractNumId w:val="1"/>` +
          `<w:lvlOverride w:ilvl="${o.level}"><w:startOverride w:val="${o.start}"/></w:lvlOverride></w:num>`
      )
      .join("") +
    "</w:numbering>"
  );
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const iso = (ts: number) => new Date(ts).toISOString().replace(/\.\d+Z$/, "Z");

/** The .docx package's files, in the order Word expects them. */
export function docxFiles(doc: DocModel, page: PageSetup, exportedAt = Date.now()): Record<string, Uint8Array> {
  const writer = new Writer(page);
  let body = doc.paragraphs.map((p) => writer.paragraph(p)).join("");
  // Word wants a paragraph between a final table and the section settings.
  if (body.endsWith("</w:tbl>")) body += "<w:p/>";
  const media = writer.media.map((img, i) => ({
    name: `image${i + 1}.${img.mime === "jpeg" ? "jpg" : img.mime}`,
    img,
  }));
  const imageRels = media
    .map(
      (m, i) =>
        `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`
    )
    .join("");

  const linkRels = writer
    .linkRels()
    .map(
      (href, i) =>
        `<Relationship Id="rIdLink${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(href)}" TargetMode="External"/>`
    )
    .join("");

  const files: Record<string, string> = {
    "[Content_Types].xml":
      XML_DECL +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
      '<Default Extension="jpg" ContentType="image/jpeg"/>' +
      '<Default Extension="gif" ContentType="image/gif"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      "</Types>",
    "_rels/.rels":
      XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      "</Relationships>",
    "docProps/core.xml":
      XML_DECL +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      `<dc:title>${xmlEscape(doc.title)}</dc:title>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${iso(doc.updatedAt)}</dcterms:created>` +
      `<dcterms:modified xsi:type="dcterms:W3CDTF">${iso(exportedAt)}</dcterms:modified>` +
      "</cp:coreProperties>",
    "docProps/app.xml":
      XML_DECL +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
      "<Application>Browser Workspace Manager</Application></Properties>",
    "word/document.xml": documentXml(body, page),
    "word/styles.xml": stylesXml(),
    "word/numbering.xml": numberingXml(writer.orderedLists()),
    "word/_rels/document.xml.rels":
      XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
      linkRels +
      imageRels +
      "</Relationships>",
  };
  const out: Record<string, Uint8Array> = Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)]));
  for (const m of media) out[`word/media/${m.name}`] = base64ToBytes(m.img.base64);
  return out;
}

export function docToDocx(doc: DocModel, page: PageSetup, exportedAt = Date.now()): Uint8Array {
  const files = docxFiles(doc, page, exportedAt);
  const stamp = new Date(exportedAt);
  return zipStore(files, Object.fromEntries(Object.keys(files).map((n) => [n, stamp])));
}
