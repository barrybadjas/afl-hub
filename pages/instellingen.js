import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

export default function Instellingen() {
    const [token, setToken] = useState('')
    const [saved, setSaved] = useState(false)
    const router = useRouter()

  useEffect(() => {
        const t = localStorage.getItem('afl-token') || ''
        setToken(t)
  }, [])

  function save() {
        if (!token.trim()) return
        localStorage.setItem('afl-token', token.trim())
        setSaved(true)
        setTimeout(() => { router.push('/') }, 1500)
  }

  return (
        <>
          <Head>
            <title>Instellingen — A Few Less Hub</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
            <meta name="apple-mobile-web-app-capable" content="yes"/>
            <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Space+Mono:wght@400&display=swap" rel="stylesheet"/>
    </Head>
        <style>{`
                *{margin:0;padding:0;box-sizing:border-box}
                        body{background:#080808;color:#e8e8e8;font-family:'Space Grotesk',sans-serif;min-height:100vh;padding:env(safe-area-inset-top,20px) 20px 40px}
                                .wrap{max-width:430px;margin:0 auto;padding-top:60px}
                                        .back{font-size:13px;color:#7B68EE;cursor:pointer;margin-bottom:30px;display:flex;align-items:center;gap:6px}
                                                h1{font-size:28px;font-weight:600;margin-bottom:6px}
                                                        .sub{font-size:12px;color:#444;font-family:'Space Mono',monospace;margin-bottom:40px}
                                                                .label{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;font-weight:600}
                                                                        .inp{width:100%;background:#111;border:.5px solid #222;border-radius:10px;padding:12px 14px;font-size:13px;color:#e8e8e8;font-family:'Space Mono',monospace;outline:none;-webkit-appearance:none}
                                                                                .inp:focus{border-color:#7B68EE}
                                                                                        .info{font-size:11px;color:#333;line-height:1.7;margin-top:8px;margin-bottom:30px}
                                                                                                .btn{width:100%;padding:14px;background:#7B68EE;border:none;border-radius:10px;font-size:14px;font-weight:600;color:#fff;font-family:'Space Grotesk',sans-serif;cursor:pointer;transition:opacity .15s}
                                                                                                        .btn:active{opacity:.8}
                                                                                                                .success{text-align:center;color:#1D9E75;font-size:13px;margin-top:16px;font-family:'Space Mono',monospace}
                                                                                                                      `}</style>
      <div className="wrap">
          <div className="back" onClick={() => router.push('/')}>← Terug naar hub</div>
        <h1>Instellingen</h1>
        <div className="sub">A Few Less Hub — koppel je Notion</div>
        <div className="label">Notion Integration Token</div>
        <input className="inp" type="password" placeholder="ntn_..." value={token} onChange={e => setToken(e.target.value)} autoComplete="off"/>
          <div className="info">Ga naar notion.so/my-integrations → kopieer je Internal Integration Secret. Deel dit NOOIT in de chat met Boris.</div>
        <button className="btn" onClick={save}>{saved ? 'Opgeslagen ✓' : 'Opslaan & verbinden'}</button>
{saved && <div className="success">Verbonden — terug naar hub...</div>}
  </div>
  </>
   )
}
