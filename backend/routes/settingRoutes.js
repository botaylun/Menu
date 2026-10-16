const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/cover', settingController.getCoverSettings);
router.put('/cover', authMiddleware, settingController.updateCoverSettings);

module.exports = router;
