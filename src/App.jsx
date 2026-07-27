import {
  Archive,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Info,
  Megaphone,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deletePost,
  fetchClubSession,
  fetchPosts,
  pulsePresence,
  reportPost,
} from './api/kawanApi.js'
import CampusHero from './components/CampusHero.jsx'
import CampusSidebar from './components/CampusSidebar.jsx'
import CategoryStrip from './components/CategoryStrip.jsx'
import ClubApplyModal from './components/ClubApplyModal.jsx'
import Header from './components/Header.jsx'
import PostCard from './components/PostCard.jsx'
import PostDetail from './components/PostDetail.jsx'
import PostModal from './components/PostModal.jsx'
import { areas, categories, copy } from './data/content.js'

function loadLanguage() {
  try {
    return localStorage.getItem('kawan-language-v2') || 'zh'
  } catch {
    return 'zh'
  }
}

function loadOwnerTokens() {
  try {
    return JSON.parse(localStorage.getItem('kawan-owner-tokens-v2') || '{}')
  } catch {
    return {}
  }
}

function getPresenceId() {
  try {
    let value = localStorage.getItem('kawan-presence-id')
    if (!value) {
      value = crypto.randomUUID()
      localStorage.setItem('kawan-presence-id', value)
    }
    return value
  } catch {
    return crypto.randomUUID()
  }
}

