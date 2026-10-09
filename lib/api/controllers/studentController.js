/* eslint-disable @typescript-eslint/no-require-imports */
const {
  readPortalData,
  writePortalData,
  getAuthService,
  getDatabaseClient,
} = require('../../../database/services/dbService');
const { getStudentStreak } = require('../services/studentService');
const { recordGrade } = require('../services/gradeRecordingService');
const { mergeTaskCompletion, calculateStats } = require('../services/studentDashboardService');

const getProfile = async (req, res) => {
  try {
    const user = req.user;
    const role = user.user_metadata?.role;
    if (role === 'teacher') return res.status(403).json({ error: 'Access denied. Not a student account.' });
    const name = user.user_metadata?.name || user.email?.split('@')[0] || 'Student';
    const meta = user.user_metadata || {};
    const profile = (await readPortalData(`student_profile:${user.email}`)) || {};
    return res.json({
      student: {
        ...profile,
        id: user.id,
        name: profile.name || name,
        email: user.email,
        avatar: (profile.name || name).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        role: 'student',
        username: profile.username || meta.username || '',
        rollNumber: profile.rollNumber || meta.rollNumber || '',
        batch: profile.batch || meta.batch || '',
        currentLevel: profile.currentLevel || 1,
        totalPoints: profile.totalPoints || 0,
        gameProgress: profile.gameProgress || 0,
        classId: profile.classId || null,
        className: profile.className || meta.class || null,
        classIds: Array.isArray(profile.classIds) ? profile.classIds : [],
        classMemberships: Array.isArray(profile.classMemberships) ? profile.classMemberships : [],
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getData = async (req, res) => {
  try {
    const user = req.user;
    const allTasks = (await readPortalData(`student_tasks:${user.email}`)) || [];
    const allGrades = (await readPortalData(`student_grades:${user.email}`)) || [];
    const tasksList = Array.isArray(allTasks) ? allTasks : [];
    const gradesList = Array.isArray(allGrades) ? allGrades : [];
    const tasksWithCompletion = mergeTaskCompletion(tasksList, gradesList);
    const streakData = await getStudentStreak(user.email, tasksWithCompletion);
    const profile = (await readPortalData(`student_profile:${user.email}`)) || {};
    const assignedClass = profile.classId ? { id: profile.classId, name: profile.className || '' } : null;
    return res.json({
      tasks: tasksWithCompletion,
      grades: gradesList,
      streakData,
      stats: calculateStats(gradesList, tasksWithCompletion, streakData),
      assignedClass,
      adminMessage: profile.adminMessage || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getDashboard = async (req, res) => {
  try {
    const user = req.user;
    const tasks = (await readPortalData(`student_tasks:${user.email}`)) || [];
    const grades = (await readPortalData(`student_grades:${user.email}`)) || [];
    const taskList = Array.isArray(tasks) ? tasks : [];
    const gradeList = Array.isArray(grades) ? grades : [];
    const tasksWithCompletion = mergeTaskCompletion(taskList, gradeList);
    const streak = await getStudentStreak(user.email, tasksWithCompletion);
    const profile = (await readPortalData(`student_profile:${user.email}`)) || { totalPoints: 0, currentLevel: 1 };
    const pendingTasks = tasksWithCompletion.filter(task => !task.completed);
    return res.json({ tasks: tasksWithCompletion, streak, stats: calculateStats(gradeList, tasksWithCompletion, streak), quest: pendingTasks[0] || null, profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const db = getDatabaseClient();
    const currentResult = await db.execute({
      sql: `SELECT s.id, s.email, s.name, s.batch, s.current_level, s.total_points,
          s.profile_json, s.roll_number
        FROM students s
        WHERE s.user_id = ? AND s.email = ? COLLATE NOCASE`,
      args: [req.user.id, req.user.email],
    });
    const current = currentResult.rows[0];
    if (!current) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    let profile;
    try {
      profile = JSON.parse(current.profile_json || '{}');
    } catch (error) {
      throw new Error(`Student profile data is invalid: ${error.message}`);
    }

    const membership = await db.execute({
      sql: `SELECT cm.class_id, c.name
        FROM class_memberships cm JOIN classes c
          ON c.id = cm.class_id AND c.teacher_id = cm.teacher_id
        WHERE cm.student_id = ?
        ORDER BY cm.updated_at DESC, cm.teacher_id, cm.class_id
        LIMIT 1`,
      args: [current.id],
    });
    const classId = membership.rows[0]?.class_id || null;

    const batch = current.batch || profile.batch || null;
    if (!classId && !batch) {
      return res.status(200).json({
        leaderboard: [],
        scope: null,
        message: 'Your BDS year, class, or batch has not been set on your student profile yet.',
      });
    }

    const filters = ['u.role = ?'];
    const args = ['student'];
    if (batch) {
      filters.push('s.batch = ? COLLATE NOCASE');
      args.push(batch);
    }
    if (classId) {
      filters.push(`(
        json_extract(s.profile_json, '$.classId') = ?
        OR EXISTS (
          SELECT 1 FROM teacher_students ts
          WHERE ts.student_id = s.id AND ts.class_id = ?
        )
      )`);
      args.push(classId, classId);
    }

    const studentsResult = await db.execute({
      sql: `SELECT s.id, s.email, s.name, s.batch, s.current_level,
          s.total_points, s.roll_number, s.profile_json
        FROM students s
        JOIN users u ON u.id = s.user_id
        WHERE ${filters.join(' AND ')}
        ORDER BY s.name COLLATE NOCASE, s.id`,
      args,
    });
    const students = studentsResult.rows;
    const studentIds = students.map(student => student.id);
    let grades = [];
    if (studentIds.length) {
      const placeholders = studentIds.map(() => '?').join(', ');
      const gradesResult = await db.execute({
        sql: `SELECT student_id, score, max_score, grade
          FROM grades
          WHERE student_id IN (${placeholders})`,
        args: studentIds,
      });
      grades = gradesResult.rows;
    }

    const gradesByStudent = new Map();
    for (const grade of grades) {
      if (!gradesByStudent.has(grade.student_id)) gradesByStudent.set(grade.student_id, []);
      gradesByStudent.get(grade.student_id).push(grade);
    }
    const gradePoints = {
      'A+': 100, A: 95, 'A-': 90, 'B+': 85, B: 80, 'B-': 75,
      'C+': 70, C: 65, 'C-': 60, D: 50, F: 0,
    };
    const ranked = students.map(student => {
      const totalExperience = (gradesByStudent.get(student.id) || []).reduce((total, grade) => {
        if (grade.score != null && Number(grade.max_score) > 0) {
          const percentage = (Number(grade.score) / Number(grade.max_score)) * 100;
          const bonus = percentage >= 95 ? 15 : percentage >= 90 ? 10 : percentage >= 80 ? 5 : 0;
          return total + Math.floor(percentage) + bonus;
        }
        return total + (gradePoints[grade.grade] ?? 0);
      }, 0);
      const name = student.name || student.email.split('@')[0];
      return {
        id: student.id,
        name,
        avatar: name.split(/\s+/).map(part => part[0]).join('').toUpperCase().slice(0, 2),
        rollNumber: student.roll_number || '',
        totalExperience,
        level: Math.floor(totalExperience / 500) + 1,
      };
    }).sort((left, right) =>
      right.totalExperience - left.totalExperience
      || left.name.localeCompare(right.name)
      || left.id.localeCompare(right.id)
    );

    let previousExperience = null;
    let previousRank = 0;
    const leaderboard = ranked.map((student, index) => {
      const rank = student.totalExperience === previousExperience ? previousRank : index + 1;
      previousExperience = student.totalExperience;
      previousRank = rank;
      return { ...student, rank, isCurrentStudent: student.id === current.id };
    });

    let className = membership.rows[0]?.name || profile.className || null;
    if (classId && !className) {
      const classResult = await db.execute({
        sql: 'SELECT name FROM classes WHERE id = ? LIMIT 1',
        args: [classId],
      });
      className = classResult.rows[0]?.name || null;
    }

    return res.json({
      leaderboard,
      scope: {
        batch,
        classId,
        className,
        label: [batch, className].filter(Boolean).join(' · ') || 'Your class',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const user = req.user;
    const notifs = (await readPortalData(`notifications:${user.email}`)) || [];
    return res.json({ notifications: notifs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const user = req.user;
    const { notificationId } = req.body;
    const key = `notifications:${user.email}`;
    const notifs = (await readPortalData(key)) || [];
    const updated = Array.isArray(notifs) ? notifs.map(n => n.id === notificationId ? { ...n, read: true } : n) : [];
    await writePortalData(key, updated);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = req.user;
    if (user.user_metadata?.role !== 'student') {
      return res.status(403).json({ error: 'Only student accounts can update this profile' });
    }
    const profileKey = `student_profile:${user.email}`;
    const existing = (await readPortalData(profileKey)) || {};
    const allowedFields = [
      'name', 'username', 'rollNumber', 'batch', 'phone', 'department', 'semester',
      'specialization', 'qualification', 'joinDate', 'address', 'bio',
    ];
    const profileUpdates = Object.fromEntries(
      allowedFields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]])
    );
    const updatedProfile = { ...existing, ...profileUpdates, email: user.email };
    await writePortalData(profileKey, updatedProfile);
    if (profileUpdates.name) {
      const supabase = getAuthService(true);
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { name: profileUpdates.name },
      });
      if (error) throw error;
    }
    return res.json({ success: true, profile: updatedProfile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const user = req.user;
    const { taskId, score, maxScore, answers } = req.body;
    const allTasks = (await readPortalData(`student_tasks:${user.email}`)) || [];
    const task = Array.isArray(allTasks) ? allTasks.find(item => item.id === taskId) : null;

    if (!task) return res.status(404).json({ error: 'Quiz not found' });
    await recordGrade({
      task: { ...task, subject: task.subject || 'Quiz', title: task.title || 'Quiz' },
      student: { id: user.id, name: user.user_metadata?.name, email: user.email },
      studentEmail: user.email,
      grade: score,
      score,
      maxScore: maxScore || 100,
      answers,
    });
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    return res.json({ success: true, percentage });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getQuest = async (req, res) => {
  try {
    const user = req.user;
    const tasks = (await readPortalData(`student_tasks:${user.email}`)) || [];
    const tasksList = Array.isArray(tasks) ? tasks : [];
    const pending = tasksList.filter(t => !t.completed);
    return res.json({ quest: pending[0] || null, tasks: tasksList });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getProfile,
  getData,
  getDashboard,
  getLeaderboard,
  getNotifications,
  markNotificationRead,
  updateProfile,
  submitQuiz,
  getQuest
};
