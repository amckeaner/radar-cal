import { useState } from 'react'
import { addTask, updateTask } from '../db/hooks'
import { CATEGORIES } from '../context/AppContext'

export default function TaskModal({ onClose, editItem }) {
  const isEdit = !!editItem
  const [form, setForm] = useState({
    title:      editItem?.title      || '',
    dueDate:    editItem?.dueDate    || new Date().toISOString().slice(0, 10),
    category:   editItem?.category   || 'work',
    importance: editItem?.importance || 3,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title:      form.title.trim(),
      dueDate:    form.dueDate,
      category:   form.category,
      importance: Number(form.importance),
    }
    if (isEdit) {
      await updateTask(editItem.id, payload)
    } else {
      await addTask(payload)
    }
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0a140a] border border-[#fbbf2430] rounded-xl p-6 w-full max-w-md font-mono shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <span className="text-[#fbbf24] text-[10px] tracking-widest">{isEdit ? 'EDIT TASK' : 'NEW TASK'}</span>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-1">TASK</label>
            <input autoFocus value={form.title} onChange={e => set('title', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="What needs doing?"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#fbbf2455] placeholder-white/20" />
          </div>

          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-1">DUE DATE</label>
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-[#fbbf2455]" />
          </div>

          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-1">CATEGORY</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => set('category', cat.id)}
                  className={`px-3 py-2 rounded text-xs border transition-all ${
                    form.category === cat.id ? 'bg-white/8' : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                  style={{ color: cat.color, borderColor: form.category === cat.id ? cat.color : undefined }}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-1">
              IMPORTANCE — {form.importance}/5
            </label>
            <input type="range" min={1} max={5} value={form.importance}
              onChange={e => set('importance', e.target.value)}
              className="w-full accent-[#fbbf24]" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs text-white/40 border border-white/10 rounded hover:border-white/20 transition-colors">
            CANCEL
          </button>
          <button onClick={handleSave} disabled={!form.title.trim() || saving}
            className="flex-1 py-2 text-xs text-[#fbbf24] border border-[#fbbf2445] rounded hover:bg-[#fbbf2412] transition-colors disabled:opacity-30">
            {saving ? 'SAVING...' : isEdit ? 'SAVE CHANGES' : 'ADD TASK'}
          </button>
        </div>
      </div>
    </div>
  )
}
