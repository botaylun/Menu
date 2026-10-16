const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const authMiddleware = require('../middleware/authMiddleware');

// Công khai: Xem danh sách khu vực
router.get('/', zoneController.getZones);

// Admin: Quản lý khu vực
router.post('/', authMiddleware, zoneController.createZone);
router.put('/:key', authMiddleware, zoneController.updateZone);
router.delete('/:key', authMiddleware, zoneController.deleteZone);

module.exports = router;
