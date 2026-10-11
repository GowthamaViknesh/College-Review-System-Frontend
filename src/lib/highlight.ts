// Wraps every match of the search term in <mark>, so readers can see why a review came up
export function highlight(text: string, term: string) {
  if (!term) return text
  return text.replace(new RegExp(term, 'gi'), (match) => `<mark class="rounded bg-amber-200 px-0.5 text-ink">${match}</mark>`)
}
