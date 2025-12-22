import { Router } from 'express';
import authRoutes from './auth';
import catalogRoutes from './catalog';
import orderRoutes from './orders';
import teamRoutes from './team';
import haulerRoutes from './hauler';
import haulerAdminRoutes from './hauler-admin';
import agentRoutes from './agent'; // Story 2.6
import agentAdminRoutes from './agent-admin'; // Story 2.6
import profileRoutes from './users/profile'; // Story 2.7
import buyerAddressRoutes from './buyers/addresses'; // Story 2.7
import farmersListingsRoutes from './farmers/listings'; // Story 3.1
import farmersPhotosRoutes from './farmers/photos'; // Story 3.2
import farmersGradingRoutes from './farmers/grading'; // Story 3.3

const router = Router();

router.use('/auth', authRoutes);
router.use('/catalog', catalogRoutes);
router.use('/orders', orderRoutes);
router.use('/buyer/team', teamRoutes); // Story 2.4 Team Management
router.use('/hauler/register', haulerRoutes); // Story 2.5 Hauler Registration
router.use('/admin/haulers', haulerAdminRoutes); // Story 2.5 Admin Verification
router.use('/agent', agentRoutes); // Story 2.6 Agent Mobile App
router.use('/admin', agentAdminRoutes); // Story 2.6 Agent Admin Management
router.use('/users', profileRoutes); // Story 2.7 Profile Management
router.use('/buyers/addresses', buyerAddressRoutes); // Story 2.7 Delivery Addresses
router.use('/farmers/listings', farmersListingsRoutes); // Story 3.1 Farmer Listings
router.use('/farmers/listings', farmersPhotosRoutes); // Story 3.2 Photo Upload
router.use('/farmers/listings', farmersGradingRoutes); // Story 3.3 AI Grading & Pricing

export default router;

