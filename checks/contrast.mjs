const channel = (value) => {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export const parseRgb = (color) => {
  const parts = color.match(/[\d.]+/g);
  if (!parts) throw new Error(`Unparseable color: ${color}`);
  return parts.slice(0, 3).map(Number);
};

export const relativeLuminance = ([r, g, b]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export const contrastRatio = (foreground, background) => {
  const [lighter, darker] = [foreground, background]
    .map((color) => relativeLuminance(parseRgb(color)))
    .sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};
