// Corrections to the base sizes in kt24_v4.json, which defaults most operatives
// to 32mm. Values are round-base diameters in mm; oval bases use their long axis.
//
// Source unless noted: Games Workshop, Warhammer 40,000 Base Size Guide
// (Warhammer Event Companion, last updated October 2026). Notes give the guide's
// unit entry. "Box" notes are not in the guide and come from the kill team box.
import { DEFAULT_BASE_MM } from '../../shared/game.js'

const corrections = [
  // Angels of Death
  [['IMP-AOD-CPT'], 40, 'Captain 40mm'],
  [['IMP-AOD-SNP'], 40, 'Eliminator Squad 40mm'],
  [['IMP-AOD-HGNR'], 40, 'Heavy Intercessor Squad 40mm'],

  // Blades of Khaine
  [['AEL-BOK-DAX', 'AEL-BOK-DAW'], 28.5, 'Dire Avengers 28.5mm'],
  [['AEL-BOK-HBX', 'AEL-BOK-HBW'], 28.5, 'Howling Banshees 28.5mm'],
  [['AEL-BOK-SSX', 'AEL-BOK-SSW'], 28.5, 'Striking Scorpions 28.5mm'],

  // Blooded
  [
    ['CHAOS-BLD-CHF', 'CHAOS-BLD-GRN', 'CHAOS-BLD-BUT', 'CHAOS-BLD-COM', 'CHAOS-BLD-CRPS', 'CHAOS-BLD-FLN',
      'CHAOS-BLD-GNR', 'CHAOS-BLD-SS', 'CHAOS-BLD-THUG', 'CHAOS-BLD-TRS', 'CHAOS-BLD-TRP'],
    25,
    'Traitor Guardsmen Squad 25mm',
  ],
  [['CHAOS-BLD-OGR'], 40, 'Traitor Enforcer: Traitor Ogryn 40mm'],

  // Brood Brothers
  [['TYR-BBRO-PAT'], 50, 'Patriarch 50mm'],

  // Canoptek Circle
  [['NEC-CAN-GEO'], 50, 'Geomancer 50mm'],
  [['NEC-CAN-ACC', 'NEC-CAN-REA', 'NEC-CAN-WAR'], 28.5, 'Canoptek Macrocytes 28.5mm'],

  // Chaos Cult
  [['CHAOS-CULT-BLBL'], 28.5, 'Dark Commune: Blessed Blade 28.5mm'],
  [['CHAOS-CULT-DEV'], 25, 'Cultist Mob 25mm'],
  [['CHAOS-CULT-MUT'], 25, 'Accursed Cultists: Mutant 25mm'],
  [['CHAOS-CULT-TOR'], 40, 'Accursed Cultists: Torment 40mm'],

  // Corsair Voidscarred
  [
    ['AEL-COR-FEL', 'AEL-COR-GNR', 'AEL-COR-HGNR', 'AEL-COR-FD', 'AEL-COR-KUR', 'AEL-COR-HNT', 'AEL-COR-SW',
      'AEL-COR-SR', 'AEL-COR-SD', 'AEL-COR-WS', 'AEL-COR-WAR'],
    28.5,
    'Corsair Voidscarred 28.5mm',
  ],

  // Death Korps (also in Inquisitorial Agents)
  [
    ['IMP-DKK-WM', 'IMP-DKK-BRU', 'IMP-DKK-CON', 'IMP-DKK-GNR', 'IMP-DKK-MDC', 'IMP-DKK-SAP', 'IMP-DKK-SNP',
      'IMP-DKK-SPT', 'IMP-DKK-TRP', 'IMP-DKK-VET', 'IMP-DKK-VOX', 'IMP-DKK-ZLT',
      'IMP-INQ-DKK24-BRU', 'IMP-INQ-DKK24-CON', 'IMP-INQ-DKK24-GNR', 'IMP-INQ-DKK24-MDC', 'IMP-INQ-DKK24-SAP',
      'IMP-INQ-DKK24-SNP', 'IMP-INQ-DKK24-TRP', 'IMP-INQ-DKK24-VET', 'IMP-INQ-DKK24-VOX', 'IMP-INQ-DKK24-ZLT'],
    25,
    'Death Korps of Krieg 25mm',
  ],

  // Elucidian Starstriders
  [
    ['IMP-ESS-EV', 'IMP-ESS-CAN', 'IMP-ESS-DCE', 'IMP-ESS-LM', 'IMP-ESS-REJAD', 'IMP-ESS-VMST', 'IMP-ESS-VM'],
    25,
    'Rogue Trader entourage 25mm',
  ],

  // Exaction Squad (also in Inquisitorial Agents)
  [
    ['IMP-AES-PE', 'IMP-AES-CAST', 'IMP-AES-CHI', 'IMP-AES-GNR', 'IMP-AES-LSH', 'IMP-AES-MAL', 'IMP-AES-MRK',
      'IMP-AES-REV', 'IMP-AES-SUB', 'IMP-AES-VIG', 'IMP-AES-VOX',
      'IMP-INQ-AES24-CAST', 'IMP-INQ-AES24-CHI', 'IMP-INQ-AES24-GNR', 'IMP-INQ-AES24-LSH', 'IMP-INQ-AES24-MAL',
      'IMP-INQ-AES24-MRK', 'IMP-INQ-AES24-REV', 'IMP-INQ-AES24-SUB', 'IMP-INQ-AES24-VIG', 'IMP-INQ-AES24-VOX'],
    28.5,
    'Exaction Squad 28.5mm',
  ],
  [['IMP-AES-RVR', 'IMP-INQ-AES24-RVR'], 25, 'Exaction Squad: Cyber-mastiff 25mm'],

  // Farstalker Kinband (Kill-broker stays 32mm)
  [
    ['TAU-FSKB-BH', 'TAU-FSKB-CB', 'TAU-FSKB-CS', 'TAU-FSKB-HGNR', 'TAU-FSKB-LS', 'TAU-FSKB-PST', 'TAU-FSKB-STK',
      'TAU-FSKB-TRK', 'TAU-FSKB-WAR'],
    28.5,
    'Kroot Farstalkers 28.5mm',
  ],
  [['TAU-FSKB-HND'], 28.5, 'Kroot Hounds 28.5mm'],

  // Gellerpox Infected (not in the 40k guide)
  [['CHAOS-GPI-VTC', 'CHAOS-GPI-BS', 'CHAOS-GPI-FS', 'CHAOS-GPI-LG'], 40, 'Box: Vulgrar and Nightmare Hulks 40mm'],
  [['CHAOS-GPI-GL', 'CHAOS-GPI-CM', 'CHAOS-GPI-ESS', 'CHAOS-GPI-SG'], 25, 'Box: Vermin and Glitchlings 25mm'],

  // Hand of the Archon
  [
    ['AEL-HOTA-KAS', 'AEL-HOTA-KAG', 'AEL-HOTA-KCD', 'AEL-HOTA-KDOY', 'AEL-HOTA-KELX', 'AEL-HOTA-KFLAY',
      'AEL-HOTA-KGNR', 'AEL-HOTA-KHGNR', 'AEL-HOTA-KSA'],
    25,
    'Hand of the Archon 25mm',
  ],

  // Hearthkyn Salvagers
  [
    ['VOT-HKS-TH', 'VOT-HKS-DO', 'VOT-HKS-MDC', 'VOT-HKS-GRN', 'VOT-HKS-GNR', 'VOT-HKS-JMP', 'VOT-HKS-KL',
      'VOT-HKS-KOG', 'VOT-HKS-LOK', 'VOT-HKS-LUG', 'VOT-HKS-WAR'],
    28.5,
    'Hearthkyn Warriors 28.5mm',
  ],

  // Hernkyn Yaegirs
  [
    ['VOT-HKY-THEYN', 'VOT-HKY-BLD', 'VOT-HKY-BOMB', 'VOT-HKY-GNR', 'VOT-HKY-IRN', 'VOT-HKY-RFL', 'VOT-HKY-TRK',
      'VOT-HKY-WAR'],
    28.5,
    'Hernkyn Yaegirs 28.5mm',
  ],

  // Hierotek Circle
  [['NEC-HIER-CHRON'], 40, 'Chronomancer 40mm'],
  [['NEC-HIER-PSYCH'], 40, 'Psychomancer 40mm'],
  [['NEC-HIER-TECH'], 50, 'Technomancer 50mm'],

  // Hunter Clade
  [['IMP-HC-SIP', 'IMP-HC-SIW'], 40, 'Sicarian Infiltrators 40mm'],
  [['IMP-HC-SRSP', 'IMP-HC-SRSW'], 40, 'Sicarian Ruststalkers 40mm'],
  [['IMP-HC-SRGA', 'IMP-HC-SRGD', 'IMP-HC-SRGG', 'IMP-HC-SRGS', 'IMP-HC-SRGW'], 25, 'Skitarii Rangers 25mm'],
  [['IMP-HC-SVA', 'IMP-HC-SVD', 'IMP-HC-SVG', 'IMP-HC-SVS', 'IMP-HC-SVW'], 25, 'Skitarii Vanguard 25mm'],

  // Imperial Navy Breachers (also in Inquisitorial Agents)
  [
    ['IMP-INB-SGT', 'IMP-INB-ARM', 'IMP-INB-AXE', 'IMP-INB-CAT', 'IMP-INB-GS', 'IMP-INB-GRN', 'IMP-INB-HC',
      'IMP-INB-SRV', 'IMP-INB-VJ',
      'IMP-INQ-INB24-ARM', 'IMP-INQ-INB24-AXE', 'IMP-INQ-INB24-CAT', 'IMP-INQ-INB24-GS', 'IMP-INQ-INB24-GRN',
      'IMP-INQ-INB24-HC', 'IMP-INQ-INB24-SRV', 'IMP-INQ-INB24-VJ'],
    25,
    'Imperial Navy Breachers 25mm',
  ],
  [
    ['IMP-INB-END', 'IMP-INB-GNR', 'IMP-INQ-INB24-END', 'IMP-INQ-INB24-GNR'],
    28.5,
    'Imperial Navy Breachers: Navis las-volley, endurant shield 28.5mm',
  ],

  // Inquisitorial Agents (core agents; gun servitor stays 32mm)
  [
    ['IMP-INQ-INQ24-INT', 'IMP-INQ-INQ24-TS', 'IMP-INQ-INQ24-AS', 'IMP-INQ-INQ24-QK', 'IMP-INQ-INQ24-VET',
      'IMP-INQ-INQ24-ENL', 'IMP-INQ-INQ24-HEX', 'IMP-INQ-INQ24-MYS', 'IMP-INQ-INQ24-PEN', 'IMP-INQ-INQ24-PST'],
    25,
    'Inquisitorial Agents 25mm',
  ],
  [
    ['IMP-INQ-TS24-TSVOX', 'IMP-INQ-TS24-TSGUN', 'IMP-INQ-TS24-TSMED', 'IMP-INQ-TS24-TSTRP'],
    25,
    'Tempestus Scions 25mm',
  ],

  // Kasrkin (also in Inquisitorial Agents)
  [
    ['IMP-KAS-SGT', 'IMP-KAS-MDC', 'IMP-KAS-DT', 'IMP-KAS-GNR', 'IMP-KAS-RT', 'IMP-KAS-SS', 'IMP-KAS-TRP',
      'IMP-KAS-VOX',
      'IMP-INQ-KAS24-MDC', 'IMP-INQ-KAS24-DT', 'IMP-INQ-KAS24-GNR', 'IMP-INQ-KAS24-RT', 'IMP-INQ-KAS24-SS',
      'IMP-INQ-KAS24-TRP', 'IMP-INQ-KAS24-VOX'],
    28.5,
    'Kasrkin 28.5mm',
  ],

  // Kommandos
  [['ORK-KOM-GROT'], 25, 'Gretchin 25mm'],
  [['ORK-KOM-SQUIG'], 25, 'Box: bomb squig 25mm (same model as Wrecka Krew)'],

  // Mandrakes
  [
    ['AEL-MND-NF', 'AEL-MND-COTF', 'AEL-MND-ABS', 'AEL-MND-DM', 'AEL-MND-SW', 'AEL-MND-WAR'],
    28.5,
    'Mandrakes 28.5mm',
  ],

  // Novitiates (Superior stays 32mm)
  [
    ['IMP-NOV-CON', 'IMP-NOV-DIA', 'IMP-NOV-DUE', 'IMP-NOV-EXA', 'IMP-NOV-HOS', 'IMP-NOV-MIL', 'IMP-NOV-PEN',
      'IMP-NOV-PRE', 'IMP-NOV-PRO', 'IMP-NOV-PUR', 'IMP-NOV-REL'],
    28.5,
    'Sisters Novitiate Squad: Sister Novitiate 28.5mm',
  ],

  // Pathfinders (drones not listed in the guide)
  [
    ['TAU-PF-SU', 'TAU-PF-AG', 'TAU-PF-BL', 'TAU-PF-COMMS', 'TAU-PF-DC', 'TAU-PF-MARKS', 'TAU-PF-MDC', 'TAU-PF-SL',
      'TAU-PF-TSI', 'TAU-PF-WE'],
    25,
    'Pathfinder Team 25mm',
  ],

  // Ratlings
  [['IMP-RAT-BIG'], 28.5, 'Ratlings: Tankstopper Rifle 28.5mm'],

  // Sanctifiers
  [['IMP-SANC-CFS'], 25, 'Sanctifiers 25mm'],

  // Scout Squad
  [
    ['IMP-SCT-SGT', 'IMP-SCT-HGNR', 'IMP-SCT-HNT', 'IMP-SCT-SNP', 'IMP-SCT-TRK', 'IMP-SCT-WAR'],
    28.5,
    'Scout Squad 28.5mm',
  ],

  // Strike Force Variel
  [['IMP-SFV-VAR'], 40, 'Lieutenant 40mm'],

  // Tempestus Aquilon (servo-sentry not listed in the guide)
  [
    ['IMP-TEMPAQ-TEMP', 'IMP-TEMPAQ-GRN', 'IMP-TEMPAQ-GF', 'IMP-TEMPAQ-GNR', 'IMP-TEMPAQ-MRK', 'IMP-TEMPAQ-PRE',
      'IMP-TEMPAQ-TRP'],
    28.5,
    'Tempestus Aquilons 28.5mm',
  ],

  // Titus mission pack
  [['SPEC-TITUS-GAD'], 40, 'Wardens of Ultramar: Ancient Gadriel 40mm'],
  [['SPEC-TITUS-HOR'], 28.5, 'Hormagaunts 28.5mm'],
  [['SPEC-TITUS-TER'], 28.5, 'Termagants 28.5mm'],
  [['SPEC-TITUS-WAR'], 50, 'Tyranid Warriors 50mm'],
  [['SPEC-TITUS-LIC'], 50, 'Lictor 50mm'],

  // Vespid Stingwings (Oversight Drone not listed in the guide)
  [
    ['TAU-VESP-VSL', 'TAU-VESP-VLS', 'TAU-VESP-VSS', 'TAU-VESP-VSB', 'TAU-VESP-VSG', 'TAU-VESP-WAR'],
    28.5,
    'Vespid Stingwings 28.5mm',
  ],

  // Void-Dancer Troupe
  [['AEL-VDT-LPL'], 25, 'Troupe Master 25mm'],
  [['AEL-VDT-PLAY'], 25, 'Troupe 25mm'],
  [['AEL-VDT-DJS'], 25, 'Death Jester 25mm'],
  [['AEL-VDT-SDS'], 25, 'Shadowseer 25mm'],

  // Wyrmblade (heavy gunner stays 32mm)
  [['TYR-WB-LDR', 'TYR-WB-GNR', 'TYR-WB-IB', 'TYR-WB-WAR'], 25, 'Neophyte Hybrids 25mm'],
]

export const BASE_SIZE_OVERRIDES = Object.fromEntries(
  corrections.flatMap(([ids, mm, note]) => ids.map((id) => [id, { mm, note }])),
)

// GW has no 28mm base; the community data writes 28.5mm as 28.
const normalize = (mm) => (mm === 28 ? 28.5 : mm)

export const baseSizeMm = (opType) =>
  BASE_SIZE_OVERRIDES[opType?.opTypeId]?.mm ?? normalize(opType?.basesize) ?? DEFAULT_BASE_MM
