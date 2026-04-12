import { useState } from 'react'
import { addEvent, updateEvent } from '../db/hooks'
import { useCategories } from '../context/AppContext'

const EFFORT_OPTIONS = [
  { value: 0.25, label: '15m' },
  { value: 0.5,  label: '30m' },
  { value: 1,    label: '1h'  },
  { value: 2,    label: '2h'  },
  { value: 3,    label: '3h'  },
  { value: 4,    label: '4h'  },
  { value: 6,    label: '6h'  },
  { value: 8,    label: '8h'  },
]

const RECURRENCE_OPTIONS = [
  { value: 'none',     label: 'NONE'      },
  { value: 'daily',    label: 'DAILY'     },
  { value: 'weekly',   label: 'WEEKLY'    },
  { value: 'biweekly', label: 'BI-WEEKLY' },
  { value: 'monthly',  label: 'MONTHLY'   },
  { value: 'yearly',   label: 'YEARLY'    },
]

export default function EventModal({ onClose, prefillCategory, prefillDate, editItem }) {
  const categories = useCategories()
  const isEdit = !!editItem
  const [form, setForm] = useState({
    title:            editItem?.title            || '',
    start:            editItem?.start            || prefillDate || new Date().toISOString().slice(0, 10),
    end:              editItem?.end              || '',
    category:         editItem?.category         || prefillCategory || 'work',
    importance:       editItem?.importance       || 3,
    allDay:           editItem?.allDay           ?? true,
    location:         editItem?.location         || '',
    recurrenceType:    editItem?.recurrenceType    || 'none',
    recurrenceEndDate: editItem?.recurrenceEndDate || '',
    estimatedHours:    editItem?.estimatedHours    || 1,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title:            form.title.trim(),
      start:            form.allDay ? form.start.slice(0, 10) : form.start,
      end:              form.end || form.start,
      category:         form.category,
      importance:       Number(form.importance),
      allDay:           form.allDay,
      location:         form.location,
      recurrenceType:    form.recurrenceType,
      recurrenceEndDate: form.recurrenceEndDate || null,
      estimatedHours:    Number(form.estimatedHours),
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
      <div className="bg-[#0a140a] border border-[#00ff4130] rounded-xl p-6 w-full max-w-md font-mono shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <span className="text-[#00ff41] text-[10px] tracking-widest">{isEdit ? 'EDIT EVENT' : 'NEW EVENT'}</span>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-1">TITLE</label>
            <input autoFocus value={form.title} onChange={e => set('title', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Event name..."
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#00ff4155] placeholder-white/20" />
          </div>

          {/* All-day toggle */}
          <div className="flex items-center gap-3">
            <label className="text-[10px] text-white/40 tracking-widest">ALL DAY</label>
            <button onClick={() => set('allDay', !form.allDay)}
              className={`w-10 h-5 rounded-full transition-colors relative ${form.allDay ? 'bg-[#00ff4155]' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.allDay ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Date range */}
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

          {/* Category */}
          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-1">CATEGORY</label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map(cat => (
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

          {/* Importance */}
          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-1">
              IMPORTANCE — {form.importance}/5
            </label>
            <input type="range" min={1} max={5} value={form.importance}
              onChange={e => set('importance', e.target.value)}
              className="w-full accent-[#00ff41]" />
          </div>

          {/* Location */}
          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-1">LOCATION (OPTIONAL)</label>
            <input value={form.location} onChange={e => set('location', e.target.value)}
              placeholder="Where?"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#00ff4155] placeholder-white/20" />
          </div>

          {/* Estimated effort */}
          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-2">
              ESTIMATED EFFORT
              <span className="ml-2 text-white/20 normal-case tracking-normal">(blip length on radar)</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {EFFORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => set('estimatedHours', opt.value)}
                  className={`py-1.5 rounded text-[10px] border transition-all tracking-wider ${
                    form.estimatedHours === opt.value
                      ? 'border-[#00ff41] text-[#00ff41] bg-[#00ff4110]'
                      : 'border-white/10 text-white/35 hover:border-white/25 hover:text-white/60'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Recurrence ── */}
          <div>
            <label className="text-[10px] text-white/40 tracking-widest block mb-2">REPEAT</label>
            <div className="grid grid-cols-3 gap-1.5">
              {RECURRENCE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => set('recurrenceType', opt.value)}
                  className={`px-2 py-1.5 rounded text-[10px] border transition-all tracking-wider ${
                    form.recurrenceType === opt.value
                      ? 'border-[#00ff41] text-[#00ff41] bg-[#00ff4110]'
                      : 'border-white/10 text-white/35 hover:border-white/25 hover:text-white/60'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Recurrence end date — only shown when repeating */}
            {form.recurrenceType !== 'none' && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-[10px] text-white/40 tracking-widest flex-shrink-0">ENDS ON</label>
                <input type="date" value={form.recurrenceEndDate}
                  onChange={e => set('recurrenceEndDate', e.target.value)}
                  placeholder="No end date"
                  className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#00ff4155]" />
                {form.recurrenceEndDate && (
                  <button onClick={() => set('recurrenceEndDate', '')}
                    className="text-white/25 hover:text-white/60 text-xs">×</button>
                )}
              </div>
            )}

            {/* Recurrence hint */}
            {form.recurrenceType !== 'none' && (
              <p className="mt-2 text-[10px] text-[#00ff41]/40 font-mono">
                ↻ {form.recurrenceType === 'daily' && 'Repeats every day'}
                {form.recurrenceType === 'weekly' && 'Repeats every week on the same day'}
                {form.recurrenceType === 'biweekly' && 'Repeats every two weeks'}
                {form.recurrenceType === 'monthly' && 'Repeats on the same day each month'}
                {form.recurrenceType === 'yearly' && 'Repeats once a year'}
                {form.recurrenceEndDate ? ` until ${form.recurrenceEndDate}` : ', no end date'}
              </p>
            )}
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
