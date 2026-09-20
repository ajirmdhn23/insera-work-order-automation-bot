const now = new Date();

function minutesAgo(minutes) {
  return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
}

function minutesFromNow(minutes) {
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

const sampleDefinitions = [
  {
    prefix: "BTU",
    workZone: "BTU",
    location: "SA Batu",
    status: "STARTWORK",
    description: "Field Validation",
    productName: "INDIHOME",
    productType: "COMMON"
  },
  {
    prefix: "NTG",
    workZone: "NTG",
    location: "SA Batu",
    status: "WAPPR",
    description: "Remove ONT",
    productName: "INDIHOME",
    productType: "COMMON"
  },
  {
    prefix: "KPO",
    workZone: "KPO",
    location: "SA Batu",
    status: "COMPWORK",
    description: "Activation NTE",
    productName: "ASTINET",
    productType: "ENTERPRISE"
  },
  {
    prefix: "BLB",
    workZone: "BLB",
    location: "SA Bululawang",
    status: "STARTWORK",
    description: "New Install",
    productName: "INDIHOME",
    productType: "COMMON"
  },
  {
    prefix: "KLJ",
    workZone: "KLJ",
    location: "SA Klojen",
    status: "WAPPR",
    description: "Field Validation",
    productName: "INDIHOME",
    productType: "COMMON"
  },
  {
    prefix: "KEP",
    workZone: "KEP",
    location: "SA Kepanjen",
    status: "STARTWORK",
    description: "CE Jumpering",
    productName: "ASTINET",
    productType: "ENTERPRISE"
  },
  {
    prefix: "PGK",
    workZone: "PGK",
    location: "SA Kepanjen",
    status: "COMPWORK",
    description: "Activation NTE",
    productName: "VPN IP Domestik",
    productType: "ENTERPRISE"
  },
  {
    prefix: "TUR",
    workZone: "TUR",
    location: "SA Turen",
    status: "STARTWORK",
    description: "New Install",
    productName: "INDIHOME",
    productType: "COMMON"
  },
  {
    prefix: "DPT",
    workZone: "DPT",
    location: "SA Turen",
    status: "WAPPR",
    description: "Field Validation",
    productName: "INDIHOME",
    productType: "COMMON"
  },
  {
    prefix: "MLG",
    workZone: "MLG",
    location: "SA Malang",
    status: "STARTWORK",
    description: "Remove ONT",
    productName: "INDIHOME",
    productType: "COMMON"
  },
  {
    prefix: "SWJ",
    workZone: "SWJ",
    location: "SA Malang",
    status: "COMPWORK",
    description: "Activation NTE",
    productName: "ASTINET",
    productType: "ENTERPRISE"
  },
  {
    prefix: "PKS",
    workZone: "PKS",
    location: "SA Sawojajar",
    status: "STARTWORK",
    description: "New Install",
    productName: "INDIHOME",
    productType: "COMMON"
  },
  {
    prefix: "LWG",
    workZone: "LWG",
    location: "SA Sawojajar",
    status: "WAPPR",
    description: "Field Validation",
    productName: "INDIHOME",
    productType: "COMMON"
  },
  {
    prefix: "BLR",
    workZone: "BLR",
    location: "SA Blitar",
    status: "STARTWORK",
    description: "CE Jumpering",
    productName: "ASTINET",
    productType: "ENTERPRISE"
  },
  {
    prefix: "WGI",
    workZone: "WGI",
    location: "SA Blitar",
    status: "COMPWORK",
    description: "Activation NTE",
    productName: "VPN IP Domestik",
    productType: "ENTERPRISE"
  },
  {
    prefix: "TUL",
    workZone: "TUL",
    location: "SA Tulungagung",
    status: "STARTWORK",
    description: "New Install",
    productName: "INDIHOME",
    productType: "COMMON"
  },
  {
    prefix: "KWR",
    workZone: "KWR",
    location: "SA Tulungagung",
    status: "WAPPR",
    description: "Field Validation",
    productName: "INDIHOME",
    productType: "COMMON"
  }
];

const workOrders = Array.from({ length: 36 }, (_, index) => {
  const source = sampleDefinitions[index % sampleDefinitions.length];
  const sequence = String(index + 1).padStart(3, "0");
  const ageInMinutes = (index + 1) * 12;

  return {
    woNumber: `WO-${source.prefix}-${sequence}`,
    workZone: source.workZone,
    locationName: source.location,
    status: source.status,
    description: source.description,
    ownerGroup: "TIF FBB FFM DISTRICT MALANG",
    productName: source.productName,
    productType: source.productType,
    crmOrderType: index % 2 === 0 ? "CREATE" : "MODIFY",
    createdAt: minutesAgo(ageInMinutes),
    modifiedAt: minutesAgo(Math.max(ageInMinutes - 5, 1)),
    statusDate: minutesAgo(Math.max(ageInMinutes - 5, 1)),
    schedstart: minutesFromNow((index + 1) * 20),
    bookingDate: minutesFromNow((index + 1) * 20),
    syncedAt: now.toISOString()
  };
});

module.exports = {
  workOrders
};