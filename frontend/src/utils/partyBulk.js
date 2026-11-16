import { isEmail } from './helpers'

export const PARTY_COLUMNS = [
  {
    key: 'name',
    header: 'name',
    label: 'Party / Vendor Name',
    required: true,
    type: 'Text',
    example: 'Shree Krishna Dairy & Cocoa Suppliers',
    description: 'Vendor / company name (min 2 characters, unique per facility)',
  },
  {
    key: 'mobileNumber',
    header: 'mobileNumber',
    label: 'Mobile Number',
    required: false,
    type: 'Phone (7–20 chars)',
    example: '9876543210',
    description: 'Contact phone or mobile number of the vendor',
  },
  {
    key: 'email',
    header: 'email',
    label: 'Email Address',
    required: false,
    type: 'Email',
    example: 'billing@krishnadairy.in',
    description: 'Vendor email address for purchase orders and statements',
  },
  {
    key: 'gstIn',
    header: 'gstIn',
    label: 'GSTIN',
    required: false,
    type: '15-char Alphanumeric',
    example: '27AAACR5055K1Z1',
    description: '15-character GST Identification Number (optional)',
  },
  {
    key: 'address',
    header: 'address',
    label: 'Address',
    required: false,
    type: 'Text',
    example: 'Plot 14, MIDC Industrial Estate, Pune',
    description: 'Billing or warehouse address of the vendor',
  },
  {
    key: 'openingBalance',
    header: 'openingBalance',
    label: 'Opening Balance (₹)',
    required: false,
    type: 'Number (≥ 0)',
    example: '15000',
    description: 'Initial balance amount in ₹ (automatically posted to Party Ledger)',
  },
  {
    key: 'openingType',
    header: 'openingType',
    label: 'Opening Balance Type',
    required: false,
    type: 'payable | advance',
    example: 'payable',
    description: '"payable" if store owes party, or "advance" if store paid party in advance',
  },
  {
    key: 'remarks',
    header: 'remarks',
    label: 'Ledger Remarks',
    required: false,
    type: 'Text',
    example: 'Opening vendor balance',
    description: 'Note recorded on the party opening balance ledger entry',
  },
]

export const DEMO_PARTY_ROWS = [
  {
    name: 'Shree Krishna Dairy & Cocoa Suppliers',
    mobileNumber: '9876543210',
    email: 'billing@krishnadairy.in',
    gstIn: '27AAACR5055K1Z1',
    address: 'Plot 14, MIDC Industrial Area, Pune',
    openingBalance: 15000,
    openingType: 'payable',
    remarks: 'Opening balance — monthly milk & cocoa supply',
  },
  {
    name: 'Royal Belgian Chocolate Imports Pvt Ltd',
    mobileNumber: '9820112233',
    email: 'orders@royalchoco.com',
    gstIn: '27AABCR9911M1Z5',
    address: 'Unit 8, Saki Vihar Complex, Mumbai',
    openingBalance: 28500,
    openingType: 'payable',
    remarks: 'Imported couverture chocolate blocks',
  },
  {
    name: 'Kashmir Dry Fruits & Nut Traders',
    mobileNumber: '9811223344',
    email: 'sales@kashmirnuts.in',
    gstIn: '07AAECK1234F1Z9',
    address: 'Khari Baoli Wholesale Market, Delhi',
    openingBalance: 5000,
    openingType: 'advance',
    remarks: 'Advance paid for almond & pistachio batch',
  },
  {
    name: 'Golden Pack Confectionery Boxes & Ribbons',
    mobileNumber: '9898776655',
    email: 'info@goldenpack.co.in',
    gstIn: '24AADCG4455P1Z2',
    address: 'GIDC Phase 2, Vatva, Ahmedabad',
    openingBalance: 0,
    openingType: 'payable',
    remarks: 'Gift boxes and gold foil trays supplier',
  },
  {
    name: 'Pure Cane Sugar & Essence Distributors',
    mobileNumber: '9765432109',
    email: 'contact@purecane.in',
    gstIn: '29AAECP7788L1Z4',
    address: 'Yeshwanthpur APMC Yard, Bengaluru',
    openingBalance: 8200,
    openingType: 'payable',
    remarks: 'Caster sugar, icing sugar & vanilla extracts',
  },
]

