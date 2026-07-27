import { Building2, CheckCircle2, KeyRound, X } from 'lucide-react'
import { useState } from 'react'
import { applyForClub } from '../api/kawanApi.js'

export default function ClubApplyModal({ open, lang, onClose }) {
  const [form, setForm] = useState({ clubName: '', ukmEmail: '', contact: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!open) return null
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await applyForClub(form)
      setDone(true)
    } catch (submissionError) {
      setError(submissionError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer club-apply-layer" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section className="club-apply-modal" role="dialog" aria-modal="true" aria-labelledby="club-apply-title">
        <button type="button" className="icon-close" onClick={onClose}><X size={20} /></button>
        {done ? (
          <div className="application-success">
            <CheckCircle2 size={42} />
            <h2>{lang === 'zh' ? '申请已提交' : 'Application sent'}</h2>
            <p>{lang === 'zh' ? '后台审核社团身份后，会通过你填写的方式发放社团账号和独立发布密钥。' : 'After the club identity is reviewed, the club account and unique publishing key will be issued through your contact method.'}</p>
            <button type="button" onClick={onClose}>{lang === 'zh' ? '完成' : 'Done'}</button>
          </div>
        ) : (
          <>
            <div className="club-apply-icon"><Building2 size={26} /></div>
            <span className="modal-eyebrow">UKM CLUB ACCESS</span>
            <h2 id="club-apply-title">{lang === 'zh' ? '申请活动发布权限' : 'Apply to publish events'}</h2>
            <p>{lang === 'zh' ? '每个通过审核的社团会获得独立账号与发布密钥；密钥可以随时在后台撤销或更换。' : 'Each approved club receives a unique account and publishing key that can be revoked or rotated from the admin system.'}</p>
            <form onSubmit={submit}>
              <label>
                <span>{lang === 'zh' ? '社团正式名称 *' : 'Official club name *'}</span>
                <input required minLength={3} value={form.clubName} onChange={(event) => update('clubName', event.target.value)} />
              </label>
              <label>
                <span>{lang === 'zh' ? 'UKM 官方邮箱 *' : 'Official UKM email *'}</span>
                <input required type="email" value={form.ukmEmail} onChange={(event) => update('ukmEmail', event.target.value)} placeholder="name@ukm.edu.my" />
              </label>
              <label>
                <span>{lang === 'zh' ? '负责人联系方式 *' : 'Committee contact *'}</span>
                <input required value={form.contact} onChange={(event) => update('contact', event.target.value)} placeholder="WhatsApp / Phone" />
              </label>
              <label>
                <span>{lang === 'zh' ? '补充说明' : 'Notes'}</span>
                <textarea rows={3} value={form.note} onChange={(event) => update('note', event.target.value)} placeholder={lang === 'zh' ? '可以说明活动类型或社团官网/社交媒体。' : 'Tell us about your events or official social profile.'} />
              </label>
              <div className="key-policy-note">
                <KeyRound size={17} />
                <span>{lang === 'zh' ? '不要多人共用密钥；负责人变更时应立即申请更换。' : 'Do not share keys broadly. Rotate the key when committee owners change.'}</span>
              </div>
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="apply-submit" type="submit" disabled={busy}>{busy ? (lang === 'zh' ? '提交中…' : 'Sending…') : (lang === 'zh' ? '提交审核' : 'Submit for review')}</button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
