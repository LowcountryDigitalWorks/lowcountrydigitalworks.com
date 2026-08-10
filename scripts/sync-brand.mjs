import { cp, mkdir, rm } from 'node:fs/promises';

const copies = [
  ['brand/logo', 'public/brand/logo'],
  ['brand/social', 'public/brand/social'],
];

await rm('public/brand', { recursive: true, force: true });
for (const [source, destination] of copies) {
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });
}

await cp('brand/icons/favicon.svg', 'public/favicon.svg');
await cp('brand/icons/favicon.ico', 'public/favicon.ico');
for (const size of [16, 24, 32, 48, 64]) {
  await cp(`brand/icons/favicon-${size}.png`, `public/favicon-${size}.png`);
}
await cp('brand/icons/apple-touch-icon.png', 'public/apple-touch-icon.png');
