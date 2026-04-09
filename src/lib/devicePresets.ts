import type { Category } from '@/types';

/**
 * Regex per canonical brand key (lowercase) — matches model strings in preset lists.
 * Add entries when a brand name doesn’t appear literally in model strings (e.g. Apple → iPhone).
 */
const BRAND_PATTERN: Record<string, RegExp> = {
  apple: /iphone|ipad|macbook|airpods|imac|apple watch/i,
  samsung: /samsung|galaxy/i,
  google: /pixel|google pixel/i,
  xiaomi: /\bxiaomi\b/i,
  redmi: /redmi/i,
  poco: /poco/i,
  oneplus: /oneplus/i,
  tecno: /tecno/i,
  infinix: /infinix/i,
  itel: /\bitel\b/i,
  huawei: /huawei/i,
  honor: /honor/i,
  oppo: /oppo/i,
  vivo: /vivo/i,
  realme: /realme/i,
  nokia: /nokia/i,
  motorola: /motorola|\bmoto\s/i,
  sony: /sony|xperia/i,
  nothing: /nothing/i,
  fairphone: /fairphone/i,
  microsoft: /microsoft|surface/i,
  hp: /\bhp\b|spectre|pavilion|omen|elitebook|zbook/i,
  dell: /dell|xps|latitude|alienware|inspiron|precision/i,
  lenovo: /lenovo|thinkpad|ideapad|legion|yoga/i,
  asus: /asus|rog|zenbook|vivobook|tuf/i,
  acer: /acer|aspire|swift|nitro|predator/i,
  msi: /\bmsi\b|katana|stealth|titan/i,
  razer: /razer|blade/i,
  lg: /\blg\b|velvet|wing/i,
  tcl: /\btcl\b/i,
  zte: /\bzte\b|nubia|red magic/i,
  gionee: /gionee/i,
  hisense: /hisense/i,
  umidigi: /umidigi/i,
  blackview: /blackview/i,
  doogee: /doogee/i,
  oukitel: /oukitel/i,
  cubot: /cubot/i,
  blu: /\bblu\b/i,
  cat: /\bcat\b\s|cat\s+s\d/i,
  alcatel: /alcatel/i,
  sharp: /sharp|aquos/i,
  micromax: /micromax/i,
  lava: /\blava\b/i,
  hotwav: /hotwav/i,
  leeco: /leeco|letv/i,
  meizu: /meizu/i,
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True if `name` is likely a model for `brand` (trimmed, case-insensitive). */
export function modelMatchesBrand(name: string, brand: string): boolean {
  const b = brand.trim().toLowerCase();
  if (!b) return true;
  const n = name.toLowerCase();
  const pattern = BRAND_PATTERN[b];
  if (pattern) return pattern.test(name);
  return n.includes(b) || new RegExp(`\\b${escapeRe(b)}`, 'i').test(name);
}

/** Common brands — Computer Village / global inventory. Users can still type anything. */
export const BRAND_SUGGESTIONS: readonly string[] = [
  'Acer',
  'AGM',
  'Alcatel',
  'Apple',
  'ASUS',
  'Blackview',
  'BLU',
  'CAT',
  'Cubot',
  'Dell',
  'Doogee',
  'Fairphone',
  'Gionee',
  'Google',
  'Hisense',
  'Honor',
  'HP',
  'Hotwav',
  'Huawei',
  'Infinix',
  'Itel',
  'Lava',
  'LeEco',
  'Lenovo',
  'LG',
  'Meizu',
  'Micromax',
  'Microsoft',
  'Motorola',
  'MSI',
  'Nokia',
  'Nothing',
  'OnePlus',
  'Oppo',
  'Oukitel',
  'Poco',
  'Razer',
  'Realme',
  'Redmi',
  'Samsung',
  'Sharp',
  'Sony',
  'TCL',
  'Tecno',
  'Umidigi',
  'Vivo',
  'Xiaomi',
  'ZTE',
].sort((a, b) => a.localeCompare(b));

const PHONE_MODELS: readonly string[] = [
  // Apple — recent lineup
  'iPhone 17 Pro Max',
  'iPhone 17 Pro',
  'iPhone 17 Air',
  'iPhone 17',
  'iPhone 16 Pro Max',
  'iPhone 16 Pro',
  'iPhone 16 Plus',
  'iPhone 16',
  'iPhone 16e',
  'iPhone 15 Pro Max',
  'iPhone 15 Pro',
  'iPhone 15 Plus',
  'iPhone 15',
  'iPhone 14 Pro Max',
  'iPhone 14 Pro',
  'iPhone 14 Plus',
  'iPhone 14',
  'iPhone 13 Pro Max',
  'iPhone 13 Pro',
  'iPhone 13 mini',
  'iPhone 13',
  'iPhone SE (3rd generation)',
  'iPhone SE (2nd generation)',
  // Samsung Galaxy S / Note successor
  'Samsung Galaxy S25 Ultra',
  'Samsung Galaxy S25+',
  'Samsung Galaxy S25',
  'Samsung Galaxy S25 Edge',
  'Samsung Galaxy S25 FE',
  'Samsung Galaxy S24 Ultra',
  'Samsung Galaxy S24+',
  'Samsung Galaxy S24',
  'Samsung Galaxy S24 FE',
  'Samsung Galaxy S23 Ultra',
  'Samsung Galaxy S23+',
  'Samsung Galaxy S23',
  'Samsung Galaxy A56',
  'Samsung Galaxy A36',
  'Samsung Galaxy A26',
  'Samsung Galaxy A16',
  'Samsung Galaxy A55',
  'Samsung Galaxy A35',
  'Samsung Galaxy A25',
  'Samsung Galaxy A15',
  'Samsung Galaxy A05s',
  'Samsung Galaxy Z Fold 7',
  'Samsung Galaxy Z Flip 7',
  'Samsung Galaxy Z Fold 6',
  'Samsung Galaxy Z Flip 6',
  'Samsung Galaxy XCover 7',
  // Google Pixel
  'Google Pixel 10 Pro XL',
  'Google Pixel 10 Pro',
  'Google Pixel 10',
  'Google Pixel 9 Pro XL',
  'Google Pixel 9 Pro Fold',
  'Google Pixel 9 Pro',
  'Google Pixel 9',
  'Google Pixel 9a',
  'Google Pixel 8 Pro',
  'Google Pixel 8',
  'Google Pixel 8a',
  'Google Pixel 7a',
  // Xiaomi / Redmi / Poco
  'Xiaomi 15 Ultra',
  'Xiaomi 15',
  'Xiaomi 14 Ultra',
  'Xiaomi 14',
  'Redmi Note 14 Pro+',
  'Redmi Note 14 Pro',
  'Redmi Note 14',
  'Redmi Note 13 Pro+',
  'Redmi Note 13 Pro',
  'Redmi Note 13',
  'Redmi 14C',
  'Redmi 13C',
  'Poco X7 Pro',
  'Poco X6 Pro',
  'Poco F6 Pro',
  'Poco M6 Pro',
  // OnePlus
  'OnePlus 13',
  'OnePlus 13R',
  'OnePlus 12',
  'OnePlus 12R',
  'OnePlus Nord 4',
  'OnePlus Nord CE4',
  // Tecno
  'Tecno Phantom V Fold 2',
  'Tecno Phantom X2 Pro',
  'Tecno Camon 30 Premier',
  'Tecno Camon 30',
  'Tecno Spark 20 Pro',
  'Tecno Pova 6 Neo',
  // Infinix
  'Infinix Note 40 Pro+',
  'Infinix Note 40 Pro',
  'Infinix Note 40',
  'Infinix Zero 40',
  'Infinix Hot 50',
  // Itel
  'Itel S24',
  'Itel A70',
  'Itel P55',
  // Others — retail common
  'Oppo Reno 12 Pro',
  'Oppo Reno 12',
  'Oppo A3 Pro',
  'Vivo X200 Pro',
  'Vivo V40',
  'Vivo Y28',
  'Realme GT 6',
  'Realme 12 Pro+',
  'Realme 12',
  'Nothing Phone (3)',
  'Nothing Phone (2a)',
  'Motorola Edge 50 Ultra',
  'Motorola Moto G84',
  'Motorola Razr 50',
  'Nokia G42',
  'Nokia C32',
  'Honor Magic 6 Pro',
  'Honor 200',
  'Huawei Pura 70 Pro',
  'Sony Xperia 1 VI',
  'ZTE Nubia RedMagic 10 Pro',
  'Umidigi G6',
  'Blackview BV9300',
  'Oukitel WP30 Pro',
  'Cubot KingKong 9',
  'Doogee V30 Pro',
];

const TABLET_MODELS: readonly string[] = [
  'iPad Pro 13" (M4)',
  'iPad Pro 11" (M4)',
  'iPad Air 13" (M2)',
  'iPad Air 11" (M2)',
  'iPad (11th generation)',
  'iPad (10th generation)',
  'iPad mini (7th generation)',
  'iPad mini (6th generation)',
  'Samsung Galaxy Tab S10 Ultra',
  'Samsung Galaxy Tab S10+',
  'Samsung Galaxy Tab S10',
  'Samsung Galaxy Tab S9 Ultra',
  'Samsung Galaxy Tab S9+',
  'Samsung Galaxy Tab S9',
  'Samsung Galaxy Tab A9+',
  'Samsung Galaxy Tab A9',
  'Google Pixel Tablet',
  'Xiaomi Pad 7',
  'Xiaomi Pad 6 Pro',
  'Xiaomi Pad 6',
  'Lenovo Tab P12 Pro',
  'Lenovo Tab P12',
  'Lenovo Tab M11',
  'Microsoft Surface Pro 11',
  'Microsoft Surface Pro 10',
  'Microsoft Surface Go 4',
  'Honor Pad 9',
  'Realme Pad 2',
  'Amazon Fire Max 11',
  'Huawei MatePad Pro',
];

const LAPTOP_MODELS: readonly string[] = [
  'MacBook Pro 16" (M4 Max)',
  'MacBook Pro 14" (M4 Pro)',
  'MacBook Pro 14" (M4 Max)',
  'MacBook Pro 16" (M3 Max)',
  'MacBook Pro 14" (M3 Pro)',
  'MacBook Air 15" (M4)',
  'MacBook Air 13" (M4)',
  'MacBook Air 15" (M3)',
  'MacBook Air 13" (M2)',
  'Microsoft Surface Laptop 7',
  'Microsoft Surface Laptop 6',
  'Microsoft Surface Laptop Studio 2',
  'Dell XPS 16',
  'Dell XPS 14',
  'Dell XPS 13',
  'Dell Latitude 7440',
  'HP Spectre x360 16',
  'HP Pavilion 15',
  'HP EliteBook 840',
  'HP Omen 16',
  'Lenovo ThinkPad X1 Carbon',
  'Lenovo ThinkPad T14',
  'Lenovo Legion Pro 7',
  'Lenovo IdeaPad Slim 5',
  'Lenovo Yoga 9i',
  'ASUS Zenbook 14 OLED',
  'ASUS ROG Zephyrus G16',
  'ASUS TUF Gaming F15',
  'Acer Swift Go 14',
  'Acer Nitro 16',
  'MSI Stealth 16',
  'Razer Blade 16',
  'Razer Blade 14',
  'LG gram 17',
  'Samsung Galaxy Book4 Pro',
  'Google Chromebook Plus',
];

const ACCESSORY_MODELS: readonly string[] = [
  'Apple MagSafe Charger 15W',
  'Apple MagSafe Duo',
  'Apple 20W USB-C Power Adapter',
  'Apple USB-C to Lightning Cable (1m)',
  'Apple USB-C to USB-C Cable (2m)',
  'AirPods Pro (2nd generation)',
  'AirPods (3rd generation)',
  'AirPods Max',
  'Samsung 45W Fast Charger',
  'Samsung 25W Travel Adapter',
  'Samsung Galaxy Buds3 Pro',
  'Google Pixel Buds Pro',
  'Anker 737 Power Bank 140W',
  'Anker Nano Charger 67W',
  'Belkin MagSafe 3-in-1 Charger',
  'USB-C Hub 7-in-1',
  'USB-C to HDMI Adapter',
  'Wireless Charging Pad 15W',
  'Phone Case (Clear)',
  'Phone Case (Silicone)',
  'Tempered Glass Screen Protector (Universal)',
  'Privacy Screen Protector',
  'Phone Ring / Grip Stand',
  'Car Phone Holder (Vent)',
  'Selfie Stick with Tripod',
  'Blue Microphone (USB)',
  'Portable Bluetooth Speaker',
  'Apple Pencil Pro',
  'Apple Pencil (USB-C)',
  'Samsung S Pen (replacement)',
  'Laptop Sleeve 15"',
  'HDMI Cable 2m',
  'Ethernet USB-C Adapter',
  'MicroSD Card 256GB',
  'USB Flash Drive 128GB',
  'Bluetooth Keyboard (compact)',
  'Wireless Mouse',
];

const PARTS_MODELS: readonly string[] = [
  'iPhone Screen Assembly (aftermarket)',
  'iPhone Battery OEM Spec',
  'iPhone Charging Port Flex',
  'iPhone Rear Camera Module',
  'Samsung Display Assembly',
  'Samsung Battery',
  'Laptop RAM DDR5 16GB SODIMM',
  'Laptop NVMe SSD 1TB',
  'Laptop DC Jack',
  'Laptop Keyboard (replacement)',
  'Tablet Touchscreen Digitizer',
  'USB-C Port Board',
  'Motherboard (refurbished)',
  'Rear Glass / Back Cover',
  'SIM Tray (dual)',
];

function poolForCategory(category: Category): readonly string[] {
  switch (category) {
    case 'phones':
      return PHONE_MODELS;
    case 'tablets':
      return TABLET_MODELS;
    case 'laptops':
      return LAPTOP_MODELS;
    case 'accessories':
      return ACCESSORY_MODELS;
    case 'parts':
      return PARTS_MODELS;
    default:
      return [];
  }
}

/**
 * Item name quick-pick list for category.
 * When `brand` is set, filters to models that match that brand; otherwise returns the full list.
 */
export function suggestedNamesForCategoryAndBrand(category: Category, brand: string): readonly string[] {
  const pool = poolForCategory(category);
  if (pool.length === 0) return [];
  const b = brand.trim();
  if (!b) return pool;
  const filtered = pool.filter((name) => modelMatchesBrand(name, b));
  return filtered.length > 0 ? filtered : pool;
}

/** @deprecated Use suggestedNamesForCategoryAndBrand(category, '') */
export function suggestedNamesForCategory(category: Category): readonly string[] {
  return suggestedNamesForCategoryAndBrand(category, '');
}
