// ═══════════════════════════════════════════════════════════════════
//  CONTENIDO EN INGLÉS DE LAS SALAS (Geografía y Biología)
//  Los datos originales viven en español en otras apps (GeografiaApp, anatomia_avanzada_dataset.json);
//  aquí solo está su traducción, por iso2 del país o id de la pieza.
//  Historia y Lengua no se traducen: su contenido es largo (Historia) o propio del castellano (Lengua).
// ═══════════════════════════════════════════════════════════════════

/** Capitales cuyo nombre cambia en inglés (el resto se escribe igual). */
export const CAPITALES_EN = {
    fr: 'Paris', de: 'Berlin', it: 'Rome', pt: 'Lisbon', gb: 'London', nl: 'Amsterdam', be: 'Brussels', ch: 'Bern',
    at: 'Vienna', pl: 'Warsaw', se: 'Stockholm', dk: 'Copenhagen', gr: 'Athens', ro: 'Bucharest', cz: 'Prague',
    bg: 'Sofia', ua: 'Kyiv', ru: 'Moscow', ie: 'Dublin', rs: 'Belgrade', lt: 'Vilnius', ee: 'Tallinn', si: 'Ljubljana',
    us: 'Washington D.C.', mx: 'Mexico City', cu: 'Havana', gt: 'Guatemala City', eg: 'Cairo', ng: 'Abuja',
    et: 'Addis Ababa', gh: 'Accra', dz: 'Algiers', sd: 'Khartoum', cm: 'Yaoundé', tn: 'Tunis', ly: 'Tripoli',
    cn: 'Beijing', in: 'New Delhi', jp: 'Tokyo', sa: 'Riyadh', ir: 'Tehran', id: 'Jakarta', vn: 'Hanoi',
    iq: 'Baghdad', sy: 'Damascus', kr: 'Seoul', mm: 'Naypyidaw', uz: 'Tashkent', co: 'Bogotá', py: 'Asunción',
};

/** Nombres de países en inglés (por si el navegador no tiene Intl.DisplayNames). */
export const PAISES_EN = {
    es: 'Spain', fr: 'France', de: 'Germany', it: 'Italy', pt: 'Portugal', gb: 'United Kingdom', nl: 'Netherlands',
    be: 'Belgium', ch: 'Switzerland', at: 'Austria', pl: 'Poland', se: 'Sweden', no: 'Norway', dk: 'Denmark',
    fi: 'Finland', gr: 'Greece', ro: 'Romania', hu: 'Hungary', cz: 'Czech Republic', hr: 'Croatia', bg: 'Bulgaria',
    ua: 'Ukraine', ru: 'Russia', ie: 'Ireland', rs: 'Serbia', sk: 'Slovakia', by: 'Belarus', lt: 'Lithuania',
    lv: 'Latvia', ee: 'Estonia', al: 'Albania', si: 'Slovenia', us: 'United States', ca: 'Canada', mx: 'Mexico',
    br: 'Brazil', ar: 'Argentina', co: 'Colombia', cl: 'Chile', pe: 'Peru', ve: 'Venezuela', ec: 'Ecuador',
    bo: 'Bolivia', py: 'Paraguay', uy: 'Uruguay', cu: 'Cuba', gt: 'Guatemala', hn: 'Honduras', eg: 'Egypt',
    ng: 'Nigeria', za: 'South Africa', ke: 'Kenya', et: 'Ethiopia', gh: 'Ghana', tz: 'Tanzania', ma: 'Morocco',
    dz: 'Algeria', sd: 'Sudan', ao: 'Angola', mg: 'Madagascar', cm: 'Cameroon', mz: 'Mozambique', ml: 'Mali',
    tn: 'Tunisia', ly: 'Libya', cn: 'China', in: 'India', jp: 'Japan', sa: 'Saudi Arabia', ir: 'Iran', tr: 'Turkey',
    pk: 'Pakistan', id: 'Indonesia', th: 'Thailand', vn: 'Vietnam', my: 'Malaysia', kz: 'Kazakhstan', iq: 'Iraq',
    sy: 'Syria', af: 'Afghanistan', kr: 'South Korea', mm: 'Myanmar', uz: 'Uzbekistan', au: 'Australia',
    nz: 'New Zealand', pg: 'Papua New Guinea',
};

