import { getValidToken } from './auth';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3';

async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const t = await getValidToken();
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${t.accessToken}`);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const resp = await fetch(url, { ...init, headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
  }
  return resp;
}

export interface SpreadsheetSummary { id: string; name: string }

export async function findOrCreateSpreadsheet(name: string): Promise<SpreadsheetSummary> {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const list = await authedFetch(`${DRIVE}/files?q=${q}&fields=files(id,name)`);
  const found = (await list.json()) as { files: SpreadsheetSummary[] };
  if (found.files?.length) return found.files[0];

  const create = await authedFetch(SHEETS, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: name },
      sheets: [
        sheetSpec('kitchen'),
        sheetSpec('items'),
        sheetSpec('meals'),
        sheetSpec('orders')
      ]
    })
  });
  const body = (await create.json()) as { spreadsheetId: string; properties: { title: string } };

  // Header rows.
  for (const tab of ['kitchen', 'items', 'meals', 'orders']) {
    await writeRange(body.spreadsheetId, `${tab}!A1:C1`, [['id', 'updatedAt', 'data']]);
  }
  return { id: body.spreadsheetId, name: body.properties.title };
}

function sheetSpec(title: string) {
  return { properties: { title, gridProperties: { rowCount: 1000, columnCount: 3 } } };
}

export async function writeRange(spreadsheetId: string, range: string, values: (string | number)[][]): Promise<void> {
  await authedFetch(`${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values })
  });
}

export async function readSheet(spreadsheetId: string, tab: string): Promise<Array<{ id: string; updatedAt: string; data: string }>> {
  const resp = await authedFetch(`${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(tab)}?majorDimension=ROWS`);
  const body = (await resp.json()) as { values?: string[][] };
  const rows = body.values ?? [];
  // Drop header.
  return rows.slice(1).map((r) => ({ id: r[0] ?? '', updatedAt: r[1] ?? '', data: r[2] ?? '' })).filter((r) => r.id);
}

export async function upsertRow(spreadsheetId: string, tab: string, id: string, updatedAt: string, data: unknown): Promise<void> {
  // Read existing rows to find row index of this id.
  const existing = await readSheet(spreadsheetId, tab);
  const idx = existing.findIndex((r) => r.id === id);
  const json = JSON.stringify(data);
  if (idx >= 0) {
    const rowNum = idx + 2; // +1 for header, +1 for 1-indexed
    await writeRange(spreadsheetId, `${tab}!A${rowNum}:C${rowNum}`, [[id, updatedAt, json]]);
  } else {
    await authedFetch(`${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(tab)}!A:C:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: [[id, updatedAt, json]] })
    });
  }
}

export async function batchUpsertRows(spreadsheetId: string, tab: string, rows: Array<{ id: string; updatedAt: string; data: unknown }>): Promise<void> {
  if (rows.length === 0) return;
  const existing = await readSheet(spreadsheetId, tab);
  const indexById = new Map(existing.map((r, i) => [r.id, i]));
  const updates: { range: string; values: (string | number)[][] }[] = [];
  const appends: (string | number)[][] = [];
  for (const r of rows) {
    const json = JSON.stringify(r.data);
    const idx = indexById.get(r.id);
    if (idx !== undefined) {
      const rowNum = idx + 2;
      updates.push({ range: `${tab}!A${rowNum}:C${rowNum}`, values: [[r.id, r.updatedAt, json]] });
    } else {
      appends.push([r.id, r.updatedAt, json]);
    }
  }
  if (updates.length) {
    await authedFetch(`${SHEETS}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data: updates })
    });
  }
  if (appends.length) {
    await authedFetch(`${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(tab)}!A:C:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: appends })
    });
  }
}
