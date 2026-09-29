// Vercel Serverless Function to Scrape Live Solar Companies & Leads by Area/Keyword
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const location = body.location || body.city || 'Ahmedabad';
    const keyword = body.keyword || 'solar EPC companies';
    const centerLat = body.lat || 23.0225;
    const centerLon = body.lon || 72.5714;

    const queries = [
      `${keyword} in ${location}`,
      `solar rooftop installers in ${location}`,
      `solar dealers inverter shops ${location}`
    ];

    const leads = [];
    const seenNames = new Set();

    for (const q of queries) {
      if (leads.length >= 20) break;
      try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const fetchRes = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html'
          }
        });

        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const regex = /<h2 class="result__title">[\s\S]*?<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
          let match;

          while ((match = regex.exec(html)) !== null && leads.length < 25) {
            const rawUrl = match[1];
            let actualUrl = rawUrl;
            if (rawUrl.includes('uddg=')) {
              const parts = rawUrl.split('uddg=');
              actualUrl = decodeURIComponent(parts[1].split('&')[0]);
            }

            const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
            const snippet = match[3].replace(/<[^>]+>/g, '').trim();

            // Filter out generic aggregator directories or irrelevant pages
            if (
              actualUrl.includes('wikipedia.org') ||
              actualUrl.includes('youtube.com') ||
              actualUrl.includes('facebook.com') ||
              rawTitle.toLowerCase().includes('what is solar')
            ) {
              continue;
            }

            // Clean title to extract company name
            let cleanName = rawTitle
              .split('|')[0]
              .split('—')[0]
              .split('–')[0]
              .split(' - ')[0]
              .replace(/Top \d+.*in /i, '')
              .replace(/Best \d+.*in /i, '')
              .replace(/Popular /i, '')
              .replace(/#1 /i, '')
              .trim();

            if (!cleanName || cleanName.length < 3 || seenNames.has(cleanName.toLowerCase())) {
              continue;
            }
            seenNames.add(cleanName.toLowerCase());

            // Extract phone number ONLY if authentically present in snippet
            const phoneMatch = snippet.match(/(?:\+91[\-\s]?)?[6-9]\d{9}|\b0\d{2,4}[\-\s]?\d{6,8}\b/);
            const extractedPhone = phoneMatch ? phoneMatch[0] : null;

            // Determine category based on snippet keywords
            const lowerSnippet = snippet.toLowerCase() + ' ' + rawTitle.toLowerCase();
            let category = 'Solar EPC Contractor & Installer';
            let type = 'epc';

            if (lowerSnippet.includes('inverter') || lowerSnippet.includes('battery') || lowerSnippet.includes('shop') || lowerSnippet.includes('hardware')) {
              category = 'Solar Inverter & Battery Shop';
              type = 'shop';
            } else if (lowerSnippet.includes('distributor') || lowerSnippet.includes('dealer') || lowerSnippet.includes('modules')) {
              category = 'Authorized Solar Module Distributor';
              type = 'dealer';
            }

            leads.push({
              id: `SCRAPE-${Date.now()}-${leads.length}`,
              name: cleanName,
              category: category,
              type: type,
              phone: extractedPhone,
              email: null,
              address: `${location}, Gujarat`,
              city: location,
              lat: Number(centerLat),
              lon: Number(centerLon),
              distanceKm: 0,
              speciality: snippet.slice(0, 140) + (snippet.length > 140 ? '...' : ''),
              website: actualUrl,
              source: 'Web Search Intelligence',
              rating: null,
              reviewsCount: null,
              verified: false,
              isScraped: true
            });
          }
        }
      } catch (err) {
        console.error('Error fetching query:', q, err.message);
      }
    }

    return res.status(200).json({
      success: true,
      location,
      keyword,
      count: leads.length,
      leads: leads.sort((a, b) => a.distanceKm - b.distanceKm)
    });
  } catch (error) {
    console.error('Scraper handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
