// shared.js — Constants and utilities shared by map and project pages

const API_BASE = 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/travaux_equipements_publics/records';
const LIMIT = 100;

const SECTOR_COLORS = {
  'Petite Enfance': '#f472b6',
  'Éducation':      '#60a5fa',
  'Sports':         '#34d399',
  'Patrimoine':     '#fbbf24',
  'Logement':       '#a78bfa',
  'Propreté':       '#fb923c',
  'Environnement':  '#4ade80',
  'Culture':        '#f87171',
};

function getColor(sector) {
  return SECTOR_COLORS[sector] || '#6366f1';
}

function getArrondissement(record) {
  const cp = record.code_postal;
  if (!cp) return null;
  const num = parseInt(cp.slice(-2), 10);
  if (isNaN(num) || num < 1 || num > 20) return null;
  return num <= 1 ? `${num}er` : `${num}e`;
}

function normalizeConstruction(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();

  const rules = [
    [/accessibilit/,               'Accessibilité'],
    [/performance.?energe|economie.?d.?energie|confort.?d.?ete|energie/, 'Performance énergétique'],
    [/isol[ea]|insonori|etancheite|phonique/, 'Isolation / Étanchéité'],
    [/vegetali/,                    'Végétalisation'],
    [/restructur|mise aux normes/,  'Restructuration'],
    [/renovation|renovacao/,        'Rénovation'],
    [/modernisation/,               'Modernisation'],
    [/ravalement|facade/,           'Ravalement'],
    [/securis|securite/,            'Sécurisation'],
    [/embelliss/,                   'Embellissement'],
    [/amelioration|reamenagement/,  'Amélioration fonctionnelle'],
    [/construction|creation|cretion|pavillon/, 'Construction neuve'],
    [/couverture/,                  'Couverture'],
  ];
  for (const [re, label] of rules) {
    if (re.test(s)) return label;
  }
  return 'Autre';
}

function normalizeService(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (/^se$/i.test(s)) return 'SE';
  if (/^samo$/i.test(s)) return 'SAMO';
  if (/^slt$/i.test(s)) return 'SLT';
  const m = s.match(/^SLA\s*(.+)$/i);
  if (!m) return s;
  let rest = m[1].trim().replace(/-/g, '/');
  if (/^centre$/i.test(rest)) return 'SLA Centre';
  rest = rest.replace(/\s*\/\s*/g, '/');
  // Handle digit-only cases like "715" → "7/15"
  if (/^\d{3,}$/.test(rest)) {
    const nums = [];
    let i = 0;
    while (i < rest.length) {
      const two = parseInt(rest.slice(i, i + 2), 10);
      if (i + 1 < rest.length && two >= 10 && two <= 20) {
        nums.push(two);
        i += 2;
      } else {
        nums.push(parseInt(rest[i], 10));
        i += 1;
      }
    }
    rest = nums.join('/');
  }
  return `SLA ${rest}`;
}

async function fetchAll() {
  let offset = 0;
  let records = [];
  while (true) {
    const url = `${API_BASE}?limit=${LIMIT}&offset=${offset}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.results || data.results.length === 0) break;
    records = records.concat(data.results);
    if (records.length >= data.total_count) break;
    offset += LIMIT;
  }
  records.forEach(r => {
    r._arrondissement = getArrondissement(r);
    r._constructionGroup = normalizeConstruction(r.type_construction);
    r._service = normalizeService(r.service);
  });
  return records;
}

function getSatelliteUrl(record) {
  const geo = record.geo_point_2d;
  if (!geo || geo.lat == null || geo.lon == null) return null;
  const lat = geo.lat, lon = geo.lon;
  const xmin = lon - 0.001;
  const xmax = lon + 0.001;
  const ymin = lat - 0.00075;
  const ymax = lat + 0.00075;
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${xmin},${ymin},${xmax},${ymax}&bboxSR=4326&size=400,280&f=image`;
}

function formatBudget(record) {
  if (!record.budget) return '—';
  const num = parseInt(record.budget.replace(/\s/g, ''), 10);
  if (isNaN(num)) return '—';
  return num.toLocaleString('fr-FR') + ' €';
}
