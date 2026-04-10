const { Client } = require('@notionhq/client')

const STATS_DB = process.env.STATS_DB_ID || ''

export default async function handler(req, res) {
  const token = req.headers['x-notion-token']
  if (!token) return res.status(401).json({ error: 'No token' })

  const notion = new Client({ auth: token })

  try {
    if (req.method === 'GET') {
      if (!STATS_DB) {
        return res.status(200).json({
          stats: [
            { week: 'W1', spotify: 680, ig: 750, tiktok: 1200 },
            { week: 'W2', spotify: 890, ig: 920, tiktok: 1800 },
            { week: 'W3', spotify: 1050, ig: 870, tiktok: 2600 },
            { week: 'W4', spotify: 1200, ig: 892, tiktok: 3400 },
          ],
          latest: { spotify_streams: 1200, spotify_listeners: 340, ig_reach: 892, ig_followers: 1100, tt_views: 3400, tt_followers: 520 }
        })
      }
      return res.status(200).json({ stats: [], latest: {} })
    }

    res.status(405).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
