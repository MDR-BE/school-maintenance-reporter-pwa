// Config.gs - Configuration constants for the Maintenance PWA

// ====================== Spreadsheet Configuration ======================
const TARGET_SPREADSHEET_ID = '1HtYJqAWengq_wvEbt2SE_Rx4cPwSyal5YwHbp_Z0wVY';
const SHEET_NAME_PATTERN = /^klusjes \d{8}$/; // Matches klusjes DDMMYYYY

// Column indices (0-based) - matches Dutch column order
const COL = {
  DESCRIPTION: 0,           // Omschrijving
  REQUESTER_NAME: 1,        // naam aanvrager
  LOCATION: 2,              // Welke klas? Welk lokaal?
  REQUIRED_MATERIALS: 3,    // Benodigd materiaal
  URGENCY: 4,               // prioriteit
  STATUS: 5,                // opvolging
  PHOTO_URLS: 6,            // photo_urls (JSON array string)
  MAINTENANCE_NOTES: 7,     // Opmerkingen
  CREATED_AT: 8,            // datum gemaakt
  UPDATED_AT: 9,            // datum update
  COMPLETED_AT: 10,         // datum opgelost
  TASK_ID: 11               // task_id (UUID)
};

// Headers for new sheets (Dutch)
const SHEET_HEADERS = [
  'Omschrijving',
  'naam aanvrager',
  'Welke klas? Welk lokaal?',
  'Benodigd materiaal',
  'prioriteit',
  'opvolging',
  'photo_urls',
  'Opmerkingen',
  'datum gemaakt',
  'datum update',
  'datum opgelost',
  'task_id'
];

// ====================== Drive Configuration ======================
const DRIVE_ROOT_FOLDER_NAME = 'Maintenance PWA';

// ====================== Property Keys ======================
const PROP = {
  MAINTENANCE_WORKER_EMAIL: 'maintenance_worker_email',
  LOGIN_PASSWORD_HASH: 'login_password_hash',
  LOGIN_PASSWORD_SALT: 'login_password_salt',
  FRONTEND_URL: 'frontend_url',
  PHOTO_FOLDER_ID_PREFIX: 'photo_folder_id_', // + year
  ACTIVE_SHEET_NAME: 'active_sheet_name'
};

// ====================== Authentication ======================
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_TOKEN_PREFIX = 'auth_token_';

// ====================== Validation Constants ======================
const VALID_URGENCIES = ['Normal', 'Important', 'Urgent'];
const VALID_STATUSES = ['New', 'Planned', 'In progress', 'Waiting for materials', 'Completed'];

// Dutch mappings (for sheet storage)
const URGENCY_TO_DUTCH = {
  'Normal': 'niet zo dringend',
  'Important': 'dringend',
  'Urgent': 'zeer dringend'
};

const DUTCH_TO_URGENCY = {
  'niet zo dringend': 'Normal',
  'dringend': 'Important',
  'zeer dringend': 'Urgent'
};

const STATUS_TO_DUTCH = {
  'New': '',
  'Planned': 'overnemen op volgend lijstje',
  'In progress': 'niet voldoende gebeurd',
  'Waiting for materials': 'wachten op materialen',
  'Completed': 'In orde'
};

const DUTCH_TO_STATUS = {
  'In orde': 'Completed',
  'overnemen op volgend lijstje': 'Planned',
  'niet voldoende gebeurd': 'In progress',
  'bezig of in pauze; met extern bedrijf of MAARTEN': 'In progress',
  'wachten op materialen': 'Waiting for materials',
  '': 'New'
};

// Valid state transitions (from -> allowed next states)
const VALID_TRANSITIONS = {
  'New': ['Planned', 'In progress', 'Completed'],
  'Planned': ['In progress', 'Waiting for materials', 'New'],
  'In progress': ['Waiting for materials', 'Completed', 'Planned'],
  'Waiting for materials': ['In progress', 'Planned'],
  'Completed': ['In progress'] // Reopen goes to In progress
};

// ====================== Limits ======================
const LIMITS = {
  MAX_PHOTOS_PER_TASK: 3,
  MAX_PHOTO_SIZE_MB: 5,
  MAX_PHOTO_DIMENSION: 1600,
  JPEG_QUALITY: 0.75,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_REQUESTER_NAME_LENGTH: 100,
  MAX_LOCATION_LENGTH: 200,
  MAX_MATERIALS_LENGTH: 500,
  MAX_NOTES_LENGTH: 2000
};

// ====================== Error Codes ======================
const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  PHOTO_TOO_LARGE: 'PHOTO_TOO_LARGE',
  PHOTO_INVALID: 'PHOTO_INVALID',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_TRANSITION: 'INVALID_TRANSITION'
};
