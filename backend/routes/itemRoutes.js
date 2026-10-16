const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const authMiddleware = require('../middleware/authMiddleware');

// Công khai: Xem danh sách món kem, xem chi tiết
router.get('/', itemController.getItems);
router.get('/:id', itemController.getItemById);

// Admin: Quản lý món kem
router.post('/', authMiddleware, itemController.createItem);
router.put('/:id', authMiddleware, itemController.updateItem);
router.delete('/:id', authMiddleware, itemController.deleteItem);

module.exports = router;
