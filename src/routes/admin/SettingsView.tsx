import { useRef, useState } from 'react';
import { useAdminStore } from '../../state/adminStore';
import { Button, Card, Input, Textarea } from '../../components/ui';
import { exportAll, importAll, type BackupBundle } from '../../storage/stores';
import { requestPersistentStorage } from '../../storage/db';

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
