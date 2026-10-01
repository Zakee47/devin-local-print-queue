import type { Dimensions } from "./event";

export function fitsWithin(d: Dimensions, max: Dimensions): boolean {
  const dimensions = [d.x, d.y, d.z];
  const limits = [max.x, max.y, max.z];
  if ([...dimensions, ...limits].some((value) => !Number.isFinite(value) || value <= 0)) return false;
  dimensions.sort((a, b) => b - a);
  limits.sort((a, b) => b - a);
  return dimensions.every((value, index) => value <= limits[index]);
}

export function formatDimensions(d: Dimensions): string {
  const format = (value: number) => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return `${format(d.x)} × ${format(d.y)} × ${format(d.z)} mm`;
}
