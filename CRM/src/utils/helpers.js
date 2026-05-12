export function daysOnLot(arrivalDate, saleDate) {
  const from = new Date(arrivalDate)
  const to = saleDate ? new Date(saleDate) : new Date()
  return Math.floor((to - from) / (1000 * 60 * 60 * 24))
}

export function formatPrice(n) {
  return '₪' + Number(n).toLocaleString('ru-RU')
}

export function formatMileage(n) {
  return Number(n).toLocaleString('ru-RU') + ' км'
}

export function shareToWhatsApp(car, baseUrl) {
  const url = `${baseUrl}/site/car/${car.id}`
  const text = `🚗 ${car.make} ${car.model} ${car.year} | ${formatMileage(car.mileage)} | ${car.color}
💰 ${formatPrice(car.salePrice)}
📍 ${car.location}
👉 ${url}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
