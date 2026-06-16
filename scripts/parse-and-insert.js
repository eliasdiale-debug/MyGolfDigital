const { readFileSync, writeFileSync } = require('fs');

const path = require('path');
const raw = readFileSync(path.join(__dirname, 'handicap-data.txt'), 'utf8');
const lines = raw.split('\n').filter(l => l.trim());

// Parse line 1: Course names with slopes
const l1 = lines[0].split('\t');
const courses = [];
for (let i = 2; i < l1.length; i += 2) {
  const n = (l1[i] || '').trim();
  const s = parseInt((l1[i+1] || '').trim());
  if (n && !isNaN(s)) courses.push({ name: n, slope: s });
}

// Parse line 3: Dates with course ratings
const l3 = lines[2].split('\t');
const gInfo = [];
for (let i = 2; i < l3.length; i += 2) {
  const ds = (l3[i] || '').trim();
  const cr = parseFloat((l3[i+1] || '').trim().replace(',', '.'));
  if (!ds || isNaN(cr)) continue;
  const p = ds.split('-');
  if (p.length !== 3) continue;
  const mm = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
  const yr = parseInt(p[2]) < 50 ? '20'+p[2] : '19'+p[2];
  gInfo.push({ date: `${yr}-${mm[p[1]]||'01'}-${p[0].padStart(2,'0')}`, rating: cr });
}

const games = [];
for (let i = 0; i < Math.min(courses.length, gInfo.length); i++) {
  games.push({ ...courses[i], ...gInfo[i] });
}

console.log(`Games parsed: ${games.length}`);

// Course name -> ID
const cid = {"Akasia":1,"Benoni Country Club":2,"Blue Valley":6,"Bryanston":8,"CCJ Rocklands":10,"CCJ Woodmead":12,"CMR":15,"Centurion":13,"Copperleaf":16,"Dainfern":18,"ERPM":26,"Ebotse":23,"Emfuleni":25,"Euphoria":27,"Firethorn":29,"Glendower":32,"Glenvista":33,"Gowrie Farm":36,"Heron Banks":38,"Houghton":40,"Huddle Park":41,"Jackal Creek":44,"Kempton Park":45,"Killarney":46,"Krugersdorp":48,"Kyalami":49,"Magalies":53,"Modderfontein":56,"Observatory":59,"Paarl":61,"Parkview":62,"Pecanwood":64,"Pretoria Country Club":69,"Pretoria West":71,"Reading":72,"Royal JHB East":74,"Ruimsig":78,"Rustenburg":79,"San Lameer Country Club":80,"Serengeti":82,"Services":83,"Southdowns":86,"Soutpansberg Golf Club":87,"Soweto Country Club":88,"Steyn City":92,"Vaal De Grace":94,"Wanderers":95,"Waterkloof":97,"Wild Coast Sun":99,"Wild Coast Sun red":100,"Wingate":98,"Woodhill":101,"Zebula Country Club and Spa":102};

// Member name -> ID
const mid = {"Asaph Mokotjo":1,"Avhashoni Ramikosi":2,"Azwinndini Khampha":3,"Basil Mukwevho":4,"Bheki Mthethwa":5,"Brian Mathibe":6,"Caleb Motsamai":7,"Dan Raselomane":8,"Elias Diale":9,"Hlengani Mathebula":10,"Humbu Neswiswi":11,"Israel Sethuntsha":12,"Joe Ralebepa":13,"Katiso Mhlakaza":14,"Kgotso Lebotsa":15,"Khathutshelo Nedzamba":16,"Livhu Magidimisa":17,"Livingstone Mashele":18,"Mandla Mthethwa":19,"Mandla Ncube":20,"Mbuyiselo Ngcakani":21,"Moagi Mahapa":22,"Moeketsi Seboko":23,"Musandiwa Mudau":24,"Mveleli Booi":25,"Naph Nteo":26,"Nthumeni Wanga":27,"Oupa Ramaswiela":28,"Raymond Ndou":29,"Reynold Ngobese":30,"Sabatta Tsotetsi":31,"Sekete Mokgehle":32,"Shaldon Josephs":33,"Solly Mlondobozi":34,"Steve Mkhawane":35,"Sydney Mhlarhi":36,"Tebele Molata":37,"Tebogo Mokale":38,"Tendekai Chinyandura":39,"Thato Mahlamvu":40,"Tsepo Lepono":41,"Wofhatwa Ndou":42,"Xolani Makwabe":43};

const allRows = [];

for (let li = 3; li < lines.length; li++) {
  const cols = lines[li].split('\t');
  const name = (cols[1] || '').trim();
  const memberId = mid[name];
  if (!memberId) { console.log(`Skip: "${name}"`); continue; }

  const diffs = [];
  let gi = 0;
  // Data columns start at index 2, every 2 cols: diff, gross (we only need diff)
  for (let c = 2; c < cols.length && gi < games.length; c += 2, gi++) {
    const v = (cols[c] || '').trim().replace(',', '.').replace(/\s/g, '');
    if (!v || v === '-') continue;
    const d = parseFloat(v);
    if (isNaN(d) || d <= 0) continue;
    const g = games[gi];
    const courseId = cid[g.name];
    if (!courseId) continue;
    diffs.push({ member_id: memberId, game_date: g.date, course_id: courseId, course_rating: g.rating, slope_rating: g.slope, differential_value: d });
  }

  // Sort by date DESC and take 20 most recent
  diffs.sort((a, b) => b.game_date.localeCompare(a.game_date));
  const top20 = diffs.slice(0, 20);
  console.log(`${name} (${memberId}): ${diffs.length} diffs -> keeping ${top20.length}`);
  allRows.push(...top20);
}

console.log(`\nTotal rows: ${allRows.length}`);

// Generate SQL
const vals = allRows.map(r => `(${r.member_id},'${r.game_date}',${r.course_id},${r.course_rating},${r.slope_rating},${r.differential_value})`);

// Split into batches of 200
const batchSize = 200;
let sql = '';
for (let i = 0; i < vals.length; i += batchSize) {
  const batch = vals.slice(i, i + batchSize);
  sql += `INSERT INTO handicap_differentials (member_id,game_date,course_id,course_rating,slope_rating,differential_value) VALUES\n${batch.join(',\n')};\n\n`;
}

writeFileSync(path.join(__dirname, 'insert-differentials.sql'), sql);
console.log(`SQL written with ${Math.ceil(vals.length / batchSize)} batches`);
