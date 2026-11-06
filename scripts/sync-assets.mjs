import { copyFile, mkdir } from 'node:fs/promises';
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
// Keep the original question file intact; public is a generated compatibility asset.
await copyFile(new URL('../questions.json', import.meta.url), new URL('../public/questions.json', import.meta.url));
