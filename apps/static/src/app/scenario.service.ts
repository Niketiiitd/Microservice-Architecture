import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import mongoose from 'mongoose';
import { Program } from './models/program.model';
import { UserApplication } from './models/userapplication.model';

@Injectable()
export class ScenarioService {
  async createScenarioAndSaveSessionId(body: any): Promise<any> {
    try {
      await mongoose.connect(process.env.MONGODB_URI!);
      console.log("Sending to toughtongueai:", body); // Add this line

      // Call the external API
      const response = await fetch('https://api.toughtongueai.com/api/public/scenarios', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer R4f4yhtqhhCdtLJi99TiLPuou2oDECVfJzWAt6cYwmg',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('External API error response:', errorText); // Add this line
        throw new InternalServerErrorException(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const userApplicationId = body.applicationId;
      const scenarioId = data.id;

      // Fetch the UserApplication to get the associated Program ID
      const userApplication = await UserApplication.findById(userApplicationId).populate('program');
      if (!userApplication) {
        throw new NotFoundException('UserApplication not found');
      }

      const programId = userApplication.program._id;

      // Save the scenario ID in the corresponding program in MongoDB
      const program = await Program.findById(programId);
      if (program) {
        // Use findByIdAndUpdate to only update sessionId and avoid full validation
        await Program.findByIdAndUpdate(programId, { sessionId: scenarioId });
      } else {
        throw new NotFoundException('Program not found');
      }

      return data;
    } catch (error) {
      console.error('Error proxying request or saving scenario ID:', error);
      throw new InternalServerErrorException('Failed to fetch or save scenario');
    }
  }
}
function fetch(
    url: string,
    options: { method: string; headers: { Authorization: string; 'Content-Type': string }; body: string }
): Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string> }> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    
        const req = lib(url, { method: options.method, headers: options.headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode || 0,
                    json: async () => JSON.parse(data),
                    text: async () => data
                });
            });
        });
    
        req.on('error', (err) => {
            reject(err);
        });
    
        if (options.body) {
            req.write(options.body);
        }
    
        req.end();
    });
}

