import { MEASURING_UNITS, generateBarcode } from './helpers'

export const EXCEL_COLUMNS = [
  {
    key: 'name',
    header: 'name',
    label: 'Item Name',
    required: true,
    type: 'Text',
    example: 'Belgian Dark Chocolate Truffle Box (500g)',
    description: 'Name of the confectionery item (min 2 characters)',
  },
  {
    key: 'category',
    header: 'category',
    label: 'Category',
    required: false,
    type: 'Text',
    example: 'Chocolates',
    description: 'Category name (auto-created if it does not exist yet)',
  },
  {
    key: 'barcode',
    header: 'barcode',
    label: 'Barcode',
    required: true,
    type: 'Text / Number',
    example: '890123450001',
    description: 'Unique barcode per store (auto-generated if left blank)',
  },
  {
    key: 'hsn',
    header: 'hsn',
    label: 'HSN Code',
    required: true,
    type: 'Text / Number',
    example: '1806',
    description: 'HSN / SAC tax code for the item',
  },
  {
    key: 'measuringUnit',
    header: 'measuringUnit',
    label: 'Measuring Unit',
    required: true,
    type: 'Enum',
    example: 'piece',
    description: 'One of: piece, kilogram, gram, litre, millilitre (or pcs, kg, g, l, ml)',
  },
  {
    key: 'purchasePrice',
    header: 'purchasePrice',
    label: 'Purchase Price',
    required: true,
    type: 'Number (≥ 0)',
    example: '320',
    description: 'Cost / purchase price per unit in ₹',
  },
  {
    key: 'purchasePriceWithTax',
    header: 'purchasePriceWithTax',
    label: 'Purchase Price With Tax',
    required: false,
    type: 'Boolean',
    example: 'FALSE',
    description: 'TRUE / Yes if purchasePrice includes GST, otherwise FALSE / No',
  },
  {
    key: 'salePrice',
    header: 'salePrice',
    label: 'Sale Price',
    required: true,
    type: 'Number (≥ 0)',
    example: '480',
    description: 'Selling price per unit in ₹',
  },
  {
    key: 'salePriceWithTax',
    header: 'salePriceWithTax',
    label: 'Sale Price With Tax',
    required: false,
    type: 'Boolean',
    example: 'TRUE',
    description: 'TRUE / Yes if salePrice includes GST, otherwise FALSE / No',
  },
  {
    key: 'gst',
    header: 'gst',
    label: 'GST (%)',
    required: true,
    type: 'Number (0–100)',
    example: '18',
    description: 'Applicable GST percentage (e.g. 0, 5, 12, 18, 28)',
  },
  {
    key: 'currentStock',
    header: 'currentStock',
    label: 'Opening Stock',
    required: false,
    type: 'Number (≥ 0)',
    example: '40',
    description: 'Initial stock quantity (automatically posted to item ledger)',
  },
  {
    key: 'lowStock',
    header: 'lowStock',
    label: 'Low Stock Alert',
    required: false,
    type: 'Number (≥ 0)',
    example: '10',
    description: 'Alert threshold when stock drops to or below this quantity',
  },
  {
    key: 'remarks',
    header: 'remarks',
    label: 'Ledger Remarks',
    required: false,
    type: 'Text',
    example: 'Opening stock via bulk upload',
    description: 'Note saved on the opening stock ledger entry',
  },
]

