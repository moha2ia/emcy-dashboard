const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/progress — List progress entries with optional filters
router.get('/', auth, (req, res) => {
  try {
    let results = db.get('weeklyProgress').value();
    const { userId, weekNumber } = req.query;
    if (userId) results = results.filter((p) => p.userId === userId);
    if (req.user.role === 'member') results = results.filter((p) => p.userId === req.user.id);
    if (weekNumber) results = results.filter((p) => p.weekNumber === parseInt(weekNumber));
    results.sort((a, b) => a.weekNumber - b.weekNumber);
    res.json({ progress: results });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/progress/stats — Aggregate statistics for dashboard
router.get('/stats', auth, (req, res) => {
  try {
    const allProgress = db.get('weeklyProgress').value();
    const allMembers = db.get('users').filter({ role: 'member' }).value();
    const totalMembers = allMembers.length;
    const totalEntries = allProgress.length;
    const doneEntries = allProgress.filter((p) => p.status === 'done').length;
    const overallCompletionRate = totalEntries > 0 ? Math.round((doneEntries / totalEntries) * 100) : 0;
    const currentWeek = allProgress.length > 0 ? Math.max(...allProgress.map((p) => p.weekNumber)) : 1;
    const activeThisWeek = allProgress.filter((p) => p.weekNumber === currentWeek && p.status === 'done').length;

    const weeklyStats = [];
    for (let week = 1; week <= currentWeek; week++) {
      const weekEntries = allProgress.filter((p) => p.weekNumber === week);
      const weekDone = weekEntries.filter((p) => p.status === 'done').length;
      const weekTotal = weekEntries.length;
      weeklyStats.push({ week, done: weekDone, notDone: weekTotal - weekDone, total: weekTotal, completionRate: weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0 });
    }

    const memberScores = allMembers.map((member) => {
      const mp = allProgress.filter((p) => p.userId === member.id);
      const done = mp.filter((p) => p.status === 'done').length;
      const total = mp.length || 1;
      return { id: member.id, name: member.name, project: member.project, score: Math.round((done / total) * 100), weeksDone: done, totalWeeks: total };
    }).sort((a, b) => b.score - a.score);

    const topPerformer = memberScores.length > 0 ? memberScores[0] : null;

    const projects = {};
    allMembers.forEach((m) => { if (!projects[m.project]) projects[m.project] = { name: m.project, members: 0, totalScore: 0 }; projects[m.project].members++; });
    memberScores.forEach((m) => { if (projects[m.project]) projects[m.project].totalScore += m.score; });
    const projectStats = Object.values(projects).map((p) => ({ ...p, avgScore: p.members > 0 ? Math.round(p.totalScore / p.members) : 0 }));

    res.json({
      stats: {
        totalMembers,
        overallCompletionRate,
        currentWeek,
        activeThisWeek,
        topPerformer,
        weeklyStats,
        memberScores: req.user.role === 'admin' ? memberScores : [], // Hide full scores from members
        projectStats,
        // Personalized stats for members
        userScore: memberScores.find(m => m.id === req.user.id)?.score || 0,
        userWeeksDone: memberScores.find(m => m.id === req.user.id)?.weeksDone || 0,
        userRank: memberScores.findIndex(m => m.id === req.user.id) + 1,
        userWeeklyStats: req.user.role === 'member' ? weeklyStats.map(ws => {
           const userWeek = allProgress.find(p => p.userId === req.user.id && p.weekNumber === ws.week);
           return {
             week: ws.week,
             completionRate: userWeek?.status === 'done' ? 100 : 0
           };
        }) : []
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/progress/tracker — Full weekly tracker grid with task details
router.get('/tracker', auth, (req, res) => {
  try {
    const allProgress = db.get('weeklyProgress').value();
    const allLogs = db.get('workLogs').value();
    let members = db.get('users').filter({ role: 'member' }).value();
    const currentWeek = allProgress.length > 0 ? Math.max(...allProgress.map((p) => p.weekNumber)) : 1;

    // Helper to determine week number from date (assuming Week 1 starts Jan 1, 2026)
    // You can adjust the start date as needed
    const getWeekFromDate = (dateStr) => {
      const startDate = new Date(2026, 0, 1);
      const logDate = new Date(dateStr);
      const diff = logDate - startDate;
      return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
    };

    const tracker = members.map(({ password, ...member }) => {
      const weeks = {};
      for (let w = 1; w <= currentWeek; w++) {
        // Find the admin's toggle status
        const entry = allProgress.find((p) => p.userId === member.id && p.weekNumber === w);
        
        // Find all logs submitted by the user for this week
        const logsForWeek = allLogs.filter(log => {
          if (log.userId !== member.id) return false;
          return getWeekFromDate(log.date) === w;
        });

        weeks[w] = {
          id: entry ? entry.id : null,
          status: entry ? entry.status : 'pending',
          note: entry ? entry.note || '' : '',
          tasks: logsForWeek.map(l => ({
            id: l.id,
            date: l.date,
            note: l.note,
            workLink: l.workLink,
            status: l.status
          }))
        };
      }
      const mp = allProgress.filter((p) => p.userId === member.id);
      const done = mp.filter((p) => p.status === 'done').length;
      const total = mp.length || 1;
      return { ...member, weeks, score: Math.round((done / total) * 100), weeksDone: done };
    });

    res.json({ tracker, currentWeek });
  } catch (error) {
    console.error('Get tracker error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});


// POST /api/progress — Record weekly progress (admin only)
router.post('/', auth, adminOnly, (req, res) => {
  try {
    const { userId, weekNumber, status, note } = req.body;
    if (!userId || !weekNumber || !status) return res.status(400).json({ message: 'userId, weekNumber, and status are required.' });
    if (!['done', 'not_done'].includes(status)) return res.status(400).json({ message: 'Status must be "done" or "not_done".' });
    const user = db.get('users').find({ id: userId }).value();
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const existing = db.get('weeklyProgress').find({ userId, weekNumber: parseInt(weekNumber) }).value();
    if (existing) return res.status(400).json({ message: 'Entry already exists. Use PUT to update.' });

    const newProgress = { id: uuidv4(), userId, weekNumber: parseInt(weekNumber), status, note: note || '', date: new Date().toISOString(), createdAt: new Date().toISOString() };
    db.get('weeklyProgress').push(newProgress).write();
    res.status(201).json({ message: 'Progress recorded.', progress: newProgress });
  } catch (error) {
    console.error('Create progress error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/progress/:id — Update a progress entry (admin only)
router.put('/:id', auth, adminOnly, (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const entry = db.get('weeklyProgress').find({ id }).value();
    if (!entry) return res.status(404).json({ message: 'Progress entry not found.' });
    const updates = { updatedAt: new Date().toISOString() };
    if (status && ['done', 'not_done'].includes(status)) updates.status = status;
    if (note !== undefined) updates.note = note;
    db.get('weeklyProgress').find({ id }).assign(updates).write();
    res.json({ message: 'Progress updated.', progress: db.get('weeklyProgress').find({ id }).value() });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/progress/toggle/:userId/:weekNumber — Quick toggle (admin only)
router.put('/toggle/:userId/:weekNumber', auth, adminOnly, (req, res) => {
  try {
    const { userId, weekNumber } = req.params;
    const weekNum = parseInt(weekNumber);
    let entry = db.get('weeklyProgress').find({ userId, weekNumber: weekNum }).value();

    if (entry) {
      const newStatus = entry.status === 'done' ? 'not_done' : 'done';
      db.get('weeklyProgress').find({ id: entry.id }).assign({ status: newStatus, updatedAt: new Date().toISOString() }).write();
      entry = db.get('weeklyProgress').find({ id: entry.id }).value();
      res.json({ message: `Toggled to ${newStatus}.`, progress: entry });
    } else {
      const np = { id: uuidv4(), userId, weekNumber: weekNum, status: 'done', note: '', date: new Date().toISOString(), createdAt: new Date().toISOString() };
      db.get('weeklyProgress').push(np).write();
      res.status(201).json({ message: 'Created as done.', progress: np });
    }
  } catch (error) {
    console.error('Toggle error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/progress/:id — Delete entry (admin only)
router.delete('/:id', auth, adminOnly, (req, res) => {
  try {
    const { id } = req.params;
    const entry = db.get('weeklyProgress').find({ id }).value();
    if (!entry) return res.status(404).json({ message: 'Not found.' });
    db.get('weeklyProgress').remove({ id }).write();
    res.json({ message: 'Deleted.' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
