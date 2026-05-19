"use strict";

let spreadsheetCalculationCache = new Map();
let spreadsheetRangeCache = new Map();

self.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.type !== "computeSpreadsheet") return;

  spreadsheetCalculationCache = new Map();
  spreadsheetRangeCache = new Map();

  const page = message.page;
  const results = [];

  const targetSheets = message.computeAll
    ? (page.excelSheets || [])
    : (page.excelSheets || []).filter((sheet) => sheet.id === page.activeExcelSheetId);
  (targetSheets.length ? targetSheets : (page.excelSheets || [])).forEach((sheet) => {
    const scopedPage = { ...page, activeExcelSheetId: sheet.id, database: sheet.database };
    (sheet.database?.rows || []).forEach((row, rowIndex) => {
      (sheet.database?.properties || []).forEach((property, columnIndex) => {
        const raw = String(row.cells?.[property.id] || "");
        if (!raw.trim().startsWith("=")) return;
        const value = computeSpreadsheetCellValue(scopedPage, rowIndex, columnIndex);
        results.push({
          key: spreadsheetFormulaResultKey(scopedPage, rowIndex, columnIndex, raw),
          pageId: page.id,
          sheetId: sheet.id,
          rowIndex,
          columnIndex,
          raw,
          value,
        });
      });
    });
  });

  self.postMessage({
    type: "spreadsheetComputed",
    requestId: message.requestId,
    results,
  });
});

function spreadsheetColumnName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function getSpreadsheetSheetForDatabase(page, database = page?.database) {
  return (page.excelSheets || []).find((candidate) => candidate.database === database)
    || (page.excelSheets || []).find((candidate) => candidate.id === page.activeExcelSheetId)
    || (page.excelSheets || [])[0]
    || null;
}

function spreadsheetFormulaResultKey(page, rowIndex, columnIndex, rawValue, database = page?.database) {
  const sheet = getSpreadsheetSheetForDatabase(page, database);
  return `${page?.id || "page"}:${sheet?.id || page?.activeExcelSheetId || "sheet"}:${rowIndex}:${columnIndex}:${String(rawValue || "")}`;
}

function spreadsheetColumnIndex(page, label) {
  const normalized = String(label || "").trim().toUpperCase();
  return (page.database?.properties || []).findIndex((property, index) => (
    String(property.name || "").trim().toUpperCase() === normalized ||
    spreadsheetColumnName(index) === normalized
  ));
}

function findSpreadsheetSheetByName(page, name) {
  const normalized = String(name || "").trim().toLowerCase();
  return (page.excelSheets || []).find((sheet) => String(sheet.name || "").trim().toLowerCase() === normalized) || null;
}

function withSpreadsheetSheet(page, sheet = null) {
  return sheet ? { ...page, database: sheet.database, activeExcelSheetId: sheet.id } : page;
}

function numericSpreadsheetValue(page, rowIndex, columnIndex, seen = new Set()) {
  const value = computeSpreadsheetCellValue(page, rowIndex, columnIndex, seen);
  const numeric = Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

function applySpreadsheetPercentSyntax(expression) {
  let next = expression;
  let previous = "";
  const additivePercentPattern = /((?:\([^()]+\))|-?\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*%/g;
  while (next !== previous) {
    previous = next;
    next = next.replace(additivePercentPattern, (_, left, operator, percent) => (
      `${left}${operator}(${left}*(${percent}/100))`
    ));
  }
  return next.replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");
}

function splitSpreadsheetArguments(value) {
  const args = [];
  let current = "";
  let depth = 0;
  let quote = "";
  String(value || "").split("").forEach((char) => {
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      return;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      current += char;
      return;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if ((char === "," || char === ";") && depth === 0) {
      args.push(current.trim());
      current = "";
      return;
    }
    current += char;
  });
  args.push(current.trim());
  return args;
}

function unquoteSpreadsheetText(value) {
  const trimmed = String(value || "").trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function spreadsheetNumberValue(value) {
  const numeric = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

function isSpreadsheetQuotedLiteral(value) {
  const trimmed = String(value || "").trim();
  return (trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"));
}

function parseSpreadsheetSheetScopedReference(page, value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(?:'([^']+)'|([^'!]+))!(.+)$/);
  if (!match) return { page, reference: raw };
  const sheetName = match[1] || match[2];
  const sheet = findSpreadsheetSheetByName(page, sheetName);
  return {
    page: withSpreadsheetSheet(page, sheet),
    reference: match[3],
    sheet,
  };
}