export default function App() {
  const [lang, setLangState] = useState(loadLanguage)
  const [posts, setPosts] = useState([])
  const [clubSession, setClubSession] = useState(null)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [online, setOnline] = useState(1)
  const [loading, setLoading] = useState(true)
  const [postOpen, setPostOpen] = useState(false)
  const [clubApplyOpen, setClubApplyOpen] = useState(false)
  const [activePost, setActivePost] = useState(null)
  const [ownerTokens, setOwnerTokens] = useState(loadOwnerTokens)
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef(null)

  const t = copy[lang]

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    localStorage.setItem('kawan-language-v2', lang)
  }, [lang])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([fetchPosts(), fetchClubSession()]).then(([postsResult, clubResult]) => {
      if (cancelled) return
      if (postsResult.status === 'fulfilled') setPosts(postsResult.value.posts || [])
      if (clubResult.status === 'fulfilled') setClubSession(clubResult.value.club || null)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    let refreshing = false
    const refreshPosts = async () => {
      if (cancelled || refreshing) return
      refreshing = true
      try {
        const result = await fetchPosts()
        if (!cancelled) {
          const nextPosts = result.posts || []
          setPosts(nextPosts)
          setActivePost((current) => (
            current && !current.isDemo && !nextPosts.some((post) => post.id === current.id)
              ? null
              : current
          ))
        }
      } catch {
        // Keep the last good feed during a temporary network failure.
      } finally {
        refreshing = false
      }
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshPosts()
    }
    const timer = window.setInterval(refreshWhenVisible, 15_000)
    window.addEventListener('focus', refreshPosts)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshPosts)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])

  useEffect(() => {
    const sessionId = getPresenceId()
    let cancelled = false
    const pulse = () => {
      pulsePresence(sessionId).then((result) => {
        if (!cancelled) setOnline(Math.max(1, Number(result.online || 1)))
      }).catch(() => {})
    }
    pulse()
    const timer = window.setInterval(pulse, 45_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const shortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector('.hero-search input')?.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  const allPosts = posts

  const filteredPosts = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return allPosts.filter((post) => {
      const text = [
        post.title,
        post.titleZh,
        post.titleEn,
        post.description,
        post.descriptionZh,
        post.descriptionEn,
        post.area,
        post.clubName,
      ].filter(Boolean).join(' ').toLowerCase()
      return (category === 'all' || post.category === category)
        && (!needle || text.includes(needle))
    }).sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
  }, [allPosts, category, search])

  const showToast = (message) => {
    setToast(message)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 3200)
  }

  const setLang = (next) => setLangState(next)

  const chooseCategory = (next) => {
    setCategory(next)
    window.requestAnimationFrame(() => {
      document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handlePublished = (post, ownerToken) => {
    setPosts((current) => [post, ...current])
    const nextTokens = { ...ownerTokens, [post.id]: ownerToken }
    setOwnerTokens(nextTokens)
    localStorage.setItem('kawan-owner-tokens-v2', JSON.stringify(nextTokens))
    setCategory(post.category)
    showToast(lang === 'zh' ? '发布成功，已经出现在 UKM 动态里。' : 'Published to the UKM campus feed.')
  }

  const handleDelete = async (postId) => {
    const confirmed = window.confirm(lang === 'zh' ? '确定删除这条帖子吗？删除后无法恢复。' : 'Delete this post permanently?')
    if (!confirmed) return
    try {
      await deletePost(postId, ownerTokens[postId])
      setPosts((current) => current.filter((post) => post.id !== postId))
      const nextTokens = { ...ownerTokens }
      delete nextTokens[postId]
      setOwnerTokens(nextTokens)
      localStorage.setItem('kawan-owner-tokens-v2', JSON.stringify(nextTokens))
      setActivePost(null)
      showToast(lang === 'zh' ? '帖子已删除。' : 'Post deleted.')
    } catch (error) {
      showToast(error.message)
    }
  }

  const handleReport = async (postId, reason) => {
    try {
      await reportPost(postId, reason)
      showToast(lang === 'zh' ? '举报已提交，后台会进行审核。' : 'Report submitted for review.')
    } catch (error) {
      showToast(error.message)
    }
  }

  return (
    <div className="app-shell">
      <Header
        lang={lang}
        setLang={setLang}
        online={online}
        onPost={() => setPostOpen(true)}
        onEvents={() => chooseCategory('events')}
      />

      <main>
        <CampusHero
          t={t}
          search={search}
          onSearch={setSearch}
          onPost={() => setPostOpen(true)}
          onEvents={() => chooseCategory('events')}
        />

        <section className="category-section">
          <CategoryStrip categories={categories} active={category} lang={lang} onChange={chooseCategory} />
        </section>

        <section className="rules-band" id="rules">
          <span className="rules-icon"><Archive size={20} /></span>
          <div>
            <strong>{t.rulesTitle}</strong>
            <p>{t.rules}</p>
          </div>
          <span className="rules-divider" />
          <span className="rules-icon contact"><Users size={20} /></span>
          <div>
            <strong>{t.publicContact}</strong>
            <p>{t.privacy}</p>
          </div>
        </section>

        <section className="campus-content" id="discover">
          <div className="feed-column">
            <header className="feed-heading">
              <div>
                <span>DISCOVER UKM</span>
                <h2>{t.latest}</h2>
                <p>{t.latestSub}</p>
              </div>
              <div className="feed-status">
                <span><i /> {online} {t.online}</span>
                <strong>{filteredPosts.length} {lang === 'zh' ? '条内容' : 'posts'}</strong>
              </div>
            </header>

            <div className="feed-filters">
              <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => chooseCategory('all')}>
                <Sparkles size={14} /> {t.all}
              </button>
              {categories.map((item) => (
                <button key={item.id} type="button" className={category === item.id ? 'active' : ''} onClick={() => chooseCategory(item.id)}>
                  {lang === 'zh' ? item.zh : item.en}
                </button>
              ))}
            </div>

            <div className="post-feed">
              {loading ? (
                [0, 1, 2].map((item) => <div className="post-skeleton" key={item} />)
              ) : filteredPosts.length ? (
                filteredPosts.map((post) => {
                  const postCategory = categories.find((item) => item.id === post.category) || categories[0]
                  return <PostCard key={post.id} post={post} category={postCategory} lang={lang} onOpen={setActivePost} />
                })
              ) : (
                <div className="empty-feed">
                  <Megaphone size={30} />
                  <h3>{t.empty}</h3>
                  <button type="button" onClick={() => setPostOpen(true)}>
                    <Plus size={16} /> {t.heroCta}
                  </button>
                </div>
              )}
            </div>

            <button className="feed-post-cta" type="button" onClick={() => setPostOpen(true)}>
              <span><Plus size={22} /></span>
              <div>
                <strong>{lang === 'zh' ? '没找到你需要的？自己发一条' : "Can't find it? Start a post"}</strong>
                <small>{lang === 'zh' ? '无需注册，一页填完；活动发布需要社团权限。' : 'No sign-up, one simple page. Events require club access.'}</small>
              </div>
              <ArrowRight size={20} />
            </button>
          </div>

          <CampusSidebar
            t={t}
            onApplyClub={() => setClubApplyOpen(true)}
          />
        </section>

        <section className="community-promise">
          <div>
            <Info size={22} />
            <span>
              <strong>{lang === 'zh' ? '从 UKM 做起' : 'Starting with UKM'}</strong>
              <p>{lang === 'zh' ? '现在只开放 UKM，不显示其他大学。先把一个校园的内容密度、社团活动和学生之间的联系做好，再考虑扩展。' : 'Kawan Campus currently serves UKM only. The focus is a useful, active campus before any future expansion.'}</p>
            </span>
          </div>
          <span className="ukm-wordmark">UKM · KAWAN CAMPUS</span>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <strong>Kawan Campus <span>UKM</span></strong>
          <p>{t.footer}</p>
        </div>
        <nav>
          <a href="#discover">{t.discover}</a>
          <a href="#rules">{lang === 'zh' ? '规则' : 'Rules'}</a>
          <button type="button" onClick={() => setClubApplyOpen(true)}>{lang === 'zh' ? '社团申请' : 'Club access'}</button>
          <a href="#admin">{lang === 'zh' ? '管理后台' : 'Admin'}</a>
        </nav>
        <small>© 2026 Kawan Campus · Built for UKM students</small>
      </footer>

      <nav className="mobile-bottom-nav">
        <a href="#discover"><Sparkles size={20} /><span>{lang === 'zh' ? '动态' : 'Feed'}</span></a>
        <button type="button" onClick={() => chooseCategory('events')}><CalendarDays size={20} /><span>{t.events}</span></button>
        <button className="mobile-post-main" type="button" onClick={() => setPostOpen(true)}><Plus size={21} /><span>{t.post}</span></button>
        <a href="https://lrobotform.com/tools/#service" target="_blank" rel="noopener noreferrer" aria-label={lang === 'zh' ? '打开论文数据机器人' : 'Open Thesis Data Robot'}><ClipboardCheck size={20} /><span>{lang === 'zh' ? '论文' : 'Thesis'}</span></a>
        <a href="https://lrobotform.com/resume/" target="_blank" rel="noopener noreferrer" aria-label={lang === 'zh' ? '打开简历项目' : 'Open Resume Project'}><FileText size={20} /><span>{lang === 'zh' ? '简历' : 'Resume'}</span></a>
      </nav>

      <PostModal
        open={postOpen}
        lang={lang}
        categories={categories}
        areas={areas}
        initialCategory={category}
        clubSession={clubSession}
        onClubSession={setClubSession}
        onClose={() => setPostOpen(false)}
        onPublished={handlePublished}
        onApplyClub={() => setClubApplyOpen(true)}
      />

      <ClubApplyModal open={clubApplyOpen} lang={lang} onClose={() => setClubApplyOpen(false)} />

      {activePost && (
        <PostDetail
          post={activePost}
          category={categories.find((item) => item.id === activePost.category) || categories[0]}
          lang={lang}
          canDelete={Boolean(ownerTokens[activePost.id])}
          onDelete={handleDelete}
          onReport={handleReport}
          onClose={() => setActivePost(null)}
          onToast={showToast}
        />
      )}

      {toast && <div className="toast" role="status"><ShieldCheck size={16} /> {toast}</div>}
    </div>
  )
}
