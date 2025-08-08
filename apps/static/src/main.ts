/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { AppModule } from './app/app.module';

// Load the root .env file
dotenv.config({ path: join(__dirname, '../../../../.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configure CORS properly for credentials
  app.enableCors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // Define allowed origins
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://your-production-domain.com' // Add your production domain
      ];
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  });
   
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = 3003;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
