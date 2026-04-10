const { Client } = require('@notionhq/client')

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers['x-notion-token']
  if (!token) return res.status(401).json({ error: 'No token' })

  try {
    const notion = new Client({ auth: token })
        const dbId = process.env.AGENDA_DB_ID || '77b9494bd2f6456383197971b3f7acb4'

    const response = await notion.databases.query({
      database_id: dbId,
      sorts: [{ property: 'Datum', direction: 'ascending' }],
      page_size: 100,
    })

    const events = response.results.map(p => ({
      id: p.id,
      title: p.properties['Titel']?.title?.[0]?.plain_text || '',
      date: p.properties['Datum']?.date?.start || '',
      time: p.properties['Tijd']?.rich_text?.[0]?.plain_text || '',
      color: p.properties['Kleur']?.select?.name || 'purple',
    })).filter(e => e.date)

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ events })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
