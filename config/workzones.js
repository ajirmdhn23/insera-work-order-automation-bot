const serviceAreas = {
  "SA Batu": ["BTU", "NTG", "KPO"],
  "SA Blimbing": ["BLB"],
  "SA Klojen": ["KLJ"],
  "SA Kepanjen": ["KEP", "PGK", "SBP", "GKW", "DNO", "GDG"],
  "SA Turen": ["DPT", "SBM", "APG", "TUR", "BNR", "GDI"],
  "SA Malang": ["MLG", "SWJ", "BRG"],
  "SA Sawojajar": ["PKS", "TMP", "LWG", "SGS"],
  "SA Blitar": ["BLR", "SNT", "PAN", "BNU", "KBN", "LDY", "WGI"],
  "SA Tulungagung": ["CAT", "KWR", "NGU", "TUL"]
};

const callbackToServiceArea = {
  sa_batu: "SA Batu",
  sa_bululawang: "SA Blimbing",
  sa_klojen: "SA Klojen",
  sa_kepanjen: "SA Kepanjen",
  sa_turen: "SA Turen",
  sa_malang: "SA Malang",
  sa_sawojajar: "SA Sawojajar",
  sa_blitar: "SA Blitar",
  sa_tulungagung: "SA Tulungagung"
};

function getWorkzonesForServiceArea(serviceArea) {
  return Array.isArray(serviceAreas[serviceArea])
    ? [...serviceAreas[serviceArea]]
    : [];
}

function getServiceAreaFromCallback(callbackData) {
  return callbackToServiceArea[callbackData] || "";
}

module.exports = {
  serviceAreas,
  callbackToServiceArea,
  getWorkzonesForServiceArea,
  getServiceAreaFromCallback
};