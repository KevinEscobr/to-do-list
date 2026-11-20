const express = require('express');
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  clearCompleted,
  syncBatch,
} = require('../controllers/task.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Todas las rutas de tareas requieren autenticación JWT
router.use(authenticateToken);

router.get('/', getTasks);
router.post('/', createTask);
router.post('/sync', syncBatch);
router.delete('/completed', clearCompleted);
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;