/* ---------------- Native OpenXML (.xlsx) Generator & Writer --------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function escapeXml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function colIndexToLetter(index) {
  let n = index + 1
  let str = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    str = String.fromCharCode(65 + rem) + str
    n = Math.floor((n - 1) / 26)
  }
  return str
}

function buildWorksheetXml(aoa) {
  const rowsXml = aoa
    .map((row, rIdx) => {
      const rNum = rIdx + 1
      const cellsXml = row
        .map((cell, cIdx) => {
          const ref = `${colIndexToLetter(cIdx)}${rNum}`
          if (typeof cell === 'number' && !isNaN(cell)) {
            return `<c r="${ref}" t="n"><v>${cell}</v></c>`
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`
        })
        .join('')
      return `<row r="${rNum}">${cellsXml}</row>`
    })
    .join('')

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rowsXml}</sheetData>` +
    `</worksheet>`
  )
}

function createStoredZip(files) {
  const encoder = new TextEncoder()
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.name)
    const dataBytes = typeof f.content === 'string' ? encoder.encode(f.content) : f.content
    return { nameBytes, dataBytes, crc: crc32(dataBytes) }
  })

  let offset = 0
  const localParts = []
  const centralParts = []

  for (const entry of entries) {
    const { nameBytes, dataBytes, crc } = entry
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(localHeader.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, 0, true)
    lv.setUint16(12, 0, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, dataBytes.length, true)
    lv.setUint32(22, dataBytes.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    localHeader.set(nameBytes, 30)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(centralHeader.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, dataBytes.length, true)
    cv.setUint32(24, dataBytes.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)
    cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true)
    cv.setUint16(36, 0, true)
    cv.setUint32(38, 0, true)
    cv.setUint32(42, offset, true)
    centralHeader.set(nameBytes, 46)

    localParts.push(localHeader, dataBytes)
    centralParts.push(centralHeader)
    offset += localHeader.length + dataBytes.length
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true)

  return new Blob([...localParts, ...centralParts, eocd], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/* -------------------- Native Sample PDF (.pdf) Generator ------------------ */

