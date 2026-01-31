import type { Clinic } from '../types/index.js'

// OpenStreetMap Overpass API for finding nearby healthcare facilities
const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter'

interface OverpassElement {
  type: string
  id: number
  lat: number
  lon: number
  tags?: {
    name?: string
    'addr:street'?: string
    'addr:housenumber'?: string
    'addr:city'?: string
    'addr:postcode'?: string
    phone?: string
    website?: string
    healthcare?: string
    amenity?: string
    'healthcare:speciality'?: string
  }
}

interface OverpassResponse {
  elements: OverpassElement[]
}

export class ClinicsService {
  async findNearbyClinics(
    lat: number,
    lng: number,
    radiusMeters: number = 10000
  ): Promise<Clinic[]> {
    // Overpass query for women's health related facilities
    const query = `
      [out:json][timeout:25];
      (
        node["healthcare"="clinic"](around:${radiusMeters},${lat},${lng});
        node["amenity"="doctors"](around:${radiusMeters},${lat},${lng});
        node["healthcare"="doctor"](around:${radiusMeters},${lat},${lng});
        node["healthcare:speciality"~"gynaecology|obstetrics|midwifery"](around:${radiusMeters},${lat},${lng});
        node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
        way["healthcare"="clinic"](around:${radiusMeters},${lat},${lng});
        way["amenity"="doctors"](around:${radiusMeters},${lat},${lng});
        way["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
      );
      out body center;
    `

    try {
      const response = await fetch(OVERPASS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      })

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`)
      }

      const data = (await response.json()) as OverpassResponse

      const clinics: Clinic[] = data.elements
        .filter((el) => el.tags?.name) // Only include places with names
        .map((el) => {
          const tags = el.tags || {}
          const address = this.buildAddress(tags)

          return {
            id: `osm-${el.type}-${el.id}`,
            name: tags.name || 'Healthcare Facility',
            address,
            location: {
              lat: el.lat,
              lng: el.lon,
            },
            phone: tags.phone,
            website: tags.website,
            distance: this.calculateDistance(lat, lng, el.lat, el.lon),
            tags: this.extractTags(tags),
          }
        })
        .sort((a, b) => (a.distance || 0) - (b.distance || 0))
        .slice(0, 20) // Limit to 20 results

      return clinics
    } catch (error) {
      console.error('Failed to fetch clinics from Overpass:', error)
      return []
    }
  }

  private buildAddress(tags: OverpassElement['tags']): string {
    if (!tags) return 'Address not available'

    const parts = []
    if (tags['addr:housenumber'] && tags['addr:street']) {
      parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`)
    } else if (tags['addr:street']) {
      parts.push(tags['addr:street'])
    }

    if (tags['addr:city']) {
      parts.push(tags['addr:city'])
    }

    if (tags['addr:postcode']) {
      parts.push(tags['addr:postcode'])
    }

    return parts.length > 0 ? parts.join(', ') : 'Address not available'
  }

  private extractTags(tags: OverpassElement['tags']): string[] {
    if (!tags) return []

    const result: string[] = []

    if (tags.healthcare) {
      result.push(tags.healthcare)
    }
    if (tags.amenity) {
      result.push(tags.amenity)
    }
    if (tags['healthcare:speciality']) {
      result.push(...tags['healthcare:speciality'].split(';'))
    }

    return result
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    // Haversine formula
    const R = 6371e3 // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180
    const phi2 = (lat2 * Math.PI) / 180
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return Math.round(R * c) // Distance in meters
  }
}

let clinicsService: ClinicsService | null = null

export function getClinicsService(): ClinicsService {
  if (!clinicsService) {
    clinicsService = new ClinicsService()
  }
  return clinicsService
}