function parseSpreadsheetRange(page, value, includeValues = true) {
  const scoped = parseSpreadsheetSheetScopedReference(page, value);
  const raw = scoped.reference;
  const rangePage = scoped.page;
  const sheet = getSpreadsheetSheetForDatabase(rangePage, rangePage.database);
  const cacheKey = `${rangePage.id}:${sheet?.id || rangePage.activeExcelSheetId || "sheet"}:${raw}:${includeValues ? "values" : "coords"}`;
  if (spreadsheetRangeCache.has(cacheKey)) return spreadsheetRangeCache.get(cacheKey);
  const columnMatch = raw.match(/^([A-Z]+):([A-Z]+)$/i);
  const cellMatch = raw.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!columnMatch && !cellMatch) return null;
  const startColumn = spreadsheetColumnIndex(rangePage, columnMatch ? columnMatch[1] : cellMatch[1]);
  const endColumn = spreadsheetColumnIndex(rangePage, columnMatch ? columnMatch[2] : cellMatch[3]);
  const startRow = columnMatch ? 0 : Number(cellMatch[2]) - 1;
  const endRow = columnMatch ? Math.max(0, (rangePage.database?.rows.length || 1) - 1) : Number(cellMatch[4]) - 1;
  if (startColumn < 0 || endColumn < 0 || startRow < 0 || endRow < 0) return null;

  const values = [];
  for (let rowCursor = Math.min(startRow, endRow); rowCursor <= Math.max(startRow, endRow); rowCursor += 1) {
    for (let columnCursor = Math.min(startColumn, endColumn); columnCursor <= Math.max(startColumn, endColumn); columnCursor += 1) {
      values.push({
        page: rangePage,
        rowIndex: rowCursor,
        columnIndex: columnCursor,
        value: includeValues ? computeSpreadsheetCellValue(rangePage, rowCursor, columnCursor, new Set()) : "",
      });
    }
  }
  spreadsheetRangeCache.set(cacheKey, values);
  return values;
}

function readSpreadsheetFormulaValue(page, value, seen = new Set()) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (isSpreadsheetQuotedLiteral(trimmed)) return unquoteSpreadsheetText(trimmed);

  const scoped = parseSpreadsheetSheetScopedReference(page, trimmed);
  const cell = scoped.reference.match(/^([A-Z]+)(\d+)$/i);
  if (cell) {
    const targetColumn = spreadsheetColumnIndex(scoped.page, cell[1]);
    const targetRow = Number(cell[2]) - 1;
    if (targetColumn < 0 || targetRow < 0) return "";
    return computeSpreadsheetCellValue(scoped.page, targetRow, targetColumn, new Set(seen));
  }
  const numeric = Number(trimmed.replace(",", "."));
  return Number.isFinite(numeric) ? String(numeric) : trimmed;
}

function equalSpreadsheetLookupValue(left, right) {
  const leftNumber = Number(String(left).replace(",", "."));
  const rightNumber = Number(String(right).replace(",", "."));
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
}

