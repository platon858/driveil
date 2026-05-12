export const STATUSES = {
  FOR_SALE: 'on_sale',
  RESERVED: 'reserved',
  SOLD: 'sold',
}

export const STATUS_LABELS = {
  on_sale: 'На продаже',
  reserved: 'Резерв',
  sold: 'Продана',
}

export const STATUS_COLORS = {
  on_sale: 'bg-green-100 text-green-800',
  reserved: 'bg-yellow-100 text-yellow-800',
  sold: 'bg-gray-100 text-gray-600',
}

export const LEAD_STATUSES = {
  NEW: 'new',
  NEGOTIATING: 'negotiating',
  LOST: 'lost',
  WON: 'won',
}

export const LEAD_STATUS_LABELS = {
  new: 'Новый',
  negotiating: 'В переговорах',
  lost: 'Не купил',
  won: 'Купил',
}

export const LEAD_STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-800',
  negotiating: 'bg-purple-100 text-purple-800',
  lost: 'bg-red-100 text-red-600',
  won: 'bg-green-100 text-green-800',
}

export const PLATFORMS = ['Yad2', 'Facebook Marketplace', 'Instagram', 'WhatsApp', 'Прямой контакт']

let nextId = 10

export function generateId() {
  return ++nextId
}

export const initialCars = [
  {
    id: 1,
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    mileage: 89000,
    color: 'Серебристый',
    transmission: 'Автомат',
    engine: 2.5,
    vin: '4T1BF1FK0LU123456',
    description: 'В отличном состоянии. Один хозяин, полный сервис у дилера.',
    location: 'Тель-Авив',
    status: STATUSES.FOR_SALE,
    purchasePrice: 38000,
    salePrice: 45000,
    platforms: ['Yad2', 'Facebook Marketplace'],
    arrivalDate: '2024-10-15',
    saleDate: null,
    photos: [],
  },
  {
    id: 2,
    make: 'Hyundai',
    model: 'Tucson',
    year: 2021,
    mileage: 62000,
    color: 'Белый',
    transmission: 'Автомат',
    engine: 1.6,
    vin: '5NPE34AF0MH123789',
    description: 'Без аварий. Полный электропакет.',
    location: 'Хайфа',
    status: STATUSES.FOR_SALE,
    purchasePrice: 55000,
    salePrice: 64000,
    platforms: ['Yad2'],
    arrivalDate: '2024-11-01',
    saleDate: null,
    photos: [],
  },
  {
    id: 3,
    make: 'Kia',
    model: 'Sportage',
    year: 2019,
    mileage: 105000,
    color: 'Чёрный',
    transmission: 'Механика',
    engine: 2.0,
    vin: 'KNDPM3AC0K7123001',
    description: 'Только что прошёл ТО. Свежая резина.',
    location: 'Беэр-Шева',
    status: STATUSES.RESERVED,
    purchasePrice: 28000,
    salePrice: 34500,
    platforms: ['Facebook Marketplace', 'Instagram'],
    arrivalDate: '2024-09-20',
    saleDate: null,
    photos: [],
  },
  {
    id: 4,
    make: 'Mazda',
    model: 'CX-5',
    year: 2018,
    mileage: 132000,
    color: 'Красный',
    transmission: 'Автомат',
    engine: 2.0,
    vin: 'JM3KFBCM2J0123456',
    description: 'Один владелец. Кожаный салон.',
    location: 'Ришон-ле-Цион',
    status: STATUSES.SOLD,
    purchasePrice: 31000,
    salePrice: 38000,
    platforms: ['Yad2', 'WhatsApp'],
    arrivalDate: '2024-08-10',
    saleDate: '2024-11-20',
    photos: [],
  },
  {
    id: 5,
    make: 'Volkswagen',
    model: 'Passat',
    year: 2022,
    mileage: 41000,
    color: 'Синий',
    transmission: 'Автомат',
    engine: 1.5,
    vin: '1VWFE21C04M123456',
    description: 'Почти новая. Парктроник, камера заднего вида.',
    location: 'Иерусалим',
    status: STATUSES.FOR_SALE,
    purchasePrice: 72000,
    salePrice: 83000,
    platforms: ['Yad2'],
    arrivalDate: '2024-12-01',
    saleDate: null,
    photos: [],
  },
]

export const initialLeads = [
  {
    id: 1,
    name: 'Алексей Смирнов',
    phone: '+972501234567',
    carId: 1,
    status: LEAD_STATUSES.NEGOTIATING,
    note: 'Интересуется Camry, хочет снизить цену',
    createdAt: '2024-12-10',
  },
  {
    id: 2,
    name: 'Михаил Коэн',
    phone: '+972509876543',
    carId: 2,
    status: LEAD_STATUSES.NEW,
    note: 'Написал в WhatsApp, ждёт ответа',
    createdAt: '2024-12-12',
  },
  {
    id: 3,
    name: 'Наталья Леви',
    phone: '+972527654321',
    carId: 4,
    status: LEAD_STATUSES.WON,
    note: 'Купила Mazda CX-5',
    createdAt: '2024-11-18',
  },
  {
    id: 4,
    name: 'Давид Перец',
    phone: '+972541112233',
    carId: 3,
    status: LEAD_STATUSES.NEGOTIATING,
    note: 'Поставил в резерв, платит аванс в пятницу',
    createdAt: '2024-12-08',
  },
]
