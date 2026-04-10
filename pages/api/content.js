const { Client } = require('@notionhq/client')

export default async function handler(req, res) {
  const token = req.headers['x-notion-token']
  if (!token) return res.status(401).json({ error: 'No token' })

  try {
    const notion = new Client({ auth: token })
    const dbId = process.env.CONTENT_DB_ID || 'ec524bbc0481457aabe18c4cb910b06a'

    if (req.method === 'GET') {
      const response = await notion.databases.query({
        database_id: dbId,
        sorts: [{ property: 'Datum live', direction: 'ascending' }],
        page_size: 50,
      })

      const posts = response.results.map(p => ({
        id: p.id,
        title: p.properties['Post titel']?.title?.[0]?.plain_text || '',
        status: p.properties['Status']?.select?.name || '',
        caption: p.properties['Caption']?.rich_text?.[0]?.plain_text || '',
        date: p.properties['Datum live']?.date?.start || '',
        platform: p.properties['Platform']?.multi_select?.map(s => s.name) || [],
      }))

      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ posts })
    }

    if (req.method === 'PATCH') {
      const { pageId, status } = req.body
      await notion.pages.update({
        page_id: pageId,
        properties: { Status: { select: { name: status } } },
      })
      return res.status(200).json({ ok: true })
    }

    res.status(405).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
