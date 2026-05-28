import { z } from 'zod';
import { POSTOP_CATEGORIES } from './repos/postop-template.schema';

export const PostopBranchParams = z.object({
  branchId: z.string().uuid(),
});

export const PostopTemplateIdParams = z.object({
  branchId: z.string().uuid(),
  templateId: z.string().uuid(),
});

export const CreatePostopTemplateBody = z.object({
  category: z.enum(POSTOP_CATEGORIES),
  title: z.string().min(1),
  content: z.string().min(1),
});

export const UpdatePostopTemplateBody = z.object({
  category: z.enum(POSTOP_CATEGORIES).optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  active: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

export const ListPostopTemplatesQuery = z.object({
  category: z.enum(POSTOP_CATEGORIES).optional(),
});
