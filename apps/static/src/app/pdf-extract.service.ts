import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import fs from 'fs';
import fetch from 'node-fetch';
import { PdfReader } from 'pdfreader';
import stream from 'stream';
import { promisify } from 'util';

const pipeline = promisify(stream.pipeline);

@Injectable()
export class PdfExtractService {
  async extractTextFromPdfUrl(pdfUrl: string): Promise<string> {
    if (!pdfUrl) {
      throw new BadRequestException('No PDF URL provided');
    }

    // Download the PDF file
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new InternalServerErrorException('Failed to fetch PDF');
    }

    const tempFilePath = 'temp.pdf';
    await pipeline(response.body as any, fs.createWriteStream(tempFilePath));

    let pdfText = '';
    await new Promise<void>((resolve, reject) => {
      new PdfReader().parseFileItems(tempFilePath, (err, item) => {
        if (err) {
          reject(err);
        } else if (!item) {
          resolve();
        } else if (item.text) {
          pdfText += item.text + '\n';
        }
      });
    });

    fs.unlinkSync(tempFilePath); // Remove temp file after processing

    return pdfText;
  }

  async extractAndSend(pdfUrl: string, targetUrl?: string): Promise<any> {
    const pdfText = await this.extractTextFromPdfUrl(pdfUrl);
    const responseData = { text: pdfText };

    if (targetUrl) {
      try {
        const sendResponse = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(responseData),
        });
        const result = await sendResponse.json();
        return { success: true, targetResponse: result };
      } catch (error) {
        throw new InternalServerErrorException('Failed to send data to target URL');
      }
    }

    return responseData;
  }
}
