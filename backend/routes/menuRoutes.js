const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

// Lấy toàn bộ Menu cho Frontend FlipBook
router.get('/', menuController.getMenuData);

module.exports = router;
