// Airline names by the callsign's ICAO prefix: the operators most often seen
// within 60 nm of London. Anything else shows its callsign alone.
const ICAO: Record<string, string> = {
  AAL: 'American Airlines',
  ACA: 'Air Canada',
  AEA: 'Air Europa',
  AFR: 'Air France',
  AIC: 'Air India',
  AUA: 'Austrian',
  AUR: 'Aurigny',
  AZA: 'ITA Airways',
  BAW: 'British Airways',
  BCS: 'European Air Transport',
  BEL: 'Brussels Airlines',
  BOX: 'AeroLogic',
  CES: 'China Eastern',
  CFE: 'BA CityFlyer',
  CLH: 'Lufthansa CityLine',
  CPA: 'Cathay Pacific',
  CSN: 'China Southern',
  DAL: 'Delta',
  DLH: 'Lufthansa',
  EAI: 'Emerald Airlines',
  EFW: 'BA Euroflyer',
  EIN: 'Aer Lingus',
  ELY: 'El Al',
  ETD: 'Etihad',
  ETH: 'Ethiopian',
  EWG: 'Eurowings',
  EXS: 'Jet2',
  EZS: 'easyJet Switzerland',
  EZY: 'easyJet',
  FDX: 'FedEx',
  FIN: 'Finnair',
  GFA: 'Gulf Air',
  IBE: 'Iberia',
  ICE: 'Icelandair',
  JAL: 'Japan Airlines',
  KAL: 'Korean Air',
  KLM: 'KLM',
  KQA: 'Kenya Airways',
  LOG: 'Loganair',
  LOT: 'LOT Polish',
  MSR: 'EgyptAir',
  NAX: 'Norwegian',
  NOZ: 'Norwegian',
  NSZ: 'Norwegian',
  PIA: 'PIA',
  QFA: 'Qantas',
  QTR: 'Qatar Airways',
  RAM: 'Royal Air Maroc',
  RJA: 'Royal Jordanian',
  RYR: 'Ryanair',
  SAS: 'SAS',
  SDM: 'Rossiya',
  SHT: 'BA Shuttle',
  SIA: 'Singapore Airlines',
  SVA: 'Saudia',
  SWR: 'Swiss',
  TAP: 'TAP Air Portugal',
  THY: 'Turkish Airlines',
  TOM: 'TUI',
  TRA: 'Transavia',
  UAE: 'Emirates',
  UAL: 'United',
  UPS: 'UPS',
  VIR: 'Virgin Atlantic',
  VLG: 'Vueling',
  WUK: 'Wizz Air UK',
  WZZ: 'Wizz Air',
};

// A few operators broadcast the IATA code instead (BA123 rather than BAW123).
const IATA: Record<string, string> = {
  BA: 'British Airways',
  U2: 'easyJet',
  FR: 'Ryanair',
  LS: 'Jet2',
  VS: 'Virgin Atlantic',
  EI: 'Aer Lingus',
};

/** The airline flying this callsign, or null when the prefix is not a known airline. */
export function airlineOf(callsign: string | null | undefined): string | null {
  if (!callsign) return null;
  const cs = callsign.trim().toUpperCase();
  const icao = /^([A-Z]{3})\d/.exec(cs);
  if (icao) return ICAO[icao[1] as string] ?? null;
  const iata = /^([A-Z0-9]{2})\d/.exec(cs);
  return iata ? (IATA[iata[1] as string] ?? null) : null;
}