function escapePdfText(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function buildSamplePartiesPdfBlob() {
  const headers = PARTY_COLUMNS.map((c) => c.header)
  const aoa = [
    headers,
    ...DEMO_PARTY_ROWS.map((r) => PARTY_COLUMNS.map((c) => String(r[c.key] ?? ''))),
  ]

  // Build PDF page drawing commands (A4 Landscape: 842 x 595 pt)
  const lines = []
  // Title banner
  lines.push('0.18 0.08 0.22 rg 30 530 782 40 re f')
  lines.push('BT /F2 15 Tf 1 1 1 rg 44 545 Td (AM Store - Bulk Parties / Vendors Sample Sheet) Tj ET')

  // Subtitle
  lines.push('BT /F1 9 Tf 0.35 0.28 0.38 rg 32 512 Td (Columns: name | mobileNumber | email | gstIn | address | openingBalance | openingType | remarks) Tj ET')

  // Table header background
  lines.push('0.95 0.89 0.83 rg 30 480 782 22 re f')

  // Column X positions on 842pt wide landscape page
  const colX = [34, 195, 268, 385, 480, 625, 688, 742]
  const colMaxChars = [28, 13, 21, 16, 26, 10, 9, 16]

  // Header row text
  headers.forEach((h, idx) => {
    lines.push(`BT /F2 8.5 Tf 0.16 0.1 0.19 rg ${colX[idx]} 487 Td (${escapePdfText(h)}) Tj ET`)
  })

  // Data rows
  DEMO_PARTY_ROWS.forEach((row, rIdx) => {
    const y = 460 - rIdx * 26
    if (rIdx % 2 === 1) {
      lines.push(`0.99 0.97 0.95 rg 30 ${y - 7} 782 24 re f`)
    }
    // Row border line
    lines.push(`0.9 0.85 0.8 RG 0.5 w 30 ${y - 7} m 812 ${y - 7} l S`)

    PARTY_COLUMNS.forEach((col, cIdx) => {
      const raw = String(row[col.key] ?? '')
      const clipped =
        raw.length > colMaxChars[cIdx] ? raw.slice(0, colMaxChars[cIdx] - 1) + '.' : raw
      lines.push(
        `BT /F1 8 Tf 0.16 0.1 0.19 rg ${colX[cIdx]} ${y} Td (${escapePdfText(clipped)}) Tj ET`
      )
    })

    // Also include a hidden full-row pipe-delimited text line at tiny scale so any PDF text extractor gets the unclipped text too
    const fullPipeRow = PARTY_COLUMNS.map((c) => String(row[c.key] ?? '')).join(' | ')
    lines.push(`BT /F1 0.1 Tf 1 1 1 rg 30 ${y - 6} Td (${escapePdfText(fullPipeRow)}) Tj ET`)
  })

  // Footer note
  lines.push(
    'BT /F1 8.5 Tf 0.45 0.38 0.48 rg 32 300 Td (Tip: You can upload this PDF file directly into AM Store -> Parties -> Bulk Upload, or upload an Excel .xlsx / .csv file.) Tj ET'
  )

  const contentStream = lines.join('\n')

  // Embed structured JSON payload inside a custom PDF Info/Metadata comment block for 100% lossless round-trip parsing
  const embeddedJson = JSON.stringify(aoa)

  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`,
    `6 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    `7 0 obj\n<< /AMStorePartyTable (${escapePdfText(embeddedJson)}) >>\nendobj\n`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += obj
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

export function downloadDemoPartiesFile(format = 'xlsx') {
  const headers = PARTY_COLUMNS.map((c) => c.header)
  const rows = DEMO_PARTY_ROWS.map((item) => PARTY_COLUMNS.map((c) => item[c.key] ?? ''))
  const aoa = [headers, ...rows]

  if (format === 'pdf') {
    const pdfBlob = buildSamplePartiesPdfBlob()
    triggerDownload(pdfBlob, 'AMStore_Parties_Demo.pdf')
    return
  }

  if (format === 'csv') {
    const csvContent = aoa
      .map((row) =>
        row
          .map((val) => {
            const s = String(val ?? '')
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          })
          .join(',')
      )
      .join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    triggerDownload(blob, 'AMStore_Parties_Demo.csv')
    return
  }

  const zipBlob = createStoredZip([
    {
      name: '[Content_Types].xml',
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `</Types>`,
    },
    {
      name: '_rels/.rels',
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="Parties_Vendors" sheetId="1" r:id="rId1"/></sheets>` +
        `</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `</Relationships>`,
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content: buildWorksheetXml(aoa),
    },
  ])

  triggerDownload(zipBlob, 'AMStore_Parties_Demo.xlsx')
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/* --------------------- Excel (.xlsx), CSV & PDF Parser -------------------- */

async function inflateRaw(compressedBytes) {
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  writer.write(compressedBytes)
  writer.close()
  const buf = await new Response(ds.readable).arrayBuffer()
  return new Uint8Array(buf)
}

async function tryDecompressPdfStream(bytes) {
  for (const format of ['deflate', 'deflate-raw']) {
    try {
      const ds = new DecompressionStream(format)
      const writer = ds.writable.getWriter()
      writer.write(bytes)
      writer.close()
      const buf = await new Response(ds.readable).arrayBuffer()
      return new TextDecoder('latin1').decode(buf)
    } catch {
      // try next format
    }
  }
  return null
}

function unescapePdfLiteral(str) {
  return str
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
}

async function parsePdfBuffer(arrayBuffer) {
  const rawBytes = new Uint8Array(arrayBuffer)
  const rawText = new TextDecoder('latin1').decode(rawBytes)

  // 1. Check if this PDF has our embedded AMStorePartyTable metadata
  const metaMatch = /\/AMStorePartyTable\s*\(([\s\S]*?)\)\s*>>/.exec(rawText)
  if (metaMatch) {
    try {
      const jsonStr = unescapePdfLiteral(metaMatch[1])
      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return parsed
      }
    } catch {
      // fall through to general PDF stream extraction
    }
  }

  // 2. General PDF text extraction across all streams (both uncompressed and FlateDecode)
  const contentChunks = [rawText]
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match
  while ((match = streamRegex.exec(rawText)) !== null) {
    const bodyStr = match[1]
    const streamBytes = new Uint8Array(bodyStr.length)
    for (let i = 0; i < bodyStr.length; i++) {
      streamBytes[i] = bodyStr.charCodeAt(i) & 0xff
    }
    const decompressed = await tryDecompressPdfStream(streamBytes)
    if (decompressed) {
      contentChunks.push(decompressed)
    }
  }

  // Extract text items grouped by Y coordinate or line breaks
  const rowMap = new Map() // yKey -> Array<{ x, text }>
  const pipeLines = []

  for (const chunk of contentChunks) {
    const btBlocks = chunk.match(/BT[\s\S]*?ET/g) || []
    let curY = 0
    let curX = 0

    for (const block of btBlocks) {
      const tdMatch = /([-\d.]+)\s+([-\d.]+)\s+T[dD]/.exec(block)
      const tmMatch = /([-\d.]+)\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)\s+Tm/.exec(block)
      if (tmMatch) {
        curX = Math.round(Number(tmMatch[2]))
        curY = Math.round(Number(tmMatch[3]))
      } else if (tdMatch) {
        curX = Math.round(Number(tdMatch[1]))
        curY = Math.round(Number(tdMatch[2]))
      }

      const literals = []
      const litRegex = /\((?:\\.|[^\\()])*\)/g
      let lm
      while ((lm = litRegex.exec(block)) !== null) {
        const txt = unescapePdfLiteral(lm[0].slice(1, -1)).trim()
        if (txt) literals.push(txt)
      }

      if (literals.length > 0) {
        const joined = literals.join(' ')
        if (joined.includes('|') && joined.split('|').length >= 3) {
          pipeLines.push(joined.split('|').map((s) => s.trim()))
        } else {
          const yKey = Math.round(curY / 4) * 4
          if (!rowMap.has(yKey)) rowMap.set(yKey, [])
          rowMap.get(yKey).push({ x: curX, text: joined })
        }
      }
    }
  }

  if (pipeLines.length > 0) {
    const headerNames = PARTY_COLUMNS.map((c) => c.header)
    const hasHeader = pipeLines[0].some((c) => c.toLowerCase().includes('name'))
    return hasHeader ? pipeLines : [headerNames, ...pipeLines]
  }

  // Reconstruct table rows sorted top-to-bottom (descending Y in PDF coordinates)
  const sortedY = [...rowMap.keys()].sort((a, b) => b - a)
  const tableRows = []
  for (const y of sortedY) {
    const items = rowMap.get(y).sort((a, b) => a.x - b.x)
    const cells = items.map((it) => it.text)
    if (cells.length >= 2) {
      tableRows.push(cells)
    } else if (cells.length === 1) {
      const single = cells[0]
      if (single.includes('\t')) tableRows.push(single.split('\t').map((s) => s.trim()))
      else if (single.includes(',')) tableRows.push(single.split(',').map((s) => s.trim()))
    }
  }

  if (tableRows.length < 2) {
    throw new Error(
      'Could not detect a party table in this PDF. Please use the Sample PDF template or upload an Excel (.xlsx) / CSV file.'
    )
  }

  return tableRows
}

async function extractZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  const view = new DataView(arrayBuffer)
  const decoder = new TextDecoder()

  let eocdPos = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i
      break
    }
  }
  if (eocdPos === -1) {
    throw new Error('Invalid .xlsx file (could not find ZIP directory)')
  }

  const totalEntries = view.getUint16(eocdPos + 10, true)
  let cdPos = view.getUint32(eocdPos + 16, true)
  const files = new Map()

  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(cdPos, true) !== 0x02014b50) break
    const method = view.getUint16(cdPos + 10, true)
    const compSize = view.getUint32(cdPos + 20, true)
    const nameLen = view.getUint16(cdPos + 28, true)
    const extraLen = view.getUint16(cdPos + 30, true)
    const commentLen = view.getUint16(cdPos + 32, true)
    const localOffset = view.getUint32(cdPos + 42, true)
    const fileName = decoder.decode(bytes.subarray(cdPos + 46, cdPos + 46 + nameLen))

    const localNameLen = view.getUint16(localOffset + 26, true)
    const localExtraLen = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const rawSlice = bytes.subarray(dataStart, dataStart + compSize)

    if (
      fileName === 'xl/sharedStrings.xml' ||
      fileName.startsWith('xl/worksheets/sheet')
    ) {
      let contentBytes
      if (method === 0) {
        contentBytes = rawSlice
      } else if (method === 8) {
        contentBytes = await inflateRaw(rawSlice)
      }
      if (contentBytes) {
        files.set(fileName, decoder.decode(contentBytes))
      }
    }

    cdPos += 46 + nameLen + extraLen + commentLen
  }

  return files
}

