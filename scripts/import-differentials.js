const { readFileSync, writeFileSync } = require('fs');

// Read the pasted text file
const raw = readFileSync('scripts/handicap-data.txt', 'utf8');
const lines = raw.split('\n').filter(l => l.trim());

// Parse line 1: Course names and slope ratings (tab-separated)
// Format: tab tab CourseA tab SlopeA tab CourseB tab SlopeB ...
const line1Parts = lines[0].split('\t');
const courses = [];
for (let i = 2; i < line1Parts.length; i += 2) {
  const name = line1Parts[i]?.trim();
  const slope = line1Parts[i + 1]?.trim();
  if (name && slope) {
    courses.push({ name, slope: parseInt(slope) });
  }
}

// Parse line 3: Dates and course ratings
// Format: tab tab DateA tab RatingA tab DateB tab RatingB ...
const line3Parts = lines[2].split('\t');
const gameInfo = [];
for (let i = 2; i < line3Parts.length; i += 2) {
  const dateStr = line3Parts[i]?.trim();
  const ratingStr = line3Parts[i + 1]?.trim().replace(',', '.');
  if (dateStr && ratingStr) {
    // Parse date like "08-Nov-24" -> "2024-11-08"
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
      const month = monthMap[parts[1]] || '01';
      const year = parseInt(parts[2]) < 50 ? `20${parts[2]}` : `19${parts[2]}`;
      gameInfo.push({ date: `${year}-${month}-${day}`, rating: parseFloat(ratingStr) });
    }
  }
}

// Build game entries combining courses and dates
const games = [];
for (let i = 0; i < Math.min(courses.length, gameInfo.length); i++) {
  games.push({
    courseName: courses[i].name,
    slopeRating: courses[i].slope,
    date: gameInfo[i].date,
    courseRating: gameInfo[i].rating
  });
}

console.log(`Parsed ${games.length} games`);
console.log('First 3 games:', JSON.stringify(games.slice(0, 3)));
console.log('Last 3 games:', JSON.stringify(games.slice(-3)));

// Course name -> course_id mapping
const courseMap = {"Akasia":1,"Benoni Country Club":2,"Benoni Lake Club":3,"Blair Athol":4,"Bloemfontein Golf Club":5,"Blue Valley":6,"Bronkorspruit":7,"Bryanston":8,"Bushwillow":9,"CCJ Rocklands":10,"CCJ Woodlands":11,"CCJ Woodmead":12,"Centurion":13,"Champagne Sports":14,"CMR":15,"Copperleaf":16,"Cullinan":17,"Dainfern":18,"Dainfern - Blue":19,"De Zalze":20,"Durban Country Club":21,"Eagle Canyon":22,"Ebotse":23,"Elements":24,"Emfuleni":25,"ERPM":26,"Euphoria":27,"Eye of Africa":28,"Firethorn":29,"Gary Player":30,"Germiston":31,"Glendower":32,"Glenvista":33,"Goldfields West":34,"Goose Valley":35,"Gowrie Farm":36,"Graceland":37,"Heron Banks":38,"Highland":39,"Houghton":40,"Huddle Park":41,"Humewood":42,"Irene CC":43,"Jackal Creek":44,"Kempton Park":45,"Killarney":46,"Koro Creek":47,"Krugersdorp":48,"Kyalami":49,"Leeuwkop":50,"Lost City":51,"Maccauvlei":52,"Magalies":53,"Magalies Blue":54,"Magalies Red":55,"Modderfontein":56,"Mooinooi":57,"Nkonyeni":58,"Observatory":59,"Oppenheimer Park Golf Club":60,"Paarl":61,"Parkview":62,"Pearl Valley":63,"Pecanwood":64,"Pezula":65,"Pinnacle point":66,"Polokwane Golf Club":67,"Potchefstroom":68,"Pretoria Country Club":69,"Pretoria Golf Club":70,"Pretoria West":71,"Reading":72,"Riviera on Vaal":73,"Royal JHB East":74,"Royal JHB West":75,"Royal Oak":76,"Royal Swazi":77,"Ruimsig":78,"Rustenburg":79,"San Lameer Country Club":80,"Seasons":81,"Serengeti":82,"Services":83,"Silverlakes":84,"Simola":85,"Southdowns":86,"Soutpansberg Golf Club":87,"Soweto Country Club":88,"State Mines":89,"Steenberg":90,"Stellenbosch":91,"Steyn City":92,"St Francis Links":93,"Vaal De Grace":94,"Wanderers":95,"Wanderers Yellow":96,"Waterkloof":97,"Wingate":98,"Wild Coast Sun":99,"Wild Coast Sun red":100,"Woodhill":101,"Zebula Country Club and Spa":102,"Zimbali":103,"Zwartkop":104};

