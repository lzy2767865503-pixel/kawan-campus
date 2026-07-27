import { CalendarDays, Car, CarFront, House, ShoppingBag, Sparkles } from 'lucide-react'

const iconMap = {
  CalendarDays,
  Car,
  CarFront,
  House,
  ShoppingBag,
  Sparkles,
}

export default function CategoryStrip({ categories, active, lang, onChange }) {
  return (
    <div className="category-strip" aria-label="Content categories">
      {categories.map((category) => {
        const Icon = iconMap[category.icon] || Sparkles
        return (
          <button
            key={category.id}
            type="button"
            className={active === category.id ? 'active' : ''}
            style={{ '--category': category.color, '--category-tint': category.tint }}
            onClick={() => onChange(category.id)}
          >
            <span className="category-icon"><Icon size={20} /></span>
            <span>
              <strong>{lang === 'zh' ? category.zh : category.en}</strong>
              <small>{lang === 'zh' ? category.shortZh : category.shortEn}</small>
            </span>
          </button>
        )
      })}
    </div>
  )
}
