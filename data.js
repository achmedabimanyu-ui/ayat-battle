// Daftar surat. Teks ayat TIDAK diketik manual: diambil dari API resmi saat main (tahap 3).
window.SURAHS = [
  [1,"Al-Fatihah",7],
  [78,"An-Naba'",40],[79,"An-Nazi'at",46],[80,"'Abasa",42],[81,"At-Takwir",29],
  [82,"Al-Infitar",19],[83,"Al-Mutaffifin",36],[84,"Al-Insyiqaq",25],[85,"Al-Buruj",22],
  [86,"At-Tariq",17],[87,"Al-A'la",19],[88,"Al-Ghasyiyah",26],[89,"Al-Fajr",30],
  [90,"Al-Balad",20],[91,"Asy-Syams",15],[92,"Al-Lail",21],[93,"Ad-Duha",11],
  [94,"Asy-Syarh",8],[95,"At-Tin",8],[96,"Al-'Alaq",19],[97,"Al-Qadr",5],
  [98,"Al-Bayyinah",8],[99,"Az-Zalzalah",8],[100,"Al-'Adiyat",11],[101,"Al-Qari'ah",11],
  [102,"At-Takatsur",8],[103,"Al-'Asr",3],[104,"Al-Humazah",9],[105,"Al-Fil",5],
  [106,"Quraisy",4],[107,"Al-Ma'un",7],[108,"Al-Kautsar",3],[109,"Al-Kafirun",6],
  [110,"An-Nasr",3],[111,"Al-Lahab",5],[112,"Al-Ikhlas",4],[113,"Al-Falaq",5],[114,"An-Nas",6]
].map(([no,name,ayat]) => ({ no, name, ayat }));

window.MODES = [
  { id:"susun",    icon:"i-build", name:"Susun ayat",     desc:"Susun potongan ayat yang diacak" },
  { id:"sambung",  icon:"i-link",  name:"Sambung ayat",   desc:"Pilih lanjutan dari awal ayat" },
  { id:"lanjutkan",icon:"i-next",  name:"Lanjutkan ayat", desc:"Pilih ayat sesudahnya" }
];

window.CONTROLS = [
  { id:"pinch", icon:"i-pinch", name:"Jepit",  desc:"Pakai kamera, jepit dan seret" },
  { id:"shoot", icon:"i-aim",   name:"Tembak", desc:"Pakai kamera, bidik dan tembak" },
  { id:"touch", icon:"i-tap",   name:"Sentuh", desc:"Tanpa kamera, ketuk kartu" }
];

// Folder audio per ayat di everyayah.com
window.QARIS = [
  { id:"Husary_128kbps",          name:"Mahmud Khalil Al-Husary" },
  { id:"Alafasy_128kbps",         name:"Mishary Rashid Alafasy" },
  { id:"Minshawy_Mujawwad_192kbps", name:"Muhammad Siddiq Al-Minshawi" },
  { id:"Abdul_Basit_Murattal_192kbps", name:"Abdul Basit (murattal)" }
];

window.PLAY_TITLES = {
  "solo": "Main sendiri",
  "duel-local": "Duel satu layar",
  "duel-online": "Duel online"
};
