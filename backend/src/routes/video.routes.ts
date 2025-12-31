import { Router } from 'express';
import { videoController } from '../controllers/video.controller';
import { authMiddleware } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configure multer for video upload
const storage = multer.diskStorage({
    destination: 'uploads/videos/',
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '209715200') }, // 200MB default
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|webm|ogg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only video files (MP4, WebM, OGG) are allowed'));
    },
});

router.use(authMiddleware);

router.post('/upload', upload.single('video'), videoController.uploadVideo);
router.get('/:id', videoController.getVideo);
router.delete('/:id', videoController.deleteVideo);

export default router;