export const CONTINENTES_EN = { Europa: 'Europe', 'América': 'the Americas', 'África': 'Africa', Asia: 'Asia', 'Oceanía': 'Oceania' };

export const SISTEMAS_EN = {
    'Sistema Nervioso': 'nervous system', 'Sistema Cardiovascular': 'cardiovascular system', 'Sistema Respiratorio': 'respiratory system',
    'Sistema Digestivo': 'digestive system', 'Sistema Endocrino y Digestivo': 'endocrine and digestive systems', 'Sistema Excretor': 'excretory system',
    'Sistema Linfático': 'lymphatic system', 'Sistema Endocrino': 'endocrine system', 'Sistema Óseo': 'skeletal system', 'Sistema Muscular': 'muscular system',
};

export const CATEGORIAS_EN = { 'Órgano': 'organ', Hueso: 'bone', 'Músculo': 'muscle' };

/** Piezas del cuerpo humano: id → [nombre, descripción]. */
export const ANATOMIA_EN = {
    'org-01': ['Brain', 'The body’s control centre, in charge of thinking, memory and controlling the other organs.'],
    'org-02': ['Heart', 'A muscle that pumps oxygen-rich blood to every part of the body.'],
    'org-03': ['Lungs', 'A pair of organs in charge of breathing and of exchanging oxygen and carbon dioxide.'],
    'org-04': ['Stomach', 'The organ where food is mixed with gastric juices to be digested.'],
    'org-05': ['Liver', 'The largest internal organ. It makes bile, cleans the blood and stores energy.'],
    'org-06': ['Pancreas', 'A gland that makes insulin to control sugar, and enzymes for digestion.'],
    'org-07': ['Small intestine', 'A long tube where most nutrients are absorbed.'],
    'org-08': ['Large intestine', 'The last part of the digestive tract: it absorbs water and forms faeces.'],
    'org-09': ['Kidneys', 'Organs that filter the blood to make urine and get rid of waste.'],
    'org-10': ['Bladder', 'A hollow organ that stores urine.'],
    'org-11': ['Spleen', 'It filters the blood, destroys old red blood cells and helps the immune system.'],
    'org-12': ['Gallbladder', 'It stores and concentrates the bile made by the liver.'],
    'org-13': ['Thyroid', 'A gland in the neck that controls the body’s metabolism.'],
    'org-14': ['Pituitary gland', 'The master gland at the base of the brain, which controls other glands.'],
    'org-15': ['Adrenal glands', 'They sit on top of the kidneys and make hormones such as adrenaline and cortisol.'],
    'org-16': ['Spinal cord', 'A cord of nerve tissue that carries messages between the brain and the body.'],
    'org-17': ['Larynx', 'It holds the vocal cords and is essential for speaking.'],
    'org-18': ['Thymus', 'A key gland for the development of the immune system during childhood.'],
    'hue-01': ['Skull', 'The bony structure that protects the brain.'],
    'hue-02': ['Jaw', 'The only bone in the head that can move.'],
    'hue-03': ['Collarbone', 'It connects the breastbone to the shoulder blade.'],
    'hue-04': ['Breastbone', 'A flat bone in the middle of the chest.'],
    'hue-05': ['Spine', 'A jointed structure that holds up the trunk and protects the spinal cord.'],
    'hue-06': ['Pelvis', 'A bowl-shaped bony structure at the bottom of the trunk.'],
    'hue-07': ['Humerus', 'The longest bone in the arm.'],
    'hue-08': ['Radius', 'A forearm bone on the same side as the thumb.'],
    'hue-09': ['Ulna', 'A forearm bone on the same side as the little finger.'],
    'hue-10': ['Femur', 'The longest and strongest bone in the human body.'],
    'hue-11': ['Tibia', 'The main bone of the leg, below the knee.'],
    'hue-12': ['Fibula', 'A thin leg bone on the outer side.'],
    'hue-13': ['Shoulder blade', 'A flat, triangular bone at the back of the shoulder.'],
    'hue-14': ['Frontal bone', 'The skull bone that forms the forehead.'],
    'hue-15': ['Occipital bone', 'The bone that forms the back and bottom of the skull.'],
    'hue-16': ['Sphenoid bone', 'A butterfly-shaped bone at the base of the skull.'],
    'hue-17': ['Atlas (C1)', 'The first neck vertebra, which holds up the weight of the skull.'],
    'hue-18': ['Axis (C2)', 'The second neck vertebra, which lets the head turn.'],
    'hue-19': ['Sacrum', 'A triangular bone at the base of the spine, made of fused vertebrae.'],
    'hue-20': ['Upper jaw', 'The face bone that holds the upper teeth.'],
    'hue-21': ['Heel bone', 'The bone that forms the heel of the foot.'],
    'hue-22': ['Stirrup', 'The smallest bone in the human body, inside the middle ear.'],
    'mus-01': ['Masseter', 'The main chewing muscle.'],
    'mus-02': ['Sternocleidomastoid', 'A neck muscle that lets you turn and tilt your head.'],
    'mus-03': ['Deltoid', 'The muscle that gives the shoulder its rounded shape.'],
    'mus-04': ['Pectoralis major', 'A large muscle that covers the upper chest.'],
    'mus-05': ['Biceps', 'The muscle at the front of the arm that bends the elbow.'],
    'mus-06': ['Triceps', 'The muscle at the back of the arm that straightens the elbow.'],
    'mus-07': ['Trapezius', 'A muscle at the back of the neck and the top of the back.'],
    'mus-08': ['Latissimus dorsi', 'The largest muscle of the trunk, in the back.'],
    'mus-09': ['Rectus abdominis', 'The muscle at the front of the belly (the “abs”).'],
    'mus-10': ['Gluteus maximus', 'The most powerful muscle of the hip area.'],
    'mus-11': ['Quadriceps', 'The muscle at the front of the thigh, which straightens the knee.'],
    'mus-12': ['Hamstrings', 'Muscles at the back of the thigh that bend the knee.'],
    'mus-13': ['Calf muscles', 'Muscles of the calf that are essential for walking.'],
    'mus-14': ['Diaphragm', 'The main breathing muscle, which separates the chest from the belly.'],
    'mus-15': ['Sartorius', 'The longest muscle in the body; it crosses the thigh diagonally.'],
    'mus-16': ['Tibialis anterior', 'A muscle at the front of the leg that lifts the foot upwards.'],
    'mus-17': ['Rhomboids', 'Muscles in the upper back that pull the shoulder blades together.'],
    'mus-18': ['Iliopsoas', 'A powerful hip flexor that connects the lower spine to the femur.'],
    'mus-19': ['Intercostals', 'Muscles between the ribs that help with breathing.'],
    'mus-20': ['Soleus', 'A wide, flat calf muscle underneath the calf muscles.'],
};

/** Contraseñas de la bruja (sala de Inglés): adivinanza en inglés para jugar en inglés. */
export const ADIVINANZAS_EN = {
    GHOST: 'It goes through walls and says “boo”.',
    WITCH: 'She flies on a broomstick and has a cauldron.',
    PUMPKIN: 'It is orange and you carve a face on it.',
    SPIDER: 'It has eight legs and spins webs.',
    SKELETON: 'It is made only of bones.',
    MONSTER: 'A creature that lives under the bed.',
    CANDY: 'What you ask for at “trick or treat”.',
    ZOMBIE: 'It walks slowly with its arms stretched out… and it is coming for you!',
};
