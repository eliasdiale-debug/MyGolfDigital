import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Game metadata ──────────────────────────────────────────────────────────
const GAMES = [
  { date: '2026-01-14', courseId: 69, courseName: 'Pretoria Country Club', par: 72, teeTime: '07:00' },
  { date: '2026-01-21', courseId: 10, courseName: 'CCJ Rocklands',         par: 72, teeTime: '07:00' },
  { date: '2026-01-28', courseId: 101, courseName: 'Woodhill',              par: 72, teeTime: '07:00' },
  { date: '2026-02-04', courseId: 95,  courseName: 'Wanderers',             par: 71, teeTime: '07:00' },
  { date: '2026-02-11', courseId: 72,  courseName: 'Reading',               par: 72, teeTime: '07:00' },
  { date: '2026-02-18', courseId: 49,  courseName: 'Kyalami',               par: 72, teeTime: '07:00' },
  { date: '2026-02-25', courseId: 12,  courseName: 'CCJ Woodmead',          par: 72, teeTime: '07:00' },
  { date: '2026-03-04', courseId: 62,  courseName: 'Parkview',              par: 72, teeTime: '07:00' },
  { date: '2026-03-11', courseId: 13,  courseName: 'Centurion',             par: 72, teeTime: '07:00' },
];

// ── Member name → ID map ───────────────────────────────────────────────────
const MEMBERS = {
  "Abbey Dikgale": 462, "Abduragmaan Baulackey": 443, "Akbar Gani": 475,
  "Alex Kensen": 484, "Alfred Aygei": 440, "Alfred Maredi": 551,
  "Allen Mutono": 639, "Amagyei Banson": 442, "Andi Dill": 463,
  "Andile Keta": 485, "Andisiwe Tingo": 729, "Andre de Jager": 454,
  "Archie Ntim": 671, "Armstrong Ndlela": 649, "Armstrong Ngcobo": 653,
  "Arthur Fernando": 472, "Ashley Ramafoko": 744, "Awore Taigbenu": 720,
  "Bafedile Masele": 555, "Banele Mhlahlo": 577, "Bathabile Ramatong": 690,
  "Ben Khumalo B": 492, "Ben Nkosi": 662, "Boitumelo Moloko": 609,
  "Bonga Dlamini": 465, "Bongani (Bora) Rayi": 693, "Bongani Godlwana": 476,
  "Bongani Mahlangu B": 529, "Bongani Mshibe": 628, "Bonolo Modise": 588,
  "Boyce Mkhize B": 581, "Boyo Diketso": 461, "Bruce Diale B": 459,
  "Buntu Manitshana": 547, "Carl Thobejane": 725, "Chief Mosikara": 618,
  "Chimane Lelaka": 504, "Christian Mbanga": 571, "Chuene Moloto C": 610,
  "Clifford Makoloane": 541, "Cohen Shikwambane": 709, "Connie Monageng": 612,
  "Cornelious Ngcukana": 654, "Daniel Chiwandamira": 452, "David Kau": 482,
  "David Malaza": 543, "David Oupa Pooe": 686, "David Rakotsoane": 688,
  "Deane Hiine": 480, "Demist Mogafe": 592, "Diamond Kekana": 483,
  "Dingaan  Khumalo D": 493, "Ditiro Tone": 731, "Edwin Bogopa": 447,
  "Edwin Makhothi": 538, "Elias Diale": 458, "Elijah Maseko E": 552,
  "Elliot Mokoena": 603, "Emmanuel Maseko EM": 553, "Emson Moyo": 625,
  "Ernest Mahlaule": 532, "Eutycuss Mathebula": 562, "Felix Ndlovu": 650,
  "Fezile Nondonga": 667, "Fidelis Madavo": 520, "Fortune Mojapelo": 599,
  "Francis Magero": 525, "Gaba Tabane": 719, "Gary Nemudzivhade": 651,
  "Gastin Fenton": 471, "Given Mutshena": 640, "Godfrey Mwiinga": 641,
  "Goitsione Modise": 589, "Greg Mojela": 600, "Helman Mkhalele": 579,
  "Herman Mmaudu": 583, "Ike Ngwena": 658, "Issac Kgafela": 486,
  "Itumeleng Matsobane": 565, "Itumeleng Oliphant": 742, "Jabu Sithole": 717,
  "Jacob Mokhanda": 602, "Jacques Mazima": 570, "James Mapunda": 550,
  "Jan Morudu": 616, "Jeff Moloto J": 611, "Jerry Zungu": 740,
  "Jimmy Tau": 722, "Joe Asamoah": 439, "Joe Mazibuko J": 569,
  "Joe Seoloane J": 704, "Johannes Manamela": 545, "John Rockson": 696,
  "Jomo Mabilo": 514, "Joshua Baganzi": 441, "Kabelo Mashiko": 557,
  "Karabo Seoloane K": 705, "Katlego Chabalala": 451, "Kenneth Mohlala": 594,
  "Kenny Mokoka": 604, "Kevin Wotshela": 738, "Khomotso Sekhabisa": 702,
  "Khumbu Ndebele": 647, "Khumbulani Gumede": 477, "Khutso Sekgota": 701,
  "Kingsley  Ncaba": 645, "Kiran Bhika": 446, "Kwanele Mazibuko": 568,
  "Langa Nxumalo L": 677, "Larry Kgatle": 487, "Lebeko Madikgetla": 523,
  "Lebo Tlomatsane": 730, "Lee-John Maans": 511, "Lekopane Mokonopi": 605,
  "Leon Langa L": 501, "Leornard Masilela": 558, "Lesedi Sennelo": 703,
  "Lesiba Ramashala": 689, "Lester Pietersen": 685, "Lethabo Leoto": 507,
  "Letlhogonolo Moroeng": 615, "Liepollo Msimang": 630, "Linda Jakavula": 481,
  "Lindile Nojontsholo": 666, "Lindiwe Klaaste": 498, "Litha Nyhonyha": 680,
  "Londani Msimang": 629, "Lukhanyo Ntshobodwana": 674, "Lunga Kupiso": 500,
  "Lungile Ludada": 510, "Lungile Madela": 521, "Lungile Mushwana": 638,
  "Luvuyo Makatesi": 536, "Luvuyo Mgolodela": 576, "Lwandiso Matoti": 564,
  "Lyborn Mashava": 556, "Maditsi Lekota": 503, "Mafika Thusi": 728,
  "Magz Khomane": 489, "Makgalaija Phokanoka": 684, "Malesela Montja": 613,
  "Malethole Mathube": 746, "Malte Vosteen": 735, "Malvern Patsanza": 683,
  "Mandla Msimang M": 631, "Manelisi Ntayiya": 670, "Marcellus Faustino": 470,
  "Marvin Choma": 453, "Masande Dlulisa": 468, "Mathew Maphuthu": 549,
  "Mathew Mwiwa": 642, "Matlaba Machaka": 518, "Mauda King Coach": 496,
  "Mholi Shandu": 708, "Micheli Ntsasa": 672, "Mike Hannie": 479,
  "Mlungisi Cele": 450, "Mmemezi Dlamini": 464, "Mogomotsi Mmutle": 584,
  "Mogosi Khunwane": 495, "Moipone Morgan": 614, "Mokolokolo Kgopana": 488,
  "Mondli Gabela": 474, "Morgan Makhubela M": 539, "Mothibi Thabeng": 724,
  "Motlatjo Seema": 698, "Mphilo Dlamini M": 466, "Mpho Rantla": 692,
  "Mpho Seele": 697, "Mpho Tenyane": 723, "Mpho Thohlang": 726,
  "Mpumelelo Ndimande": 648, "Mukhouane Mocwana": 587, "Musa Nene": 652,
  "Mxolisi Mavumengwana": 567, "Mxolisi Siyonzana": 718, "Mzo Tshaka": 732,
  "Mzwandile Ntuli": 675, "Mzwandile Nxumalo M": 678, "Mzwandile Riba": 694,
  "Nathi Dlamini N": 467, "Nathi Mdladla": 574, "Nditsheni Matumba": 566,
  "Ngange Nongogo": 668, "Ngange Nongoqo": 669, "Nhlanhla Maphalala": 548,
  "Nick Xolo": 739, "Nico Nyamupachito": 679, "Njabulo Ngubane": 656,
  "Nkululeko Poya": 687, "Norman Moyo": 626, "Ntombie Dengu": 456,
  "Ntsieng Lenong": 506, "Obakeng Mofokeng": 591, "Olerato Mphake": 627,
  "Oliver Dickson": 460, "Omolemo kitchin": 497, "Oscar Magudulela": 527,
  "Oscar Mogodiela": 593, "Owen Nkumane": 664, "Pambili Booi": 448,
  "Patrick Denga": 455, "Patrick Mthombeni": 633, "Patrick Wanjau": 737,
  "Paul Counihan": 741, "Paul Sijadu": 714, "Percy Moiloa": 596,
  "Peter Letsoalo": 509, "Peter Mbugua": 573, "Peter Moima": 597,
  "Peter Namingona": 644, "Peter Paradza": 682, "Philly Motsepe": 622,
  "Phindile Bekwa": 444, "Pro Fred": 473, "Ralph Mgijima": 575,
  "Reo Mugwira": 634, "Richard Vries": 736, "Rivo Mhlari": 578,
  "Saider Sibanda": 713, "Sakhiwe Ngobese": 655, "Sam Mabitsela": 515,
  "Sam Mohlamanyane": 595, "Sandile Mthiyane": 632, "Sanele Shabalala": 707,
  "Sean Motebang": 620, "Sean Shomang": 711, "Sechele Magodielo": 526,
  "Senzo Mncadi": 585, "Shadrack Moephuli": 590, "Shaun Musakada": 637,
  "Shelton Takara": 721, "Sibusiso Khoza": 490, "Sico Kotumela": 499,
  "Sifiso Masina": 559, "Sikhona Lembede": 505, "Simon Mothlasedi": 621,
  "Siphiwe Nkula": 663, "Sipho Gura": 478, "Sipho Makhalema": 537,
  "Sipho Makhubela S": 540, "Sivuyile Mndawe": 586, "Skhumbuzo Mzele": 643,
  "Skhumbuzo Nxumalo": 676, "Smart Ncube": 646, "Solly Mabandla": 512,
  "Sonia Booth": 449, "Sonia Mangope": 546, "Tando Fani": 469,
  "Tapiwa Mafana": 524, "Tebogo Dhlamini": 457, "Tebogo Masela": 554,
  "Teko Mojaki": 598, "Thabiso Madiba": 522, "Thabiso Molefe": 608,
  "Thabiso Ntshingila": 673, "Thabo Mahlakwana": 528, "Thabo Motswiane": 624,
  "Thabo Seopa": 706, "Thabo Tselane": 745, "Thandisizwe Mahlutshana": 533,
  "Thapelo Mahlangu T": 530, "Thato MBHA": 572, "Thembile Mabhaso": 513,
  "Thembinkosi Masinga": 560, "Theo Shiluvani": 710, "Thomas Aphane": 438,
  "Thomas Tshikalange": 734, "Thulani Mkhize": 580, "Thulani Nodangala": 665,
  "Thuso Segopolo": 700, "Timo Bernhard": 445, "Tirisano Molamu": 607,
  "Tony Amedo": 437, "Treasure Mabunda": 517, "Trevor Machimana": 519,
  "Tshediso Nkgoedi": 660, "Tshepo Letsebe": 508, "Tshepo Malatjie": 542,
  "Tshepo Mosuwe": 619, "Tshepo Nkomo": 661, "Tshepo Segone": 699,
  "Tsietsi Molai": 606, "Tumelo Langa T": 502, "Tumelo Matlakale": 563,
  "Tuwani Mulaudzi T": 636, "Vennah Ogounga": 681, "Victor Mokgatle": 601,
  "Vishal Ramruthan": 691, "Volvo Masubulele": 561, "Votelwa Majola": 535,
  "Vukani Khulu": 491, "Vukani Khumalo V": 494, "Vulani Mabunda": 516,
  "Vumani Mkhize V": 582, "Vusi Mahlasela": 531, "Vuyisile Sibaca": 712,
  "Wandile Nhlengethwa": 659, "Wendell Robinson": 695, "Willie Moshweou": 617,
  "Xolani Mahote": 534, "Xolisa Ngwadla": 657, "Xolisa Sikobi": 715,
  "Xoliswa Motsohi": 623, "Yali Tshengiwe": 733, "Yanela Malusi": 544,
  "Zakhele Simelane": 716, "Zitha Thuki": 727, "Zweli Mabona": 743,
  "Zwido Mulaudzi": 635,
};

