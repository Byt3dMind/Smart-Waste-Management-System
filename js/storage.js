/* ============================================================
   SMART WASTE COLLECTION SYSTEM — Data Layer (storage.js)
   Persistent frontend storage using localStorage only.
   No backend · No server · No database required.
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════
   SECTION 1 — CORE CRUD HELPERS
   Generic reusable localStorage functions.
══════════════════════════════════════════════════════════ */

/**
 * Save (create / overwrite) a value in localStorage.
 * @param {string} key   - Storage key
 * @param {*}      data  - Any JSON-serialisable value
 * @returns {boolean}    - true on success, false on error
 */
function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error(`[SwmsStorage] saveData("${key}") failed:`, err);
    return false;
  }
}

/**
 * Retrieve a value from localStorage.
 * @param {string} key       - Storage key
 * @param {*}      fallback  - Value returned when key is absent (default: null)
 * @returns {*}              - Parsed value, or fallback
 */
function getData(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`[SwmsStorage] getData("${key}") failed:`, err);
    return fallback;
  }
}

/**
 * Update (merge-patch) an existing record in localStorage.
 * - If the stored value is an array, the updated item is matched by id.
 * - If the stored value is an object, it is shallow-merged with `data`.
 * - If the key does not exist, it is created from scratch.
 *
 * @param {string}        key   - Storage key
 * @param {object|Array}  data  - New data or partial patch object
 * @param {string|number} [id]  - Record id (required when key holds an array)
 * @returns {boolean}           - true on success
 */
function updateData(key, data, id = null) {
  try {
    const existing = getData(key);

    if (Array.isArray(existing) && id !== null) {
      // Update a single item inside an array by id
      const updated = existing.map(item =>
        item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
      );
      return saveData(key, updated);
    }

    if (existing !== null && typeof existing === 'object' && !Array.isArray(existing)) {
      // Shallow-merge objects
      return saveData(key, { ...existing, ...data, updatedAt: new Date().toISOString() });
    }

    // Key does not exist — create it
    return saveData(key, data);
  } catch (err) {
    console.error(`[SwmsStorage] updateData("${key}") failed:`, err);
    return false;
  }
}

/**
 * Delete a key entirely, or remove a single record from an array.
 * @param {string}        key  - Storage key
 * @param {string|number} [id] - Record id (when key holds an array)
 * @returns {boolean}          - true on success
 */
