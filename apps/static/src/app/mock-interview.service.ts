import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';

@Injectable()
export class MockInterviewService {
  // Update the path to point to the same directory as this service
  private readonly PY_PATH = path.join(__dirname, 'generate_mock_interview.py');
  private readonly PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

  async generateMockInterview(school: string): Promise<any> {
    if (!school || !school.trim()) {
      throw new BadRequestException('Missing school parameter');
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.PYTHON_BIN, [this.PY_PATH], {
        env: { ...process.env, SCHOOL_NAME: school }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (c) => { stdout += c; });
      child.stderr.on('data', (c) => { stderr += c; });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(stderr);
          return reject(new InternalServerErrorException('Python error'));
        }
        try {
          const data = JSON.parse(stdout);
          resolve(data);
        } catch (err) {
          console.error('Bad JSON from python:', stdout);
          reject(new InternalServerErrorException('Malformed JSON from Python script'));
        }
      });
    });
  }
}
