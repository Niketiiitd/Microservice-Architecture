import { Injectable } from '@nestjs/common';

interface TempUser {
   name: string;
   email: string;
}


@Injectable()
export class AppService {
  getData(): { message: string; user: Partial<TempUser> } {
    return { 
      message: 'Hello API', 
      user: { name: 'John Doe', email: 'john.doe@example.com' } 
    };
  }
}