function colLettersToIndex(cellRef) {
  const match = /^([A-Z]+)/i.exec(cellRef || '')
  if (!match) return -1
  const letters = match[1].toUpperCase()
  let idx = 0
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64)
  }
  return idx - 1
}

async function parseXlsxBuffer(arrayBuffer) {
  const files = await extractZipEntries(arrayBuffer)
  const parser = new DOMParser()

  const sharedStrings = []
  const sstXml = files.get('xl/sharedStrings.xml')
  if (sstXml) {
    const doc = parser.parseFromString(sstXml, 'application/xml')
    const siNodes = doc.getElementsByTagName('si')
    for (let i = 0; i < siNodes.length; i++) {
      const tNodes = siNodes[i].getElementsByTagName('t')
      let text = ''
      for (let j = 0; j < tNodes.length; j++) {
        text += tNodes[j].textContent ?? ''
      }
      sharedStrings.push(text)
    }
  }

  const sheetKey =
    files.has('xl/worksheets/sheet1.xml')
      ? 'xl/worksheets/sheet1.xml'
      : [...files.keys()].find((k) => k.startsWith('xl/worksheets/sheet'))

  if (!sheetKey) {
    throw new Error('No worksheet found inside the Excel file')
  }

  const sheetDoc = parser.parseFromString(files.get(sheetKey), 'application/xml')
  const rowNodes = sheetDoc.getElementsByTagName('row')
  const rows = []

  for (let i = 0; i < rowNodes.length; i++) {
    const rowEl = rowNodes[i]
    const cellNodes = rowEl.getElementsByTagName('c')
    const rowArr = []
    let maxCol = -1

    for (let j = 0; j < cellNodes.length; j++) {
      const cEl = cellNodes[j]
      const ref = cEl.getAttribute('r') || ''
      const colIdx = ref ? colLettersToIndex(ref) : j
      const type = cEl.getAttribute('t')
      let val = ''

      if (type === 'inlineStr') {
        const tNodes = cEl.getElementsByTagName('t')
        for (let k = 0; k < tNodes.length; k++) val += tNodes[k].textContent ?? ''
      } else {
        const vNode = cEl.getElementsByTagName('v')[0]
        const rawVal = vNode?.textContent ?? ''
        if (type === 's') {
          val = sharedStrings[Number(rawVal)] ?? ''
        } else if (type === 'b') {
          val = rawVal === '1' ? 'TRUE' : 'FALSE'
        } else {
          val = rawVal
        }
      }

      if (colIdx >= 0) {
        rowArr[colIdx] = val
        if (colIdx > maxCol) maxCol = colIdx
      }
    }

    for (let c = 0; c <= maxCol; c++) {
      if (rowArr[c] === undefined) rowArr[c] = ''
    }
    if (rowArr.some((cell) => String(cell).trim() !== '')) {
      rows.push(rowArr)
    }
  }

  return rows
}

