// Vercel serverless function — YouTube Data API v3 proxy
// YOUTUBE_API_KEY lives only here, never exposed to the browser bundle.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'YOUTUBE_API_KEY not configured on server' });

  const { type, q, id } = req.query || {};

  try {
    if (type === 'search') {
      if (!q) return res.status(400).json({ error: 'Missing q' });
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=10&key=${apiKey}`;
      const upstream = await fetch(url);
      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        return res.status(upstream.status).json({ error: err?.error?.message || `YouTube error ${upstream.status}` });
      }
      const data = await upstream.json();
      const items = (data.items || []).map(i => ({
        id:      i.id.videoId,
        title:   i.snippet.title,
        channel: i.snippet.channelTitle,
        thumb:   i.snippet.thumbnails.medium?.url || `https://img.youtube.com/vi/${i.id.videoId}/mqdefault.jpg`,
      }));
      return res.status(200).json(items);
    }

    if (type === 'duration') {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${id}&key=${apiKey}`;
      const upstream = await fetch(url);
      if (!upstream.ok) return res.status(upstream.status).json({ error: `YouTube error ${upstream.status}` });
      const data = await upstream.json();
      const iso  = data.items?.[0]?.contentDetails?.duration || '';
      const m    = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const secs = m ? (+m[1]||0)*3600 + (+m[2]||0)*60 + (+m[3]||0) : 300;
      return res.status(200).json({ seconds: secs });
    }

    return res.status(400).json({ error: 'Invalid type. Use type=search or type=duration' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
