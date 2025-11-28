import { z } from 'zod';

export const loginSchema = z.object({
    body: z.object({
        phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
        otp: z.string().length(6, 'OTP must be 6 digits'),
    }),
});

export const createOrderSchema = z.object({
    body: z.object({
        items: z.array(z.object({
            productId: z.string(),
            quantity: z.number().positive(),
        })).min(1, 'Order must contain at least one item'),
        deliveryAddressId: z.string(),
    }),
});
