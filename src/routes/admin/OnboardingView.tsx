import { useState } from 'react';
import { useAdminStore } from '../../state/adminStore';
import { Button, Card, Input, Textarea } from '../../components/ui';
import { uuid, nowIso } from '../../lib/id';
import { requestPersistentStorage } from '../../storage/db';

export function OnboardingView() {
  const saveKitchen = useAdminStore((s) => s.saveKitchen);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [upi, setUpi] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [color, setColor] = useState('#f97316');
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim() && whatsapp.replace(/\D/g, '').length >= 10 && upi.includes('@') && address.trim();

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    await saveKitchen({
      id: uuid(),
      slug: slug.trim() || slugify(name),
      name: name.trim(),
      whatsappPhone: whatsapp.replace(/\D/g, ''),
      upiId: upi.trim(),
      address: address.trim(),
      logoUrl: logoUrl.trim() || undefined,
      themeColor: color,
      createdAt: nowIso()
    });
    await requestPersistentStorage();
  }

  return (
    <div className="min-h-screen max-w-md mx-auto p-6">
      <div className="text-5xl mb-2 text-center">🍱</div>
      <h1 className="text-2xl font-bold text-center mb-1">Set up your kitchen</h1>
      <p className="text-center text-neutral-600 mb-6 text-sm">All data lives on this device. Export anytime.</p>
      <Card className="space-y-4">
        <Input label="Kitchen name *" placeholder="Your kitchen name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Slug (label)" placeholder="my-kitchen" value={slug} onChange={(e) => setSlug(e.target.value)} hint="Used in WhatsApp messages." />
        <Input label="WhatsApp phone (with country code) *" placeholder="+91 98765 43210" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        <Input label="UPI ID *" placeholder="name@bank" value={upi} onChange={(e) => setUpi(e.target.value)} />
        <Textarea label="Address *" placeholder="Building, Flat / Door number" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label="Logo image URL (optional)" placeholder="https://…/logo.png" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        <div>
          <span className="block text-sm font-medium text-neutral-700 mb-1">Brand color</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 rounded border border-neutral-300" />
        </div>
        <Button onClick={submit} disabled={!canSubmit || saving} className="w-full">
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </Card>
    </div>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
