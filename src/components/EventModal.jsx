import { useState } from 'react'
import { addEvent, updateEvent } from '../db/hooks'
import { CATEGORIES } from '../context/AppContext'

export default function EventModal({ onClose, prefillCategory, prefillDate, editItem }) {
  const isEdit = !!editItem
  const [form, setForm] = useState({
    title:      editItem?.title      || '',
    start:      editItem?.start      || prefillDate || new Date().toISOString().slice(0, 10),
    end:        editItem?.end        || '',
    category:   editItem?.category   || prefillCategory || 'work',
    importance: editItem?.importance || 3,
    allDay:     editItem?.allDay     ?? true,
    location:   editItem?.location   || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title:      form.title.trim(),
      start:      form.allDay ? form.start.slice(0, 10) : form.start,
      end:        form.end || form.start,
      category:   form.category,
      importance: Number(form.importance),
      allDay:     form.allDay,
      location:   form.location,
    }
    if (isEdit) {
      await updateEvent(editItem.id, payload)
    } else {
      await addEvent({ ...payload, calendarSource: 'manual', gcalId: null })
    }
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0a140a] border border-[#00ff4130] rounded-xl p-6 w-full max-w-md font-mono shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <span className="text-[#00ff41] text-[10px] tracking-widest">{isEdit ? 'EDIT EVENT' : 'NEW EVENT'}</span>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-1">TITLE</label>
            <input autoFocus value={form.title} onChange={e => set('title', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Event name..."
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#00ff4155] placeholder-white/20" />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[10px] text-white/40 tracking-widest">ALL DAY</label>
            <button onClick={() => set('allDay', !form.allDay)}
              className={`w-10 h-5 rounded-full transition-colors relative ${form.allDay ? 'bg-[#00ff4155]' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.allDay ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 tracking-widest block mb-1">START</label>
              <input type={form.allDay ? 'date' : 'datetime-local'}
                value={form.allDay ? form.start.slice(0,10) : form.start}
                onChange={e => set('start', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-[#00ff4155]" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 tracking-widest block mb-1">END</label>
              <input type={form.allDay ? 'date' : 'datetime-local'}
                value={form.allDay ? (form.end || '').slice(0,10) : form.end}
                onChange={e => set('end', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-[#00ff4155]" />
            </div>
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
              className="w-full accent-[#00ff41]" />
          </div>

          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-1">LOCATION (OPTIONAL)</label>
            <input value={form.location} onChange={e => set('location', e.target.value)}
              placeholder="Where?"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#00ff4155] placeholder-white/20" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs text-white/40 border border-white/10 rounded hover:border-white/20 transition-colors">
            CANCEL
          </button>
          <button onClick={handleSave} disabled={!form.title.trim() || saving}
            className="flex-1 py-2 text-xs text-[#00ff41] border border-[#00ff4145] rounded hover:bg-[#00ff4112] transition-colors disabled:opacity-30">
            {saving ? 'SAVING...' : isEdit ? 'SAVE CHANGES' : 'ADD EVENT'}
          </button>
        </div>
      </div>
    </div>
  )
}
