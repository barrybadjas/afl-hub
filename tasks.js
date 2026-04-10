const { Client } = require('@notionhq/client')

const TASKS_DB = process.env.TASKS_DB_ID || ''

export default async function handler(req, res) {
  const token = req.headers['x-notion-token']
  if (!token) return res.status(401).json({ error: 'No token' })

  const notion = new Client({ auth: token })

  try {
    if (req.method === 'GET') {
      if (!TASKS_DB) return res.status(200).json({ tasks: [] })
      const response = await notion.databases.query({
        database_id: TASKS_DB,
        sorts: [{ property: 'Deadline', direction: 'ascending' }],
        page_size: 50,
      })
      const tasks = response.results.map(p => ({
        id: p.id,
        title: p.properties['Naam']?.title?.[0]?.plain_text || '',
        priority: p.properties['Prioriteit']?.select?.name || 'Midden',
        deadline: p.properties['Deadline']?.date?.start || '',
        note: p.properties['Notitie']?.rich_text?.[0]?.plain_text || '',
        done: p.properties['Klaar']?.checkbox || false,
      }))
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ tasks })
    }

    if (req.method === 'POST') {
      if (!TASKS_DB) return res.status(400).json({ error: 'No tasks DB configured' })
      const { title, priority, deadline, note } = req.body
      const props = {
        'Naam': { title: [{ text: { content: title } }] },
        'Prioriteit': { select: { name: priority || 'Midden' } },
        'Klaar': { checkbox: false },
      }
      if (deadline) props['Deadline'] = { date: { start: deadline } }
      if (note) props['Notitie'] = { rich_text: [{ text: { content: note } }] }
      const page = await notion.pages.create({
        parent: { database_id: TASKS_DB },
        properties: props,
      })
      return res.status(200).json({ ok: true, id: page.id })
    }

    if (req.method === 'PATCH') {
      const { pageId, done } = req.body
      await notion.pages.update({
        page_id: pageId,
        properties: { 'Klaar': { checkbox: done } },
      })
      return res.status(200).json({ ok: true })
    }

    res.status(405).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