// Member number -> member_id mapping (from the data: number in column 1 maps to member)
const memberMap = {1:1, 2:2, 3:3, 4:4, 5:5, 6:7, 7:8, 8:9, 9:10, 10:11, 11:12, 12:13, 13:14, 14:15, 15:16, 16:17, 17:18, 18:19, 19:20, 20:21, 21:22, 22:23, 23:24, 24:25, 25:26, 26:27, 27:28, 28:29, 29:30, 30:31, 31:32, 32:33, 33:34, 34:35, 35:36, 36:37, 37:38, 38:39, 39:40, 40:41, 41:42, 42:43};

// Actually, looking at lines 4+, the format is:
// memberNumber tab memberName tab diff1 tab gross1 tab diff2 tab gross2 ...
// Member numbers in the file map to actual member names. Let me map by name.
const memberNameToId = {"Asaph Mokotjo":1,"Avhashoni Ramikosi":2,"Azwinndini Khampha":3,"Basil Mukwevho":4,"Bheki Mthethwa":5,"Brian Mathibe":6,"Caleb Motsamai":7,"Dan Raselomane":8,"Elias Diale":9,"Hlengani Mathebula":10,"Humbu Neswiswi":11,"Israel Sethuntsha":12,"Joe Ralebepa":13,"Katiso Mhlakaza":14,"Kgotso Lebotsa":15,"Khathutshelo Nedzamba":16,"Livhu Magidimisa":17,"Livingstone Mashele":18,"Mandla Mthethwa":19,"Mandla Ncube":20,"Mbuyiselo Ngcakani":21,"Moagi Mahapa":22,"Moeketsi Seboko":23,"Musandiwa Mudau":24,"Mveleli Booi":25,"Naph Nteo":26,"Nthumeni Wanga":27,"Oupa Ramaswiela":28,"Raymond Ndou":29,"Reynold Ngobese":30,"Sabatta Tsotetsi":31,"Sekete Mokgehle":32,"Shaldon Josephs":33,"Solly Mlondobozi":34,"Steve Mkhawane":35,"Sydney Mhlarhi":36,"Tebele Molata":37,"Tebogo Mokale":38,"Tendekai Chinyandura":39,"Thato Mahlamvu":40,"Tsepo Lepono":41,"Wofhatwa Ndou":42,"Xolani Makwabe":43};

// Parse member rows (lines 4+, which is index 3+)
const allInserts = [];

for (let lineIdx = 3; lineIdx < lines.length; lineIdx++) {
  const parts = lines[lineIdx].split('\t');
  const memberNum = parts[0]?.trim();
  const memberName = parts[1]?.trim();
  
  if (!memberName || !memberNameToId[memberName]) {
    console.log(`Skipping line ${lineIdx + 1}: no member match for "${memberName}"`);
    continue;
  }
  
  const memberId = memberNameToId[memberName];
  
  // Parse differentials: starts at index 2, every 2 columns (diff, gross, diff, gross, ...)
  const memberDiffs = [];
  let gameIdx = 0;
  for (let col = 2; col < parts.length; col += 2) {
    if (gameIdx >= games.length) break;
    
    const diffStr = parts[col]?.trim().replace(',', '.').replace(/\s/g, '');
    
    if (diffStr && diffStr !== '-' && diffStr !== '') {
      const diffValue = parseFloat(diffStr);
      if (!isNaN(diffValue) && diffValue > 0) {
        const game = games[gameIdx];
        const courseId = courseMap[game.courseName];
        if (courseId) {
          memberDiffs.push({
            member_id: memberId,
            game_date: game.date,
            course_id: courseId,
            course_rating: game.courseRating,
            slope_rating: game.slopeRating,
            differential_value: diffValue
          });
        }
      }
    }
    gameIdx++;
  }
  
  // Take only the 20 most recent (they're already ordered by date in the spreadsheet, newest first based on how games are ordered)
  // Actually games appear to be oldest first based on dates. Sort by date DESC and take first 20.
  memberDiffs.sort((a, b) => b.game_date.localeCompare(a.game_date));
  const top20 = memberDiffs.slice(0, 20);
  
  console.log(`${memberName} (id=${memberId}): ${memberDiffs.length} total diffs, keeping ${top20.length}`);
  allInserts.push(...top20);
}

console.log(`\nTotal inserts: ${allInserts.length}`);

// Generate SQL
let sql = `-- Clear existing differentials\nDELETE FROM handicap_differentials;\n\n`;
sql += `-- Insert 20 most recent differentials per member\n`;
sql += `INSERT INTO handicap_differentials (member_id, game_date, course_id, course_rating, slope_rating, differential_value) VALUES\n`;

const values = allInserts.map(r => 
  `(${r.member_id}, '${r.game_date}', ${r.course_id}, ${r.course_rating}, ${r.slope_rating}, ${r.differential_value})`
);

sql += values.join(',\n') + ';\n';

// Write to file
writeFileSync('scripts/insert-differentials.sql', sql);
console.log('\nSQL written to scripts/insert-differentials.sql');
