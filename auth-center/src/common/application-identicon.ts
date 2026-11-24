export function applicationIdenticon(id: string): string {
  let hash = 2166136261;
  for (const character of id.toLowerCase()) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }

  const hue = (hash >>> 16) % 360;
  const pixels = (hash & 0x7fff) || (1 << 8);
  const cells: string[] = [];
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 3; column++) {
      if (!(pixels & (1 << (row * 3 + column)))) continue;
      cells.push(`<rect x="${15 + column * 10}" y="${15 + row * 10}" width="10" height="10"/>`);
      if (column !== 2) {
        cells.push(`<rect x="${55 - column * 10}" y="${15 + row * 10}" width="10" height="10"/>`);
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" shape-rendering="crispEdges"><rect width="80" height="80" fill="hsl(${hue} 85% 93%)"/><g fill="hsl(${hue} 70% 52%)">${cells.join("")}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
