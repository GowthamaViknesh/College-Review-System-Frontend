import { useQuery } from '@tanstack/react-query'

// The lists of countries, their states and their cities come from the country-state-city package.
// Its city list alone is about 8 MB, so it is downloaded only when a form that needs it is opened,
// and then kept for as long as the page stays open.
type Places = typeof import('country-state-city')

export function usePlaces(): Places | undefined {
  return useQuery({ queryKey: ['places'], queryFn: () => import('country-state-city'), staleTime: Infinity, gcTime: Infinity }).data
}

const byName = (a: string, b: string) => a.localeCompare(b)

// Colleges store places by name ("India", "Tamil Nadu", "Chennai"), which is what people read and
// search for. The package finds states and cities by code, so each name is turned back into its code
// on the way down. Every list is empty until the level above it has been chosen.
export function placeOptions(places: Places | undefined, countryName: string, stateName: string) {
  if (!places) return { countries: [], states: [], cities: [] }

  const allCountries = places.Country.getAllCountries()
  const country = allCountries.find((item) => item.name === countryName)
  const allStates = country ? places.State.getStatesOfCountry(country.isoCode) : []
  const state = allStates.find((item) => item.name === stateName)
  const allCities = country && state ? places.City.getCitiesOfState(country.isoCode, state.isoCode) : []

  // Some places appear twice in the data under one name; a list of names needs each only once
  const names = (items: { name: string }[]) => [...new Set(items.map((item) => item.name))].sort(byName)
  return { countries: names(allCountries), states: names(allStates), cities: names(allCities) }
}
