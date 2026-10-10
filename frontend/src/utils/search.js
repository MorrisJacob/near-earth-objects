function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

// Match every term, in any order, across the fields visitors can look up.
// Ignore punctuation so NASA designations work with or without parentheses.
export function matchesSearch(neo, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  const fields = [neo.name, neo.id, neo.close_approach_date].map(normalize)
  return terms.every(term => fields.some(field => field.includes(term)))
}
