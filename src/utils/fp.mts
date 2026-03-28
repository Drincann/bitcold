export function toMap<T, K, V>(
  items: T[],
  keyExtractor: (item: T) => K,
  valueExtractor: (item: T) => V
): Map<K, V> {

  const map = new Map<K, V>()
  items.forEach(item => {
    map.set(keyExtractor(item), valueExtractor(item))
  })

  return map
}

export function identity<T>(): (value: T) => T {
  return v => v
}