function parseCsvText(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(field)
        field = ''
      } else if (ch === '\r' && next === '\n') {
        row.push(field)
        if (row.some((c) => c.trim() !== '')) rows.push(row)
        row = []
        field = ''
        i++
      } else if (ch === '\n' || ch === '\r') {
        row.push(field)
        if (row.some((c) => c.trim() !== '')) rows.push(row)
        row = []
        field = ''
      } else {
        field += ch
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((c) => c.trim() !== '')) rows.push(row)
  }
  return rows
}

/* --------------------- Header Mapping & Row Normalization ----------------- */

const PARTY_HEADER_ALIASES = {
  name: 'name',
  partyname: 'name',
  vendorname: 'name',
  party: 'name',
  vendor: 'name',
  companyname: 'name',

  mobilenumber: 'mobileNumber',
  mobile: 'mobileNumber',
  phone: 'mobileNumber',
  phonenumber: 'mobileNumber',
  contact: 'mobileNumber',
  contactnumber: 'mobileNumber',

  email: 'email',
  emailaddress: 'email',
  emailid: 'email',
  mail: 'email',

  gstin: 'gstIn',
  gst: 'gstIn',
  gstno: 'gstIn',
  gstnumber: 'gstIn',

  address: 'address',
  billingaddress: 'address',
  location: 'address',
  city: 'address',

  openingbalance: 'openingBalance',
  balance: 'openingBalance',
  opening: 'openingBalance',
  openingamount: 'openingBalance',

  openingtype: 'openingType',
  balancetype: 'openingType',
  type: 'openingType',

  remarks: 'remarks',
  ledgerremarks: 'remarks',
  notes: 'remarks',
  note: 'remarks',
}

