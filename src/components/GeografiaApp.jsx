import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import correctSoundFile from '../assets/correct-choice-43861.mp3';
import wrongSoundFile   from '../assets/negative_beeps-6008.mp3';

const WORLD_URL    = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
const ESP_PROV_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/spain-provinces.geojson';
const FLAG_URL     = (iso2) => `https://flagcdn.com/w320/${iso2}.png`;
let _worldCache = null;
let _espCache   = null;

// ── World countries (for map quiz) ────────────────────────────────────────────
const PAISES = [
  { nombre:'España',           nameEn:'Spain',                       continente:'Europa'   },
  { nombre:'Francia',          nameEn:'France',                      continente:'Europa'   },
  { nombre:'Alemania',         nameEn:'Germany',                     continente:'Europa'   },
  { nombre:'Italia',           nameEn:'Italy',                       continente:'Europa'   },
  { nombre:'Portugal',         nameEn:'Portugal',                    continente:'Europa'   },
  { nombre:'Reino Unido',      nameEn:'United Kingdom', nameAlt:'Great Britain', continente:'Europa' },
  { nombre:'Países Bajos',     nameEn:'Netherlands',                 continente:'Europa'   },
  { nombre:'Bélgica',          nameEn:'Belgium',                     continente:'Europa'   },
  { nombre:'Suiza',            nameEn:'Switzerland',                 continente:'Europa'   },
  { nombre:'Austria',          nameEn:'Austria',                     continente:'Europa'   },
  { nombre:'Polonia',          nameEn:'Poland',                      continente:'Europa'   },
  { nombre:'Suecia',           nameEn:'Sweden',                      continente:'Europa'   },
  { nombre:'Noruega',          nameEn:'Norway',                      continente:'Europa'   },
  { nombre:'Dinamarca',        nameEn:'Denmark',                     continente:'Europa'   },
  { nombre:'Finlandia',        nameEn:'Finland',                     continente:'Europa'   },
  { nombre:'Grecia',           nameEn:'Greece',                      continente:'Europa'   },
  { nombre:'Rumanía',          nameEn:'Romania',                     continente:'Europa'   },
  { nombre:'Hungría',          nameEn:'Hungary',                     continente:'Europa'   },
  { nombre:'República Checa',  nameEn:'Czech Republic', nameAlt:'Czechia', continente:'Europa' },
  { nombre:'Croacia',          nameEn:'Croatia',                     continente:'Europa'   },
  { nombre:'Bulgaria',         nameEn:'Bulgaria',                    continente:'Europa'   },
  { nombre:'Ucrania',          nameEn:'Ukraine',                     continente:'Europa'   },
  { nombre:'Rusia',            nameEn:'Russia',                      continente:'Europa'   },
  { nombre:'Irlanda',          nameEn:'Ireland',                     continente:'Europa'   },
  { nombre:'Serbia',           nameEn:'Serbia',                      continente:'Europa'   },
  { nombre:'Eslovaquia',       nameEn:'Slovakia',                    continente:'Europa'   },
  { nombre:'Bielorrusia',      nameEn:'Belarus',                     continente:'Europa'   },
  { nombre:'Lituania',         nameEn:'Lithuania',                   continente:'Europa'   },
  { nombre:'Letonia',          nameEn:'Latvia',                      continente:'Europa'   },
  { nombre:'Estonia',          nameEn:'Estonia',                     continente:'Europa'   },
  { nombre:'Albania',          nameEn:'Albania',                     continente:'Europa'   },
  { nombre:'Eslovenia',        nameEn:'Slovenia',                    continente:'Europa'   },
  { nombre:'Estados Unidos',   nameEn:'United States of America', nameAlt:'United States', continente:'América' },
  { nombre:'Canadá',           nameEn:'Canada',                      continente:'América'  },
  { nombre:'México',           nameEn:'Mexico',                      continente:'América'  },
  { nombre:'Brasil',           nameEn:'Brazil',                      continente:'América'  },
  { nombre:'Argentina',        nameEn:'Argentina',                   continente:'América'  },
  { nombre:'Colombia',         nameEn:'Colombia',                    continente:'América'  },
  { nombre:'Chile',            nameEn:'Chile',                       continente:'América'  },
  { nombre:'Perú',             nameEn:'Peru',                        continente:'América'  },
  { nombre:'Venezuela',        nameEn:'Venezuela',                   continente:'América'  },
  { nombre:'Ecuador',          nameEn:'Ecuador',                     continente:'América'  },
  { nombre:'Bolivia',          nameEn:'Bolivia',                     continente:'América'  },
  { nombre:'Paraguay',         nameEn:'Paraguay',                    continente:'América'  },
  { nombre:'Uruguay',          nameEn:'Uruguay',                     continente:'América'  },
  { nombre:'Cuba',             nameEn:'Cuba',                        continente:'América'  },
  { nombre:'Guatemala',        nameEn:'Guatemala',                   continente:'América'  },
  { nombre:'Honduras',         nameEn:'Honduras',                    continente:'América'  },
  { nombre:'Egipto',           nameEn:'Egypt',                       continente:'África'   },
  { nombre:'Nigeria',          nameEn:'Nigeria',                     continente:'África'   },
  { nombre:'Sudáfrica',        nameEn:'South Africa',                continente:'África'   },
  { nombre:'Kenia',            nameEn:'Kenya',                       continente:'África'   },
  { nombre:'Etiopía',          nameEn:'Ethiopia',                    continente:'África'   },
  { nombre:'Ghana',            nameEn:'Ghana',                       continente:'África'   },
  { nombre:'Tanzania',         nameEn:'Tanzania', nameAlt:'United Republic of Tanzania', continente:'África' },
  { nombre:'Marruecos',        nameEn:'Morocco',                     continente:'África'   },
  { nombre:'Argelia',          nameEn:'Algeria',                     continente:'África'   },
  { nombre:'Sudán',            nameEn:'Sudan',                       continente:'África'   },
  { nombre:'Angola',           nameEn:'Angola',                      continente:'África'   },
  { nombre:'Madagascar',       nameEn:'Madagascar',                  continente:'África'   },
  { nombre:'Camerún',          nameEn:'Cameroon',                    continente:'África'   },
  { nombre:'Mozambique',       nameEn:'Mozambique',                  continente:'África'   },
  { nombre:'Malí',             nameEn:'Mali',                        continente:'África'   },
  { nombre:'Túnez',            nameEn:'Tunisia',                     continente:'África'   },
  { nombre:'Libia',            nameEn:'Libya',                       continente:'África'   },
  { nombre:'China',            nameEn:'China',                       continente:'Asia'     },
  { nombre:'India',            nameEn:'India',                       continente:'Asia'     },
  { nombre:'Japón',            nameEn:'Japan',                       continente:'Asia'     },
  { nombre:'Arabia Saudí',     nameEn:'Saudi Arabia',                continente:'Asia'     },
  { nombre:'Irán',             nameEn:'Iran',                        continente:'Asia'     },
  { nombre:'Turquía',          nameEn:'Turkey',                      continente:'Asia'     },
  { nombre:'Pakistán',         nameEn:'Pakistan',                    continente:'Asia'     },
  { nombre:'Indonesia',        nameEn:'Indonesia',                   continente:'Asia'     },
  { nombre:'Tailandia',        nameEn:'Thailand',                    continente:'Asia'     },
  { nombre:'Vietnam',          nameEn:'Vietnam',                     continente:'Asia'     },
  { nombre:'Malasia',          nameEn:'Malaysia',                    continente:'Asia'     },
  { nombre:'Kazajistán',       nameEn:'Kazakhstan',                  continente:'Asia'     },
  { nombre:'Irak',             nameEn:'Iraq',                        continente:'Asia'     },
  { nombre:'Siria',            nameEn:'Syria',                       continente:'Asia'     },
  { nombre:'Afganistán',       nameEn:'Afghanistan',                 continente:'Asia'     },
  { nombre:'Corea del Sur',    nameEn:'South Korea', nameAlt:'Republic of Korea', continente:'Asia' },
  { nombre:'Myanmar',          nameEn:'Myanmar',                     continente:'Asia'     },
  { nombre:'Uzbekistán',       nameEn:'Uzbekistan',                  continente:'Asia'     },
  { nombre:'Australia',        nameEn:'Australia',                   continente:'Oceanía'  },
  { nombre:'Nueva Zelanda',    nameEn:'New Zealand',                 continente:'Oceanía'  },
  { nombre:'Papúa N. Guinea',  nameEn:'Papua New Guinea',            continente:'Oceanía'  },
];

