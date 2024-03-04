/**
 * LittleZIP
 * Copyright (C) George MacKerron 2024
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *   http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// references:
// https://users.cs.jmu.edu/buchhofp/forensics/formats/pkzip.html
// https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
// https://www.rfc-editor.org/rfc/rfc1952


import { crc32 } from './crc32';

export interface File {
  data: string | ArrayBuffer | Uint8Array;
  name: string;
  lastModified?: Date;
}

const
  hasCompressionStreams = typeof CompressionStream !== 'undefined',
  textEncoder = new TextEncoder(),
  sum = (ns: number[]) => ns.reduce((memo, n) => memo + n, 0),
  ui8 = Uint8Array,  // saves a few bytes when minified
  gzipHeaderBytes = 10;

export async function createZip(inputFiles: File[], compressWhenPossible = true) {
  const
    localHeaderOffsets = [],
    attemptDeflate = hasCompressionStreams && compressWhenPossible,
    numFiles = inputFiles.length,
    fileNames = inputFiles.map(file => textEncoder.encode(file.name)),
    fileData = inputFiles.map(({ data }) =>
      typeof data === 'string' ? textEncoder.encode(data) :
        data instanceof ArrayBuffer ? new ui8(data) : data),
    totalDataSize = sum(fileData.map(data => data.byteLength)),
    totalFileNamesSize = sum(fileNames.map(name => name.byteLength)),
    centralDirectorySize = numFiles * 46 + totalFileNamesSize,
    // if deflate actually expands the data, which can happen, we'll just stick it in uncompressed
    maxZipSize = totalDataSize
      + numFiles * 30 + totalFileNamesSize  // local headers
      + centralDirectorySize + 22,  // 22 = cental directory trailer
    now = new Date(),
    zip = new ui8(maxZipSize);


  let b = 0;  // zip byte index

  // write local headers and compressed files
  for (let fileIndex = 0; fileIndex < numFiles; fileIndex++) {
    localHeaderOffsets[fileIndex] = b;

    const
      fileName = fileNames[fileIndex],
      fileNameSize = fileName.byteLength,
      uncompressed = fileData[fileIndex],
      uncompressedSize = uncompressed.byteLength,
      lm = inputFiles[fileIndex].lastModified ?? now,
      mtime = Math.floor(lm.getSeconds() / 2) + (lm.getMinutes() << 5) + (lm.getHours() << 11),
      mdate = lm.getDate() + ((lm.getMonth() + 1) << 5) + ((lm.getFullYear() - 1980) << 9);

    // signature
    zip[b++] = 0x50; // P
    zip[b++] = 0x4b; // K
    zip[b++] = 0x03;
    zip[b++] = 0x04;
    // version needed to extract
    zip[b++] = 20;  // 2.0
    zip[b++] = 0;
    // general purpose flag
    zip[b++] = 0;
    zip[b++] = 0b1000;  // bit 11 (indexed from 0) => UTF-8 file names
    // compression (come back later)
    const compressionOffset = b++;
    zip[b++] = 0;
    // mtime, mdate
    zip[b++] = mtime & 0xff;
    zip[b++] = mtime >> 8;
    zip[b++] = mdate & 0xff;
    zip[b++] = mdate >> 8;
    // crc32 (come back later)
    let crcOffset = b;
    b += 4;
    // compressed size (come back later)
    let compressedSizeOffset = b;
    b += 4;
    // uncompressed size
    zip[b++] = uncompressedSize & 0xff;
    zip[b++] = (uncompressedSize >> 8) & 0xff;
    zip[b++] = (uncompressedSize >> 16) & 0xff;
    zip[b++] = (uncompressedSize >> 24);
    // file name length
    zip[b++] = fileNameSize & 0xff;
    zip[b++] = (fileNameSize >> 8) & 0xff;
    // extra field length
    zip[b++] = 0;
    zip[b++] = 0;
    // file name
    zip.set(fileName, b);
    b += fileNameSize;

    // compressed data
    let compressedSize: number;
    if (attemptDeflate) {
      const
        compressedStart = b,
        cstream = new CompressionStream('gzip'),
        writer = cstream.writable.getWriter(),
        reader = cstream.readable.getReader();

      let
        bytes: Uint8Array,
        bytesStartOffset = 0,
        bytesEndOffset = 0,
        abortDeflate = false;

      writer.write(uncompressed);
      writer.close();

      deflate: {
        // check and skip gzip header
        for (; ;) {
          const data = await reader.read();
          if (data.done) throw new Error('Unexpected end of gzip data');

          bytes = data.value;
          bytesStartOffset = bytesEndOffset;
          bytesEndOffset = bytesStartOffset + bytes.length;

          // check flags value
          // note: we assume no optional fields; if there are any, we give up on compression
          if (bytesStartOffset <= 3 && bytesEndOffset > 3) {
            const flags = bytes[3 - bytesStartOffset];
            if (flags & 0b11110) {
              abortDeflate = true;  // assumptions on gzip flags were violated
              break deflate;
            }
          }

          // check end of header
          if (bytesEndOffset >= gzipHeaderBytes) {
            bytes = bytes.subarray(gzipHeaderBytes - bytesStartOffset);  // length could be zero
            break;
          }
        }

        // copy compressed data
        for (; ;) {
          const
            bytesAlreadyWritten = b - compressedStart,
            bytesLength = bytes.byteLength;

          if (bytesAlreadyWritten + bytesLength >= uncompressedSize) {
            abortDeflate = true;
            break deflate;
          }

          zip.set(bytes, b);
          b += bytesLength;

          const data = await reader.read();
          if (data.done) break;

          bytes = data.value;
        }
      }

      if (abortDeflate) {
        // Either we got unexpected flags, or deflate made the data larger.
        // In either case, we give up on the compressed data, but hold on for the CRC.
        // We need the last 8 bytes of gzip data: the first 4 of these are the CRC.

        for (; ;) {
          const
            bytesLength = bytes.byteLength,
            copyBytes = 8 - bytesLength,
            bPrev = b;

          b = compressedStart;
          for (let i = 0; i < 8; i++) {
            zip[b++] = i < copyBytes ? zip[bPrev - copyBytes + i] : bytes[bytesLength - 8 + i];
          }

          const data = await reader.read();
          if (data.done) break;

          bytes = data.value;
        }
      }

      // backtrack and retrieve CRC
      b -= 8;
      zip[crcOffset++] = zip[b++];
      zip[crcOffset++] = zip[b++];
      zip[crcOffset++] = zip[b++];
      zip[crcOffset++] = zip[b++];
      b -= 4;

      if (abortDeflate) {
        zip[compressionOffset] = 0;  // no compression
        zip.set(uncompressed, b);
        b += uncompressedSize;
        compressedSize = uncompressedSize;

      } else {
        zip[compressionOffset] = 8;  // deflate
        compressedSize = b - compressedStart;
      }

    } else {
      zip[compressionOffset] = 0;  // no compression
      zip.set(uncompressed, b);
      b += uncompressedSize;
      compressedSize = uncompressedSize;

      // calculate CRC ourselves
      const crc = crc32(uncompressed);
      zip[b++] = crc & 0xff;
      zip[b++] = (crc >> 8) & 0xff;
      zip[b++] = (crc >> 16) & 0xff;
      zip[b++] = (crc >> 24);
    }

    // fill in compressed size
    zip[compressedSizeOffset++] = compressedSize & 0xff;
    zip[compressedSizeOffset++] = (compressedSize >> 8) & 0xff;
    zip[compressedSizeOffset++] = (compressedSize >> 16) & 0xff;
    zip[compressedSizeOffset++] = (compressedSize >> 24);
  }

  // write central directory
  const centralDirectoryOffset = b;
  for (let fileIndex = 0; fileIndex < numFiles; fileIndex++) {
    const
      localHeaderOffset = localHeaderOffsets[fileIndex],
      fileName = fileNames[fileIndex],
      fileNameSize = fileName.byteLength;

    // signature
    zip[b++] = 0x50; // P
    zip[b++] = 0x4b; // K
    zip[b++] = 0x01;
    zip[b++] = 0x02;
    // version created by
    zip[b++] = 20;  // 2.0
    zip[b++] = 0;   // platform (MS-DOS)
    // version needed to extract
    zip[b++] = 20;  // 2.0
    zip[b++] = 0;
    // copy local header from [general purpose flag] to [extra field length]
    zip.set(zip.subarray(localHeaderOffset + 6, localHeaderOffset + 30), b);
    b += 24;
    // file comment length, disk number, internal attr, external attr
    for (let j = 0; j < 10; j++) zip[b++] = 0;
    // local header offset
    zip[b++] = localHeaderOffset & 0xff;
    zip[b++] = (localHeaderOffset >> 8) & 0xff;
    zip[b++] = (localHeaderOffset >> 16) & 0xff;
    zip[b++] = (localHeaderOffset >> 24);
    // file name
    zip.set(fileName, b);
    b += fileNameSize;
  }

  // write end-of-central-directory record
  // signature
  zip[b++] = 0x50; // P
  zip[b++] = 0x4b; // K
  zip[b++] = 0x05;
  zip[b++] = 0x06;
  // disk numbers x 2
  zip[b++] = 0;
  zip[b++] = 0;
  zip[b++] = 0;
  zip[b++] = 0;
  // disk entries
  zip[b++] = numFiles & 0xff;
  zip[b++] = (numFiles >> 8) & 0xff;
  // total entries
  zip[b++] = numFiles & 0xff;
  zip[b++] = (numFiles >> 8) & 0xff;
  // central directory size
  zip[b++] = centralDirectorySize & 0xff;
  zip[b++] = (centralDirectorySize >> 8) & 0xff;
  zip[b++] = (centralDirectorySize >> 16) & 0xff;
  zip[b++] = (centralDirectorySize >> 24);
  // central directory offset
  zip[b++] = centralDirectoryOffset & 0xff;
  zip[b++] = (centralDirectoryOffset >> 8) & 0xff;
  zip[b++] = (centralDirectoryOffset >> 16) & 0xff;
  zip[b++] = (centralDirectoryOffset >> 24);
  // comment length
  zip[b++] = 0;
  zip[b++] = 0;

  return zip.subarray(0, b);
}