function deleteData(key, id = null) {
  try {
    if (id !== null) {
      const existing = getData(key);
      if (Array.isArray(existing)) {
        const filtered = existing.filter(item => item.id !== id);
        return saveData(key, filtered);
      }
    }
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error(`[SwmsStorage] deleteData("${key}") failed:`, err);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════
   SECTION 2 — DOMAIN-SPECIFIC HELPERS
   Convenience wrappers around the core CRUD functions.
══════════════════════════════════════════════════════════ */

/** Bin helpers */
const SwmsBins = {
  getAll()          { return getData(SWMS_KEYS.BINS, []); },
  getById(id)       { return this.getAll().find(b => b.id === id) || null; },
  save(bins)        { return saveData(SWMS_KEYS.BINS, bins); },
  add(bin)          {
    const bins = this.getAll();
    bins.push({ ...bin, createdAt: new Date().toISOString() });
    return saveData(SWMS_KEYS.BINS, bins);
  },
  update(id, patch) { return updateData(SWMS_KEYS.BINS, patch, id); },
  delete(id)        { return deleteData(SWMS_KEYS.BINS, id); },
  getByZone(zone)   { return this.getAll().filter(b => b.zone === zone); },
  getByStatus(status) { return this.getAll().filter(b => b.status === status); },
};

/** Vehicle helpers */
const SwmsVehicles = {
  getAll()          { return getData(SWMS_KEYS.VEHICLES, []); },
  getById(id)       { return this.getAll().find(v => v.id === id) || null; },
  save(vehicles)    { return saveData(SWMS_KEYS.VEHICLES, vehicles); },
  add(vehicle)      {
    const list = this.getAll();
    list.push({ ...vehicle, createdAt: new Date().toISOString() });
    return saveData(SWMS_KEYS.VEHICLES, list);
  },
  update(id, patch) { return updateData(SWMS_KEYS.VEHICLES, patch, id); },
  delete(id)        { return deleteData(SWMS_KEYS.VEHICLES, id); },
  getActive()       { return this.getAll().filter(v => v.status === 'active'); },
};

/** Complaint helpers */
const SwmsComplaints = {
  getAll()          { return getData(SWMS_KEYS.COMPLAINTS, []); },
  getById(id)       { return this.getAll().find(c => c.id === id) || null; },
  save(list)        { return saveData(SWMS_KEYS.COMPLAINTS, list); },
  add(complaint)    {
    const list = this.getAll();
    const newId = 'CMP-' + String(list.length + 1).padStart(4, '0');
    const record = {
      ...complaint,
      id: newId,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    list.unshift(record);               // newest first
    return saveData(SWMS_KEYS.COMPLAINTS, list);
  },
  update(id, patch) { return updateData(SWMS_KEYS.COMPLAINTS, patch, id); },
  delete(id)        { return deleteData(SWMS_KEYS.COMPLAINTS, id); },
  getByStatus(status) { return this.getAll().filter(c => c.status === status); },
};

/** Reports helpers */
const SwmsReports = {
  getAll()          { return getData(SWMS_KEYS.REPORTS, {}); },
  get(type)         { return getData(SWMS_KEYS.REPORTS, {})[type] || null; },
  save(reports)     { return saveData(SWMS_KEYS.REPORTS, reports); },
  update(type, data){ return updateData(SWMS_KEYS.REPORTS, { [type]: data }); },
};

/** Settings helpers */
const SwmsSettings = {
  get()              { return getData(SWMS_KEYS.SETTINGS, {}); },
  set(patch)         { return updateData(SWMS_KEYS.SETTINGS, patch); },
  getValue(field, fallback = null) {
    const s = this.get();
    return s[field] !== undefined ? s[field] : fallback;
  },
};

/* ══════════════════════════════════════════════════════════
   SECTION 3 — STORAGE KEYS (single source of truth)
══════════════════════════════════════════════════════════ */

const SWMS_KEYS = {
  BINS:       'swms_bins',
  VEHICLES:   'swms_vehicles',
  COMPLAINTS: 'swms_complaints',
  REPORTS:    'swms_reports',
  SETTINGS:   'swms_settings',
  META:       'swms_meta',
};

/* ══════════════════════════════════════════════════════════
   SECTION 4 — SAMPLE / SEED DATA
══════════════════════════════════════════════════════════ */

/* ── 4.1 Smart Bins (10 bins) ─────────────────────────── */
const SEED_BINS = [
  {
    id:          'BIN-0001',
    location:    'MG Road Junction',
    address:     '12, MG Road, Zone A',
    zone:        'Zone A',
    lat:         12.9716,
    lng:         77.5946,
    wasteType:   'General',
    fillLevel:   92,          // %
    status:      'full',      // empty | partial | near-full | full
    battery:     78,          // %
    temperature: 31,          // °C
    lastEmptied: '2026-06-01T08:00:00.000Z',
    lastUpdated: '2026-06-02T03:00:00.000Z',
    sensor:      'active',
    alerts:      ['overflow_risk'],
    createdAt:   '2024-01-15T00:00:00.000Z',
  },
  {
    id:          'BIN-0002',
    location:    'Park Street Corner',
    address:     '45, Park Street, Zone B',
    zone:        'Zone B',
    lat:         12.9742,
    lng:         77.6101,
    wasteType:   'Recyclable',
    fillLevel:   78,
    status:      'near-full',
    battery:     91,
    temperature: 29,
    lastEmptied: '2026-06-01T10:30:00.000Z',
    lastUpdated: '2026-06-02T02:45:00.000Z',
    sensor:      'active',
    alerts:      ['near_capacity'],
    createdAt:   '2024-01-15T00:00:00.000Z',
  },
  {
    id:          'BIN-0003',
    location:    'City Market West Gate',
    address:     '7, Market Road, Zone E',
    zone:        'Zone E',
    lat:         12.9610,
    lng:         77.5830,
    wasteType:   'Organic',
    fillLevel:   55,
    status:      'partial',
    battery:     64,
    temperature: 33,
    lastEmptied: '2026-06-01T07:00:00.000Z',
    lastUpdated: '2026-06-02T03:10:00.000Z',
    sensor:      'active',
    alerts:      [],
    createdAt:   '2024-02-01T00:00:00.000Z',
  },
  {
    id:          'BIN-0004',
    location:    'Gandhi Nagar Bus Stop',
    address:     '88, Gandhi Nagar, Zone D',
    zone:        'Zone D',
    lat:         12.9498,
    lng:         77.5731,
    wasteType:   'General',
    fillLevel:   18,
    status:      'empty',
    battery:     85,
    temperature: 30,
    lastEmptied: '2026-06-02T01:00:00.000Z',
    lastUpdated: '2026-06-02T03:00:00.000Z',
    sensor:      'active',
    alerts:      [],
    createdAt:   '2024-02-01T00:00:00.000Z',
  },
  {
    id:          'BIN-0005',
    location:    'Station Road Platform 2',
    address:     'Railway Station, Zone C',
    zone:        'Zone C',
    lat:         12.9795,
    lng:         77.5916,
    wasteType:   'General',
    fillLevel:   95,
    status:      'full',
    battery:     22,
    temperature: 35,
    lastEmptied: '2026-06-01T06:30:00.000Z',
    lastUpdated: '2026-06-02T02:30:00.000Z',
    sensor:      'active',
    alerts:      ['overflow_risk', 'low_battery'],
    createdAt:   '2024-02-15T00:00:00.000Z',
  },
  {
    id:          'BIN-0006',
    location:    'Airport Terminal 1',
    address:     'HAL Airport Road, Zone F',
    zone:        'Zone F',
    lat:         13.0035,
    lng:         77.6683,
    wasteType:   'Recyclable',
    fillLevel:   42,
    status:      'partial',
    battery:     97,
    temperature: 27,
    lastEmptied: '2026-06-01T12:00:00.000Z',
    lastUpdated: '2026-06-02T03:05:00.000Z',
    sensor:      'active',
    alerts:      [],
    createdAt:   '2024-03-01T00:00:00.000Z',
  },
  {
    id:          'BIN-0007',
    location:    'Lake View Park Entrance',
    address:     'Lake View Road, Zone A',
    zone:        'Zone A',
    lat:         12.9852,
    lng:         77.5612,
    wasteType:   'Organic',
    fillLevel:   28,
    status:      'empty',
    battery:     73,
    temperature: 28,
    lastEmptied: '2026-06-01T09:00:00.000Z',
    lastUpdated: '2026-06-02T02:55:00.000Z',
    sensor:      'active',
    alerts:      [],
    createdAt:   '2024-03-10T00:00:00.000Z',
  },
  {
    id:          'BIN-0008',
    location:    'Industrial Estate Gate 3',
    address:     'KIADB Industrial Area, Zone F',
    zone:        'Zone F',
    lat:         13.0218,
    lng:         77.6842,
    wasteType:   'Hazardous',
    fillLevel:   67,
    status:      'partial',
    battery:     55,
    temperature: 36,
    lastEmptied: '2026-05-31T14:00:00.000Z',
    lastUpdated: '2026-06-02T02:00:00.000Z',
    sensor:      'active',
    alerts:      ['high_temperature'],
    createdAt:   '2024-04-01T00:00:00.000Z',
  },
  {
    id:          'BIN-0009',
    location:    'Whitefield Tech Park',
    address:     'EPIP Zone, Whitefield, Zone B',
    zone:        'Zone B',
    lat:         12.9698,
    lng:         77.7499,
    wasteType:   'Recyclable',
    fillLevel:   10,
    status:      'empty',
    battery:     89,
    temperature: 26,
    lastEmptied: '2026-06-02T02:00:00.000Z',
    lastUpdated: '2026-06-02T03:00:00.000Z',
    sensor:      'active',
    alerts:      [],
    createdAt:   '2024-04-10T00:00:00.000Z',
  },
  {
    id:          'BIN-0010',
    location:    'Koramangala 5th Block',
    address:     '80 Feet Road, Zone D',
    zone:        'Zone D',
    lat:         12.9347,
    lng:         77.6265,
    wasteType:   'General',
    fillLevel:   83,
    status:      'near-full',
    battery:     61,
    temperature: 30,
    lastEmptied: '2026-06-01T05:00:00.000Z',
    lastUpdated: '2026-06-02T03:15:00.000Z',
    sensor:      'active',
    alerts:      ['near_capacity'],
    createdAt:   '2024-05-01T00:00:00.000Z',
  },
];

/* ── 4.2 Vehicles (5 vehicles) ────────────────────────── */
const SEED_VEHICLES = [
  {
    id:           'VH-001',
    name:         'Crusher Alpha',
    type:         'Compactor',
    plateNumber:  'KA-01-WM-0001',
    driver:       'Rahul Kumar',
    driverPhone:  '+91 98765 10001',
    status:       'active',          // active | idle | maintenance | offline
    currentZone:  'Zone A',
    route:        'Route A — Zone North',
    lat:          12.9730,
    lng:          77.5960,
    speed:        28,                // km/h
    fuel:         74,                // %
    stopsCompleted: 18,
    stopsTotal:   48,
    distanceCovered: 21.4,          // km
    distanceTotal:   42.0,
    lastService:  '2026-05-15T00:00:00.000Z',
    nextService:  '2026-07-15T00:00:00.000Z',
    engineHours:  1240,
    lastUpdated:  '2026-06-02T03:15:00.000Z',
    createdAt:    '2023-06-01T00:00:00.000Z',
  },
  {
    id:           'VH-002',
    name:         'Tipper Bravo',
    type:         'Tipper',
    plateNumber:  'KA-01-WM-0002',
    driver:       'Suresh Menon',
    driverPhone:  '+91 98765 10002',
    status:       'active',
    currentZone:  'Zone B',
    route:        'Route B — Zone East',
    lat:          12.9760,
    lng:          77.6120,
    speed:        34,
    fuel:         58,
    stopsCompleted: 22,
    stopsTotal:   52,
    distanceCovered: 18.2,
    distanceTotal:   39.0,
    lastService:  '2026-04-20T00:00:00.000Z',
    nextService:  '2026-06-20T00:00:00.000Z',
    engineHours:  2105,
    lastUpdated:  '2026-06-02T03:10:00.000Z',
    createdAt:    '2023-06-01T00:00:00.000Z',
  },
  {
    id:           'VH-003',
    name:         'Mini Van Charlie',
    type:         'Mini Van',
    plateNumber:  'KA-01-WM-0003',
    driver:       'Priya Tiwari',
    driverPhone:  '+91 98765 10003',
    status:       'active',
    currentZone:  'Zone C',
    route:        'Route C — Zone West',
    lat:          12.9800,
    lng:          77.5920,
    speed:        22,
    fuel:         91,
    stopsCompleted: 9,
    stopsTotal:   45,
    distanceCovered: 8.7,
    distanceTotal:   51.0,
    lastService:  '2026-05-01T00:00:00.000Z',
    nextService:  '2026-08-01T00:00:00.000Z',
    engineHours:  870,
    lastUpdated:  '2026-06-02T03:05:00.000Z',
    createdAt:    '2024-01-10T00:00:00.000Z',
  },
  {
    id:           'VH-004',
    name:         'Hydraulic Delta',
    type:         'Hydraulic Loader',
    plateNumber:  'KA-01-WM-0004',
    driver:       'Anil Gowda',
    driverPhone:  '+91 98765 10004',
    status:       'idle',
    currentZone:  'Depot',
    route:        null,
    lat:          12.9520,
    lng:          77.5800,
    speed:        0,
    fuel:         100,
    stopsCompleted: 0,
    stopsTotal:   0,
    distanceCovered: 0,
    distanceTotal:   0,
    lastService:  '2026-05-28T00:00:00.000Z',
    nextService:  '2026-08-28T00:00:00.000Z',
    engineHours:  3450,
    lastUpdated:  '2026-06-02T03:00:00.000Z',
    createdAt:    '2022-11-01T00:00:00.000Z',
  },
  {
    id:           'VH-005',
    name:         'Compactor Echo',
    type:         'Compactor',
    plateNumber:  'KA-01-WM-0005',
    driver:       'Kavitha Reddy',
    driverPhone:  '+91 98765 10005',
    status:       'maintenance',
    currentZone:  'Maintenance Bay',
    route:        null,
    lat:          12.9500,
    lng:          77.5780,
    speed:        0,
    fuel:         43,
    stopsCompleted: 0,
    stopsTotal:   0,
    distanceCovered: 0,
    distanceTotal:   0,
    lastService:  '2026-06-01T00:00:00.000Z',
    nextService:  '2026-06-03T00:00:00.000Z',
    engineHours:  5800,
    lastUpdated:  '2026-06-02T00:00:00.000Z',
    createdAt:    '2021-08-15T00:00:00.000Z',
  },
];

/* ── 4.3 Complaints (5 complaints) ───────────────────── */
const SEED_COMPLAINTS = [
  {
    id:          'CMP-0001',
    name:        'Rajesh Sharma',
    email:       'rajesh.s@gmail.com',
    phone:       '+91 99887 11001',
    category:    'Overflowing Bin',
    zone:        'Zone A',
    location:    'MG Road Junction, near Metro Exit 2',
    priority:    'critical',
    description: 'The bin on MG Road has been overflowing since yesterday evening. Garbage is spilling onto the footpath and causing foul smell. Urgent attention required.',
    status:      'open',
    assignedTo:  null,
    resolution:  null,
    createdAt:   '2026-06-02T01:30:00.000Z',
    updatedAt:   '2026-06-02T01:30:00.000Z',
  },
  {
    id:          'CMP-0002',
    name:        'Anitha Krishnamurthy',
    email:       'anitha.k@yahoo.com',
    phone:       '+91 99887 11002',
    category:    'Missed Collection',
    zone:        'Zone C',
    location:    'Station Road, Platform 2 area',
    priority:    'high',
    description: 'Our street has been skipped for 3 consecutive days. The waste truck does not come to Subedar Chatram Road in the mornings anymore. Residents are very upset.',
    status:      'in-progress',
    assignedTo:  'VH-003',
    resolution:  null,
    createdAt:   '2026-06-01T09:15:00.000Z',
    updatedAt:   '2026-06-01T14:30:00.000Z',
  },
  {
    id:          'CMP-0003',
    name:        'Mohammed Farouk',
    email:       'mfarouk@hotmail.com',
    phone:       '+91 99887 11003',
    category:    'Illegal Dumping',
    zone:        'Zone B',
    location:    'Behind Park Street Mall, alley near parking lot',
    priority:    'medium',
    description: 'Someone is dumping construction debris and old furniture in the alley behind the mall at night. It is blocking the fire exit and attracting rodents.',
    status:      'in-progress',
    assignedTo:  'Operations Team',
    resolution:  null,
    createdAt:   '2026-06-01T06:45:00.000Z',
    updatedAt:   '2026-06-01T11:00:00.000Z',
  },
  {
    id:          'CMP-0004',
    name:        'Sunita Patel',
    email:       'sunita.patel@outlook.com',
    phone:       '+91 99887 11004',
    category:    'Bin Damage / Vandalism',
    zone:        'Zone D',
    location:    'Gandhi Nagar Bus Stop, opposite KSRTC depot',
    priority:    'low',
    description: 'The smart bin near Gandhi Nagar bus stop has a broken lid. It was apparently damaged by a vehicle. The sensor display is also cracked.',
    status:      'resolved',
    assignedTo:  'Maintenance Team',
    resolution:  'Bin lid replaced and sensor unit recalibrated on 31 May 2026. Bin is fully operational.',
    createdAt:   '2026-05-30T10:20:00.000Z',
    updatedAt:   '2026-05-31T16:00:00.000Z',
  },
  {
    id:          'CMP-0005',
    name:        'Deepak Nair',
    email:       'deepak.nair@gmail.com',
    phone:       '+91 99887 11005',
    category:    'Foul Odour',
    zone:        'Zone E',
    location:    'City Market, West Gate, near vegetable section',
    priority:    'medium',
    description: 'The organic waste bin at the market is not being emptied frequently enough. The smell is very strong, especially in the afternoon. Shopkeepers are complaining.',
    status:      'resolved',
    assignedTo:  'VH-002',
    resolution:  'Collection frequency increased to twice daily for this bin. Last emptied on 1 Jun 2026 at 16:00.',
    createdAt:   '2026-05-29T08:00:00.000Z',
    updatedAt:   '2026-06-01T16:30:00.000Z',
  },
];

/* ── 4.4 Reports (monthly sample data) ───────────────── */
const SEED_REPORTS = {

  /* Monthly collection volume (tonnes) — last 6 months */
  collectionVolume: {
    labels: ['January', 'February', 'March', 'April', 'May', 'June'],
    data:   [712, 698, 745, 780, 810, 820],
    unit:   'tonnes',
    trend:  '+15.2%',   // vs same period last year
    total:  4565,
  },

  /* Bin fill distribution (%) */
  binFillDistribution: {
    labels:      ['Empty (0–30%)', 'Partial (31–70%)', 'Near Full (71–89%)', 'Full (90–100%)'],
    data:        [490, 450, 284, 23],
    percentages: [39.3, 36.1, 22.8, 1.8],
    asOf:        '2026-06-02T03:00:00.000Z',
  },

  /* Waste type breakdown */
  wasteByType: {
    labels:      ['General', 'Recyclable', 'Organic', 'Hazardous'],
    data:        [45, 30, 20, 5],        // %
    colours:     ['#22c55e', '#38bdf8', '#a78bfa', '#f87171'],
    unit:        'percentage',
  },

  /* Fuel efficiency — monthly litres used vs baseline */
  fuelEfficiency: {
    labels:       ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    baseline:     [8200, 8100, 8400, 8600, 8800, 9000],  // litres (without optimisation)
    actual:       [5740, 5670, 5880, 5900, 6050, 6120],  // litres (with AI routes)
    savings:      [2460, 2430, 2520, 2700, 2750, 2880],  // litres saved
    savingsPct:   [30.0, 30.0, 30.0, 31.4, 31.2, 32.0],
    unit:         'litres',
    totalSaved:   15740,
    co2SavedKg:   35961,                                 // 15740 L × 2.285 kg CO₂/L diesel
  },

  /* Complaint resolution trend — monthly */
  complaintTrend: {
    labels:     ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    submitted:  [38, 42, 35, 51, 47, 5],
    resolved:   [35, 40, 34, 48, 46, 2],
    pending:    [3,  2,  1,  3,  1,  3],
    avgResolutionHrs: [14.2, 12.8, 10.5, 11.3, 9.7, 8.4],
  },

  /* Vehicle performance — monthly */
  vehiclePerformance: {
    labels:          ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    avgRoutesPerDay: [5.8, 5.9, 6.0, 6.1, 6.2, 6.2],
    avgStopsPerDay:  [207, 215, 220, 228, 235, 240],
    uptimePct:       [94.2, 95.0, 96.1, 95.8, 97.0, 97.2],
    maintenanceDays: [8, 6, 5, 7, 4, 3],
  },

  /* Cost analysis — monthly (₹ in thousands) */
  costAnalysis: {
    labels:       ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    operationalCost: [142, 138, 145, 150, 148, 152],
    fuelCost:     [87,  85,  90,  92,  91,  93],
    maintenanceCost: [22, 18, 16, 21, 14, 12],
    totalCost:    [251, 241, 251, 263, 253, 257],
    savings:      [48,  45,  50,  52,  53,  56],
    unit:         '₹ thousands',
    totalSavings6M: 304,
  },

  /* Environmental impact — cumulative */
  environmentalImpact: {
    co2Avoided_kg:       35961,
    treesEquivalent:     1747,       // 1 tree absorbs ~21 kg CO₂/yr
    dieselSaved_litres:  15740,
    wasteRecycled_pct:   30.0,
    landfillDiverted_t:  1369.5,    // 30% of 4565 t
    greenScore:          87,         // out of 100
    badges:              ['Carbon Neutral Platform', 'Zero Waste Initiative', 'ISO 14001 Compliant'],
  },

  /* Zone-wise collection efficiency (%) */
  zoneEfficiency: {
    labels:     ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F'],
    efficiency: [98.2, 97.5, 96.8, 98.0, 95.1, 97.9],
    collections:[840, 920, 780, 860, 640, 525],
    unit:       'percentage',
  },

  /* Generated metadata */
  meta: {
    generatedAt:   new Date().toISOString(),
    period:        'January 2026 – June 2026',
    currency:      'INR',
    distanceUnit:  'km',
    weightUnit:    'tonnes',
  },
};

/* ── 4.5 App Settings (defaults) ─────────────────────── */
const SEED_SETTINGS = {
  appName:           'SmartWaste System',
  city:              'Bengaluru',
  timezone:          'Asia/Kolkata',
  currency:          'INR',
  distanceUnit:      'km',
  weightUnit:        'tonnes',
  alertThreshold:    80,             // % fill level to trigger "near-full" alert
  criticalThreshold: 90,             // % fill level to trigger "full" alert
  lowBatteryAlert:   25,             // % battery to trigger alert
  refreshInterval:   300,            // seconds between simulated sensor updates
  mapCenter:         { lat: 12.9716, lng: 77.5946 },
  mapZoom:           12,
  language:          'en',
  version:           '1.0.0',
  initializedAt:     new Date().toISOString(),
  updatedAt:         new Date().toISOString(),
};

/* ══════════════════════════════════════════════════════════
   SECTION 5 — INITIALISATION
   Seeds localStorage on first load. Safe to call on every
   page — it only writes if data does not already exist.
══════════════════════════════════════════════════════════ */

/**
 * Wipe all SWMS data and re-seed from scratch.
 * Call manually: SwmsDB.reset()
 */
function _seedAll() {
  saveData(SWMS_KEYS.BINS,       SEED_BINS);
  saveData(SWMS_KEYS.VEHICLES,   SEED_VEHICLES);
  saveData(SWMS_KEYS.COMPLAINTS, SEED_COMPLAINTS);
  saveData(SWMS_KEYS.REPORTS,    SEED_REPORTS);
  saveData(SWMS_KEYS.SETTINGS,   SEED_SETTINGS);
  saveData(SWMS_KEYS.META, {
    seededAt:    new Date().toISOString(),
    dataVersion: '1.0.0',
    totalBins:   SEED_BINS.length,
    totalVehicles: SEED_VEHICLES.length,
    totalComplaints: SEED_COMPLAINTS.length,
  });
  console.info('%c♻ SwmsStorage: Sample data seeded successfully.', 'color:#4ade80;font-weight:600;');
}

/**
 * Initialise storage on page load.
 * Only seeds data if it hasn't been seeded before (checks META key).
 */
function _initStorage() {
  const meta = getData(SWMS_KEYS.META);
  if (!meta) {
    _seedAll();
  } else {
    console.info('%c♻ SwmsStorage: Data already initialised. Skipping seed.', 'color:#4ade80;');
  }
}

/* ══════════════════════════════════════════════════════════
   SECTION 6 — PUBLIC API  (SwmsDB namespace)
   Use this in other JS files instead of calling functions
   directly.

   Examples:
     SwmsDB.bins.getAll()
     SwmsDB.vehicles.getById('VH-001')
     SwmsDB.complaints.add({ name:'Alice', ... })
     SwmsDB.reports.get('collectionVolume')
     SwmsDB.settings.getValue('alertThreshold', 80)
     SwmsDB.reset()
══════════════════════════════════════════════════════════ */

const SwmsDB = {
  /* Core CRUD */
  save:   saveData,
  get:    getData,
  update: updateData,
  delete: deleteData,

  /* Domain helpers */
  bins:       SwmsBins,
  vehicles:   SwmsVehicles,
  complaints: SwmsComplaints,
  reports:    SwmsReports,
  settings:   SwmsSettings,

  /* Keys */
  keys: SWMS_KEYS,

  /** Full reset — wipes all SWMS data and re-seeds defaults */
  reset() {
    Object.values(SWMS_KEYS).forEach(k => localStorage.removeItem(k));
    _seedAll();
    console.warn('[SwmsDB] All data has been reset to defaults.');
  },

  /** Return a quick health summary of what is stored */
  status() {
    return {
      bins:       (getData(SWMS_KEYS.BINS,       []) || []).length,
      vehicles:   (getData(SWMS_KEYS.VEHICLES,   []) || []).length,
      complaints: (getData(SWMS_KEYS.COMPLAINTS, []) || []).length,
      hasReports: !!getData(SWMS_KEYS.REPORTS),
      hasSettings:!!getData(SWMS_KEYS.SETTINGS),
      meta:        getData(SWMS_KEYS.META),
    };
  },
};

/* ── Auto-initialise on script load ──────────────────── */
_initStorage();

/* ── Expose globally for browser console access ──────── */
window.SwmsDB    = SwmsDB;
window.saveData  = saveData;
window.getData   = getData;
window.updateData = updateData;
window.deleteData = deleteData;