// ── Parse the data file ────────────────────────────────────────────────────
// Tab-separated. Columns (0-indexed):
// 0=MemberID, 1=Surname, 2=Name, 3=Initials, 4=Gender, 5=HCP, 6=Club
// Then for each of 9 games, 4 columns: Points, New Playing HI, Playing Course HCP, Playing HI Index
// Game n (1-based): points at col 4*(n-1)+8, nhcp at +9, courseHcp at +10, hiIndex at +11

const fileContent = readFileSync('/user_read_only_context/text_attachments/pasted-text-banQa.txt', 'utf-8');
const lines = fileContent.split('\n').filter(l => l.trim());

// Skip header rows (first 4 lines are headers)
const dataLines = lines.slice(4);

// Build per-game player lists: only players with actual points
const gameParticipants = GAMES.map(() => []);

for (const line of dataLines) {
  const cols = line.split('\t');
  const rawName = `${cols[2]?.trim() || ''} ${cols[1]?.trim() || ''}`.trim();
  // Also try "Name Surname" format since file has Surname in col1, Name in col2
  const nameA = `${cols[2]?.trim()} ${cols[1]?.trim()}`.trim(); // "Name Surname"
  const nameB = `${cols[1]?.trim()} ${cols[2]?.trim()}`.trim(); // "Surname Name" - unlikely but check
  
  // Find member_id
  let memberId = MEMBERS[nameA] || MEMBERS[nameB] || null;
  if (!memberId) {
    // Try partial match
    const allNames = Object.keys(MEMBERS);
    const match = allNames.find(n => n.toLowerCase().includes((cols[2]?.trim() || '').toLowerCase()) && n.toLowerCase().includes((cols[1]?.trim() || '').toLowerCase()));
    if (match) memberId = MEMBERS[match];
  }
  if (!memberId) continue; // skip if no member found

  for (let g = 0; g < 9; g++) {
    const baseCol = 4 * g + 8;
    const pointsRaw = cols[baseCol]?.trim();
    const playingHcpRaw = cols[baseCol + 2]?.trim(); // Playing Course Handicap
    const hiIndexRaw = cols[baseCol + 3]?.trim();    // Playing HI Index

    if (!pointsRaw || pointsRaw === '' || isNaN(Number(pointsRaw))) continue;

    const points = Number(pointsRaw);
    const playingHcp = playingHcpRaw && !isNaN(Number(playingHcpRaw)) ? Number(playingHcpRaw) : null;
    const hiIndex = hiIndexRaw && !isNaN(Number(hiIndexRaw)) ? Number(hiIndexRaw) : null;
    const par = GAMES[g].par;

    // Gross = par + playing_handicap - (points - 36)
    // Stableford: points = 36 + (par + hcp - gross) => gross = par + hcp - (points - 36)
    const gross = playingHcp !== null ? par + playingHcp - (points - 36) : null;

    gameParticipants[g].push({
      memberId,
      memberName: nameA,
      points,
      playingHcp,
      hiIndex,
      gross,
    });
  }
}

