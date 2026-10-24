import { Request, Response } from 'express';
import * as analyticsService from './analytics.service';

export const getMyAnalytics = async (req: Request, res: Response) => {
  const analytics = await analyticsService.getMyAnalytics(req.user!.id);
  res.json({
    status: 'success',
    data: { analytics },
  });
};