function spreadsheetLookupNumber(value) {
  const numeric = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function findApproximateSpreadsheetLookupIndex(lookupRange, lookupValue, matchMode) {
  const mode = Number(matchMode);
  if (!Number.isFinite(mode) || mode === 0) return -1;
  const lookupNumber = spreadsheetLookupNumber(lookupValue);
  if (lookupNumber === null) return -1;
  let bestIndex = -1;
  let bestDistance = Infinity;
  lookupRange.forEach((item, index) => {
    const candidate = spreadsheetLookupNumber(item.value);
    if (candidate === null) return;
    const isNextTier = mode === 1 && candidate >= lookupNumber;
    const isPreviousTier = mode === -1 && candidate <= lookupNumber;
    if (!isPreviousTier && !isNextTier) return;
    const distance = Math.abs(lookupNumber - candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function replaceSpreadsheetFunctionCalls(expression, functionName, resolver) {
  const source = String(expression || "");
  const lower = source.toLowerCase();
  const needle = `${functionName.toLowerCase()}(`;
  let output = "";
  let cursor = 0;

  while (cursor < source.length) {
    const start = lower.indexOf(needle, cursor);
    if (start < 0) {
      output += source.slice(cursor);
      break;
    }
    output += source.slice(cursor, start);
    let index = start + needle.length;
    let depth = 1;
    let quote = "";
    while (index < source.length && depth > 0) {
      const char = source[index];
      if (quote) {
        if (char === quote) quote = "";
      } else if (char === "\"" || char === "'") {
        quote = char;
      } else if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
      }
      index += 1;
    }
    if (depth !== 0) {
      output += source.slice(start);
      break;
    }
    const argsText = source.slice(start + needle.length, index - 1);
    const resolved = resolver(argsText);
    const numeric = Number(String(resolved).replace(",", "."));
    output += Number.isFinite(numeric) && String(resolved).trim() !== ""
      ? String(numeric)
      : JSON.stringify(String(resolved ?? ""));
    cursor = index;
  }

  return output;
}

function resolveSpreadsheetXlookup(page, argsText, seen) {
  const args = splitSpreadsheetArguments(argsText);
  if (args.length < 3) return "";
  const lookupValue = readSpreadsheetFormulaValue(page, args[0], seen);
  const lookupRange = parseSpreadsheetRange(page, args[1]);
  const returnRange = parseSpreadsheetRange(page, args[2], false);
  const fallback = args.length >= 4 ? readSpreadsheetFormulaValue(page, args[3], seen) : "";
  const matchMode = args.length >= 5 ? readSpreadsheetFormulaValue(page, args[4], seen) : "0";
  if (!lookupRange?.length || !returnRange?.length) return fallback;
  let foundIndex = lookupRange.findIndex((item) => equalSpreadsheetLookupValue(item.value, lookupValue));
  if (foundIndex < 0) foundIndex = findApproximateSpreadsheetLookupIndex(lookupRange, lookupValue, matchMode);
  if (foundIndex < 0) return fallback;
  const result = returnRange[Math.min(foundIndex, returnRange.length - 1)];
  return result ? computeSpreadsheetCellValue(result.page || page, result.rowIndex, result.columnIndex, new Set(seen)) : fallback;
}

function resolveSpreadsheetSum(page, argsText, seen) {
  return splitSpreadsheetArguments(argsText).reduce((total, arg) => {
    if (!arg) return total;
    const range = parseSpreadsheetRange(page, arg);
    if (range?.length) {
      return total + range.reduce((rangeTotal, item) => rangeTotal + spreadsheetNumberValue(item.value), 0);
    }
    return total + spreadsheetNumberValue(evaluateSpreadsheetFormulaFragment(page, arg, seen));
  }, 0);
}

function evaluateSpreadsheetComparison(page, expression, seen) {
  const text = String(expression || "").trim();
  let quote = "";
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) continue;
    const twoChars = text.slice(index, index + 2);
    const operator = [">=", "<=", "<>", "!="].includes(twoChars) ? twoChars : (["=", ">", "<"].includes(char) ? char : "");
    if (!operator) continue;
    const left = evaluateSpreadsheetFormulaFragment(page, text.slice(0, index), seen);
    const right = evaluateSpreadsheetFormulaFragment(page, text.slice(index + operator.length), seen);
    const leftNumber = Number(String(left).replace(",", "."));
    const rightNumber = Number(String(right).replace(",", "."));
    const bothNumeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    const leftComparable = bothNumeric ? leftNumber : String(left ?? "").trim().toLowerCase();
    const rightComparable = bothNumeric ? rightNumber : String(right ?? "").trim().toLowerCase();
    if (operator === "=") return leftComparable === rightComparable;
    if (operator === "<>" || operator === "!=") return leftComparable !== rightComparable;
    if (operator === ">") return leftComparable > rightComparable;
    if (operator === "<") return leftComparable < rightComparable;
    if (operator === ">=") return leftComparable >= rightComparable;
    if (operator === "<=") return leftComparable <= rightComparable;
  }
  return Boolean(spreadsheetNumberValue(evaluateSpreadsheetFormulaFragment(page, text, seen)));
}

function resolveSpreadsheetIf(page, argsText, seen) {
  const args = splitSpreadsheetArguments(argsText);
  if (args.length < 2) return "";
  const condition = evaluateSpreadsheetComparison(page, args[0], seen);
  return evaluateSpreadsheetFormulaFragment(page, condition ? args[1] : (args[2] || ""), seen);
}

function evaluateSpreadsheetFormulaFragment(page, expression, seen = new Set()) {
  let fragment = String(expression || "").trim().replace(/_xlfn\./gi, "");
  if (!fragment) return "";
  if (isSpreadsheetQuotedLiteral(fragment)) return unquoteSpreadsheetText(fragment);
  fragment = replaceSpreadsheetFunctionCalls(fragment, "XLOOKUP", (argsText) => resolveSpreadsheetXlookup(page, argsText, seen));
  fragment = replaceSpreadsheetFunctionCalls(fragment, "SUM", (argsText) => resolveSpreadsheetSum(page, argsText, seen));
  fragment = replaceSpreadsheetFunctionCalls(fragment, "SOMME", (argsText) => resolveSpreadsheetSum(page, argsText, seen));
  fragment = replaceSpreadsheetFunctionCalls(fragment, "SI", (argsText) => resolveSpreadsheetIf(page, argsText, seen));
  fragment = replaceSpreadsheetFunctionCalls(fragment, "IF", (argsText) => resolveSpreadsheetIf(page, argsText, seen));
  if (isSpreadsheetQuotedLiteral(fragment)) return unquoteSpreadsheetText(fragment);
  fragment = fragment.replace(/\b([A-Z]+)(\d+)\b/g, (_, columnLabel, rowLabel) => {
    const targetColumn = spreadsheetColumnIndex(page, columnLabel);
    const targetRow = Number(rowLabel) - 1;
    if (targetColumn < 0 || targetRow < 0) return "0";
    return String(numericSpreadsheetValue(page, targetRow, targetColumn, new Set(seen)));
  });
  fragment = applySpreadsheetPercentSyntax(fragment);
  if (/^[\d+\-*/().\s]+$/.test(fragment)) {
    try {
      const result = Function(`"use strict"; return (${fragment});`)();
      return Number.isFinite(Number(result)) ? String(Number(result)) : "";
    } catch (error) {
      return "";
    }
  }
  return readSpreadsheetFormulaValue(page, fragment, seen);
}

function computeSpreadsheetCellValue(page, rowIndex, columnIndex, seen = new Set()) {
  const property = page.database?.properties[columnIndex];
  const row = page.database?.rows[rowIndex];
  if (!property || !row) return "";
  const raw = String(row.cells[property.id] || "").trim();
  const sheet = getSpreadsheetSheetForDatabase(page, page.database);
  const key = `${sheet?.id || page.activeExcelSheetId || "sheet"}:${rowIndex}:${columnIndex}`;
  const cacheKey = `${page.id}:${key}:${raw}`;
  if (spreadsheetCalculationCache.has(cacheKey)) return spreadsheetCalculationCache.get(cacheKey);
  if (seen.has(key)) return "";
  if (!raw.startsWith("=")) {
    spreadsheetCalculationCache.set(cacheKey, raw);
    return raw;
  }
  seen.add(key);
  const finalResult = evaluateSpreadsheetFormulaFragment(page, raw.slice(1), seen);
  spreadsheetCalculationCache.set(cacheKey, finalResult);
  return finalResult;
}
