import { asyncHandler } from "../utils/asyncHandler";
import { created, success } from "../utils/response";
import { addressService, notificationService } from "../services/account.service";
import { authService } from "../services/auth.service";
import { createAddressSchema } from "../validators/catalog.validator";
import { changePasswordSchema, updateProfileSchema } from "../validators/auth.validator";
import { paginationSchema } from "../validators/commerce.validator";
import { pushService } from "../services/push.service";
import { z } from "zod";

export const addressController = {
  list: asyncHandler(async (req, res) => {
    const items = await addressService.list(req.user!.id);
    success(res, { items });
  }),

  create: asyncHandler(async (req, res) => {
    const input = createAddressSchema.parse(req.body);
    const address = await addressService.create(req.user!.id, input);
    created(res, address);
  }),

  update: asyncHandler(async (req, res) => {
    const input = createAddressSchema.partial().parse(req.body);
    const address = await addressService.update(req.user!.id, (req.params.id as string), input);
    success(res, address);
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await addressService.remove(req.user!.id, (req.params.id as string));
    success(res, result);
  }),

  setDefault: asyncHandler(async (req, res) => {
    const result = await addressService.setDefault(req.user!.id, (req.params.id as string));
    success(res, result);
  }),
};

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    const query = paginationSchema
      .extend({ unread: z.coerce.boolean().optional().default(false) })
      .parse(req.query);
    const result = await notificationService.list(req.user!.id, query.page, query.limit, query.unread);
    success(res, { items: result.items }, result.meta);
  }),

  unreadCount: asyncHandler(async (req, res) => {
    const count = await notificationService.unreadCount(req.user!.id);
    success(res, { count });
  }),

  markRead: asyncHandler(async (req, res) => {
    await notificationService.markRead(req.user!.id, (req.params.id as string));
    success(res, { ok: true });
  }),

  markAllRead: asyncHandler(async (req, res) => {
    await notificationService.markAllRead(req.user!.id);
    success(res, { ok: true });
  }),
};

export const profileController = {
  get: asyncHandler(async (req, res) => {
    const result = await authService.me(req.user!.id);
    success(res, result);
  }),

  update: asyncHandler(async (req, res) => {
    const input = updateProfileSchema.parse(req.body);
    const result = await authService.updateProfile(req.user!.id, input);
    success(res, result);
  }),

  changePassword: asyncHandler(async (req, res) => {
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, input.currentPassword, input.newPassword);
    success(res, { message: "Password changed" });
  }),
};

const registerDeviceSchema = z.object({
  token: z.string().trim().min(10).max(4096),
  platform: z.enum(["IOS", "ANDROID", "WEB"]),
  appId: z.string().trim().max(100).optional().nullable(),
});

export const deviceController = {
  register: asyncHandler(async (req, res) => {
    const input = registerDeviceSchema.parse(req.body);
    const result = await pushService.registerDevice({
      userId: req.user!.id,
      token: input.token,
      platform: input.platform,
      appId: input.appId,
    });
    success(res, result);
  }),

  unregister: asyncHandler(async (req, res) => {
    const input = z.object({ token: z.string().trim().min(10).max(4096) }).parse(req.body);
    const result = await pushService.unregisterDevice(req.user!.id, input.token);
    success(res, result);
  }),
};
