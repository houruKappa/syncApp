import Joi from 'joi';

export const createRoomSchema = Joi.object({
    name: Joi.string().min(3).max(100).required().messages({
        'string.min': 'Room name must be at least 3 characters',
        'string.max': 'Room name cannot exceed 100 characters',
        'any.required': 'Room name is required',
    }),
    isPublic: Joi.boolean().default(true),
    password: Joi.string().min(4).allow('', null).optional(),
    videoUrl: Joi.string().uri().allow('', null).optional(),
});

export const joinRoomSchema = Joi.object({
    password: Joi.string().allow('', null).optional(),
});
