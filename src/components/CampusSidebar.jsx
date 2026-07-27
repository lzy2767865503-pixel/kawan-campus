import { KeyRound, ShieldCheck } from 'lucide-react'

export default function CampusSidebar({ t, onApplyClub }) {
  return (
    <aside className="campus-sidebar">
      <section className="club-access-card">
        <ShieldCheck size={24} />
        <h3>{t.clubOnly}</h3>
        <p>{t.clubOnlySub}</p>
        <button type="button" onClick={onApplyClub}>
          <KeyRound size={16} />
          {t.applyClub}
        </button>
      </section>
    </aside>
  )
}
