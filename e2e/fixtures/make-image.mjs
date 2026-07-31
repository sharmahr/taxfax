// Generates a document-like PNG (no deps) so we can transcode it to HEIC with `sips`.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const W = 1000, H = 1400;
const rgb = Buffer.alloc(W * H * 3);
// Warm paper background
for (let i = 0; i < W * H; i++) { rgb[i*3] = 250; rgb[i*3+1] = 249; rgb[i*3+2] = 244; }
function rect(x0, y0, x1, y1, r, g, b) {
  for (let y = Math.max(0,y0); y < Math.min(H,y1); y++)
    for (let x = Math.max(0,x0); x < Math.min(W,x1); x++) {
      const o = (y*W + x)*3; rgb[o]=r; rgb[o+1]=g; rgb[o+2]=b;
    }
}
// A framed "form" with a heading bar and rows of ink lines (mimics a W-2).
rect(70,70,930,120, 40,40,44);            // heading bar
for (let i=0;i<14;i++){                    // field rows
  const y = 180 + i*80;
  rect(90, y, 90+ (200 + (i*53)%520), y+18, 60,60,66);   // label/value line
  rect(90, y+34, 90 + (120 + (i*97)%360), y+46, 150,150,156); // faint sub line
}
rect(70,70,72,1330, 210,210,214); rect(928,70,930,1330,210,210,214);
rect(70,70,930,72,210,210,214); rect(70,1328,930,1330,210,210,214);

// PNG encode (filter 0 per scanline)
const raw = Buffer.alloc(H * (1 + W*3));
for (let y=0;y<H;y++){ raw[y*(1+W*3)] = 0; rgb.copy(raw, y*(1+W*3)+1, y*W*3, (y+1)*W*3); }
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length,0);
  const t = Buffer.from(type,'ascii');
  const crc = Buffer.alloc(4);
  // CRC32
  let c = ~0;
  const buf = Buffer.concat([t,data]);
  for (let i=0;i<buf.length;i++){ c ^= buf[i]; for(let k=0;k<8;k++) c = (c>>>1) ^ (0xEDB88320 & -(c&1)); }
  crc.writeUInt32BE((~c)>>>0,0);
  return Buffer.concat([len,t,data,crc]);
}
const sig = Buffer.from([137,80,78,71,13,10,26,10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4); ihdr[8]=8; ihdr[9]=2; // 8-bit RGB
const png = Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(process.argv[2], png);
console.log('wrote', process.argv[2], png.length, 'bytes');
