/**
 * Sunrise/sunset calculation based on the formulas used by SunCalc
 * (https://github.com/mourner/suncalc), reduced to what the day/night background needs.
 */

const rad = Math.PI / 180
const dayMs = 1000 * 60 * 60 * 24
const J1970 = 2440588
const J2000 = 2451545
const J0 = 0.0009
const obliquity = rad * 23.4397

const toDays = (date: Date) => date.valueOf() / dayMs - 0.5 + J1970 - J2000
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * dayMs)

const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d)

function eclipticLongitude(M: number) {
  const center = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const perihelion = rad * 102.9372
  return M + center + perihelion + Math.PI
}

const approxTransit = (Ht: number, lw: number, n: number) => J0 + (Ht + lw) / (2 * Math.PI) + n
const solarTransitJ = (ds: number, M: number, L: number) =>
  J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)

/**
 * Times at which the sun crosses the given altitude (in degrees) on the day of `date`.
 * Returns null during polar day/night when the sun never crosses that altitude.
 */
export function getSunTimes(date: Date, latitude: number, longitude: number, altitude: number) {
  const lw = rad * -longitude
  const phi = rad * latitude
  const d = toDays(date)

  const n = Math.round(d - J0 - lw / (2 * Math.PI))
  const ds = approxTransit(0, lw, n)
  const M = solarMeanAnomaly(ds)
  const L = eclipticLongitude(M)
  const dec = Math.asin(Math.sin(obliquity) * Math.sin(L))
  const Jnoon = solarTransitJ(ds, M, L)

  const h = rad * altitude
  const w = Math.acos(
    (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  )
  if (Number.isNaN(w)) return null

  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L)
  const Jrise = Jnoon - (Jset - Jnoon)
  return { rise: fromJulian(Jrise), set: fromJulian(Jset), noon: fromJulian(Jnoon) }
}