// ── Insert into DB ─────────────────────────────────────────────────────────
async function run() {
  const ORGANIZER_ID = 612; // Connie Monageng

  for (let g = 0; g < 9; g++) {
    const game = GAMES[g];
    const participants = gameParticipants[g];
    if (participants.length === 0) {
      console.log(`Game ${g + 1} (${game.date}): no participants, skipping`);
      continue;
    }

    // 1. Create adhoc_game
    const { data: gameData, error: gameErr } = await supabase
      .from('adhoc_games')
      .insert({
        organizer_id: ORGANIZER_ID,
        course_id: game.courseId,
        game_date: game.date,
        tee_off_time: game.teeTime,
        max_players: participants.length + 4,
        cost_per_player: 0,
        status: 'completed',
        game_type: 'IPS',
        club_id: 13,
        notes: 'Imported from historical data',
      })
      .select('adhoc_game_id')
      .single();

    if (gameErr) {
      console.error(`Game ${g + 1} insert error:`, gameErr.message);
      continue;
    }

    const gameId = gameData.adhoc_game_id;
    console.log(`Game ${g + 1} (${game.date} @ ${game.courseName}): created adhoc_game_id=${gameId}, ${participants.length} players`);

    // 2. Assign fourballs
    const sortedByHcp = [...participants].sort((a, b) => (a.playingHcp ?? 99) - (b.playingHcp ?? 99));
    const pairingsToInsert = sortedByHcp.map((p, idx) => ({
      adhoc_game_id: gameId,
      member_id: p.memberId,
      fourball_number: Math.floor(idx / 4) + 1,
      is_captain: idx % 4 === 0,
      gross_score: p.gross,
      points: p.points,
      playing_handicap: p.playingHcp,
      result_submitted: true,
      scores_submitted_at: new Date(game.date + 'T12:00:00Z').toISOString(),
    }));

    const { error: pairErr } = await supabase.from('pairings').insert(pairingsToInsert);
    if (pairErr) {
      console.error(`Game ${g + 1} pairings insert error:`, pairErr.message);
      continue;
    }

    // 3. Insert performance_records
    const perfToInsert = participants.map(p => ({
      member_id: p.memberId,
      course_id: game.courseId,
      game_date: game.date,
      gross_score: p.gross,
      points: p.points,
      playing_handicap: p.playingHcp,
      handicap_index: p.hiIndex,
      club_id: 13,
    }));

    const { error: perfErr } = await supabase.from('performance_records').insert(perfToInsert);
    if (perfErr) {
      console.error(`Game ${g + 1} performance_records insert error:`, perfErr.message);
      continue;
    }

    console.log(`  -> pairings and performance_records inserted successfully`);
  }

  console.log('Import complete!');
}

run().catch(console.error);
