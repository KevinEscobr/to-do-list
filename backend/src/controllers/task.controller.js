const db = require('../config/db');

/**
 * Mapea una fila de base de datos SQLite al modelo de datos Task de la app.
 */
function mapRowToTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    description: row.description || '',
    category: row.category,
    priority: row.priority,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    imageUrl: row.image_url || undefined,
    imageFormat: row.image_format || undefined,
    location: row.location_json ? JSON.parse(row.location_json) : undefined,
    weather: row.weather_json ? JSON.parse(row.weather_json) : undefined,
    synced: true,
    remoteId: row.id,
  };
}

/**
 * GET /api/tasks
 * Retorna las tareas del usuario autenticado con filtros opcionales.
 */
function getTasks(req, res) {
  const userId = req.user.id;
  const { category, completed, search } = req.query;

  let query = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [userId];

  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (completed !== undefined && completed !== 'all') {
    query += ' AND completed = ?';
    params.push(completed === 'true' || completed === '1' ? 1 : 0);
  }

  if (search && search.trim() !== '') {
    query += ' AND (text LIKE ? OR description LIKE ? OR location_json LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.queryAll(query, params);
  const tasks = rows.map(mapRowToTask);

  return res.json(tasks);
}

/**
 * GET /api/tasks/:id
 */
function getTaskById(req, res) {
  const userId = req.user.id;
  const taskId = Number(req.params.id);

  const row = db.queryOne('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
  if (!row) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  return res.json(mapRowToTask(row));
}

/**
 * POST /api/tasks
 * Crea una nueva tarea para el usuario autenticado.
 */
function createTask(req, res) {
  const userId = req.user.id;
  const {
    text,
    description = '',
    category = 'Personal',
    priority = 'Media',
    completed = false,
    imageUrl = null,
    imageFormat = null,
    location = null,
    weather = null,
  } = req.body || {};

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'El campo "text" (título) es obligatorio.' });
  }

  const now = Date.now();
  const locationJson = location ? JSON.stringify(location) : null;
  const weatherJson = weather ? JSON.stringify(weather) : null;

  const result = db.execute(
    `INSERT INTO tasks (
      user_id, text, description, category, priority, completed,
      created_at, updated_at, image_url, image_format, location_json, weather_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      text.trim(),
      description.trim(),
      category,
      priority,
      completed ? 1 : 0,
      now,
      now,
      imageUrl,
      imageFormat,
      locationJson,
      weatherJson,
    ]
  );

  const newTaskId = Number(result.lastInsertRowid);
  const row = db.queryOne('SELECT * FROM tasks WHERE id = ?', [newTaskId]);

  return res.status(201).json(mapRowToTask(row));
}

/**
 * PUT /api/tasks/:id
 * Actualiza una tarea existente.
 */
function updateTask(req, res) {
  const userId = req.user.id;
  const taskId = Number(req.params.id);

  const existing = db.queryOne('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
  if (!existing) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const body = req.body || {};
  const text = body.text !== undefined ? body.text.trim() : existing.text;
  const description = body.description !== undefined ? body.description.trim() : existing.description;
  const category = body.category !== undefined ? body.category : existing.category;
  const priority = body.priority !== undefined ? body.priority : existing.priority;
  const completed = body.completed !== undefined ? (body.completed ? 1 : 0) : existing.completed;
  const imageUrl = body.imageUrl !== undefined ? body.imageUrl : existing.image_url;
  const imageFormat = body.imageFormat !== undefined ? body.imageFormat : existing.image_format;
  const locationJson = body.location !== undefined ? JSON.stringify(body.location) : existing.location_json;
  const weatherJson = body.weather !== undefined ? JSON.stringify(body.weather) : existing.weather_json;
  const now = Date.now();

  db.execute(
    `UPDATE tasks SET
      text = ?, description = ?, category = ?, priority = ?, completed = ?,
      updated_at = ?, image_url = ?, image_format = ?, location_json = ?, weather_json = ?
    WHERE id = ? AND user_id = ?`,
    [
      text,
      description,
      category,
      priority,
      completed,
      now,
      imageUrl,
      imageFormat,
      locationJson,
      weatherJson,
      taskId,
      userId,
    ]
  );

  const updatedRow = db.queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
  return res.json(mapRowToTask(updatedRow));
}

/**
 * DELETE /api/tasks/:id
 * Elimina una tarea individual.
 */
function deleteTask(req, res) {
  const userId = req.user.id;
  const taskId = Number(req.params.id);

  const existing = db.queryOne('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
  if (!existing) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  db.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
  return res.json({ message: 'Tarea eliminada correctamente', id: taskId });
}

/**
 * DELETE /api/tasks/completed
 * Elimina todas las tareas completadas del usuario.
 */
function clearCompleted(req, res) {
  const userId = req.user.id;
  const result = db.execute('DELETE FROM tasks WHERE user_id = ? AND completed = 1', [userId]);

  return res.json({
    message: 'Tareas completadas eliminadas correctamente',
    deletedCount: result.changes,
  });
}

/**
 * POST /api/tasks/sync
 * Sincronización en lote para clientes móviles offline-first.
 */
function syncBatch(req, res) {
  const userId = req.user.id;
  const { tasks = [] } = req.body || {};

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'El cuerpo debe incluir un arreglo "tasks"' });
  }

  const details = [];
  let syncedTasks = 0;
  let failedTasks = 0;

  for (const clientTask of tasks) {
    try {
      const now = Date.now();
      const locationJson = clientTask.location ? JSON.stringify(clientTask.location) : null;
      const weatherJson = clientTask.weather ? JSON.stringify(clientTask.weather) : null;

      let remoteId = clientTask.remoteId;

      if (remoteId) {
        // Actualizar tarea existente si pertenece al usuario
        const existing = db.queryOne('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [remoteId, userId]);
        if (existing) {
          db.execute(
            `UPDATE tasks SET
              text = ?, description = ?, category = ?, priority = ?, completed = ?,
              updated_at = ?, image_url = ?, image_format = ?, location_json = ?, weather_json = ?
            WHERE id = ? AND user_id = ?`,
            [
              clientTask.text || 'Sin título',
              clientTask.description || '',
              clientTask.category || 'Personal',
              clientTask.priority || 'Media',
              clientTask.completed ? 1 : 0,
              now,
              clientTask.imageUrl || null,
              clientTask.imageFormat || null,
              locationJson,
              weatherJson,
              remoteId,
              userId,
            ]
          );
        } else {
          remoteId = null;
        }
      }

      if (!remoteId) {
        // Insertar nueva tarea en la BD remota
        const result = db.execute(
          `INSERT INTO tasks (
            user_id, text, description, category, priority, completed,
            created_at, updated_at, image_url, image_format, location_json, weather_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            clientTask.text || 'Sin título',
            clientTask.description || '',
            clientTask.category || 'Personal',
            clientTask.priority || 'Media',
            clientTask.completed ? 1 : 0,
            clientTask.createdAt || now,
            now,
            clientTask.imageUrl || null,
            clientTask.imageFormat || null,
            locationJson,
            weatherJson,
          ]
        );
        remoteId = Number(result.lastInsertRowid);
      }

      details.push({
        id: clientTask.id,
        remoteId,
        status: 'ok',
      });
      syncedTasks++;
    } catch (err) {
      details.push({
        id: clientTask.id,
        status: 'error',
        error: err.message,
      });
      failedTasks++;
    }
  }

  return res.json({
    success: failedTasks === 0,
    syncedTasks,
    failedTasks,
    details,
  });
}

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  clearCompleted,
  syncBatch,
};
