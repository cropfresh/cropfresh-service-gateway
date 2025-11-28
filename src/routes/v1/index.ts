import { Router } from 'express';
import authRoutes from './auth';
import catalogRoutes from './catalog';
import orderRoutes from './orders';

const router = Router();

router.use('/auth', authRoutes);
router.use('/catalog', catalogRoutes);
router.use('/orders', orderRoutes);

export default router;
