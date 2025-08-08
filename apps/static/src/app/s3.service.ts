import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.AMAZON_AWS_BUCKET_NAME!;
    this.s3Client = new S3Client({
      region: process.env.AMAZON_AWS_BUCKET_REGION,
      credentials: {
        accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  uploadFile(fileBuffer: Buffer, fileName: string, mimetype: string) {
    const uploadParams = {
      Bucket: this.bucketName,
      Body: fileBuffer,
      Key: fileName,
      ContentType: mimetype,
    };
    return this.s3Client.send(new PutObjectCommand(uploadParams));
  }

  deleteFile(fileName: string) {
    const deleteParams = {
      Bucket: this.bucketName,
      Key: fileName,
    };
    return this.s3Client.send(new DeleteObjectCommand(deleteParams));
  }

  async getObjectSignedUrl(key: string): Promise<string> {
    const params = {
      Bucket: this.bucketName,
      Key: key,
    };
    const command = new GetObjectCommand(params);
    const seconds = 60 * 60; // 1 hour
    return getSignedUrl(this.s3Client, command, { expiresIn: seconds });
  }
}
