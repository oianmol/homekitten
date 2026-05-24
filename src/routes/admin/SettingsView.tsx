import { useRef, useState } from 'react';
import { useAdminStore } from '../../state/adminStore';
import { Button, Card, Input, Pill, Textarea } from '../../components/ui';
import { exportAll, importAll, type BackupBundle } from '../../storage/stores';
import { requestPersistentStorage } from '../../storage/db';
import { useSyncStore } from '../../state/syncStore';

export function SettingsView() {
  const { kitchen, saveKitchen, hydrate } = useAdminStore();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!kitchen) return null;

  async function doExport() {
    const bundle = await exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homekitten-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport(file: File) {
    setImportStatus(null);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as BackupBundle;
      await importAll(bundle, importMode);
      // Force re-hydrate.
      useAdminStore.setState({ hydrated: false });
      await hydrate();
      setImportStatus(`Imported (${importMode}): ${bundle.items.length} items · ${bundle.mealWindows.length} meals · ${bundle.orders.length} orders.`);
    } catch (e) {
      setImportStatus('Import failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function tryPersist() {
    const ok = await requestPersistentStorage();
    setPersisted(ok);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card className="space-y-3">
        <h2 className="font-medium">Kitchen profile</h2>
        <Input label="Name" value={kitchen.name} onChange={(e) => saveKitchen({ ...kitchen, name: e.target.value })} />
        <Input label="WhatsApp phone" value={kitchen.whatsappPhone} onChange={(e) => saveKitchen({ ...kitchen, whatsappPhone: e.target.value.replace(/\D/g, '') })} />
        <Input label="UPI ID" value={kitchen.upiId} onChange={(e) => saveKitchen({ ...kitchen, upiId: e.target.value })} />
        <Textarea label="Address" rows={2} value={kitchen.address} onChange={(e) => saveKitchen({ ...kitchen, address: e.target.value })} />
        <Input label="Logo URL" value={kitchen.logoUrl ?? ''} onChange={(e) => saveKitchen({ ...kitchen, logoUrl: e.target.value || undefined })} />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">Backup</h2>
        <p className="text-sm text-neutral-600">Export everything to a JSON file. Save it to your Drive/email. Import on another device to sync.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={doExport}>Export backup</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>Import backup</Button>
          <select value={importMode} onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
            className="px-3 py-2 rounded-lg border border-neutral-300 text-sm">
            <option value="merge">merge</option>
            <option value="replace">replace</option>
          </select>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
        {importStatus && <div className="text-sm text-neutral-600">{importStatus}</div>}
      </Card>

      <GoogleSyncCard />

      <Card className="space-y-3">
        <h2 className="font-medium">Persistent storage</h2>
        <p className="text-sm text-neutral-600">
          Browsers may evict storage if disk is low. Granting persistent storage prevents that.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={tryPersist}>Request persistent</Button>
          {persisted !== null && (
            <span className="text-sm text-neutral-700">
              {persisted ? 'Granted ✓' : 'Not granted — install the app to your home screen for better odds.'}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

function GoogleSyncCard() {
  const { configured, connected, syncing, lastSyncAt, lastResult, lastError, sheetId, connect, disconnect, syncNow } = useSyncStore();
  if (!configured) {
    return (
      <Card className="space-y-2">
        <h2 className="font-medium">Google Drive sync</h2>
        <p className="text-sm text-neutral-600">
          Cross-device sync via Google Sheets is not configured on this build.
          The deployment owner needs to set <code>VITE_GOOGLE_CLIENT_ID</code>.
        </p>
      </Card>
    );
  }
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Google Drive sync</h2>
        <Pill tone={connected ? 'green' : 'neutral'}>{connected ? 'connected' : 'not connected'}</Pill>
      </div>
      <p className="text-sm text-neutral-600">
        Mirror your kitchen profile, items, meals, and orders to a Google Sheet in your own Drive. Sign in on a second device to keep both in sync. We never see your data — it lives in your Google account.
      </p>
      <div className="flex flex-wrap gap-2">
        {!connected && <Button onClick={connect}>Connect Google account</Button>}
        {connected && <Button onClick={syncNow} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync now'}</Button>}
        {connected && <Button variant="ghost" onClick={disconnect}>Disconnect</Button>}
        {sheetId && (
          <a className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-neutral-700 hover:bg-neutral-100"
             href={`https://docs.google.com/spreadsheets/d/${sheetId}`} target="_blank" rel="noreferrer">
            Open sheet ↗
          </a>
        )}
      </div>
      {lastSyncAt && (
        <div className="text-xs text-neutral-500">
          Last sync: {new Date(lastSyncAt).toLocaleString('en-IN')}
          {lastResult && (
            <> · pushed {lastResult.pushed.items + lastResult.pushed.meals + lastResult.pushed.orders} · pulled {lastResult.pulled.items + lastResult.pulled.meals + lastResult.pulled.orders}</>
          )}
        </div>
      )}
      {lastError && <div className="text-sm text-red-600">{lastError}</div>}
    </Card>
  );
}