// ── Countries with flags & capitals ──────────────────────────────────────────
const PAISES_BANDERAS = [
  // Europa
  { nombre:'España',          capital:'Madrid',             iso2:'es', continente:'Europa'  },
  { nombre:'Francia',         capital:'París',              iso2:'fr', continente:'Europa'  },
  { nombre:'Alemania',        capital:'Berlín',             iso2:'de', continente:'Europa'  },
  { nombre:'Italia',          capital:'Roma',               iso2:'it', continente:'Europa'  },
  { nombre:'Portugal',        capital:'Lisboa',             iso2:'pt', continente:'Europa'  },
  { nombre:'Reino Unido',     capital:'Londres',            iso2:'gb', continente:'Europa'  },
  { nombre:'Países Bajos',    capital:'Ámsterdam',          iso2:'nl', continente:'Europa'  },
  { nombre:'Bélgica',         capital:'Bruselas',           iso2:'be', continente:'Europa'  },
  { nombre:'Suiza',           capital:'Berna',              iso2:'ch', continente:'Europa'  },
  { nombre:'Austria',         capital:'Viena',              iso2:'at', continente:'Europa'  },
  { nombre:'Polonia',         capital:'Varsovia',           iso2:'pl', continente:'Europa'  },
  { nombre:'Suecia',          capital:'Estocolmo',          iso2:'se', continente:'Europa'  },
  { nombre:'Noruega',         capital:'Oslo',               iso2:'no', continente:'Europa'  },
  { nombre:'Dinamarca',       capital:'Copenhague',         iso2:'dk', continente:'Europa'  },
  { nombre:'Finlandia',       capital:'Helsinki',           iso2:'fi', continente:'Europa'  },
  { nombre:'Grecia',          capital:'Atenas',             iso2:'gr', continente:'Europa'  },
  { nombre:'Rumanía',         capital:'Bucarest',           iso2:'ro', continente:'Europa'  },
  { nombre:'Hungría',         capital:'Budapest',           iso2:'hu', continente:'Europa'  },
  { nombre:'República Checa', capital:'Praga',              iso2:'cz', continente:'Europa'  },
  { nombre:'Croacia',         capital:'Zagreb',             iso2:'hr', continente:'Europa'  },
  { nombre:'Bulgaria',        capital:'Sofía',              iso2:'bg', continente:'Europa'  },
  { nombre:'Ucrania',         capital:'Kiev',               iso2:'ua', continente:'Europa'  },
  { nombre:'Rusia',           capital:'Moscú',              iso2:'ru', continente:'Europa'  },
  { nombre:'Irlanda',         capital:'Dublín',             iso2:'ie', continente:'Europa'  },
  { nombre:'Serbia',          capital:'Belgrado',           iso2:'rs', continente:'Europa'  },
  { nombre:'Eslovaquia',      capital:'Bratislava',         iso2:'sk', continente:'Europa'  },
  { nombre:'Bielorrusia',     capital:'Minsk',              iso2:'by', continente:'Europa'  },
  { nombre:'Lituania',        capital:'Vilna',              iso2:'lt', continente:'Europa'  },
  { nombre:'Letonia',         capital:'Riga',               iso2:'lv', continente:'Europa'  },
  { nombre:'Estonia',         capital:'Tallin',             iso2:'ee', continente:'Europa'  },
  { nombre:'Albania',         capital:'Tirana',             iso2:'al', continente:'Europa'  },
  { nombre:'Eslovenia',       capital:'Liubliana',          iso2:'si', continente:'Europa'  },
  // América
  { nombre:'Estados Unidos',  capital:'Washington D.C.',    iso2:'us', continente:'América' },
  { nombre:'Canadá',          capital:'Ottawa',             iso2:'ca', continente:'América' },
  { nombre:'México',          capital:'Ciudad de México',   iso2:'mx', continente:'América' },
  { nombre:'Brasil',          capital:'Brasilia',           iso2:'br', continente:'América' },
  { nombre:'Argentina',       capital:'Buenos Aires',       iso2:'ar', continente:'América' },
  { nombre:'Colombia',        capital:'Bogotá',             iso2:'co', continente:'América' },
  { nombre:'Chile',           capital:'Santiago',           iso2:'cl', continente:'América' },
  { nombre:'Perú',            capital:'Lima',               iso2:'pe', continente:'América' },
  { nombre:'Venezuela',       capital:'Caracas',            iso2:'ve', continente:'América' },
  { nombre:'Ecuador',         capital:'Quito',              iso2:'ec', continente:'América' },
  { nombre:'Bolivia',         capital:'Sucre',              iso2:'bo', continente:'América' },
  { nombre:'Paraguay',        capital:'Asunción',           iso2:'py', continente:'América' },
  { nombre:'Uruguay',         capital:'Montevideo',         iso2:'uy', continente:'América' },
  { nombre:'Cuba',            capital:'La Habana',          iso2:'cu', continente:'América' },
  { nombre:'Guatemala',       capital:'Guatemala',          iso2:'gt', continente:'América' },
  { nombre:'Honduras',        capital:'Tegucigalpa',        iso2:'hn', continente:'América' },
  // África
  { nombre:'Egipto',          capital:'El Cairo',           iso2:'eg', continente:'África'  },
  { nombre:'Nigeria',         capital:'Abuya',              iso2:'ng', continente:'África'  },
  { nombre:'Sudáfrica',       capital:'Pretoria',           iso2:'za', continente:'África'  },
  { nombre:'Kenia',           capital:'Nairobi',            iso2:'ke', continente:'África'  },
  { nombre:'Etiopía',         capital:'Adís Abeba',         iso2:'et', continente:'África'  },
  { nombre:'Ghana',           capital:'Acra',               iso2:'gh', continente:'África'  },
  { nombre:'Tanzania',        capital:'Dodoma',             iso2:'tz', continente:'África'  },
  { nombre:'Marruecos',       capital:'Rabat',              iso2:'ma', continente:'África'  },
  { nombre:'Argelia',         capital:'Argel',              iso2:'dz', continente:'África'  },
  { nombre:'Sudán',           capital:'Jartum',             iso2:'sd', continente:'África'  },
  { nombre:'Angola',          capital:'Luanda',             iso2:'ao', continente:'África'  },
  { nombre:'Madagascar',      capital:'Antananarivo',       iso2:'mg', continente:'África'  },
  { nombre:'Camerún',         capital:'Yaundé',             iso2:'cm', continente:'África'  },
  { nombre:'Mozambique',      capital:'Maputo',             iso2:'mz', continente:'África'  },
  { nombre:'Malí',            capital:'Bamako',             iso2:'ml', continente:'África'  },
  { nombre:'Túnez',           capital:'Túnez',              iso2:'tn', continente:'África'  },
  { nombre:'Libia',           capital:'Trípoli',            iso2:'ly', continente:'África'  },
  // Asia
  { nombre:'China',           capital:'Pekín',              iso2:'cn', continente:'Asia'    },
  { nombre:'India',           capital:'Nueva Delhi',        iso2:'in', continente:'Asia'    },
  { nombre:'Japón',           capital:'Tokio',              iso2:'jp', continente:'Asia'    },
  { nombre:'Arabia Saudí',    capital:'Riad',               iso2:'sa', continente:'Asia'    },
  { nombre:'Irán',            capital:'Teherán',            iso2:'ir', continente:'Asia'    },
  { nombre:'Turquía',         capital:'Ankara',             iso2:'tr', continente:'Asia'    },
  { nombre:'Pakistán',        capital:'Islamabad',          iso2:'pk', continente:'Asia'    },
  { nombre:'Indonesia',       capital:'Yakarta',            iso2:'id', continente:'Asia'    },
  { nombre:'Tailandia',       capital:'Bangkok',            iso2:'th', continente:'Asia'    },
  { nombre:'Vietnam',         capital:'Hanói',              iso2:'vn', continente:'Asia'    },
  { nombre:'Malasia',         capital:'Kuala Lumpur',       iso2:'my', continente:'Asia'    },
  { nombre:'Kazajistán',      capital:'Astana',             iso2:'kz', continente:'Asia'    },
  { nombre:'Irak',            capital:'Bagdad',             iso2:'iq', continente:'Asia'    },
  { nombre:'Siria',           capital:'Damasco',            iso2:'sy', continente:'Asia'    },
  { nombre:'Afganistán',      capital:'Kabul',              iso2:'af', continente:'Asia'    },
  { nombre:'Corea del Sur',   capital:'Seúl',               iso2:'kr', continente:'Asia'    },
  { nombre:'Myanmar',         capital:'Naipyidó',           iso2:'mm', continente:'Asia'    },
  { nombre:'Uzbekistán',      capital:'Taskent',            iso2:'uz', continente:'Asia'    },
  // Oceanía
  { nombre:'Australia',       capital:'Canberra',           iso2:'au', continente:'Oceanía' },
  { nombre:'Nueva Zelanda',   capital:'Wellington',         iso2:'nz', continente:'Oceanía' },
  { nombre:'Papúa N. Guinea', capital:'Port Moresby',       iso2:'pg', continente:'Oceanía' },
];

// ── Spanish provinces ─────────────────────────────────────────────────────────
const PROVINCIAS = [
  { nombre:'Álava',                  nameEn:'Álava',                nameAlt:'Araba/Álava'         },
  { nombre:'Albacete',               nameEn:'Albacete'                                            },
  { nombre:'Alicante',               nameEn:'Alicante',             nameAlt:'Alicante/Alacant'    },
  { nombre:'Almería',                nameEn:'Almería'                                             },
  { nombre:'Asturias',               nameEn:'Asturias'                                            },
  { nombre:'Ávila',                  nameEn:'Ávila'                                               },
  { nombre:'Badajoz',                nameEn:'Badajoz'                                             },
  { nombre:'Islas Baleares',         nameEn:'Islas Baleares',       nameAlt:'Illes Balears'       },
  { nombre:'Barcelona',              nameEn:'Barcelona'                                           },
  { nombre:'Burgos',                 nameEn:'Burgos'                                              },
  { nombre:'Cáceres',                nameEn:'Cáceres'                                             },
  { nombre:'Cádiz',                  nameEn:'Cádiz'                                               },
  { nombre:'Cantabria',              nameEn:'Cantabria'                                           },
  { nombre:'Castellón',              nameEn:'Castellón',            nameAlt:'Castellón/Castelló'  },
  { nombre:'Ciudad Real',            nameEn:'Ciudad Real'                                         },
  { nombre:'Córdoba',                nameEn:'Córdoba'                                             },
  { nombre:'Cuenca',                 nameEn:'Cuenca'                                              },
  { nombre:'Girona',                 nameEn:'Girona',               nameAlt:'Gerona/Girona'       },
  { nombre:'Granada',                nameEn:'Granada'                                             },
  { nombre:'Guadalajara',            nameEn:'Guadalajara'                                         },
  { nombre:'Guipúzcoa',              nameEn:'Gipuzkoa/Guipúzcoa',   nameAlt:'Guipúzcoa'           },
  { nombre:'Huelva',                 nameEn:'Huelva'                                              },
  { nombre:'Huesca',                 nameEn:'Huesca'                                              },
  { nombre:'Jaén',                   nameEn:'Jaén'                                                },
  { nombre:'A Coruña',               nameEn:'A Coruña',             nameAlt:'La Coruña'           },
  { nombre:'La Rioja',               nameEn:'La Rioja'                                            },
  { nombre:'Las Palmas',             nameEn:'Las Palmas'                                          },
  { nombre:'León',                   nameEn:'León'                                                },
  { nombre:'Lleida',                 nameEn:'Lleida',               nameAlt:'Lérida/Lleida'       },
  { nombre:'Lugo',                   nameEn:'Lugo'                                                },
  { nombre:'Madrid',                 nameEn:'Madrid'                                              },
  { nombre:'Málaga',                 nameEn:'Málaga'                                              },
  { nombre:'Murcia',                 nameEn:'Murcia'                                              },
  { nombre:'Navarra',                nameEn:'Navarra'                                             },
  { nombre:'Ourense',                nameEn:'Ourense',              nameAlt:'Orense/Ourense'      },
  { nombre:'Palencia',               nameEn:'Palencia'                                            },
  { nombre:'Pontevedra',             nameEn:'Pontevedra'                                          },
  { nombre:'Salamanca',              nameEn:'Salamanca'                                           },
  { nombre:'Santa Cruz de Tenerife', nameEn:'Santa Cruz de Tenerife'                             },
  { nombre:'Segovia',                nameEn:'Segovia'                                             },
  { nombre:'Sevilla',                nameEn:'Sevilla'                                             },
  { nombre:'Soria',                  nameEn:'Soria'                                               },
  { nombre:'Tarragona',              nameEn:'Tarragona'                                           },
  { nombre:'Teruel',                 nameEn:'Teruel'                                              },
  { nombre:'Toledo',                 nameEn:'Toledo'                                              },
  { nombre:'Valencia',               nameEn:'Valencia',             nameAlt:'Valencia/València'   },
  { nombre:'Valladolid',             nameEn:'Valladolid'                                          },
  { nombre:'Vizcaya',                nameEn:'Bizkaia/Vizcaya',      nameAlt:'Vizcaya'             },
  { nombre:'Zamora',                 nameEn:'Zamora'                                              },
  { nombre:'Zaragoza',               nameEn:'Zaragoza'                                            },
];