export async function parsePartyBulkFile(file) {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const fileName = (file.name || '').toLowerCase()

  let rawRows = []

  // 1. Check PDF magic bytes "%PDF-" (0x25 0x50 0x44 0x46) or .pdf extension
  if (
    fileName.endsWith('.pdf') ||
    (bytes.length > 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46)
  ) {
    rawRows = await parsePdfBuffer(arrayBuffer)
  }
  // 2. Check ZIP magic bytes "PK\x03\x04" for .xlsx
  else if (
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    rawRows = await parseXlsxBuffer(arrayBuffer)
  }
  // 3. Otherwise parse as CSV / text
  else {
    const text = new TextDecoder('utf-8').decode(bytes)
    rawRows = parseCsvText(text)
  }

  if (rawRows.length < 2) {
    throw new Error('The uploaded file is empty or has no party rows beneath the header row.')
  }
  if (rawRows.length - 1 > 10000) {
    throw new Error(
      `Maximum 10,000 parties can be imported at one time (file has ${rawRows.length - 1} rows).`
    )
  }

  // Locate header row (normally row 0, or first row containing "name" / "party")
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const candidate = rawRows[i].map((c) =>
      String(c ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    )
    if (candidate.some((c) => PARTY_HEADER_ALIASES[c] === 'name')) {
      headerRowIdx = i
      break
    }
  }

  const headerRow = rawRows[headerRowIdx]
  const colMap = {}
  headerRow.forEach((rawHeader, idx) => {
    const norm = String(rawHeader ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    const mapped = PARTY_HEADER_ALIASES[norm]
    if (mapped && colMap[mapped] === undefined) {
      colMap[mapped] = idx
    }
  })

  if (colMap.name === undefined) {
    throw new Error('Missing required "name" (Party / Vendor Name) column in the file header.')
  }

  const parsedRows = []
  const seenNames = new Set()

  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const cells = rawRows[r]
    const get = (key) => (colMap[key] !== undefined ? String(cells[colMap[key]] ?? '').trim() : '')

    const name = get('name')
    const mobileNumber = get('mobileNumber')
    const email = get('email').toLowerCase()
    const gstIn = get('gstIn').toUpperCase()
    const address = get('address')
    const rawOpening = get('openingBalance').replace(/[₹,\s]/g, '')
    const rawType = get('openingType').toLowerCase()
    const remarks = get('remarks')

    // Skip completely blank trailing lines
    if (!name && !mobileNumber && !email && !gstIn) continue

    let openingBalance = rawOpening === '' ? 0 : Number(rawOpening)
    let openingType = 'payable'
    if (rawType === 'advance' || rawType === 'adv' || rawType === 'dr' || rawType === 'debit') {
      openingType = 'advance'
    } else if (openingBalance < 0) {
      openingBalance = Math.abs(openingBalance)
      openingType = 'advance'
    }

    const rowErrors = []
    if (name.length < 2) rowErrors.push('Party name must be at least 2 characters')
    if (mobileNumber && (mobileNumber.length < 7 || mobileNumber.length > 20)) {
      rowErrors.push('Mobile number must be 7–20 characters')
    }
    if (email && !isEmail(email)) {
      rowErrors.push('Invalid email address')
    }
    if (gstIn && gstIn.length !== 15) {
      rowErrors.push('GSTIN must be 15 characters')
    }
    if (isNaN(openingBalance) || openingBalance < 0) {
      rowErrors.push('Invalid openingBalance')
    }

    const lowerName = name.toLowerCase()
    if (name && seenNames.has(lowerName)) {
      rowErrors.push(`Duplicate party name "${name}" in file`)
    } else if (name) {
      seenNames.add(lowerName)
    }

    parsedRows.push({
      rowNumber: r + 1,
      name,
      mobileNumber,
      email,
      gstIn,
      address,
      openingBalance: isNaN(openingBalance) ? 0 : openingBalance,
      openingType,
      remarks,
      valid: rowErrors.length === 0,
      errors: rowErrors,
    })
  }

  return {
    rows: parsedRows,
    validRows: parsedRows.filter((r) => r.valid),
    invalidRows: parsedRows.filter((r) => !r.valid),
  }
}

