export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { messages, context } = req.body

  const systemPrompt = `Je bent Boris, de persoonlijke AI-assistent van Job Oosterbaan van het indie muziekduo A Few Less. Je kent de band door en door:

- A Few Less is een artiestenDuo: Job (eindverantwoordelijke) en Milan (50/50 partner)
- Manager: Olivier (eigen dashboard)
- Drummer: Rick | Basgitarist: Tom | Promoter: Chayen (later)
- Alle content wordt gefilmd op videoband — dit is de signature stijl
- Digitaliseren kost evenveel tijd als filmen
- Pure Gold is de aankomende single, release 24 april 2026
- Muziekstijl: indie, cinematisch, VHS-esthetiek, melancholisch

Jij beheert:
- Agenda (via Notion sync met Apple Agenda)
- Content pipeline
- Release planning
- Taken en strategie

Praat altijd in het Nederlands. Wees direct, strategisch en praktisch. Je kent Job zijn agenda en planning.

${context ? `Huidige context:\n${context}` : ''}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages || [],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    res.status(200).json({ reply: text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