// ── Physical geography elements ───────────────────────────────────────────────
const ELEMENTOS_GEO = [
  { nombre:'Ebro',             tipo:'rio', ambito:'España',  lon:-0.9,   lat:41.6,  lon_inicio:-4.1,  lat_inicio:43.0,  lon_fin:0.8,    lat_fin:40.7  },
  { nombre:'Tajo',             tipo:'rio', ambito:'España',  lon:-4.0,   lat:39.9,  lon_inicio:-1.5,  lat_inicio:40.4,  lon_fin:-9.0,   lat_fin:38.7  },
  { nombre:'Duero',            tipo:'rio', ambito:'España',  lon:-4.5,   lat:41.5,  lon_inicio:-2.8,  lat_inicio:41.9,  lon_fin:-8.7,   lat_fin:41.1  },
  { nombre:'Guadalquivir',     tipo:'rio', ambito:'España',  lon:-4.8,   lat:37.5,  lon_inicio:-2.9,  lat_inicio:37.9,  lon_fin:-6.4,   lat_fin:36.8  },
  { nombre:'Guadiana',         tipo:'rio', ambito:'España',  lon:-5.5,   lat:38.9,  lon_inicio:-2.9,  lat_inicio:38.9,  lon_fin:-7.4,   lat_fin:37.2  },
  { nombre:'Miño',             tipo:'rio', ambito:'España',  lon:-7.9,   lat:42.2,  lon_inicio:-7.3,  lat_inicio:43.1,  lon_fin:-8.9,   lat_fin:41.9  },
  { nombre:'Segura',           tipo:'rio', ambito:'España',  lon:-1.2,   lat:38.1,  lon_inicio:-2.7,  lat_inicio:38.1,  lon_fin:-0.7,   lat_fin:38.1  },
  { nombre:'Júcar',            tipo:'rio', ambito:'España',  lon:-1.8,   lat:39.4,  lon_inicio:-1.7,  lat_inicio:40.2,  lon_fin:-0.2,   lat_fin:39.2  },
  { nombre:'Turia',            tipo:'rio', ambito:'España',  lon:-1.1,   lat:39.8,  lon_inicio:-1.4,  lat_inicio:40.5,  lon_fin:-0.3,   lat_fin:39.5  },
  { nombre:'Pisuerga',         tipo:'rio', ambito:'España',  lon:-4.5,   lat:41.7,  lon_inicio:-4.5,  lat_inicio:42.9,  lon_fin:-4.7,   lat_fin:41.6  },
  { nombre:'Pirineos',         tipo:'cordillera', ambito:'España',  lon:0.3,    lat:42.7  },
  { nombre:'Sierra Nevada',    tipo:'cordillera', ambito:'España',  lon:-3.3,   lat:37.1  },
  { nombre:'Sistema Central',  tipo:'cordillera', ambito:'España',  lon:-3.9,   lat:40.6  },
  { nombre:'Sistema Ibérico',  tipo:'cordillera', ambito:'España',  lon:-2.1,   lat:41.3  },
  { nombre:'Cord. Cantábrica', tipo:'cordillera', ambito:'España',  lon:-5.1,   lat:43.1  },
  { nombre:'Sierra Morena',    tipo:'cordillera', ambito:'España',  lon:-4.2,   lat:38.1  },
  { nombre:'Macizo Galaico',   tipo:'cordillera', ambito:'España',  lon:-7.5,   lat:42.5  },
  { nombre:'Montes de Toledo', tipo:'cordillera', ambito:'España',  lon:-4.4,   lat:39.6  },
  { nombre:'Rin',              tipo:'rio', ambito:'Europa',  lon:8.2,    lat:50.9,  lon_inicio:8.7,   lat_inicio:46.6,  lon_fin:4.0,    lat_fin:51.9  },
  { nombre:'Danubio',          tipo:'rio', ambito:'Europa',  lon:18.9,   lat:45.8,  lon_inicio:8.0,   lat_inicio:48.0,  lon_fin:29.7,   lat_fin:45.2  },
  { nombre:'Sena',             tipo:'rio', ambito:'Europa',  lon:2.3,    lat:48.8,  lon_inicio:4.7,   lat_inicio:47.8,  lon_fin:0.1,    lat_fin:49.5  },
  { nombre:'Támesis',          tipo:'rio', ambito:'Europa',  lon:-0.5,   lat:51.5,  lon_inicio:-1.9,  lat_inicio:51.7,  lon_fin:0.7,    lat_fin:51.5  },
  { nombre:'Loira',            tipo:'rio', ambito:'Europa',  lon:-1.0,   lat:47.3,  lon_inicio:4.2,   lat_inicio:44.8,  lon_fin:-2.2,   lat_fin:47.3  },
  { nombre:'Volga',            tipo:'rio', ambito:'Europa',  lon:48.8,   lat:51.8,  lon_inicio:33.5,  lat_inicio:57.4,  lon_fin:50.0,   lat_fin:46.0  },
  { nombre:'Elba',             tipo:'rio', ambito:'Europa',  lon:10.0,   lat:53.4,  lon_inicio:15.6,  lat_inicio:50.7,  lon_fin:8.7,    lat_fin:53.9  },
  { nombre:'Po',               tipo:'rio', ambito:'Europa',  lon:11.5,   lat:45.0,  lon_inicio:7.1,   lat_inicio:44.7,  lon_fin:12.4,   lat_fin:44.9  },
  { nombre:'Tiber',            tipo:'rio', ambito:'Europa',  lon:12.3,   lat:41.7,  lon_inicio:12.0,  lat_inicio:43.8,  lon_fin:12.2,   lat_fin:41.7  },
  { nombre:'Vístula',          tipo:'rio', ambito:'Europa',  lon:21.0,   lat:52.2,  lon_inicio:18.9,  lat_inicio:49.6,  lon_fin:18.9,   lat_fin:54.4  },
  { nombre:'Dniéper',          tipo:'rio', ambito:'Europa',  lon:32.0,   lat:48.5,  lon_inicio:33.8,  lat_inicio:55.9,  lon_fin:32.7,   lat_fin:46.5  },
  { nombre:'Ródano',           tipo:'rio', ambito:'Europa',  lon:4.8,    lat:43.5,  lon_inicio:8.3,   lat_inicio:46.5,  lon_fin:4.5,    lat_fin:43.4  },
  { nombre:'Alpes',            tipo:'cordillera', ambito:'Europa',  lon:10.2,   lat:46.8  },
  { nombre:'Cárpatos',         tipo:'cordillera', ambito:'Europa',  lon:23.5,   lat:48.5  },
  { nombre:'Urales',           tipo:'cordillera', ambito:'Europa',  lon:59.5,   lat:57.0  },
  { nombre:'Apeninos',         tipo:'cordillera', ambito:'Europa',  lon:13.5,   lat:42.5  },
  { nombre:'Balcanes',         tipo:'cordillera', ambito:'Europa',  lon:24.5,   lat:42.5  },
  { nombre:'Macizo Central',   tipo:'cordillera', ambito:'Europa',  lon:3.0,    lat:45.5  },
  { nombre:'Escandinavos',     tipo:'cordillera', ambito:'Europa',  lon:16.0,   lat:65.0  },
  { nombre:'Amazonas',         tipo:'rio', ambito:'América', lon:-60.0,  lat:-3.0,  lon_inicio:-77.0, lat_inicio:-10.5, lon_fin:-49.5,  lat_fin:-0.5  },
  { nombre:'Misisipi',         tipo:'rio', ambito:'América', lon:-90.0,  lat:32.0,  lon_inicio:-95.2, lat_inicio:47.2,  lon_fin:-89.1,  lat_fin:29.1  },
  { nombre:'Paraná',           tipo:'rio', ambito:'América', lon:-58.5,  lat:-27.0, lon_inicio:-46.5, lat_inicio:-20.5, lon_fin:-58.4,  lat_fin:-34.0 },
  { nombre:'Orinoco',          tipo:'rio', ambito:'América', lon:-64.5,  lat:7.0,   lon_inicio:-64.0, lat_inicio:2.4,   lon_fin:-62.2,  lat_fin:8.6   },
  { nombre:'Colorado',         tipo:'rio', ambito:'América', lon:-114.5, lat:36.0,  lon_inicio:-105.6,lat_inicio:40.4,  lon_fin:-114.8, lat_fin:31.9  },
  { nombre:'San Lorenzo',      tipo:'rio', ambito:'América', lon:-71.5,  lat:47.0,  lon_inicio:-79.0, lat_inicio:43.7,  lon_fin:-64.5,  lat_fin:49.3  },
  { nombre:'Yukón',            tipo:'rio', ambito:'América', lon:-139.0, lat:62.5,  lon_inicio:-135.0,lat_inicio:60.4,  lon_fin:-164.7, lat_fin:62.6  },
  { nombre:'Andes',            tipo:'cordillera', ambito:'América', lon:-68.0,  lat:-22.0 },
  { nombre:'Mont. Rocosas',    tipo:'cordillera', ambito:'América', lon:-110.0, lat:43.0  },
  { nombre:'Sierra Madre',     tipo:'cordillera', ambito:'América', lon:-103.0, lat:24.0  },
  { nombre:'Apalaches',        tipo:'cordillera', ambito:'América', lon:-82.5,  lat:37.0  },
  { nombre:'Nilo',             tipo:'rio', ambito:'África',  lon:32.5,   lat:18.0,  lon_inicio:32.9,  lat_inicio:0.4,   lon_fin:30.5,   lat_fin:31.5  },
  { nombre:'Congo',            tipo:'rio', ambito:'África',  lon:17.5,   lat:-3.5,  lon_inicio:29.5,  lat_inicio:-11.5, lon_fin:12.4,   lat_fin:-6.1  },
  { nombre:'Níger',            tipo:'rio', ambito:'África',  lon:5.5,    lat:13.0,  lon_inicio:-10.8, lat_inicio:9.6,   lon_fin:6.4,    lat_fin:5.3   },
  { nombre:'Zambeze',          tipo:'rio', ambito:'África',  lon:33.0,   lat:-15.5, lon_inicio:24.3,  lat_inicio:-11.5, lon_fin:36.0,   lat_fin:-18.9 },
  { nombre:'Orange',           tipo:'rio', ambito:'África',  lon:25.5,   lat:-28.5, lon_inicio:27.8,  lat_inicio:-29.4, lon_fin:16.5,   lat_fin:-28.6 },
  { nombre:'Atlas',            tipo:'cordillera', ambito:'África',  lon:-4.0,   lat:32.0  },
  { nombre:'Drakensberg',      tipo:'cordillera', ambito:'África',  lon:29.5,   lat:-29.5 },
  { nombre:'Tibesti',          tipo:'cordillera', ambito:'África',  lon:18.0,   lat:21.0  },
  { nombre:'Ahaggar',          tipo:'cordillera', ambito:'África',  lon:5.5,    lat:23.3  },
  { nombre:'Yangtsé',          tipo:'rio', ambito:'Asia',    lon:111.5,  lat:30.5,  lon_inicio:91.0,  lat_inicio:33.4,  lon_fin:121.5,  lat_fin:31.4  },
  { nombre:'Ganges',           tipo:'rio', ambito:'Asia',    lon:82.0,   lat:24.5,  lon_inicio:79.1,  lat_inicio:30.9,  lon_fin:89.0,   lat_fin:21.8  },
  { nombre:'Huang He',         tipo:'rio', ambito:'Asia',    lon:105.0,  lat:36.0,  lon_inicio:96.0,  lat_inicio:35.1,  lon_fin:118.5,  lat_fin:37.4  },
  { nombre:'Ob',               tipo:'rio', ambito:'Asia',    lon:69.0,   lat:62.0,  lon_inicio:85.9,  lat_inicio:52.4,  lon_fin:73.5,   lat_fin:66.8  },
  { nombre:'Éufrates',         tipo:'rio', ambito:'Asia',    lon:40.0,   lat:34.5,  lon_inicio:39.2,  lat_inicio:39.1,  lon_fin:47.5,   lat_fin:30.0  },
  { nombre:'Indo',             tipo:'rio', ambito:'Asia',    lon:68.5,   lat:27.5,  lon_inicio:81.0,  lat_inicio:31.8,  lon_fin:67.5,   lat_fin:23.6  },
  { nombre:'Mekong',           tipo:'rio', ambito:'Asia',    lon:102.5,  lat:17.0,  lon_inicio:94.5,  lat_inicio:33.5,  lon_fin:106.5,  lat_fin:9.6   },
  { nombre:'Lena',             tipo:'rio', ambito:'Asia',    lon:124.0,  lat:64.0,  lon_inicio:107.5, lat_inicio:53.5,  lon_fin:126.5,  lat_fin:72.5  },
  { nombre:'Tigris',           tipo:'rio', ambito:'Asia',    lon:44.0,   lat:33.5,  lon_inicio:38.4,  lat_inicio:38.5,  lon_fin:47.8,   lat_fin:30.0  },
  { nombre:'Himalaya',         tipo:'cordillera', ambito:'Asia',    lon:84.0,   lat:28.5  },
  { nombre:'Cáucaso',          tipo:'cordillera', ambito:'Asia',    lon:43.5,   lat:42.5  },
  { nombre:'Zagros',           tipo:'cordillera', ambito:'Asia',    lon:48.0,   lat:33.5  },
  { nombre:'Altái',            tipo:'cordillera', ambito:'Asia',    lon:88.0,   lat:50.0  },
  { nombre:'Karakórum',        tipo:'cordillera', ambito:'Asia',    lon:77.0,   lat:35.5  },
  { nombre:'Murray',           tipo:'rio', ambito:'Oceanía', lon:143.5,  lat:-34.5, lon_inicio:148.3, lat_inicio:-36.6, lon_fin:139.0,  lat_fin:-35.6 },
  { nombre:'Darling',          tipo:'rio', ambito:'Oceanía', lon:145.0,  lat:-31.0, lon_inicio:151.5, lat_inicio:-28.5, lon_fin:142.0,  lat_fin:-34.1 },
  { nombre:'Gascoyne',         tipo:'rio', ambito:'Oceanía', lon:115.0,  lat:-25.0, lon_inicio:117.8, lat_inicio:-25.6, lon_fin:113.6,  lat_fin:-24.9 },
  { nombre:'Lachlan',          tipo:'rio', ambito:'Oceanía', lon:148.0,  lat:-33.5, lon_inicio:149.8, lat_inicio:-34.4, lon_fin:145.0,  lat_fin:-34.0 },
  { nombre:'Cord. Divisoria',  tipo:'cordillera', ambito:'Oceanía', lon:149.0,  lat:-31.0 },
  { nombre:'Alpes del Sur',    tipo:'cordillera', ambito:'Oceanía', lon:170.5,  lat:-44.0 },
  { nombre:'Mac.Donnell',      tipo:'cordillera', ambito:'Oceanía', lon:133.5,  lat:-23.7 },
  { nombre:'Montes Flinders',  tipo:'cordillera', ambito:'Oceanía', lon:138.5,  lat:-32.0 },
];

