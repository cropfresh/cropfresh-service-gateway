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
import farmersDroppointRoutes from './farmers/droppoint'; // Story 3.4
import farmersDroppointsRoutes from './farmers/droppoints'; // Story 3.4
import farmersMatchesRoutes from './farmers/matches'; // Story 3.5
import farmersTransactionsRoutes from './farmers/transactions'; // Story 3.7
import farmersNotificationsRoutes from './farmers/notifications'; // Story 3.8

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
router.use('/farmers/listings', farmersDroppointRoutes); // Story 3.4 Drop Point Assignment
router.use('/farmers/droppoints', farmersDroppointsRoutes); // Story 3.4 Drop Point Discovery
router.use('/farmers/matches', farmersMatchesRoutes); // Story 3.5 Buyer Match View
router.use('/farmers', farmersTransactionsRoutes); // Story 3.7 Transaction History
router.use('/farmers/notifications', farmersNotificationsRoutes); // Story 3.8 Notifications

export default router;

