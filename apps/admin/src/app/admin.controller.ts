import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('universities')
  async getUniversities(
    @Query('id') id: string,
    @Query('name') name: string,
    @Res() res: Response
  ) {
    try {
      const result = await this.adminService.getUniversities({ id, name });
      if ('error' in result) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  @Get('programs')
  async getPrograms(
    @Query('id') id: string,
    @Query('universityId') universityId: string,
    @Res() res: Response
  ) {
    try {
      const result = await this.adminService.getPrograms({ id, universityId });
      if ('error' in result) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  @Post('scenario')
  async createScenario(
    @Body() body: any,
    @Res() res: Response
  ) {
    try {
      const result = await this.adminService.createScenarioAndSaveSessionId(body);
      if ('error' in result) {
        return res.status(result.status || 500).json({ error: result.error });
      }
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