// ── Config ────────────────────────────────────────────────────────────────────
const CONTINENTES    = ['Todo el mundo', 'Europa', 'América', 'África', 'Asia', 'Oceanía'];
const AMBITOS_FISICO = ['España', 'Europa', 'América', 'África', 'Asia', 'Oceanía', 'Todo el mundo'];
const N_PREGUNTAS    = 10;
const TIEMPO         = 20;

const VIEW_PENINSULA = { lonC: -3.5,  latC: 40.1, lonSpan: 18.5,  latSpan: 11.0 };
const VIEW_CANARIAS  = { lonC:-15.5,  latC: 28.4, lonSpan:  8.5,  latSpan:  4.5 };

const FISICO_VIEWS = {
  'España':        { lonC:  -3.5, latC:  40.1, lonSpan:  18.5, latSpan:  11.0 },
  'Europa':        { lonC:  20.0, latC:  54.0, lonSpan:  80.0, latSpan:  50.0 },
  'América':       { lonC: -80.0, latC:  15.0, lonSpan: 100.0, latSpan:  80.0 },
  'África':        { lonC:  22.0, latC:   5.0, lonSpan:  70.0, latSpan:  70.0 },
  'Asia':          { lonC:  90.0, latC:  35.0, lonSpan: 120.0, latSpan:  70.0 },
  'Oceanía':       { lonC: 150.0, latC: -25.0, lonSpan:  60.0, latSpan:  50.0 },
  'Todo el mundo': { lonC:   0.0, latC:  20.0, lonSpan: 360.0, latSpan: 175.0 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const norm = s =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

const getPool = (modoJuego, continente) =>
  modoJuego === 'provincias'
    ? PROVINCIAS
    : continente === 'Todo el mundo' ? PAISES : PAISES.filter(p => p.continente === continente);

const getPoolFisico = (ambito, tipo) => {
  let list = ELEMENTOS_GEO;
  if (ambito !== 'Todo el mundo') list = list.filter(e => e.ambito === ambito);
  if (tipo === 'rios')             list = list.filter(e => e.tipo === 'rio');
  else if (tipo === 'cordilleras') list = list.filter(e => e.tipo === 'cordillera');
  return list;
};

const getPoolBanderas = (continente) =>
  continente === 'Todo el mundo' ? PAISES_BANDERAS : PAISES_BANDERAS.filter(p => p.continente === continente);

// Options pool for fisico: same scope + tipo; fallback to global if too small
const getOpcionesPool = (el, ambito) => {
  const scopePool = ambito === 'Todo el mundo'
    ? ELEMENTOS_GEO.filter(e => e.tipo === el.tipo)
    : ELEMENTOS_GEO.filter(e => e.tipo === el.tipo && e.ambito === ambito);
  return scopePool.length >= 4 ? scopePool : ELEMENTOS_GEO.filter(e => e.tipo === el.tipo);
};

const generarOpciones = (correcto, pool) =>
  shuffle([correcto, ...shuffle(pool.filter(p => p.nombre !== correcto.nombre)).slice(0, 3)]);

// Banderas options: same scope, extract country name or capital depending on preguntaTipo
const generarOpcionesBanderas = (item, pool) => {
  if (item.preguntaTipo === 'capital') {
    const distractors = shuffle(pool.filter(p => p.capital !== item.nombre)).slice(0, 3).map(p => ({ nombre: p.capital }));
    return shuffle([{ nombre: item.nombre }, ...distractors]);
  } else {
    const distractors = shuffle(pool.filter(p => p.nombre !== item.nombre)).slice(0, 3).map(p => ({ nombre: p.nombre }));
    return shuffle([{ nombre: item.nombre }, ...distractors]);
  }
};

const findFeature = (features, item) => {
  const n1 = item.nameEn || item.nombre, n2 = item.nameAlt;
  const nm1 = norm(n1), nm2 = n2 ? norm(n2) : null;
  return (
    features.find(f => f.properties?.name === n1) ||
    (n2 && features.find(f => f.properties?.name === n2)) ||
    features.find(f => norm(f.properties?.name) === nm1) ||
    (nm2 && features.find(f => norm(f.properties?.name) === nm2)) ||
    features.find(f => { const fn = norm(f.properties?.name || ''); return fn && (fn.includes(nm1) || (nm1.includes(fn) && nm1.length > 3)); }) ||
    null
  );
};

const getBoundsMain = geom => {
  let rings = [];
  if (geom.type === 'Polygon') rings = [geom.coordinates[0]];
  else if (geom.type === 'MultiPolygon') {
    let best = [], bestLen = 0;
    geom.coordinates.forEach(poly => { if (poly[0].length > bestLen) { best = poly[0]; bestLen = poly[0].length; } });
    rings = [best];
  }
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  rings.forEach(r => r.forEach(([lon, lat]) => {
    if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
  }));
  return { minLon, maxLon, minLat, maxLat };
};

const worldAutoView = feature => {
  const { minLon, maxLon, minLat, maxLat } = getBoundsMain(feature.geometry);
  const lonSpan = Math.max(maxLon - minLon, 0.5);
  const latSpan = Math.max(maxLat - minLat, 0.5);
  const pad = Math.max(lonSpan, latSpan) * 0.65;
  return { lonC: (minLon + maxLon) / 2, latC: (minLat + maxLat) / 2, lonSpan: lonSpan + pad * 2, latSpan: latSpan + pad * 2 };
};

const provAutoView = feature => {
  const { minLon, maxLon } = getBoundsMain(feature.geometry);
  const lonC = (minLon + maxLon) / 2;
  return lonC < -10 ? { ...VIEW_CANARIAS } : { ...VIEW_PENINSULA };
};

const playSound = (type) => {
  const file = type === 'CORRECT' ? correctSoundFile : wrongSoundFile;
  const audio = new Audio(file);
  audio.volume = 0.6;
  audio.play().catch(() => {});
  if (type === 'CORRECT') setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1500);
};

// ── Projection ────────────────────────────────────────────────────────────────
const makeProjFromView = (lonC, latC, lonSpan, latSpan, W, H) => {
  const pad = 28;
  const cos = Math.max(0.1, Math.cos((latC * Math.PI) / 180));
  const availW = W - 2 * pad, availH = H - 2 * pad;
  const scale = Math.min(availW / (lonSpan * cos), availH / latSpan);
  const projW = lonSpan * cos * scale;
  const projH = latSpan * scale;
  const offX = pad + (availW - projW) / 2;
  const offY = pad + (availH - projH) / 2;
  const vL = lonC - lonSpan / 2;
  const vT = latC + latSpan / 2;
  return {
    fwd: (lon, lat) => ({ x: offX + (lon - vL) * cos * scale, y: offY + (vT - lat) * scale }),
    inv: (x, y)     => ({ lon: vL + (x - offX) / (cos * scale), lat: vT - (y - offY) / scale }),
    cos, scale, offX, offY,
  };
};

const renderMap = (canvas, features, targetFeature, view, bgColor = '#bfdbfe', grayColor = '#c5d4e0') => {
  const { lonC, latC, lonSpan, latSpan } = view;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);
  const { fwd } = makeProjFromView(lonC, latC, lonSpan, latSpan, W, H);
  const drawGeom = (geom, fill, stroke, lw) => {
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    const drawRing = ring => {
      if (ring.length < 2) return;
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => { const { x, y } = fwd(lon, lat); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    if (geom.type === 'Polygon') geom.coordinates.forEach(drawRing);
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(drawRing));
  };
  for (const f of features) {
    if (f === targetFeature) continue;
    drawGeom(f.geometry, grayColor, '#8fa8bb', 0.5);
  }
  if (targetFeature) drawGeom(targetFeature.geometry, '#3b82f6', '#1e3a8a', 2);
};

const drawMarker = (ctx, cx, cy, tipo) => {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 10;
  if (tipo === 'rio') {
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white'; ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('〜', cx, cy + 1);
  } else {
    ctx.fillStyle = '#78350f';
    ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + 17, cy + 11); ctx.lineTo(cx - 17, cy + 11); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + 9, cy - 5); ctx.lineTo(cx - 9, cy - 5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
};

const drawRio = (ctx, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 6;
  // River body
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = len < 6 ? 4 : 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Source circle (nacimiento)
  ctx.fillStyle = '#93c5fd';
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x1, y1, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Arrowhead at mouth (desembocadura)
  if (len > 3) {
    const ux = dx / len, uy = dy / len;
    const ax = x2 - ux * 12, ay = y2 - uy * 12;
    const px = -uy * 6, py = ux * 6;
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(ax + px, ay + py);
    ctx.lineTo(ax - px, ay - py);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

const inp = { width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'#f1f5f9', fontSize:'0.92rem', outline:'none', boxSizing:'border-box' };

// ── Component ─────────────────────────────────────────────────────────────────
export default function GeografiaApp({ onBack }) {
  const [pantalla,          setPantalla]          = useState('intro');
  const [modoJuego,         setModoJuego]         = useState('mundo');
  const [continente,        setContinente]        = useState('Europa');
  const [ambitoFisico,      setAmbitoFisico]      = useState('España');
  const [tipoFisico,        setTipoFisico]        = useState('mixto');
  const [tipoPreguntaBandera, setTipoPreguntaBandera] = useState('nombre');
  const [modo,              setModo]              = useState('seleccionar');
  const [worldFeats,        setWorldFeats]        = useState(null);
  const [espFeats,          setEspFeats]          = useState(null);
  const [cargando,          setCargando]          = useState(false);
  const [preguntas,         setPreguntas]         = useState([]);
  const [idx,               setIdx]               = useState(0);
  const [opciones,          setOpciones]          = useState([]);
  const [respuestas,        setRespuestas]        = useState([]);
  const [tiempo,            setTiempo]            = useState(TIEMPO);
  const [fase,              setFase]              = useState('jugando');
  const [correcto,          setCorrecto]          = useState(null);
  const [input,             setInput]             = useState('');
  const [zoomed,            setZoomed]            = useState(false);
  const [modalEnviar,       setModalEnviar]       = useState(false);
  const [mNombre,           setMNombre]           = useState('');
  const [mCurso,            setMCurso]            = useState('');
  const [mCodigo,           setMCodigo]           = useState('');
  const [enviando,          setEnviando]          = useState(false);

  const canvasRef         = useRef(null);
  const timerRef          = useRef(null);
  const inputRef          = useRef(null);
  const viewRef           = useRef(null);
  const baseViewRef       = useRef(null);
  const targetRef         = useRef(null);
  const elementoFisicoRef = useRef(null);
  const isPanRef          = useRef(false);
  const panStartRef       = useRef(null);
  const lastTouchRef      = useRef(null);

  const currentFeatures = modoJuego === 'provincias' ? espFeats : worldFeats;

  const ensureFeatures = useCallback((juego) => {
    if (juego === 'mundo') {
      if (_worldCache) { setWorldFeats(_worldCache); return Promise.resolve(); }
      setCargando(true);
      return fetch(WORLD_URL).then(r => r.json()).then(d => { _worldCache = d.features; setWorldFeats(_worldCache); setCargando(false); }).catch(() => setCargando(false));
    } else {
      if (_espCache) { setEspFeats(_espCache); return Promise.resolve(); }
      setCargando(true);
      return fetch(ESP_PROV_URL).then(r => r.json()).then(d => { _espCache = d.features; setEspFeats(_espCache); setCargando(false); }).catch(() => setCargando(false));
    }
  }, []);

  useEffect(() => {
    if (modoJuego === 'fisico') ensureFeatures('mundo');
    else if (modoJuego !== 'banderas') ensureFeatures(modoJuego);
  }, [modoJuego, ensureFeatures]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewRef.current) return;
    if (modoJuego === 'fisico') {
      if (!worldFeats) return;
      renderMap(canvas, worldFeats, null, viewRef.current, '#bfdbfe', '#c5d4e0');
      const el = elementoFisicoRef.current;
      if (el) {
        const { lonC, latC, lonSpan, latSpan } = viewRef.current;
        const W = canvas.width, H = canvas.height;
        const { fwd } = makeProjFromView(lonC, latC, lonSpan, latSpan, W, H);
        const ctx2 = canvas.getContext('2d');
        if (el.tipo === 'rio' && el.lon_inicio != null) {
          const { x: x1, y: y1 } = fwd(el.lon_inicio, el.lat_inicio);
          const { x: x2, y: y2 } = fwd(el.lon_fin, el.lat_fin);
          drawRio(ctx2, x1, y1, x2, y2);
        } else {
          const { x, y } = fwd(el.lon, el.lat);
          drawMarker(ctx2, x, y, el.tipo);
        }
      }
    } else {
      const feats = modoJuego === 'provincias' ? espFeats : worldFeats;
      if (!feats) return;
      const bg   = modoJuego === 'provincias' ? '#d4e8f5' : '#bfdbfe';
      const gray = modoJuego === 'provincias' ? '#b8cdd8' : '#c5d4e0';
      renderMap(canvas, feats, targetRef.current, viewRef.current, bg, gray);
    }
  }, [worldFeats, espFeats, modoJuego]);

  const resetView = useCallback(() => {
    if (!baseViewRef.current) return;
    viewRef.current = { ...baseViewRef.current };
    setZoomed(false);
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (pantalla !== 'quiz' || !preguntas[idx]) return;
    if (modoJuego === 'banderas') return;
    if (modoJuego === 'fisico') {
      const el = preguntas[idx];
      elementoFisicoRef.current = el;
      targetRef.current = null;
      const v = { ...FISICO_VIEWS[ambitoFisico] };
      baseViewRef.current = v;
      viewRef.current = { ...v };
      setZoomed(false);
      redraw();
    } else {
      if (!currentFeatures) return;
      const item = preguntas[idx];
      const target = findFeature(currentFeatures, item);
      targetRef.current = target;
      const v = target
        ? (modoJuego === 'provincias' ? provAutoView(target) : worldAutoView(target))
        : { lonC: 0, latC: 20, lonSpan: 360, latSpan: 180 };
      baseViewRef.current = v;
      viewRef.current = { ...v };
      setZoomed(false);
      redraw();
    }
  }, [currentFeatures, worldFeats, idx, pantalla, preguntas, modoJuego, ambitoFisico, redraw]);

  useEffect(() => {
    if (pantalla === 'quiz' && modoJuego !== 'banderas') redraw();
  }, [currentFeatures, worldFeats, redraw, pantalla, modoJuego]);

  useEffect(() => {
    if (pantalla !== 'quiz' || modo !== 'seleccionar' || !preguntas[idx]) return;
    if (modoJuego === 'banderas') {
      setOpciones(generarOpcionesBanderas(preguntas[idx], getPoolBanderas(continente)));
    } else if (modoJuego === 'fisico') {
      const el = preguntas[idx];
      setOpciones(generarOpciones(el, getOpcionesPool(el, ambitoFisico)));
    } else {
      setOpciones(generarOpciones(preguntas[idx], getPool(modoJuego, continente)));
    }
  }, [idx, pantalla, preguntas, modo, continente, modoJuego, ambitoFisico]);

  useEffect(() => {
    if (pantalla !== 'quiz' || fase !== 'jugando') return;
    timerRef.current = setInterval(() => {
      setTiempo(t => {
        if (t <= 1) { clearInterval(timerRef.current); procesarRespuesta(null); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [pantalla, fase, idx]); // eslint-disable-line

  const procesarRespuesta = useCallback((respuesta) => {
    clearInterval(timerRef.current);
    const item = preguntas[idx];
    if (!item) return;
    const esCorrecta = respuesta !== null && norm(respuesta) === norm(item.nombre);
    playSound(esCorrecta ? 'CORRECT' : 'WRONG');
    setCorrecto(esCorrecta);
    setFase('feedback');
    setRespuestas(prev => [...prev, {
      correcto: esCorrecta,
      pais: item.nombre,
      paisNombre: item.paisNombre || item.nombre,
      iso2: item.iso2,
      preguntaTipo: item.preguntaTipo,
      dada: respuesta,
    }]);
    setTimeout(() => {
      const next = idx + 1;
      if (next >= preguntas.length) { setPantalla('resultado'); return; }
      setIdx(next);
      setFase('jugando');
      setTiempo(TIEMPO);
      setInput('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }, 1600);
  }, [idx, preguntas]);

  const iniciarTest = () => {
    let qs;
    if (modoJuego === 'banderas') {
      const pool = getPoolBanderas(continente);
      if (pool.length < 4) return;
      qs = shuffle(pool).slice(0, Math.min(N_PREGUNTAS, pool.length)).map(p => {
        const preguntaTipo = tipoPreguntaBandera === 'mixto'
          ? (Math.random() > 0.5 ? 'nombre' : 'capital')
          : tipoPreguntaBandera;
        return {
          nombre:      preguntaTipo === 'capital' ? p.capital : p.nombre,
          paisNombre:  p.nombre,
          iso2:        p.iso2,
          continente:  p.continente,
          preguntaTipo,
        };
      });
    } else if (modoJuego === 'fisico') {
      const pool = getPoolFisico(ambitoFisico, tipoFisico);
      if (pool.length < 2) return;
      qs = shuffle(pool).slice(0, Math.min(N_PREGUNTAS, pool.length));
    } else {
      const pool = getPool(modoJuego, continente);
      if (pool.length < 2) return;
      qs = shuffle(pool).slice(0, Math.min(N_PREGUNTAS, pool.length));
    }
    setPreguntas(qs);
    setIdx(0);
    setRespuestas([]);
    setFase('jugando');
    setTiempo(TIEMPO);
    setInput('');
    setPantalla('quiz');
  };

  const enviarAlProfesor = async (aciertos, total) => {
    if (!mNombre.trim()) { alert('Introduce tu nombre'); return; }
    const cod = mCodigo.trim().toUpperCase();
    if (cod.length < 3) { alert('Introduce el código de tu profesor'); return; }
    setEnviando(true);
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', cod));
      if (!snap.exists()) { alert('Código de profesor no encontrado. Pídelo a tu profe.'); setEnviando(false); return; }
      const pct = Math.round((aciertos / total) * 100);
      const zona = modoJuego === 'mundo' || modoJuego === 'banderas' ? continente
        : modoJuego === 'fisico' ? ambitoFisico : 'España';
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'GEOGRAFIA',
        modalidad: 'Individual',
        fecha: new Date(),
        codigoProfesor: cod,
        config: {
          modoJuego,
          zona,
          tipoElemento:    modoJuego === 'fisico' ? tipoFisico : null,
          tipoPregunta:    modoJuego === 'banderas' ? tipoPreguntaBandera : null,
          modoRespuesta:   modo,
        },
        jugadores: [{
          nombre:     mNombre.trim(),
          curso:      mCurso.trim(),
          aciertos,
          intentos:   total,
          fallos:     total - aciertos,
          porcentaje: pct,
        }],
      });
      alert('✅ Resultado enviado al profesor.');
      setModalEnviar(false);
      setMNombre(''); setMCurso(''); setMCodigo('');
    } catch (e) { alert('Error al enviar: ' + e.message); }
    setEnviando(false);
  };

  // ── Zoom + Pan ──────────────────────────────────────────────────────────────
  const canvasToGeo = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas || !viewRef.current) return null;
    const { lonC, latC, lonSpan, latSpan } = viewRef.current;
    const W = canvas.width, H = canvas.height;
    const { inv } = makeProjFromView(lonC, latC, lonSpan, latSpan, W, H);
    const rect = canvas.getBoundingClientRect();
    return inv((clientX - rect.left) * (W / rect.width), (clientY - rect.top) * (H / rect.height));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = e => {
      e.preventDefault();
      if (!viewRef.current) return;
      const { lonC: oL, latC: oA, lonSpan, latSpan } = viewRef.current;
      const factor = e.deltaY < 0 ? 0.78 : 1.28;
      const newLS = Math.max(0.5, Math.min(360, lonSpan * factor));
      const newAS = Math.max(0.2, Math.min(180, latSpan * factor));
      const geo = canvasToGeo(e.clientX, e.clientY);
      let nL = oL, nA = oA;
      if (geo) {
        const W = canvas.width, H = canvas.height;
        const rect = canvas.getBoundingClientRect();
        const fx = (e.clientX - rect.left) * (W / rect.width) / W;
        const fy = (e.clientY - rect.top)  * (H / rect.height) / H;
        nL = geo.lon - (fx - 0.5) * newLS;
        nA = geo.lat + (fy - 0.5) * newAS;
      }
      viewRef.current = { lonC: nL, latC: nA, lonSpan: newLS, latSpan: newAS };
      setZoomed(true);
      redraw();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasToGeo, redraw]);

  const onMouseDown = useCallback(e => {
    if (e.button !== 0) return;
    isPanRef.current = true;
    panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, ...viewRef.current };
  }, []);

  const onMouseMove = useCallback(e => {
    if (!isPanRef.current || !panStartRef.current || !viewRef.current) return;
    const { mouseX, mouseY, lonC, latC, lonSpan, latSpan } = panStartRef.current;
    const canvas = canvasRef.current; if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const rect = canvas.getBoundingClientRect();
    const { cos, scale } = makeProjFromView(lonC, latC, lonSpan, latSpan, W, H);
    const dx = (e.clientX - mouseX) * (W / rect.width);
    const dy = (e.clientY - mouseY) * (H / rect.height);
    viewRef.current = { lonC: lonC - dx / (cos * scale), latC: latC + dy / scale, lonSpan, latSpan };
    setZoomed(true);
    redraw();
  }, [redraw]);

  const onMouseUp   = useCallback(() => { isPanRef.current = false; }, []);

  const onTouchStart = useCallback(e => {
    if (e.touches.length === 1) {
      isPanRef.current = true;
      panStartRef.current = { mouseX: e.touches[0].clientX, mouseY: e.touches[0].clientY, ...viewRef.current };
    } else if (e.touches.length === 2) {
      isPanRef.current = false;
      lastTouchRef.current = [{ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY }];
    }
  }, []);

  const onTouchMove = useCallback(e => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanRef.current && panStartRef.current) {
      const { mouseX, mouseY, lonC, latC, lonSpan, latSpan } = panStartRef.current;
      const canvas = canvasRef.current;
      const W = canvas.width, H = canvas.height;
      const rect = canvas.getBoundingClientRect();
      const { cos, scale } = makeProjFromView(lonC, latC, lonSpan, latSpan, W, H);
      const dx = (e.touches[0].clientX - mouseX) * (W / rect.width);
      const dy = (e.touches[0].clientY - mouseY) * (H / rect.height);
      viewRef.current = { lonC: lonC - dx / (cos * scale), latC: latC + dy / scale, lonSpan, latSpan };
      setZoomed(true);
      redraw();
    } else if (e.touches.length === 2 && lastTouchRef.current) {
      const prev = lastTouchRef.current;
      const cur = [{ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY }];
      const prevDist = Math.hypot(prev[1].x - prev[0].x, prev[1].y - prev[0].y);
      const curDist  = Math.hypot(cur[1].x - cur[0].x, cur[1].y - cur[0].y);
      if (prevDist > 0 && viewRef.current) {
        const f = prevDist / curDist;
        const { lonSpan, latSpan } = viewRef.current;
        viewRef.current = { ...viewRef.current, lonSpan: Math.max(0.5, Math.min(360, lonSpan * f)), latSpan: Math.max(0.2, Math.min(180, latSpan * f)) };
        setZoomed(true);
        redraw();
      }
      lastTouchRef.current = cur;
    }
  }, [redraw]);

  const onTouchEnd = useCallback(() => { isPanRef.current = false; lastTouchRef.current = null; }, []);

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (pantalla === 'intro') {
    const poolSize = modoJuego === 'fisico' ? getPoolFisico(ambitoFisico, tipoFisico).length
      : modoJuego === 'banderas' ? getPoolBanderas(continente).length
      : getPool(modoJuego, continente).length;
    const canStart = poolSize >= 2 && !cargando;

    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1e3a5f 0%,#1e40af 50%,#0f766e 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'sans-serif' }}>
        <button onClick={onBack} style={{ position:'absolute', top:16, left:16, background:'rgba(255,255,255,0.15)', border:'none', color:'white', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:'0.9rem' }}>← Volver</button>

        <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:24, padding:'32px 28px', maxWidth:520, width:'100%', textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:6 }}>🌍</div>
          <h1 style={{ color:'white', margin:'0 0 4px', fontSize:'1.8rem', fontWeight:900 }}>Test de Geografía</h1>
          <p style={{ color:'rgba(255,255,255,0.6)', margin:'0 0 22px', fontSize:'0.92rem' }}>10 preguntas · 20 segundos por pregunta</p>

          {/* Mode tabs — 2 rows */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:22, background:'rgba(0,0,0,0.25)', borderRadius:14, padding:4 }}>
            {[['mundo','🌍','Países'],['provincias','🗺️','Provincias ESP'],['fisico','🏔️','Geo. Física'],['banderas','🚩','Banderas']].map(([m, ico, lbl]) => (
              <button key={m} onClick={() => setModoJuego(m)}
                style={{ padding:'9px 6px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.8rem', transition:'all .15s',
                  background: modoJuego === m ? 'rgba(255,255,255,0.18)' : 'transparent',
                  color: modoJuego === m ? 'white' : 'rgba(255,255,255,0.5)' }}>
                {ico} {lbl}
              </button>
            ))}
          </div>

          {/* Continent selector — mundo & banderas */}
          {(modoJuego === 'mundo' || modoJuego === 'banderas') && (
            <div style={{ marginBottom:18, textAlign:'left' }}>
              <label style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.8rem', fontWeight:700, display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>Continente</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                {CONTINENTES.map(c => (
                  <button key={c} onClick={() => setContinente(c)}
                    style={{ padding:'7px 12px', borderRadius:18, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.8rem',
                      background: continente === c ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                      color: continente === c ? 'white' : 'rgba(255,255,255,0.65)' }}>
                    {c}
                  </button>
                ))}
              </div>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.74rem', marginTop:6 }}>{poolSize} {modoJuego === 'banderas' ? 'países' : 'países'} disponibles</p>
            </div>
          )}

          {/* Banderas: what to ask */}
          {modoJuego === 'banderas' && (
            <div style={{ marginBottom:18, textAlign:'left' }}>
              <label style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.8rem', fontWeight:700, display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>¿Qué preguntar?</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['nombre','🌍','Nombre del país'],['capital','🏛️','Capital'],['mixto','🎲','Mixto']].map(([v, ico, lbl]) => (
                  <button key={v} onClick={() => setTipoPreguntaBandera(v)}
                    style={{ flex:1, padding:'9px 6px', borderRadius:12,
                      border:`2px solid ${tipoPreguntaBandera === v ? '#3b82f6' : 'rgba(255,255,255,0.12)'}`,
                      background: tipoPreguntaBandera === v ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.04)',
                      color:'white', cursor:'pointer', fontWeight:700, fontSize:'0.78rem' }}>
                    {ico}<br/><span style={{ fontSize:'0.7rem', fontWeight:400, opacity:0.8 }}>{lbl}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Provinces info */}
          {modoJuego === 'provincias' && (
            <div style={{ marginBottom:18, background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'11px 14px', textAlign:'left' }}>
              <span style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.85rem' }}>🗺️ Identifica las <b style={{color:'white'}}>{PROVINCIAS.length} provincias</b> de España por su forma en el mapa</span>
            </div>
          )}

          {/* Physical geography selectors */}
          {modoJuego === 'fisico' && (
            <>
              <div style={{ marginBottom:14, textAlign:'left' }}>
                <label style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.8rem', fontWeight:700, display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:1 }}>Zona geográfica</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {AMBITOS_FISICO.map(a => (
                    <button key={a} onClick={() => setAmbitoFisico(a)}
                      style={{ padding:'6px 11px', borderRadius:18, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.78rem',
                        background: ambitoFisico === a ? '#0d9488' : 'rgba(255,255,255,0.1)',
                        color: ambitoFisico === a ? 'white' : 'rgba(255,255,255,0.65)' }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:18, textAlign:'left' }}>
                <label style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.8rem', fontWeight:700, display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:1 }}>Tipo de elemento</label>
                <div style={{ display:'flex', gap:8 }}>
                  {[['mixto','🌊⛰️','Mixto'],['rios','🌊','Solo ríos'],['cordilleras','⛰️','Solo cordilleras']].map(([v, ico, lbl]) => (
                    <button key={v} onClick={() => setTipoFisico(v)}
                      style={{ flex:1, padding:'9px 6px', borderRadius:12,
                        border:`2px solid ${tipoFisico === v ? '#0d9488' : 'rgba(255,255,255,0.12)'}`,
                        background: tipoFisico === v ? 'rgba(13,148,136,0.25)' : 'rgba(255,255,255,0.04)',
                        color:'white', cursor:'pointer', fontWeight:700, fontSize:'0.78rem' }}>
                      {ico}<br/><span style={{ fontSize:'0.7rem', fontWeight:400, opacity:0.8 }}>{lbl}</span>
                    </button>
                  ))}
                </div>
                <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.74rem', marginTop:6 }}>
                  {poolSize} elementos disponibles
                  {poolSize < 2 && <span style={{ color:'#f87171' }}> · Selecciona una zona con más elementos</span>}
                </p>
              </div>
            </>
          )}

          {/* Answer mode (not for banderas+capital since we need exact string) */}
          <div style={{ marginBottom:24, textAlign:'left' }}>
            <label style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.8rem', fontWeight:700, display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>Modo de respuesta</label>
            <div style={{ display:'flex', gap:10 }}>
              {[['seleccionar','🔘','Elegir opción'],['escribir','⌨️','Escribir el nombre']].map(([m, ico, lbl]) => (
                <button key={m} onClick={() => setModo(m)}
                  style={{ flex:1, padding:'11px 8px', borderRadius:12,
                    border:`2px solid ${modo === m ? '#3b82f6' : 'rgba(255,255,255,0.12)'}`,
                    background: modo === m ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.04)',
                    color:'white', cursor:'pointer', fontWeight:700, fontSize:'0.85rem' }}>
                  {ico}<br/><span style={{ fontSize:'0.72rem', fontWeight:400, opacity:0.8 }}>{lbl}</span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={iniciarTest} disabled={!canStart}
            style={{ width:'100%', padding:'14px 0', borderRadius:14, border:'none', background:'#3b82f6', color:'white', fontSize:'1.1rem', fontWeight:900, cursor: canStart ? 'pointer' : 'not-allowed', opacity: canStart ? 1 : 0.5 }}>
            {cargando ? '⏳ Cargando mapas…' : '¡Empezar!'}
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTADO ──────────────────────────────────────────────────────────────
  if (pantalla === 'resultado') {
    const aciertos = respuestas.filter(r => r.correcto).length;
    const total    = respuestas.length;
    const pct      = Math.round((aciertos / total) * 100);
    const emoji    = pct === 100 ? '🏆' : pct >= 70 ? '😃' : pct >= 40 ? '😅' : '😢';
    const subtitulo = modoJuego === 'provincias' ? 'Provincias de España'
      : modoJuego === 'fisico'   ? `Geo. Física · ${ambitoFisico}`
      : modoJuego === 'banderas' ? `Banderas · ${continente}`
      : continente;
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1e3a5f 0%,#1e40af 50%,#0f766e 100%)', display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 20px', fontFamily:'sans-serif' }}>
        <div style={{ background:'rgba(255,255,255,0.08)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:24, padding:'32px 24px', maxWidth:480, width:'100%' }}>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:60 }}>{emoji}</div>
            <h2 style={{ color:'white', margin:'8px 0 4px', fontSize:'1.8rem' }}>{aciertos}/{total}</h2>
            <p style={{ color:'rgba(255,255,255,0.55)', margin:0 }}>{pct}% de acierto · {subtitulo}</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
            {respuestas.map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, background: r.correcto ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)', borderRadius:10, padding:'7px 11px', border:`1px solid ${r.correcto ? 'rgba(34,197,94,0.28)' : 'rgba(239,68,68,0.28)'}` }}>
                {r.iso2 && <img src={FLAG_URL(r.iso2)} alt="" style={{ height:18, borderRadius:2, flexShrink:0, objectFit:'cover' }} />}
                <span style={{ fontSize:14 }}>{r.correcto ? '✅' : '❌'}</span>
                <span style={{ color:'white', fontWeight:700, flex:1, fontSize:'0.85rem' }}>
                  {r.preguntaTipo === 'capital' ? `${r.paisNombre} → ${r.pais}` : r.pais}
                </span>
                {!r.correcto && <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.74rem' }}>{r.dada ? `"${r.dada}"` : 'Sin resp.'}</span>}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, marginBottom:10 }}>
            <button onClick={() => { setPreguntas([]); setPantalla('intro'); }} style={{ flex:1, padding:'12px 0', borderRadius:12, border:'2px solid rgba(255,255,255,0.25)', background:'transparent', color:'white', fontWeight:700, cursor:'pointer' }}>← Menú</button>
            <button onClick={iniciarTest} style={{ flex:1, padding:'12px 0', borderRadius:12, border:'none', background:'#3b82f6', color:'white', fontWeight:900, cursor:'pointer' }}>🔄 Repetir</button>
          </div>
          <button onClick={() => setModalEnviar(true)}
            style={{ width:'100%', padding:'11px 0', borderRadius:12, border:'none', background:'rgba(124,58,237,0.85)', color:'white', fontWeight:700, fontSize:'0.92rem', cursor:'pointer' }}>
            📤 Enviar resultado al Profesor
          </button>
        </div>

        {/* Modal enviar */}
        {modalEnviar && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
            <div style={{ background:'#1e1b4b', borderRadius:18, padding:28, width:'100%', maxWidth:380, border:'1.5px solid rgba(167,139,250,0.3)', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>
              <h3 style={{ margin:'0 0 18px', color:'#f1f5f9', fontSize:'1.1rem', fontWeight:700 }}>📤 Enviar al Profesor</h3>
              <div style={{ marginBottom:11 }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.82rem', marginBottom:5 }}>Tu nombre *</label>
                <input value={mNombre} onChange={e => setMNombre(e.target.value)} placeholder="Ej: Ana García" style={inp} />
              </div>
              <div style={{ marginBottom:11 }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.82rem', marginBottom:5 }}>Curso (opcional)</label>
                <input value={mCurso} onChange={e => setMCurso(e.target.value)} placeholder="Ej: 5ºA" style={inp} />
              </div>
              <div style={{ marginBottom:18 }}>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'0.82rem', marginBottom:5 }}>Código del Profesor *</label>
                <input value={mCodigo} onChange={e => setMCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10}
                  style={{ ...inp, fontFamily:'monospace', letterSpacing:2 }} />
              </div>
              <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:10, padding:'11px 13px', marginBottom:18, fontSize:'0.82rem' }}>
                <div style={{ color:'#a78bfa', fontWeight:700, marginBottom:7 }}>Resumen del test</div>
                <div style={{ display:'flex', justifyContent:'space-between', color:'#cbd5e1', marginBottom:3 }}>
                  <span>Modo</span>
                  <span style={{ color:'white', fontWeight:600 }}>
                    {modoJuego === 'mundo' ? `🌍 Países · ${continente}`
                      : modoJuego === 'fisico' ? `🏔️ Física · ${ambitoFisico}`
                      : modoJuego === 'banderas' ? `🚩 Banderas · ${continente}`
                      : '🗺️ Provincias de España'}
                  </span>
                </div>
                {modoJuego === 'banderas' && (
                  <div style={{ display:'flex', justifyContent:'space-between', color:'#cbd5e1', marginBottom:3 }}>
                    <span>Preguntar</span>
                    <span style={{ color:'white', fontWeight:600 }}>
                      {tipoPreguntaBandera === 'nombre' ? '🌍 Nombre' : tipoPreguntaBandera === 'capital' ? '🏛️ Capital' : '🎲 Mixto'}
                    </span>
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', color:'#cbd5e1', marginBottom:3 }}>
                  <span>Respuesta</span>
                  <span style={{ color:'white', fontWeight:600 }}>{modo === 'seleccionar' ? '🔘 Opciones' : '⌨️ Escrito'}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid rgba(255,255,255,0.1)', marginTop:7, paddingTop:7, fontWeight:700, color:'#f1f5f9' }}>
                  <span>Resultado</span>
                  <span style={{ color: pct >= 70 ? '#86efac' : '#fca5a5' }}>{aciertos}/{total} ({pct}%)</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setModalEnviar(false)}
                  style={{ flex:1, padding:'10px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.18)', background:'transparent', color:'#94a3b8', cursor:'pointer', fontWeight:600 }}>
                  Cancelar
                </button>
                <button onClick={() => enviarAlProfesor(aciertos, total)} disabled={enviando}
                  style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background: enviando ? '#4c1d95' : '#7c3aed', color:'white', cursor: enviando ? 'default' : 'pointer', fontWeight:700 }}>
                  {enviando ? 'Enviando…' : '📤 Enviar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── QUIZ ───────────────────────────────────────────────────────────────────
  const item = preguntas[idx];
  const tiempoColor = tiempo > 10 ? '#22c55e' : tiempo > 5 ? '#f59e0b' : '#ef4444';
  const modoLabel = modoJuego === 'provincias' ? '🗺️ Provincias'
    : modoJuego === 'fisico'   ? '🏔️ Geo. Física'
    : modoJuego === 'banderas' ? '🚩 Banderas'
    : '🌍 Países';

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1e3a5f 0%,#1e40af 50%,#0f766e 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:16, fontFamily:'sans-serif' }}>

      {/* Header */}
      <div style={{ width:'100%', maxWidth:590, display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <button onClick={() => setPantalla('intro')} style={{ background:'rgba(255,255,255,0.12)', border:'none', color:'white', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontSize:'0.8rem' }}>← Salir</button>
        <span style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.82rem' }}>{modoLabel} · Pregunta {idx + 1}/{preguntas.length}</span>
        <span style={{ color:tiempoColor, fontWeight:900, fontSize:'1.2rem', minWidth:40, textAlign:'right' }}>{tiempo}s</span>
      </div>

      {/* Timer bar */}
      <div style={{ width:'100%', maxWidth:590, height:5, background:'rgba(255,255,255,0.14)', borderRadius:3, marginBottom:10, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:3, background:tiempoColor, width:`${(tiempo/TIEMPO)*100}%`, transition:'width 1s linear, background .3s' }} />
      </div>

      {/* Progress dots */}
      <div style={{ width:'100%', maxWidth:590, display:'flex', gap:4, marginBottom:12 }}>
        {preguntas.map((_, i) => (
          <div key={i} style={{ flex:1, height:4, borderRadius:2, background: i < idx ? '#22c55e' : i === idx ? '#3b82f6' : 'rgba(255,255,255,0.14)' }} />
        ))}
      </div>

      {/* Fisico question label */}
      {modoJuego === 'fisico' && item && (
        <div style={{ width:'100%', maxWidth:590, textAlign:'center', marginBottom:10 }}>
          <span style={{ background:'rgba(255,255,255,0.12)', color:'white', borderRadius:20, padding:'5px 18px', fontSize:'0.88rem', fontWeight:600 }}>
            {item.tipo === 'rio' ? '🌊 ¿Cómo se llama este río?' : '⛰️ ¿Cómo se llama esta cordillera?'}
          </span>
        </div>
      )}

      {/* ── FLAG display (banderas mode) ─────────────────────────────────── */}
      {modoJuego === 'banderas' ? (
        <div style={{ position:'relative', width:'100%', maxWidth:590, marginBottom:14, borderRadius:18, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.5)', background:'rgba(0,0,0,0.35)', minHeight:260, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px 20px 36px' }}>
          {item?.iso2 && (
            <img
              src={FLAG_URL(item.iso2)}
              alt="bandera"
              style={{ maxHeight:190, maxWidth:'85%', objectFit:'contain', borderRadius:8, boxShadow:'0 6px 24px rgba(0,0,0,0.5)' }}
            />
          )}
          <div style={{ marginTop:18, color:'rgba(255,255,255,0.85)', fontSize:'0.95rem', fontWeight:600, textAlign:'center' }}>
            {item?.preguntaTipo === 'capital' ? '🏛️ ¿Cuál es la capital de este país?' : '🌍 ¿Cómo se llama este país?'}
          </div>

          {/* Feedback overlay */}
          {fase === 'feedback' && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background: correcto ? 'rgba(22,163,74,0.82)' : 'rgba(185,28,28,0.82)', backdropFilter:'blur(4px)' }}>
              <div style={{ fontSize:62 }}>{correcto ? '✅' : '❌'}</div>
              {!correcto && (
                <>
                  <div style={{ color:'white', fontWeight:900, fontSize:'1.35rem', marginTop:8 }}>{item?.nombre}</div>
                  {item?.preguntaTipo === 'capital' && (
                    <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.85rem', marginTop:4 }}>Capital de {item?.paisNombre}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

      ) : (
        /* ── MAP display (all other modes) ──────────────────────────────── */
        <div style={{ position:'relative', width:'100%', maxWidth:590, marginBottom:14, borderRadius:18, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.5)', cursor: isPanRef.current ? 'grabbing' : 'grab' }}>
          <canvas ref={canvasRef} width={590} height={370}
            style={{ display:'block', width:'100%', height:'auto', userSelect:'none' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          />

          {modoJuego === 'provincias' && !zoomed && fase === 'jugando' && (
            <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.6)', color:'rgba(255,255,255,0.8)', fontSize:'0.72rem', borderRadius:8, padding:'4px 12px', pointerEvents:'none', whiteSpace:'nowrap' }}>
              La provincia azul está resaltada · ¿Cuál es?
            </div>
          )}
          {modoJuego === 'fisico' && !zoomed && fase === 'jugando' && (
            <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.6)', color:'rgba(255,255,255,0.8)', fontSize:'0.72rem', borderRadius:8, padding:'4px 12px', pointerEvents:'none', whiteSpace:'nowrap' }}>
              Busca el símbolo en el mapa · 🔍 Rueda para zoom
            </div>
          )}
          {!zoomed && (
            <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.48)', color:'rgba(255,255,255,0.6)', fontSize:'0.68rem', borderRadius:8, padding:'3px 10px', pointerEvents:'none', whiteSpace:'nowrap' }}>
              🔍 Rueda del ratón · Arrastra para mover
            </div>
          )}
          {zoomed && (
            <button onClick={resetView} style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.6)', border:'1px solid rgba(255,255,255,0.28)', color:'white', fontSize:'0.72rem', borderRadius:8, padding:'4px 12px', cursor:'pointer', whiteSpace:'nowrap' }}>
              ⟳ Restablecer vista
            </button>
          )}

          {/* Feedback overlay */}
          {fase === 'feedback' && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background: correcto ? 'rgba(22,163,74,0.75)' : 'rgba(185,28,28,0.75)', backdropFilter:'blur(4px)' }}>
              <div style={{ fontSize:62 }}>{correcto ? '✅' : '❌'}</div>
              {!correcto && <div style={{ color:'white', fontWeight:900, fontSize:'1.4rem', marginTop:8 }}>{item?.nombre}</div>}
            </div>
          )}
        </div>
      )}

      {/* Answer options */}
      {fase === 'jugando' && modo === 'seleccionar' && (
        <div style={{ width:'100%', maxWidth:590, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {opciones.map(op => (
            <button key={op.nombre} onClick={() => procesarRespuesta(op.nombre)}
              style={{ padding:'13px 10px', borderRadius:12, border:'2px solid rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.09)', color:'white', fontWeight:700, fontSize:'0.92rem', cursor:'pointer', transition:'background .12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
            >
              {op.nombre}
            </button>
          ))}
        </div>
      )}

      {fase === 'jugando' && modo === 'escribir' && (
        <div style={{ width:'100%', maxWidth:590, display:'flex', gap:10 }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && input.trim() && procesarRespuesta(input.trim())}
            placeholder={
              modoJuego === 'banderas'
                ? (item?.preguntaTipo === 'capital' ? 'Escribe el nombre de la capital…' : 'Escribe el nombre del país en español…')
                : modoJuego === 'fisico'
                ? `Escribe el nombre del ${item?.tipo === 'rio' ? 'río' : 'la cordillera'}…`
                : modoJuego === 'provincias'
                ? 'Escribe el nombre de la provincia…'
                : 'Escribe el nombre del país en español…'
            }
            autoFocus
            style={{ flex:1, padding:'13px 16px', borderRadius:12, border:'2px solid rgba(255,255,255,0.28)', background:'rgba(255,255,255,0.09)', color:'white', fontSize:'1rem', outline:'none' }} />
          <button onClick={() => input.trim() && procesarRespuesta(input.trim())} disabled={!input.trim()}
            style={{ padding:'13px 20px', borderRadius:12, border:'none', background:'#3b82f6', color:'white', fontWeight:900, cursor:'pointer', opacity:input.trim() ? 1 : 0.5 }}>OK</button>
        </div>
      )}

      {fase === 'feedback' && (
        <div style={{ width:'100%', maxWidth:590, textAlign:'center', color: correcto ? '#86efac' : '#fca5a5', fontWeight:700, fontSize:'1rem', paddingTop:8 }}>
          {correcto ? '¡Correcto!' : `La respuesta era: ${item?.nombre}`}
        </div>
      )}
    </div>
  );
}
