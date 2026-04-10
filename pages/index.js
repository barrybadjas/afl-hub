import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'

const COLORS = {
  purple: '#7B68EE',
  red: '#E24B4A',
  green: '#1D9E75',
  amber: '#BA7517',
  coral: '#D85A30',
  blue: '#4A9EFF',
}

const NL_DAYS = ['zo','ma','di','wo','do','vr','za']
const NL_MONTHS_SHORT = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
const NL_MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const NL_DAYS_FULL = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag']

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export default function App() {
  const [tab, setTab] = useState(0)
  const [token, setToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState([])
  const [posts, setPosts] = useState([])
  const [tasks, setTasks] = useState([])
  const [stats, setStats] = useState(null)
  const [checks, setChecks] = useState({drums:true,pitch:true,'content-ok':true})
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selDate, setSelDate] = useState(new Date().toISOString().split('T')[0])
  const [borisMessages, setBorisMessages] = useState([{role:'assistant',content:'Goedemorgen, Job. Wat kan ik voor je doen vandaag?'}])
  const [borisInput, setBorisInput] = useState('')
  const [borisLoading, setBorisoading] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({title:'',priority:'Midden',deadline:'',note:''})
  const [taskDetail, setTaskDetail] = useState(null)
  const [borisAdvice, setBorisAdvice] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const borisEndRef = useRef(null)
  const now = new Date()

  useEffect(() => {
    const saved = localStorage.getItem('afl-token')
    const savedChecks = localStorage.getItem('afl-checks')
    if (saved) { setToken(saved); setTokenInput(saved); setConnected(true) }
    if (savedChecks) setChecks(JSON.parse(savedChecks))
  }, [])

  useEffect(() => {
    if (connected && token) { loadAll() }
  }, [connected, token])

  useEffect(() => {
    borisEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [borisMessages])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [ag, ct, tk, st] = await Promise.all([
        fetch('/api/agenda', { headers: { 'x-notion-token': token } }).then(r => r.json()),
        fetch('/api/content', { headers: { 'x-notion-token': token } }).then(r => r.json()),
        fetch('/api/tasks', { headers: { 'x-notion-token': token } }).then(r => r.json()),
        fetch('/api/stats', { headers: { 'x-notion-token': token } }).then(r => r.json()),
      ])
      if (ag.events) setEvents(ag.events)
      if (ct.posts) setPosts(ct.posts)
      if (tk.tasks) setTasks(tk.tasks)
      if (st.latest) setStats(st)
    } catch(e) {}
    setLoading(false)
  }

  function saveToken() {
    if (!tokenInput.trim()) return
    setToken(tokenInput.trim())
    localStorage.setItem('afl-token', tokenInput.trim())
    setConnected(true)
    showToast('Verbonden met Notion ✓')
  }

  function toggleCheck(key) {
    const next = { ...checks, [key]: !checks[key] }
    setChecks(next)
    localStorage.setItem('afl-checks', JSON.stringify(next))
  }

  const releaseKeys = ['drums','bas','vocals','mix1','milan','export','master','pitch','distro','content-ok','live']
  const releaseDone = releaseKeys.filter(k => checks[k]).length
  const releasePct = Math.round(releaseDone / releaseKeys.length * 100)

  async function sendBoris() {
    if (!borisInput.trim()) return
    const msg = borisInput.trim()
    setBorisInput('')
    const newMessages = [...borisMessages, { role: 'user', content: msg }]
    setBorisMessages(newMessages)
    setBorisoading(true)
    try {
      const r = await fetch('/api/boris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context: `Events vandaag: ${events.filter(e => e.date === now.toISOString().split('T')[0]).map(e => e.title).join(', ')}. Release Pure Gold: ${releaseDone}/11 klaar.`
        })
      })
      const d = await r.json()
      setBorisMessages(prev => [...prev, { role: 'assistant', content: d.reply || 'Er ging iets mis.' }])
    } catch(e) {
      setBorisMessages(prev => [...prev, { role: 'assistant', content: 'Kon Boris niet bereiken.' }])
    }
    setBorisoading(false)
  }

  async function openTaskDetail(task) {
    setTaskDetail(task)
    setBorisAdvice('')
    try {
      const r = await fetch('/api/boris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Geef me een korte strategisch advies (max 3 zinnen) voor deze taak: "${task.title}". Deadline: ${task.deadline || 'geen'}. Notitie: ${task.note || 'geen'}.` }]
        })
      })
      const d = await r.json()
      setBorisAdvice(d.reply || '')
    } catch(e) {}
  }

  async function addTask() {
    if (!taskForm.title.trim()) return
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notion-token': token },
        body: JSON.stringify(taskForm)
      })
      setShowTaskForm(false)
      setTaskForm({ title: '', priority: 'Midden', deadline: '', note: '' })
      loadAll()
      showToast('Taak toegevoegd ✓')
    } catch(e) {}
  }

  async function updateContentStatus(postId, newStatus) {
    try {
      await fetch('/api/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-notion-token': token },
        body: JSON.stringify({ pageId: postId, status: newStatus })
      })
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: newStatus } : p))
      showToast('Status bijgewerkt ✓')
    } catch(e) {}
  }

  const greeting = now.getHours() < 12 ? 'Goedemorgen' : now.getHours() < 17 ? 'Goedemiddag' : 'Goedenavond'
  const todayEvents = events.filter(e => e.date === now.toISOString().split('T')[0])
  const dayEvents = events.filter(e => e.date === selDate)

  function daysUntil(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    const t = new Date(); t.setHours(0,0,0,0)
    const diff = Math.ceil((d - t) / 86400000)
    return diff <= 0 ? 'vandaag' : `${diff}d`
  }

  const statusOrder = ['📹 Te schieten','📼 Te digitaliseren','✂️ Te bewerken','✅ Klaar om te posten','🚀 Live']
  const statusNext = {
    '📹 Te schieten': '📼 Te digitaliseren',
    '📼 Te digitaliseren': '✂️ Te bewerken',
    '✂️ Te bewerken': '✅ Klaar om te posten',
    '✅ Klaar om te posten': '🚀 Live',
    '🚀 Live': '🚀 Live',
  }
  const statusColors = {
    '📹 Te schieten': '#333',
    '📼 Te digitaliseren': '#BA7517',
    '✂️ Te bewerken': '#D85A30',
    '✅ Klaar om te posten': '#1D9E75',
    '🚀 Live': '#7B68EE',
  }

  function buildCalDays() {
    const days = []
    const first = new Date(calYear, calMonth, 1)
    const last = new Date(calYear, calMonth + 1, 0)
    let startDow = first.getDay(); if (startDow === 0) startDow = 7
    for (let i = 1; i < startDow; i++) {
      const d = new Date(calYear, calMonth, 1 - (startDow - i - 1) - 1)
      days.push({ date: d, other: true })
    }
    for (let i = 1; i <= last.getDate(); i++) days.push({ date: new Date(calYear, calMonth, i), other: false })
    while (days.length % 7 !== 0) {
      const d = new Date(calYear, calMonth + 1, days.length - last.getDate() - startDow + 2)
      days.push({ date: d, other: true })
    }
    return days
  }

  const calDays = buildCalDays()
  const todayStr = now.toISOString().split('T')[0]

  const tabs = [
    { label: 'Vandaag', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg> },
    { label: 'Agenda', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="16" height="15" rx="2.5"/><line x1="2" y1="8" x2="18" y2="8"/><line x1="7" y1="2" x2="7" y2="8"/><line x1="13" y1="2" x2="13" y2="8"/></svg> },
    { label: 'Content', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="14" height="3" rx="1.2"/><rect x="3" y="8.5" width="10" height="3" rx="1.2"/><rect x="3" y="14" width="12" height="3" rx="1.2"/></svg> },
    { label: 'Release', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="10" cy="10" r="8"/><polyline points="10,6 10,10.5 13,12.5"/></svg> },
    { label: 'Taken', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,10 8,14 16,6"/></svg> },
    { label: 'Stats', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,16 6,10 10,12 14,5 18,8"/></svg> },
    { label: 'Boris', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="10" cy="10" r="8"/><circle cx="10" cy="10" r="3"/></svg> },
  ]

  return (
    <>
      <Head>
        <title>A Few Less Hub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <meta name="apple-mobile-web-app-title" content="A Few Less"/>
        <meta name="theme-color" content="#080808"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </Head>

      <style>{`
        :root {
          --bg: #080808;
          --bg2: #0f0f0f;
          --bg3: #161616;
          --bg4: #1e1e1e;
          --border: #1a1a1a;
          --border2: #252525;
          --text: #e8e8e8;
          --text2: #777;
          --text3: #3a3a3a;
          --purple: #7B68EE;
          --purple-dim: #16142a;
          --green: #1D9E75;
          --green-dim: #091a14;
          --red: #E24B4A;
          --red-dim: #1f0e0e;
          --amber: #BA7517;
          --amber-dim: #1a1000;
          --coral: #D85A30;
          --coral-dim: #1f0d07;
          --safe-top: env(safe-area-inset-top, 0px);
          --safe-bottom: env(safe-area-inset-bottom, 0px);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { background: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; height: 100%; overflow: hidden; -webkit-text-size-adjust: 100%; }
        .app { display: flex; flex-direction: column; height: 100vh; height: 100dvh; max-width: 430px; margin: 0 auto; position: relative; overflow: hidden; }
        .grain { position: fixed; inset: 0; pointer-events: none; z-index: 999; opacity: 0.04; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"); background-size: 200px; }
        .sbar { display: flex; justify-content: space-between; align-items: center; padding: calc(var(--safe-top) + 14px) 18px 8px; flex-shrink: 0; }
        .sbar-time { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--text2); }
        .sbar-logo { font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--text3); }
        .sbar-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--green); animation: pulse 3s infinite; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.3} }
        .screens { flex: 1; overflow: hidden; }
        .scr { display: none; flex-direction: column; height: 100%; overflow-y: auto; padding: 8px 16px 0; scrollbar-width: none; }
        .scr::-webkit-scrollbar { display: none; }
        .scr.on { display: flex; }
        .pg-title { font-size: 28px; font-weight: 600; color: var(--text); line-height: 1.1; letter-spacing: -0.02em; }
        .pg-sub { font-size: 11px; color: var(--text2); margin-top: 2px; font-family: 'Space Mono', monospace; }
        .pg-head { margin-bottom: 16px; }
        .sec { font-size: 9px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; margin: 16px 0 8px; display: flex; align-items: center; gap: 8px; }
        .sec::after { content: ''; flex: 1; height: 0.5px; background: var(--border2); }
        .card { background: var(--bg2); border-radius: 12px; padding: 12px 14px; margin-bottom: 7px; border: 0.5px solid var(--border); cursor: pointer; transition: background 0.1s, transform 0.1s; text-decoration: none; display: block; color: var(--text); -webkit-user-select: none; }
        .card:active { background: var(--bg3); transform: scale(0.99); }
        .ev-row { display: flex; align-items: center; gap: 11px; }
        .ev-bar { width: 2.5px; border-radius: 2px; flex-shrink: 0; align-self: stretch; min-height: 30px; }
        .ev-body { flex: 1; min-width: 0; }
        .ev-time { font-size: 10px; color: var(--text2); font-family: 'Space Mono', monospace; margin-bottom: 2px; }
        .ev-title { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .urg-row { display: flex; align-items: center; justify-content: space-between; }
        .urg-t { font-size: 13px; font-weight: 500; }
        .urg-d { font-size: 10px; margin-top: 2px; font-family: 'Space Mono', monospace; color: var(--text2); }
        .pill { font-size: 9px; padding: 3px 9px; border-radius: 20px; font-weight: 600; white-space: nowrap; font-family: 'Space Mono', monospace; }
        .chk-group { background: var(--bg2); border-radius: 12px; border: 0.5px solid var(--border); padding: 3px 14px; margin-bottom: 7px; }
        .chk { display: flex; align-items: center; gap: 11px; padding: 10px 0; border-bottom: 0.5px solid var(--border); cursor: pointer; -webkit-user-select: none; }
        .chk:last-child { border-bottom: none; }
        .chk-c { width: 19px; height: 19px; border-radius: 50%; border: 1.5px solid var(--border2); flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .chk-c.done { background: var(--green); border-color: var(--green); }
        .chk-t { font-size: 13px; color: var(--text); flex: 1; font-weight: 400; }
        .chk-t.done { color: var(--text3); text-decoration: line-through; }
        .chk-b { font-size: 10px; color: var(--text3); font-family: 'Space Mono', monospace; }
        .prog-wrap { margin-bottom: 14px; }
        .prog-h { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .prog-lbl { font-size: 11px; color: var(--text2); }
        .prog-val { font-size: 11px; font-family: 'Space Mono', monospace; color: var(--green); }
        .prog-track { height: 3px; background: var(--border2); border-radius: 2px; }
        .prog-fill { height: 3px; border-radius: 2px; background: var(--green); transition: width 0.4s ease; }
        .post-h { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .post-t { font-size: 13px; font-weight: 500; color: var(--text); flex: 1; margin-right: 8px; }
        .post-cap { font-size: 11px; color: var(--text2); line-height: 1.5; }
        .stag { font-size: 9px; padding: 2px 8px; border-radius: 20px; white-space: nowrap; font-family: 'Space Mono', monospace; font-weight: 600; }
        .stat-g { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-bottom: 7px; }
        .stat-c { background: var(--bg2); border-radius: 12px; padding: 12px 14px; border: 0.5px solid var(--border); }
        .stat-v { font-size: 22px; font-weight: 600; color: var(--text); font-family: 'Space Mono', monospace; }
        .stat-l { font-size: 9px; color: var(--text2); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.08em; }
        .stat-d { font-size: 10px; margin-top: 5px; font-family: 'Space Mono', monospace; }
        .up { color: var(--green); } .dn { color: var(--red); }
        .chart-wrap { background: var(--bg2); border-radius: 12px; padding: 12px 14px; margin-bottom: 7px; border: 0.5px solid var(--border); }
        .chart-lbl { font-size: 9px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
        .bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 60px; }
        .bar { flex: 1; border-radius: 3px 3px 0 0; transition: height 0.4s; }
        .bar-label { font-size: 8px; color: var(--text3); text-align: center; margin-top: 4px; font-family: 'Space Mono', monospace; }
        .scr-end { height: 16px; flex-shrink: 0; }
        .cal-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .cal-month { font-size: 15px; font-weight: 600; color: var(--text); }
        .cal-nav { display: flex; gap: 6px; }
        .cal-btn { background: var(--bg2); border: 0.5px solid var(--border); border-radius: 7px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text2); transition: background 0.1s; }
        .cal-btn:active { background: var(--bg3); }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 14px; }
        .cal-dn { font-size: 9px; color: var(--text3); text-align: center; padding: 3px 0; text-transform: uppercase; letter-spacing: 0.06em; }
        .cal-day { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 1px; border-radius: 7px; cursor: pointer; min-height: 36px; transition: background 0.1s; }
        .cal-day:active { background: var(--bg3); }
        .cal-day.today .cal-num { background: var(--purple); color: #fff; border-radius: 50%; }
        .cal-day.sel { background: var(--purple-dim); }
        .cal-day.other .cal-num { color: var(--text3); }
        .cal-num { font-size: 12px; font-weight: 500; color: var(--text2); width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
        .cal-dots { display: flex; gap: 2px; justify-content: center; }
        .cal-dot { width: 3px; height: 3px; border-radius: 50%; }
        .day-evs { background: var(--bg2); border-radius: 12px; border: 0.5px solid var(--border); padding: 3px 14px; margin-bottom: 7px; }
        .day-ev { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 0.5px solid var(--border); }
        .day-ev:last-child { border-bottom: none; }
        .day-ev-bar { width: 2.5px; height: 30px; border-radius: 2px; flex-shrink: 0; }
        .day-ev-body { flex: 1; }
        .day-ev-time { font-size: 10px; color: var(--text2); font-family: 'Space Mono', monospace; }
        .day-ev-title { font-size: 13px; font-weight: 500; color: var(--text); }
        .no-evs { text-align: center; padding: 18px; font-size: 11px; color: var(--text3); font-family: 'Space Mono', monospace; }
        .task-card { background: var(--bg2); border-radius: 12px; padding: 12px 14px; margin-bottom: 7px; border: 0.5px solid var(--border); cursor: pointer; transition: background 0.1s; }
        .task-card:active { background: var(--bg3); }
        .task-row { display: flex; align-items: center; gap: 10px; }
        .task-title { font-size: 13px; font-weight: 500; color: var(--text); flex: 1; }
        .task-title.done { color: var(--text3); text-decoration: line-through; }
        .task-meta { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
        .task-badge { font-size: 9px; padding: 2px 7px; border-radius: 20px; font-family: 'Space Mono', monospace; }
        .task-note-icon { color: var(--text3); font-size: 11px; }
        .fab { position: fixed; bottom: calc(var(--safe-bottom) + 70px); right: 18px; width: 48px; height: 48px; border-radius: 50%; background: var(--purple); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 50; transition: transform 0.15s; }
        .fab:active { transform: scale(0.94); }
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; display: flex; flex-direction: column; justify-content: flex-end; }
        .modal { background: var(--bg2); border-radius: 20px 20px 0 0; padding: 20px 18px calc(var(--safe-bottom) + 20px); border-top: 0.5px solid var(--border2); }
        .modal-title { font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 16px; }
        .inp { background: var(--bg3); border: 0.5px solid var(--border2); border-radius: 9px; padding: 10px 13px; font-size: 13px; color: var(--text); font-family: 'Space Grotesk', sans-serif; width: 100%; outline: none; -webkit-appearance: none; margin-bottom: 10px; }
        .inp:focus { border-color: var(--purple); }
        .inp-label { font-size: 10px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; display: block; }
        .seg { display: flex; gap: 6px; margin-bottom: 10px; }
        .seg-btn { flex: 1; padding: 8px; border-radius: 8px; font-size: 11px; font-weight: 500; text-align: center; cursor: pointer; background: var(--bg3); border: 0.5px solid var(--border2); color: var(--text2); transition: all 0.1s; font-family: 'Space Grotesk', sans-serif; }
        .seg-btn.active { background: var(--purple-dim); border-color: var(--purple); color: var(--purple); }
        .btn-row { display: flex; gap: 8px; margin-top: 6px; }
        .btn { flex: 1; padding: 12px; border-radius: 10px; font-size: 13px; font-weight: 600; text-align: center; cursor: pointer; transition: all 0.1s; font-family: 'Space Grotesk', sans-serif; border: none; }
        .btn:active { transform: scale(0.98); }
        .btn-primary { background: var(--purple); color: #fff; }
        .btn-secondary { background: var(--bg3); color: var(--text2); }
        .detail-modal { background: var(--bg2); border-radius: 20px 20px 0 0; padding: 20px 18px calc(var(--safe-bottom) + 20px); border-top: 0.5px solid var(--border2); max-height: 70vh; overflow-y: auto; }
        .detail-title { font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
        .detail-meta { font-size: 11px; color: var(--text2); font-family: 'Space Mono', monospace; margin-bottom: 14px; }
        .detail-note { background: var(--bg3); border-radius: 9px; padding: 10px 13px; font-size: 12px; color: var(--text2); line-height: 1.6; margin-bottom: 14px; }
        .boris-advice { background: var(--purple-dim); border: 0.5px solid var(--purple); border-radius: 9px; padding: 10px 13px; font-size: 12px; color: #b8b0ff; line-height: 1.6; margin-bottom: 14px; }
        .boris-advice-lbl { font-size: 9px; color: var(--purple); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; font-weight: 600; }
        .boris-screen { display: flex; flex-direction: column; height: 100%; }
        .boris-msgs { flex: 1; overflow-y: auto; padding: 0 16px; scrollbar-width: none; }
        .boris-msgs::-webkit-scrollbar { display: none; }
        .boris-msg { margin-bottom: 10px; display: flex; flex-direction: column; }
        .boris-msg.user { align-items: flex-end; }
        .boris-msg.assistant { align-items: flex-start; }
        .boris-bubble { max-width: 85%; padding: 10px 13px; border-radius: 14px; font-size: 13px; line-height: 1.5; }
        .boris-msg.user .boris-bubble { background: var(--purple); color: #fff; border-radius: 14px 14px 3px 14px; }
        .boris-msg.assistant .boris-bubble { background: var(--bg2); border: 0.5px solid var(--border); color: var(--text); border-radius: 14px 14px 14px 3px; }
        .boris-input-row { display: flex; gap: 8px; padding: 10px 16px calc(var(--safe-bottom) + 10px); border-top: 0.5px solid var(--border); flex-shrink: 0; }
        .boris-input { flex: 1; background: var(--bg2); border: 0.5px solid var(--border2); border-radius: 20px; padding: 9px 14px; font-size: 13px; color: var(--text); font-family: 'Space Grotesk', sans-serif; outline: none; -webkit-appearance: none; }
        .boris-input:focus { border-color: var(--purple); }
        .boris-send { width: 36px; height: 36px; border-radius: 50%; background: var(--purple); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: transform 0.1s; border: none; }
        .boris-send:active { transform: scale(0.94); }
        .settings-section { background: var(--bg2); border-radius: 12px; border: 0.5px solid var(--border); padding: 14px; margin-bottom: 7px; }
        .s-lbl { font-size: 9px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 5px; display: block; font-weight: 600; }
        .s-info { font-size: 11px; color: var(--text3); line-height: 1.6; margin-top: 6px; }
        .s-btn { background: var(--purple-dim); border: 0.5px solid var(--purple); border-radius: 9px; padding: 11px; font-size: 13px; color: var(--purple); font-family: 'Space Grotesk', sans-serif; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.1s; margin-top: 10px; }
        .s-btn:active { background: var(--purple); color: #fff; }
        .status-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 0.5px solid var(--border); }
        .status-row:last-child { border-bottom: none; }
        .status-k { font-size: 12px; color: var(--text2); }
        .status-v { font-size: 11px; font-family: 'Space Mono', monospace; }
        .tab-bar { display: flex; background: var(--bg); border-top: 0.5px solid var(--border); padding: 6px 0 calc(var(--safe-bottom) + 6px); flex-shrink: 0; }
        .tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; padding: 4px 0; transition: opacity 0.1s; }
        .tab:active { opacity: 0.6; }
        .tab-ic { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: background 0.1s; color: var(--text3); }
        .tab.on .tab-ic { background: var(--bg3); color: var(--purple); }
        .tab-lbl { font-size: 8px; color: var(--text3); letter-spacing: 0.05em; font-weight: 500; }
        .tab.on .tab-lbl { color: var(--purple); }
        .toast-wrap { position: fixed; bottom: calc(var(--safe-bottom) + 80px); left: 50%; transform: translateX(-50%) translateY(${toast ? '0' : '20px'}); opacity: ${toast ? '1' : '0'}; transition: all 0.25s; pointer-events: none; z-index: 200; white-space: nowrap; }
        .toast-inner { background: var(--bg3); border: 0.5px solid var(--border2); border-radius: 20px; padding: 8px 16px; font-size: 12px; color: var(--text); font-family: 'Space Mono', monospace; }
        .loading { display: flex; align-items: center; justify-content: center; padding: 30px; }
        .spin { width: 20px; height: 20px; border: 2px solid var(--border2); border-top-color: var(--purple); border-radius: 50%; animation: rot 0.7s linear infinite; }
        @keyframes rot { to { transform: rotate(360deg); } }
        .not-connected { text-align: center; padding: 30px 20px; font-size: 12px; color: var(--text3); line-height: 1.8; font-family: 'Space Mono', monospace; }
        @media(min-width:430px){.app{border-left:0.5px solid var(--border);border-right:0.5px solid var(--border)}}
      `}</style>

      <div className="grain"/>

      <div className="app">
        {/* STATUS BAR */}
        <div className="sbar">
          <div className="sbar-time" id="clk">{now.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</div>
          <div className="sbar-logo">A Few Less</div>
          <div className="sbar-dot"/>
        </div>

        <div className="screens">

          {/* SCREEN 0: VANDAAG */}
          <div className={`scr${tab===0?' on':''}`}>
            <div className="pg-head">
              <div className="pg-title">{greeting}</div>
              <div className="pg-sub">{NL_DAYS_FULL[now.getDay()]} {now.getDate()} {NL_MONTHS_SHORT[now.getMonth()]} {now.getFullYear()}</div>
            </div>

            <div className="sec">Vandaag</div>
            {!connected ? <div className="not-connected">Voeg je Notion token toe<br/>in Instellingen</div> :
             loading ? <div className="loading"><div className="spin"/></div> :
             todayEvents.length === 0 ? <div className="not-connected">Geen A Few Less events vandaag</div> :
             todayEvents.map(e => (
              <div key={e.id} className="card">
                <div className="ev-row">
                  <div className="ev-bar" style={{background: COLORS[e.color]||COLORS.purple}}/>
                  <div className="ev-body">
                    <div className="ev-time">{e.time}</div>
                    <div className="ev-title">{e.title}</div>
                  </div>
                </div>
              </div>
            ))}

            <div className="sec">Urgent</div>
            <div className="card" onClick={()=>setTab(3)}>
              <div className="urg-row">
                <div><div className="urg-t" style={{color:'var(--red)'}}>Master opsturen</div><div className="urg-d">Deadline zo 19 april</div></div>
                <div className="pill" style={{background:'var(--red-dim)',color:'var(--red)'}}>{daysUntil('2026-04-19')}</div>
              </div>
            </div>
            <div className="card" onClick={()=>setTab(3)}>
              <div className="urg-row">
                <div><div className="urg-t" style={{color:'var(--purple)'}}>Spotify editorial pitch</div><div className="urg-d">Deadline zo 12 april</div></div>
                <div className="pill" style={{background:'var(--purple-dim)',color:'var(--purple)'}}>{daysUntil('2026-04-12')}</div>
              </div>
            </div>

            <div className="sec">Release voortgang</div>
            <div className="card" onClick={()=>setTab(3)}>
              <div className="prog-wrap" style={{marginBottom:0}}>
                <div className="prog-h"><div className="prog-lbl">Pure Gold — 24 april</div><div className="prog-val">{releaseDone} / {releaseKeys.length}</div></div>
                <div className="prog-track"><div className="prog-fill" style={{width:releasePct+'%'}}/></div>
              </div>
            </div>

            <div className="sec">Content</div>
            <div className="card" onClick={()=>setTab(2)}>
              <div className="urg-row">
                <div><div className="urg-t" style={{color:'var(--text)'}}>Content pipeline</div><div className="urg-d">{posts.length} posts — {posts.filter(p=>p.status==='📹 Te schieten').length} te schieten</div></div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round"><path d="M2 7h10M8 3l4 4-4 4"/></svg>
              </div>
            </div>

            <div className="scr-end"/>
          </div>

          {/* SCREEN 1: AGENDA */}
          <div className={`scr${tab===1?' on':''}`}>
            <div className="pg-head">
              <div className="pg-title">Agenda</div>
              <div className="pg-sub">{events.length} events — live uit Notion</div>
            </div>

            <div className="cal-hdr">
              <div className="cal-month">{NL_MONTHS[calMonth]} {calYear}</div>
              <div className="cal-nav">
                <div className="cal-btn" onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1)}else setCalMonth(m=>m-1)}}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 2L3 5l4 3"/></svg>
                </div>
                <div className="cal-btn" onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1)}else setCalMonth(m=>m+1)}}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 2l4 3-4 3"/></svg>
                </div>
              </div>
            </div>

            <div className="cal-grid">
              {['ma','di','wo','do','vr','za','zo'].map(d=><div key={d} className="cal-dn">{d}</div>)}
              {calDays.map(({date,other},i)=>{
                const ds = date.toISOString().split('T')[0]
                const evs = events.filter(e=>e.date===ds)
                return (
                  <div key={i} className={`cal-day${other?' other':''}${ds===todayStr?' today':''}${ds===selDate?' sel':''}`} onClick={()=>setSelDate(ds)}>
                    <div className="cal-num">{date.getDate()}</div>
                    {evs.length>0&&<div className="cal-dots">{evs.slice(0,3).map((e,j)=><div key={j} className="cal-dot" style={{background:COLORS[e.color]||COLORS.purple}}/>)}</div>}
                  </div>
                )
              })}
            </div>

            <div className="sec">{NL_DAYS[new Date(selDate+'T00:00:00').getDay()]} {new Date(selDate+'T00:00:00').getDate()} {NL_MONTHS_SHORT[new Date(selDate+'T00:00:00').getMonth()]}</div>
            {dayEvents.length===0 ? <div className="no-evs">Geen events op deze dag</div> :
            <div className="day-evs">
              {dayEvents.map(e=>(
                <div key={e.id} className="day-ev">
                  <div className="day-ev-bar" style={{background:COLORS[e.color]||COLORS.purple}}/>
                  <div className="day-ev-body">
                    <div className="day-ev-time">{e.time}</div>
                    <div className="day-ev-title">{e.title}</div>
                  </div>
                </div>
              ))}
            </div>}
            <div className="scr-end"/>
          </div>

          {/* SCREEN 2: CONTENT */}
          <div className={`scr${tab===2?' on':''}`}>
            <div className="pg-head">
              <div className="pg-title">Content</div>
              <div className="pg-sub">{posts.length} posts — videoband workflow</div>
            </div>
            {!connected ? <div className="not-connected">Voeg je Notion token toe in Instellingen</div> :
             loading ? <div className="loading"><div className="spin"/></div> :
             statusOrder.map(status => {
               const group = posts.filter(p=>p.status===status)
               if (!group.length) return null
               return (
                 <div key={status}>
                   <div className="sec">{status.replace(/^[^\s]+\s/,'')}</div>
                   {group.map(p=>(
                     <div key={p.id} className="card">
                       <div className="post-h">
                         <div className="post-t">{p.title}</div>
                         <div className="stag" style={{color:statusColors[p.status],background:statusColors[p.status]+'20'}}>{p.status.split(' ')[0]}</div>
                       </div>
                       <div className="post-cap">{p.caption}</div>
                       {statusNext[p.status] && statusNext[p.status] !== p.status && (
                         <div style={{marginTop:8,display:'flex',justifyContent:'flex-end'}}>
                           <div style={{fontSize:10,color:'var(--purple)',fontFamily:"'Space Mono',monospace",cursor:'pointer',padding:'3px 0'}} onClick={()=>updateContentStatus(p.id, statusNext[p.status])}>
                             → {statusNext[p.status].replace(/^[^\s]+\s/,'')}
                           </div>
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               )
             })
            }
            <div className="scr-end"/>
          </div>

          {/* SCREEN 3: RELEASE */}
          <div className={`scr${tab===3?' on':''}`}>
            <div className="pg-head">
              <div className="pg-title">Pure Gold</div>
              <div className="pg-sub">Release 24 april 2026</div>
            </div>
            <div className="prog-wrap">
              <div className="prog-h"><div className="prog-lbl">Voortgang</div><div className="prog-val">{releaseDone} / {releaseKeys.length} — {releasePct}%</div></div>
              <div className="prog-track"><div className="prog-fill" style={{width:releasePct+'%'}}/></div>
            </div>
            <div className="sec">Opnames</div>
            <div className="chk-group">
              {[['drums','Drums — Rick','za 11/4'],['bas','Bas — Tom','di 14/4'],['vocals','Vocals — Job','vandaag']].map(([k,t,b])=>(
                <div key={k} className="chk" onClick={()=>toggleCheck(k)}>
                  <div className={`chk-c${checks[k]?' done':''}`}>{checks[k]&&<svg width="10" height="7" viewBox="0 0 10 7" fill="none"><polyline points="1,3.5 4,6.5 9,1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
                  <div className={`chk-t${checks[k]?' done':''}`}>{t}</div>
                  <div className="chk-b">{b}</div>
                </div>
              ))}
            </div>
            <div className="sec">Mix & Master</div>
            <div className="chk-group">
              {[['mix1','Mix dag 1','wo 15/4'],['milan','Milan mixen','vr 17/4'],['export','Final export','za 18/4'],['master','Master opsturen','zo 19/4']].map(([k,t,b])=>(
                <div key={k} className="chk" onClick={()=>toggleCheck(k)}>
                  <div className={`chk-c${checks[k]?' done':''}`}>{checks[k]&&<svg width="10" height="7" viewBox="0 0 10 7" fill="none"><polyline points="1,3.5 4,6.5 9,1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
                  <div className={`chk-t${checks[k]?' done':''}`}>{t}</div>
                  <div className="chk-b">{b}</div>
                </div>
              ))}
            </div>
            <div className="sec">Release</div>
            <div className="chk-group">
              {[['pitch','Spotify editorial pitch','✓'],['distro','Upload distributie','zo 19/4'],['content-ok','Content pipeline gevuld','✓'],['live','Pure Gold live 24/4','vr 24/4']].map(([k,t,b])=>(
                <div key={k} className="chk" onClick={()=>toggleCheck(k)}>
                  <div className={`chk-c${checks[k]?' done':''}`}>{checks[k]&&<svg width="10" height="7" viewBox="0 0 10 7" fill="none"><polyline points="1,3.5 4,6.5 9,1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
                  <div className={`chk-t${checks[k]?' done':''}`}>{t}</div>
                  <div className="chk-b">{b}</div>
                </div>
              ))}
            </div>
            <div className="scr-end"/>
          </div>

          {/* SCREEN 4: TAKEN */}
          <div className={`scr${tab===4?' on':''}`}>
            <div className="pg-head">
              <div className="pg-title">Taken</div>
              <div className="pg-sub">{tasks.filter(t=>!t.done).length} open — gesorteerd op deadline</div>
            </div>
            {!connected ? <div className="not-connected">Voeg je Notion token toe in Instellingen</div> :
             loading ? <div className="loading"><div className="spin"/></div> :
             tasks.length === 0 ? <div className="not-connected">Geen taken — tik + om toe te voegen</div> :
             tasks.map(t=>(
              <div key={t.id} className="task-card" onClick={()=>openTaskDetail(t)}>
                <div className="task-row">
                  <div className={`task-title${t.done?' done':''}`}>{t.title}</div>
                  {t.note && <div className="task-note-icon">●</div>}
                </div>
                <div className="task-meta">
                  {t.priority&&<div className="task-badge" style={{background:t.priority==='Hoog'?'var(--red-dim)':t.priority==='Laag'?'var(--green-dim)':'var(--amber-dim)',color:t.priority==='Hoog'?'var(--red)':t.priority==='Laag'?'var(--green)':'var(--amber)'}}>{t.priority}</div>}
                  {t.deadline&&<div className="task-badge" style={{background:'var(--bg3)',color:'var(--text2)'}}>{t.deadline}</div>}
                </div>
              </div>
             ))
            }
            {tab===4&&connected&&(
              <div className="fab" onClick={()=>setShowTaskForm(true)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>
              </div>
            )}
            <div className="scr-end"/>
          </div>

          {/* SCREEN 5: STATS */}
          <div className={`scr${tab===5?' on':''}`}>
            <div className="pg-head">
              <div className="pg-title">Stats</div>
              <div className="pg-sub">A Few Less — week overzicht</div>
            </div>
            <div className="sec">Spotify</div>
            <div className="stat-g">
              <div className="stat-c"><div className="stat-v">{fmt(stats?.latest?.spotify_streams||1200)}</div><div className="stat-l">Streams week</div><div className="stat-d up">+12%</div></div>
              <div className="stat-c"><div className="stat-v">{fmt(stats?.latest?.spotify_listeners||340)}</div><div className="stat-l">Maand luisteraars</div><div className="stat-d up">+8%</div></div>
            </div>
            <div className="chart-wrap">
              <div className="chart-lbl">Spotify streams — 4 weken</div>
              <div className="bar-chart">
                {(stats?.stats||[{week:'W1',spotify:680},{week:'W2',spotify:890},{week:'W3',spotify:1050},{week:'W4',spotify:1200}]).map((s,i,arr)=>{
                  const max = Math.max(...arr.map(x=>x.spotify))
                  return <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <div className="bar" style={{height:Math.round(s.spotify/max*52)+'px',background:'var(--purple)',width:'100%'}}/>
                    <div className="bar-label">{s.week}</div>
                  </div>
                })}
              </div>
            </div>
            <div className="sec">Instagram</div>
            <div className="stat-g">
              <div className="stat-c"><div className="stat-v">{fmt(stats?.latest?.ig_reach||892)}</div><div className="stat-l">Bereik week</div><div className="stat-d dn">-3%</div></div>
              <div className="stat-c"><div className="stat-v">{fmt(stats?.latest?.ig_followers||1100)}</div><div className="stat-l">Volgers</div><div className="stat-d up">+14</div></div>
            </div>
            <div className="chart-wrap">
              <div className="chart-lbl">Instagram bereik — 4 weken</div>
              <div className="bar-chart">
                {(stats?.stats||[{week:'W1',ig:750},{week:'W2',ig:920},{week:'W3',ig:870},{week:'W4',ig:892}]).map((s,i,arr)=>{
                  const max = Math.max(...arr.map(x=>x.ig||892))
                  return <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <div className="bar" style={{height:Math.round((s.ig||892)/max*52)+'px',background:'var(--coral)',width:'100%'}}/>
                    <div className="bar-label">{s.week}</div>
                  </div>
                })}
              </div>
            </div>
            <div className="sec">TikTok</div>
            <div className="stat-g">
              <div className="stat-c"><div className="stat-v">{fmt(stats?.latest?.tt_views||3400)}</div><div className="stat-l">Views week</div><div className="stat-d up">+34%</div></div>
              <div className="stat-c"><div className="stat-v">{fmt(stats?.latest?.tt_followers||520)}</div><div className="stat-l">Volgers</div><div className="stat-d up">+22</div></div>
            </div>
            <div className="chart-wrap">
              <div className="chart-lbl">TikTok views — 4 weken</div>
              <div className="bar-chart">
                {(stats?.stats||[{week:'W1',tiktok:1200},{week:'W2',tiktok:1800},{week:'W3',tiktok:2600},{week:'W4',tiktok:3400}]).map((s,i,arr)=>{
                  const max = Math.max(...arr.map(x=>x.tiktok||3400))
                  return <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <div className="bar" style={{height:Math.round((s.tiktok||3400)/max*52)+'px',background:'var(--green)',width:'100%'}}/>
                    <div className="bar-label">{s.week}</div>
                  </div>
                })}
              </div>
            </div>
            <div className="scr-end"/>
          </div>

          {/* SCREEN 6: BORIS */}
          <div className={`scr${tab===6?' on':''}`} style={{padding:0}}>
            <div className="pg-head" style={{padding:'8px 16px 0'}}>
              <div className="pg-title">Boris</div>
              <div className="pg-sub">AI — altijd beschikbaar</div>
            </div>
            <div className="boris-screen">
              <div className="boris-msgs">
                {borisMessages.map((m,i)=>(
                  <div key={i} className={`boris-msg ${m.role}`}>
                    <div className="boris-bubble">{m.content}</div>
                  </div>
                ))}
                {borisLoading&&<div className="boris-msg assistant"><div className="boris-bubble" style={{color:'var(--text2)'}}>...</div></div>}
                <div ref={borisEndRef}/>
              </div>
              <div className="boris-input-row">
                <input className="boris-input" placeholder="Vraag Boris iets..." value={borisInput} onChange={e=>setBorisInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendBoris()}/>
                <button className="boris-send" onClick={sendBoris}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M2 7h10M8 3l4 4-4 4"/></svg>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* TAB BAR */}
        <div className="tab-bar">
          {tabs.map((t,i)=>(
            <div key={i} className={`tab${tab===i?' on':''}`} onClick={()=>setTab(i)}>
              <div className="tab-ic">{t.icon}</div>
              <div className="tab-lbl">{t.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TASK FORM MODAL */}
      {showTaskForm&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowTaskForm(false)}>
          <div className="modal">
            <div className="modal-title">Nieuwe taak</div>
            <label className="inp-label">Naam</label>
            <input className="inp" placeholder="Wat moet er gedaan worden?" value={taskForm.title} onChange={e=>setTaskForm(f=>({...f,title:e.target.value}))} autoFocus/>
            <label className="inp-label">Prioriteit</label>
            <div className="seg">
              {['Hoog','Midden','Laag'].map(p=>(
                <div key={p} className={`seg-btn${taskForm.priority===p?' active':''}`} onClick={()=>setTaskForm(f=>({...f,priority:p}))}>{p}</div>
              ))}
            </div>
            <label className="inp-label">Deadline</label>
            <input className="inp" type="date" value={taskForm.deadline} onChange={e=>setTaskForm(f=>({...f,deadline:e.target.value}))}/>
            <label className="inp-label">Notitie</label>
            <input className="inp" placeholder="Optioneel..." value={taskForm.note} onChange={e=>setTaskForm(f=>({...f,note:e.target.value}))}/>
            <div className="btn-row">
              <div className="btn btn-secondary" onClick={()=>setShowTaskForm(false)}>Annuleer</div>
              <div className="btn btn-primary" onClick={addTask}>Opslaan</div>
            </div>
          </div>
        </div>
      )}

      {/* TASK DETAIL MODAL */}
      {taskDetail&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setTaskDetail(null)}>
          <div className="detail-modal">
            <div className="detail-title">{taskDetail.title}</div>
            <div className="detail-meta">
              {taskDetail.priority&&`${taskDetail.priority} prioriteit`}
              {taskDetail.deadline&&` · deadline ${taskDetail.deadline}`}
            </div>
            {taskDetail.note&&<div className="detail-note">{taskDetail.note}</div>}
            <div className="boris-advice-lbl">Boris advies</div>
            <div className="boris-advice">{borisAdvice||'Advies laden...'}</div>
            <div className="btn-row">
              <div className="btn btn-secondary" onClick={()=>setTaskDetail(null)}>Sluiten</div>
              <div className="btn btn-primary" style={{background:taskDetail.done?'var(--bg4)':'var(--green)'}} onClick={async()=>{
                await fetch('/api/tasks',{method:'PATCH',headers:{'Content-Type':'application/json','x-notion-token':token},body:JSON.stringify({pageId:taskDetail.id,done:!taskDetail.done})})
                setTasks(prev=>prev.map(t=>t.id===taskDetail.id?{...t,done:!t.done}:t))
                setTaskDetail(null)
                showToast(taskDetail.done?'Taak heropend':'Taak afgevinkt ✓')
              }}>{taskDetail.done?'Heropenen':'Afvinken'}</div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS - render inline when tab 6 was settings, now its Boris. Let's add settings tab */}

      {/* TOAST */}
      <div className="toast-wrap">
        <div className="toast-inner">{toast}</div>
      </div>
    </>
  )
}