export const DEMO_INVENTORY_ROWS = [
  {
    name: 'Belgian Dark Chocolate Truffle Box (500g)',
    category: 'Chocolates',
    barcode: '890123450001',
    hsn: '1806',
    measuringUnit: 'piece',
    purchasePrice: 320,
    purchasePriceWithTax: false,
    salePrice: 480,
    salePriceWithTax: true,
    gst: 18,
    currentStock: 40,
    lowStock: 10,
    remarks: 'Initial stock - festive batch',
  },
  {
    name: 'Assorted French Macarons (Box of 12)',
    category: 'Macarons & Pastries',
    barcode: '890123450002',
    hsn: '1905',
    measuringUnit: 'piece',
    purchasePrice: 410,
    purchasePriceWithTax: false,
    salePrice: 620,
    salePriceWithTax: true,
    gst: 18,
    currentStock: 25,
    lowStock: 8,
    remarks: 'Initial stock - cold display',
  },
  {
    name: 'Roasted Almond Butterscotch Brittle',
    category: 'Nuts & Brittles',
    barcode: '890123450003',
    hsn: '1704',
    measuringUnit: 'kilogram',
    purchasePrice: 550,
    purchasePriceWithTax: false,
    salePrice: 780,
    salePriceWithTax: false,
    gst: 12,
    currentStock: 15,
    lowStock: 5,
    remarks: 'Bulk jar weight in kg',
  },
  {
    name: 'Pure Alphonso Mango Coulis Syrup',
    category: 'Syrups & Toppings',
    barcode: '890123450004',
    hsn: '2008',
    measuringUnit: 'litre',
    purchasePrice: 240,
    purchasePriceWithTax: true,
    salePrice: 360,
    salePriceWithTax: true,
    gst: 12,
    currentStock: 30,
    lowStock: 6,
    remarks: 'Initial stock - pantry shelf',
  },
  {
    name: 'Classic Kaju Katli Silver Leaf',
    category: 'Traditional Sweets',
    barcode: '890123450005',
    hsn: '2106',
    measuringUnit: 'kilogram',
    purchasePrice: 680,
    purchasePriceWithTax: false,
    salePrice: 960,
    salePriceWithTax: true,
    gst: 5,
    currentStock: 20,
    lowStock: 5,
    remarks: 'Fresh counter tray',
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
          if (typeof cell === 'boolean') {
            return `<c r="${ref}" t="inlineStr"><is><t>${cell ? 'TRUE' : 'FALSE'}</t></is></c>`
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
    lv.setUint16(8, 0, true) // STORED (no compression)
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

export function downloadDemoExcel(format = 'xlsx') {
  const headers = EXCEL_COLUMNS.map((c) => c.header)
  const rows = DEMO_INVENTORY_ROWS.map((item) =>
    EXCEL_COLUMNS.map((c) => item[c.key] ?? '')
  )
  const aoa = [headers, ...rows]

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
    triggerDownload(blob, 'AMStore_Inventory_Demo.csv')
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
        `<sheets><sheet name="Inventory_Items" sheetId="1" r:id="rId1"/></sheets>` +
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

  triggerDownload(zipBlob, 'AMStore_Inventory_Demo.xlsx')
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

/* ---------------- Native .xlsx & .csv Spreadsheet Parser ------------------ */

async function inflateRaw(compressedBytes) {
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  writer.write(compressedBytes)
  writer.close()
  const buf = await new Response(ds.readable).arrayBuffer()
  return new Uint8Array(buf)
}

async function extractZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  const view = new DataView(arrayBuffer)
  const decoder = new TextDecoder()

  // Locate End of Central Directory (EOCD) signature 0x06054b50 from the end
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

const HEADER_ALIASES = {
  name: 'name',
  itemname: 'name',
  item: 'name',
  productname: 'name',
  product: 'name',

  category: 'category',
  categoryname: 'category',
  group: 'category',

  barcode: 'barcode',
  itemcode: 'barcode',
  sku: 'barcode',
  ean: 'barcode',

  hsn: 'hsn',
  hsncode: 'hsn',
  sac: 'hsn',

  measuringunit: 'measuringUnit',
  unit: 'measuringUnit',
  uom: 'measuringUnit',

  purchaseprice: 'purchasePrice',
  costprice: 'purchasePrice',
  buyprice: 'purchasePrice',
  purchase: 'purchasePrice',

  purchasepricewithtax: 'purchasePriceWithTax',
  purchasetaxinclusive: 'purchasePriceWithTax',
  purchasewithgst: 'purchasePriceWithTax',

  saleprice: 'salePrice',
  sellingprice: 'salePrice',
  mrp: 'salePrice',
  price: 'salePrice',

  salepricewithtax: 'salePriceWithTax',
  saletaxinclusive: 'salePriceWithTax',
  salewithgst: 'salePriceWithTax',

  gst: 'gst',
  gstrate: 'gst',
  gstpercent: 'gst',
  tax: 'gst',

  currentstock: 'currentStock',
  openingstock: 'currentStock',
  stock: 'currentStock',
  qty: 'currentStock',
  quantity: 'currentStock',

  lowstock: 'lowStock',
  lowstockalert: 'lowStock',
  minstock: 'lowStock',
  reorderlevel: 'lowStock',

  remarks: 'remarks',
  ledgerremarks: 'remarks',
  notes: 'remarks',
  note: 'remarks',
}

const UNIT_ALIASES = {
  piece: 'piece',
  pieces: 'piece',
  pcs: 'piece',
  pc: 'piece',
  pkt: 'piece',
  box: 'piece',
  nos: 'piece',
  kilogram: 'kilogram',
  kilograms: 'kilogram',
  kg: 'kilogram',
  kgs: 'kilogram',
  gram: 'gram',
  grams: 'gram',
  gm: 'gram',
  gms: 'gram',
  g: 'gram',
  litre: 'litre',
  litres: 'litre',
  liter: 'litre',
  liters: 'litre',
  l: 'litre',
  ltr: 'litre',
  millilitre: 'millilitre',
  millilitres: 'millilitre',
  milliliter: 'millilitre',
  ml: 'millilitre',
}

function parseBool(val) {
  if (typeof val === 'boolean') return val
  const s = String(val ?? '').trim().toLowerCase()
  return s === 'true' || s === 'yes' || s === '1' || s === 'y'
}

export async function parseInventorySpreadsheet(file) {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  let rawRows = []
  // Check PK\x03\x04 ZIP header for .xlsx
  if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    rawRows = await parseXlsxBuffer(arrayBuffer)
  } else {
    const text = new TextDecoder('utf-8').decode(bytes)
    rawRows = parseCsvText(text)
  }

  if (rawRows.length < 2) {
    throw new Error('The uploaded sheet is empty or has no data rows beneath the header row.')
  }
  if (rawRows.length - 1 > 10000) {
    throw new Error(`Maximum 10,000 items can be imported at one time (sheet has ${rawRows.length - 1} rows).`)
  }

  const headerRow = rawRows[0]
  const colMap = {}
  headerRow.forEach((rawHeader, idx) => {
    const norm = String(rawHeader ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    const mapped = HEADER_ALIASES[norm]
    if (mapped && colMap[mapped] === undefined) {
      colMap[mapped] = idx
    }
  })

  if (colMap.name === undefined) {
    throw new Error('Missing required "name" (Item Name) column in the sheet header.')
  }

  const parsedRows = []
  const seenBarcodes = new Set()

  for (let r = 1; r < rawRows.length; r++) {
    const cells = rawRows[r]
    const get = (key) => (colMap[key] !== undefined ? String(cells[colMap[key]] ?? '').trim() : '')

    const name = get('name')
    const category = get('category')
    const rawBarcode = get('barcode')
    const barcode = rawBarcode || generateBarcode()
    const hsn = get('hsn')
    const rawUnit = get('measuringUnit').toLowerCase()
    const measuringUnit = UNIT_ALIASES[rawUnit] || rawUnit || 'piece'

    const rawPurchasePrice = get('purchasePrice')
    const rawSalePrice = get('salePrice')
    const rawGst = get('gst')
    const rawCurrentStock = get('currentStock')
    const rawLowStock = get('lowStock')

    const purchasePrice = rawPurchasePrice === '' ? NaN : Number(rawPurchasePrice)
    const salePrice = rawSalePrice === '' ? NaN : Number(rawSalePrice)
    const gst = rawGst === '' ? 0 : Number(rawGst)
    const currentStock = rawCurrentStock === '' ? 0 : Number(rawCurrentStock)
    const lowStock = rawLowStock === '' ? 0 : Number(rawLowStock)

    const purchasePriceWithTax = parseBool(get('purchasePriceWithTax'))
    const salePriceWithTax = parseBool(get('salePriceWithTax'))
    const remarks = get('remarks')

    const rowErrors = []
    if (name.length < 2) rowErrors.push('Item name must be at least 2 characters')
    if (!hsn) rowErrors.push('HSN code is required')
    if (!MEASURING_UNITS.includes(measuringUnit)) {
      rowErrors.push(`Invalid unit "${get('measuringUnit')}" (use piece, kilogram, gram, litre, millilitre)`)
    }
    if (isNaN(purchasePrice) || purchasePrice < 0) rowErrors.push('Invalid purchasePrice')
    if (isNaN(salePrice) || salePrice < 0) rowErrors.push('Invalid salePrice')
    if (isNaN(gst) || gst < 0 || gst > 100) rowErrors.push('GST must be 0–100')
    if (isNaN(currentStock) || currentStock < 0) rowErrors.push('Opening stock cannot be negative')
    if (isNaN(lowStock) || lowStock < 0) rowErrors.push('Low stock cannot be negative')

    if (seenBarcodes.has(barcode)) {
      rowErrors.push(`Duplicate barcode "${barcode}" in sheet`)
    } else {
      seenBarcodes.add(barcode)
    }

    parsedRows.push({
      rowNumber: r + 1,
      name,
      category,
      barcode,
      hsn,
      measuringUnit,
      purchasePrice: isNaN(purchasePrice) ? 0 : purchasePrice,
      purchasePriceWithTax,
      salePrice: isNaN(salePrice) ? 0 : salePrice,
      salePriceWithTax,
      gst: isNaN(gst) ? 0 : gst,
      currentStock: isNaN(currentStock) ? 0 : currentStock,
      lowStock: isNaN(lowStock) ? 0 : lowStock,
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

