import { useState } from 'react';
import { useAdminStore } from '../../state/adminStore';
import { Button, Card, Input, Modal, Pill, Textarea } from '../../components/ui';
import { rupeesToPaise, paiseToRupees } from '../../lib/currency';
import { uuid, nowIso } from '../../lib/id';
import type { Item } from '../../model/types';

export function ItemsView() {
  const { items, saveItem, deleteItem } = useAdminStore();
  const [editing, setEditing] = useState<Item | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Item catalog</h1>
        <Button onClick={() => setEditing(blankItem())}>+ Add item</Button>
      </div>
      {items.length === 0 ? (
        <Card>
          <p className="text-neutral-600">No items yet. Add your first dish to get started.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <Card key={i.id} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium">{i.name} <span className="text-neutral-500 text-sm font-normal">{i.unit}</span></div>
                {i.description && <div className="text-sm text-neutral-500">{i.description}</div>}
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-medium">{paiseToRupees(i.pricePaise)}</span>
                  {!i.isActive && <Pill tone="neutral">hidden</Pill>}
                </div>
              </div>
              <Button variant="ghost" onClick={() => setEditing(i)}>Edit</Button>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <ItemEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (it) => { await saveItem(it); setEditing(null); }}
          onDelete={async (id) => { await deleteItem(id); setEditing(null); }}
        />
      )}
    </div>
  );
}

function blankItem(): Item {
  return {
    id: uuid(),
    name: '',
    pricePaise: 0,
    isActive: true,
    updatedAt: nowIso()
  };
}

function ItemEditor({ item, onClose, onSave, onDelete }: {
  item: Item;
  onClose: () => void;
  onSave: (i: Item) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const isNew = !useAdminStore.getState().items.some((i) => i.id === item.id);
  const [name, setName] = useState(item.name);
  const [desc, setDesc] = useState(item.description ?? '');
  const [unit, setUnit] = useState(item.unit ?? '');
  const [price, setPrice] = useState(item.pricePaise > 0 ? (item.pricePaise / 100).toString() : '');
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? '');
  const [isActive, setIsActive] = useState(item.isActive);

  const canSave = name.trim() && parseFloat(price) > 0;

  async function save() {
    if (!canSave) return;
    await onSave({
      ...item,
      name: name.trim(),
      description: desc.trim() || undefined,
      unit: unit.trim() || undefined,
      pricePaise: rupeesToPaise(price),
      imageUrl: imageUrl.trim() || undefined,
      isActive,
      updatedAt: nowIso()
    });
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'New item' : 'Edit item'}>
      <div className="space-y-3">
        <Input label="Name *" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Description" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Unit" placeholder="250 ml / 1 pc" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <Input label="Price (₹) *" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Input label="Image URL (optional)" placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Visible in catalog
        </label>
        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={!canSave} className="flex-1">Save</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {!isNew && <Button variant="danger" onClick={() => onDelete(item.id)}>Delete</Button>}
        </div>
      </div>
    </Modal>
  );
}
