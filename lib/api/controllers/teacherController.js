/* eslint-disable @typescript-eslint/no-require-imports */
const { readPortalData, writePortalData, deletePortalData, listPortalDataByPrefix, getAuthService } = require('../../../database/services/dbService');
const { recordGrade, normalizeScore } = require('../services/gradeRecordingService');
const { assignTaskToStudents: assignTaskToStudentsDeep } = require('../services/taskAssignmentService');

const runWithConcurrency = async (items, concurrency, operation) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await operation(items[index], index);
    }
  });
  const outcomes = await Promise.allSettled(workers);
  const failure = outcomes.find(outcome => outcome.status === 'rejected');
  if (failure) throw failure.reason;
  return results;
};

const getOwnedStudent = async (teacherId, email) => {
  const students = (await readPortalData(`students:${teacherId}`)) || [];
  return Array.isArray(students)
    ? students.find(student => String(student.email).toLowerCase() === String(email).toLowerCase())
    : null;
};

const getProfile = async (req, res) => {
  try {
    const user = req.user;
    const role = user.user_metadata?.role;
    if (role === 'student') return res.status(403).json({ error: 'Access denied. Not a teacher account.' });
    const name = user.user_metadata?.name || user.email?.split('@')[0] || 'Teacher';
    return res.json({
      teacher: {
        ...user.user_metadata,
        id: user.id,
        name,
        email: user.email,
        avatar: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        role: 'teacher',
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getData = async (req, res) => {
  try {
    const user = req.user;
    const [students, classes, tasks, grades] = await Promise.all([
      readPortalData(`students:${user.id}`),
      readPortalData(`classes:${user.id}`),
      readPortalData(`tasks:${user.id}`),
      readPortalData(`dental_college_grades:${user.id}`),
    ]);
    return res.json({
      students: students || [],
      classes: classes || [],
      tasks: tasks || [],
      grades: grades || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const saveStudents = async (req, res) => {
  try {
    const user = req.user;
    const { students } = req.body;
    if (!Array.isArray(students)) return res.status(400).json({ error: 'students array is required' });
    await writePortalData(`students:${user.id}`, students);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const saveClasses = async (req, res) => {
  try {
    const user = req.user;
    const { classes } = req.body;
    if (!Array.isArray(classes)) return res.status(400).json({ error: 'classes array is required' });
    await writePortalData(`classes:${user.id}`, classes);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteClass = async (req, res) => {
  try {
    const user = req.user;
    const students = (await readPortalData(`students:${user.id}`)) || [];
    if (Array.isArray(students) && students.some(student =>
      student.classId === req.params.classId || (Array.isArray(student.classIds) && student.classIds.includes(req.params.classId))
    )) {
      return res.status(409).json({ error: 'Cannot delete a class while students are assigned to it' });
    }
    const classesKey = `classes:${user.id}`;
    const classes = (await readPortalData(classesKey)) || [];
    const classList = Array.isArray(classes) ? classes : [];
    if (!classList.some(item => item.id === req.params.classId)) {
      return res.status(404).json({ error: 'Class not found' });
    }
    await writePortalData(classesKey, classList.filter(item => item.id !== req.params.classId));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateManualStudent = async (req, res) => {
  try {
    const studentsKey = `students:${req.user.id}`;
    const saved = (await readPortalData(studentsKey)) || [];
    const students = Array.isArray(saved) ? saved : [];
    const index = students.findIndex(student => String(student.id) === req.params.studentId);
    if (index < 0) return res.status(404).json({ error: 'Student not found' });
    if (students[index].isRegistered) return res.status(403).json({ error: 'Registered student profiles must be updated by that student' });

    const allowedFields = [
      'name', 'username', 'rollNumber', 'batch', 'classId', 'className', 'phone',
      'department', 'semester', 'specialization', 'qualification', 'joinDate', 'address', 'bio',
    ];
    const updates = Object.fromEntries(
      allowedFields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]])
    );
    const student = { ...students[index], ...updates, id: students[index].id, email: students[index].email };
    students[index] = student;
    await writePortalData(studentsKey, students);
    return res.json({ success: true, student });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createTask = async (req, res) => {
  try {
    const user = req.user;
    const task = req.body;
    if (!task?.title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const newTask = {
      id: task.id || `task-${Date.now()}`,
      title: task.title,
      description: task.description || '',
      maxPoints: task.maxPoints || task.points || 100,
      points: task.points || task.maxPoints || 100,
      dueDate: task.dueDate || task.date || new Date().toISOString().split('T')[0],
      date: task.date || task.dueDate || new Date().toISOString().split('T')[0],
      classId: task.classId || null,
      className: task.className || null,
      subject: task.subject || 'General',
      priority: task.priority || 'Medium',
      type: task.type || 'task',
      status: task.status || 'active',
      createdAt: new Date().toISOString(),
      teacherId: user.id,
      ...(task.type === 'quiz' ? {
        duration: task.duration,
        totalPoints: task.totalPoints,
        questions: task.questions || [],
      } : {}),
    };
    const tasksKey = `tasks:${user.id}`;
    const existingTasks = (await readPortalData(tasksKey)) || [];
    const tasksList = Array.isArray(existingTasks) ? existingTasks : [];
    tasksList.push(newTask);
    await writePortalData(tasksKey, tasksList);
    let assignedCount;
    try {
      assignedCount =       await assignTaskToStudentsDeep(user.id, newTask);
    } catch (error) {
      await writePortalData(tasksKey, tasksList.filter(item => item.id !== newTask.id));
      throw error;
    }
    return res.json({ ...newTask, assignedCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const addTask = async (req, res) => {
  try {
    const user = req.user;
    const { title, description, points, date, class_id, type, subject, priority } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const task = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      description: description || '',
      points: points || 50,
      maxPoints: points || 50,
      type: type || 'task',
      date: date || new Date().toISOString().split('T')[0],
      dueDate: date || new Date().toISOString().split('T')[0],
      classId: class_id || null,
      subject: subject || 'General',
      priority: priority || 'Medium',
      teacherId: user.id,
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    const tasksKey = `tasks:${user.id}`;
    const tasks = (await readPortalData(tasksKey)) || [];
    const tasksList = Array.isArray(tasks) ? tasks : [];
    tasksList.push(task);
    await writePortalData(tasksKey, tasksList);
    let assignmentCount;
    try {
      assignmentCount = await assignTaskToStudentsDeep(user.id, task);
    } catch (error) {
      await writePortalData(tasksKey, tasksList.filter(item => item.id !== task.id));
      throw error;
    }
    return res.json({ success: true, task, assignedCount: assignmentCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const user = req.user;
    const tasksKey = `tasks:${user.id}`;
    const tasks = (await readPortalData(tasksKey)) || [];
    const taskList = Array.isArray(tasks) ? tasks : [];
    const index = taskList.findIndex(task => task.id === req.params.taskId);
    if (index < 0) return res.status(404).json({ error: 'Task not found' });

    const updates = req.body || {};
    if (updates.title !== undefined && !updates.title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const previousTask = taskList[index];
    const updatedTask = { ...previousTask, ...updates, id: previousTask.id, teacherId: user.id };
    taskList[index] = updatedTask;
    try {
      const teacherStudents = (await readPortalData(`students:${user.id}`)) || [];
      const eligibleEmails = new Set(
        (Array.isArray(teacherStudents) ? teacherStudents : [])
          .filter(student => student?.email && (!updatedTask.classId
            || student.classId === updatedTask.classId
            || (Array.isArray(student.classIds) && student.classIds.includes(updatedTask.classId))))
          .map(student => student.email)
      );
      const studentTaskEntries = await listPortalDataByPrefix('student_tasks:');
      for (const entry of studentTaskEntries) {
        if (!Array.isArray(entry.value)) continue;
        const email = entry.key.slice('student_tasks:'.length);
        let changed = false;
        const updatedStudentTasks = entry.value.flatMap(studentTask => {
          if (studentTask.id !== updatedTask.id) return [studentTask];
          changed = true;
          if (!eligibleEmails.has(email)) return [];
          return [{
            ...studentTask,
            ...updatedTask,
            completed: studentTask.completed,
            grade: studentTask.grade,
          }];
        });
        if (changed) await writePortalData(entry.key, updatedStudentTasks);
      }
      await assignTaskToStudentsDeep(user.id, updatedTask);
      await writePortalData(tasksKey, taskList);
    } catch (error) {
      taskList[index] = previousTask;
      await writePortalData(tasksKey, taskList);
      throw error;
    }

    return res.json({ task: updatedTask });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const user = req.user;
    const tasksKey = `tasks:${user.id}`;
    const tasks = (await readPortalData(tasksKey)) || [];
    const taskList = Array.isArray(tasks) ? tasks : [];
    const task = taskList.find(item => item.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const [studentTaskEntries, studentGradeEntries, notificationEntries, teacherGrades] = await Promise.all([
      listPortalDataByPrefix('student_tasks:'),
      listPortalDataByPrefix('student_grades:'),
      listPortalDataByPrefix('notifications:'),
      readPortalData(`dental_college_grades:${user.id}`),
    ]);
    const updates = [];
    for (const entry of studentTaskEntries) {
      if (!Array.isArray(entry.value)) continue;
      const filtered = entry.value.filter(item => item.id !== task.id);
      if (filtered.length !== entry.value.length) updates.push(() => writePortalData(entry.key, filtered));
    }
    for (const entry of studentGradeEntries) {
      if (!Array.isArray(entry.value)) continue;
      const grades = entry.value.filter(grade => grade.taskId !== task.id && grade.task_id !== task.id);
      if (grades.length !== entry.value.length) updates.push(() => writePortalData(entry.key, grades));
    }
    for (const entry of notificationEntries) {
      if (!Array.isArray(entry.value)) continue;
      const notifications = entry.value.filter(item => item.taskId !== task.id);
      if (notifications.length !== entry.value.length) updates.push(() => writePortalData(entry.key, notifications));
    }

    if (Array.isArray(teacherGrades)) {
      const filtered = teacherGrades.filter(grade => grade.taskId !== task.id && grade.task_id !== task.id);
      if (filtered.length !== teacherGrades.length) {
        updates.push(() => writePortalData(`dental_college_grades:${user.id}`, filtered));
      }
    }

    await runWithConcurrency(updates, 20, update => update());
    await Promise.all([
      deletePortalData(`task_grades:${task.id}`),
      writePortalData(tasksKey, taskList.filter(item => item.id !== task.id)),
    ]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getTaskStudents = async (req, res) => {
  try {
    const user = req.user;
    const { taskId } = req.body;
    const allStudentsRaw = (await readPortalData(`students:${user.id}`)) || [];
    const allStudents = Array.isArray(allStudentsRaw) ? allStudentsRaw : [];
    const tasks = (await readPortalData(`tasks:${user.id}`)) || [];
    const task = Array.isArray(tasks) ? tasks.find(t => t.id === taskId) : null;
    const relevantStudents = task?.classId
      ? allStudents.filter(s => s.classId === task.classId || (Array.isArray(s.classIds) && s.classIds.includes(task.classId)))
      : allStudents;
    const taskGrades = (await readPortalData(`task_grades:${taskId}`)) || {};
    const studentsWithGrades = relevantStudents.map(s => ({ id: s.id, name: s.name, email: s.email, avatar: s.avatar, classId: s.classId, className: s.className, grade: taskGrades[s.email] || null }));
    return res.json({ students: studentsWithGrades });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getTaskGrades = async (req, res) => {
  try {
    const tasks = (await readPortalData(`tasks:${req.user.id}`)) || [];
    if (!Array.isArray(tasks) || !tasks.some(task => task.id === req.params.taskId)) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const grades = (await readPortalData(`task_grades:${req.params.taskId}`)) || {};
    return res.json({ grades });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const saveGrades = async (req, res) => {
  try {
    const user = req.user;
    const { grades } = req.body;
    if (!Array.isArray(grades)) return res.status(400).json({ error: 'grades array is required' });
    if (grades.some(grade => !grade?.studentEmail || !grade?.assignment)) {
      return res.status(400).json({ error: 'Each grade requires a student email and assignment' });
    }

    const gradesKey = `dental_college_grades:${user.id}`;
    const previousGrades = (await readPortalData(gradesKey)) || [];
    const previousList = Array.isArray(previousGrades) ? previousGrades : [];
    const normalizedGrades = grades.map(grade => ({ ...grade, teacherId: user.id }));
    const ownedStudents = await readPortalData(`students:${user.id}`);
    for (const grade of normalizedGrades) {
      const student = Array.isArray(ownedStudents)
        ? ownedStudents.find(item => String(item.email).toLowerCase() === String(grade.studentEmail).toLowerCase())
        : null;
      if (!student) return res.status(403).json({ error: 'Cannot grade a student outside your roster' });
      if (grade.classId && !(student.classId === grade.classId
        || (Array.isArray(student.classIds) && student.classIds.includes(grade.classId)))) {
        return res.status(403).json({ error: 'Student is not assigned to this class' });
      }
    }

    for (const oldGrade of previousList) {
      const studentKey = `student_grades:${oldGrade.studentEmail}`;
      const studentGrades = (await readPortalData(studentKey)) || [];
      if (!Array.isArray(studentGrades)) continue;
      const filtered = studentGrades.filter(grade => grade.id !== oldGrade.id);
      if (filtered.length !== studentGrades.length) await writePortalData(studentKey, filtered);
    }

    await writePortalData(gradesKey, normalizedGrades);
    for (const grade of normalizedGrades) {
      const studentKey = `student_grades:${grade.studentEmail}`;
      const stored = (await readPortalData(studentKey)) || [];
      const studentGrades = Array.isArray(stored) ? stored : [];
      const existingIndex = studentGrades.findIndex(item => item.id === grade.id);
      if (existingIndex >= 0) studentGrades[existingIndex] = grade;
      else studentGrades.push(grade);
      await writePortalData(studentKey, studentGrades);

      if (grade.taskId) {
        const taskGradesKey = `task_grades:${grade.taskId}`;
        const taskGrades = (await readPortalData(taskGradesKey)) || {};
        await writePortalData(taskGradesKey, { ...taskGrades, [grade.studentEmail]: grade.grade ?? grade.score });
        const tasksKey = `student_tasks:${grade.studentEmail}`;
        const studentTasks = (await readPortalData(tasksKey)) || [];
        if (Array.isArray(studentTasks)) {
          await writePortalData(tasksKey, studentTasks.map(task =>
            task.id === grade.taskId
              ? { ...task, completed: true, grade: grade.grade ?? grade.score, score: grade.score }
              : task
          ));
        }
      }
    }

    return res.json({ success: true, grades: normalizedGrades });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getAllStudents = async (req, res) => {
  try {
    const user = req.user;
    const supabase = getAuthService(true);
    const users = [];
    for (let page = 1; ; page += 1) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      users.push(...(data?.users || []));
      if (!data?.users || data.users.length < 1000) break;
    }
    const students = users.filter(u => u.user_metadata?.role === 'student');
    const profileEntries = await listPortalDataByPrefix('student_profile:');
    const profileMap = new Map();
    for (const entry of profileEntries) {
      if (entry.value?.email) profileMap.set(entry.value.email, entry.value);
    }
    const teacherStudents = (await readPortalData(`students:${user.id}`)) || [];
    const assignedEmails = new Set(Array.isArray(teacherStudents) ? teacherStudents.map(s => s.email) : []);
    const assignedByEmail = new Map(Array.isArray(teacherStudents)
      ? teacherStudents.map(student => [student.email, student])
      : []);
    const result = students.map(u => {
      const profile = profileMap.get(u.email) || {};
      const meta = u.user_metadata || {};
      const name = profile.name || meta.name || u.email?.split('@')[0] || 'Student';
      return {
        id: u.id, name, email: u.email,
        avatar: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        username: profile.username || meta.username || '',
        rollNumber: profile.rollNumber || meta.rollNumber || '',
        batch: profile.batch || meta.batch || '',
        currentLevel: profile.currentLevel || 1,
        totalPoints: profile.totalPoints || 0,
        gameProgress: profile.gameProgress || 0,
        lastActive: u.last_sign_in_at || u.created_at,
        status: 'active',
        subjects: profile.subjects || [],
        averageGrade: 0,
        classId: assignedByEmail.get(u.email)?.classId || null,
        className: assignedByEmail.get(u.email)?.className || null,
        classIds: assignedByEmail.get(u.email)?.classIds || [],
        classMemberships: assignedByEmail.get(u.email)?.classMemberships || [],
        isRegistered: true,
        isAssigned: assignedEmails.has(u.email),
        registeredAt: u.created_at,
      };
    });
    return res.json({ students: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getTaskStats = async (req, res) => {
  try {
    const user = req.user;
    const [tasks, allStudentsRaw] = await Promise.all([
      readPortalData(`tasks:${user.id}`),
      readPortalData(`students:${user.id}`),
    ]);
    const tasksList = Array.isArray(tasks) ? tasks : [];
    const allStudents = Array.isArray(allStudentsRaw) ? allStudentsRaw : [];
    const studentEmails = [...new Set(allStudents.map(student => student.email).filter(Boolean))];
    const [taskGradeMaps, studentTaskLists] = await Promise.all([
      runWithConcurrency(tasksList, 20, task => readPortalData(`task_grades:${task.id}`)),
      runWithConcurrency(studentEmails, 20, email => readPortalData(`student_tasks:${email}`)),
    ]);
    const taskGradesById = new Map(tasksList.map((task, index) => [task.id, taskGradeMaps[index] || {}]));
    const completedTaskIdsByEmail = new Map(studentEmails.map((email, index) => [
      email,
      new Set(Array.isArray(studentTaskLists[index])
        ? studentTaskLists[index].filter(studentTask => studentTask.completed).map(studentTask => studentTask.id)
        : []),
    ]));
    const taskStats = {};
    for (const task of tasksList) {
      const relevantStudents = task.classId
        ? allStudents.filter(s => s.classId === task.classId || (Array.isArray(s.classIds) && s.classIds.includes(task.classId)))
        : allStudents;
      const totalStudents = relevantStudents.length;
      let completed = 0;
      const taskGrades = taskGradesById.get(task.id);
      for (const student of relevantStudents) {
        const hasGrade = taskGrades[student.email] !== undefined && taskGrades[student.email] !== null;
        const taskWasCompleted = completedTaskIdsByEmail.get(student.email)?.has(task.id);
        if (hasGrade || taskWasCompleted) completed++;
      }
      taskStats[task.id] = { totalStudents, completed, attempted: completed, completionRate: totalStudents > 0 ? Math.round((completed / totalStudents) * 100) : 0, attemptRate: totalStudents > 0 ? Math.round((completed / totalStudents) * 100) : 0 };
    }
    return res.json({ taskStats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const allowedFields = [
      'name', 'phone', 'department', 'specialization', 'qualification',
      'experience', 'bio', 'address', 'joinDate', 'notifications', 'preferences',
    ];
    const updates = Object.fromEntries(
      allowedFields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]])
    );
    const supabase = getAuthService(true);
    const profile = { ...user.user_metadata, ...updates };
    const { error } = await supabase.auth.admin.updateUserById(user.id, { user_metadata: profile });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deactivateAccount = async (req, res) => {
  try {
    const user = req.user;
    const supabase = getAuthService(true);
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, accountDisabled: true },
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const user = req.user;
    const tasksKey = `tasks:${user.id}`;
    const ownedTasks = (await readPortalData(tasksKey)) || [];
    const taskIds = new Set(Array.isArray(ownedTasks) ? ownedTasks.map(task => task.id) : []);
    const teacherGrades = (await readPortalData(`dental_college_grades:${user.id}`)) || [];
    const gradeIds = new Set(Array.isArray(teacherGrades) ? teacherGrades.map(grade => grade.id) : []);
    const assignedStudents = (await readPortalData(`students:${user.id}`)) || [];
    const [studentTaskEntries, studentGradeEntries, notificationEntries, taskGradeEntries] = await Promise.all([
      listPortalDataByPrefix('student_tasks:'),
      listPortalDataByPrefix('student_grades:'),
      listPortalDataByPrefix('notifications:'),
      listPortalDataByPrefix('task_grades:'),
    ]);

    for (const entry of studentTaskEntries) {
      if (!Array.isArray(entry.value)) continue;
      const filtered = entry.value.filter(task => !taskIds.has(task.id));
      if (filtered.length !== entry.value.length) await writePortalData(entry.key, filtered);
    }
    for (const entry of studentGradeEntries) {
      if (!Array.isArray(entry.value)) continue;
      const filtered = entry.value.filter(grade =>
        grade.teacherId !== user.id
        && !gradeIds.has(grade.id)
        && !taskIds.has(grade.taskId || grade.task_id)
      );
      if (filtered.length !== entry.value.length) await writePortalData(entry.key, filtered);
    }
    for (const entry of notificationEntries) {
      if (!Array.isArray(entry.value)) continue;
      const filtered = entry.value.filter(notification => !taskIds.has(notification.taskId));
      if (filtered.length !== entry.value.length) await writePortalData(entry.key, filtered);
    }
    for (const entry of taskGradeEntries) {
      if (entry.key.startsWith('task_grades:') && taskIds.has(entry.key.slice('task_grades:'.length))) {
        await deletePortalData(entry.key);
      }
    }
    for (const student of Array.isArray(assignedStudents) ? assignedStudents : []) {
      if (!student.email) continue;
      const profileKey = `student_profile:${student.email}`;
      const profile = (await readPortalData(profileKey)) || {};
      if (profile.classId === student.classId) {
        await writePortalData(profileKey, { ...profile, classId: null, className: null });
      }
    }

    await Promise.all([
      deletePortalData(tasksKey),
      deletePortalData(`classes:${user.id}`),
      deletePortalData(`students:${user.id}`),
      deletePortalData(`dental_college_grades:${user.id}`),
    ]);

    const supabase = getAuthService(true);
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getStudentStreak = async (req, res) => {
  try {
    if (!(await getOwnedStudent(req.user.id, req.params.email))) {
      return res.status(404).json({ error: 'Student is not assigned to this teacher' });
    }
    const streakData = (await readPortalData(`student_streak:${req.params.email}`)) || { currentStreak: 0, longestStreak: 0, dates: [] };
    return res.json({ streakData });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getStudentTasks = async (req, res) => {
  try {
    if (!(await getOwnedStudent(req.user.id, req.params.email))) {
      return res.status(404).json({ error: 'Student is not assigned to this teacher' });
    }
    const tasks = (await readPortalData(`student_tasks:${req.params.email}`)) || [];
    return res.json({ tasks });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const assignStudent = async (req, res) => {
  try {
    const user = req.user;
    const { studentId, studentEmail, classId, className } = req.body;
    if (!studentEmail || !classId) return res.status(400).json({ error: 'studentEmail and classId are required' });
    const supabase = getAuthService(true);
    const { data: authData } = await supabase.auth.admin.getUserById(studentId);
    const studentName = authData?.user?.user_metadata?.name || studentEmail.split('@')[0];
    const avatar = studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const studentsKey = `students:${user.id}`;
    const existingStudents = (await readPortalData(studentsKey)) || [];
    const studentsList = Array.isArray(existingStudents) ? existingStudents : [];
    const existingIndex = studentsList.findIndex(s => s.email === studentEmail || s.id === studentId);
    const existingStudent = existingIndex >= 0 ? studentsList[existingIndex] : {};
    const classIds = [...new Set([...(existingStudent.classIds || []), classId])];
    const classMemberships = [
      ...(existingStudent.classMemberships || []).filter(membership => membership.classId !== classId),
      { classId, className, status: 'active', addedAt: new Date().toISOString() },
    ];
    const studentEntry = {
      ...existingStudent, id: studentId, name: studentName, email: studentEmail, avatar,
      classId: classIds[0], className: classMemberships[0]?.className || className,
      classIds, classMemberships, status: 'active', addedAt: existingStudent.addedAt || new Date().toISOString(),
    };
    if (existingIndex >= 0) studentsList[existingIndex] = studentEntry;
    else studentsList.push(studentEntry);
    await writePortalData(studentsKey, studentsList);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const unassignStudent = async (req, res) => {
  try {
    const user = req.user;
    const { studentId, classId } = req.body;
    const studentsKey = `students:${user.id}`;
    const existingStudents = (await readPortalData(studentsKey)) || [];
    const studentsList = Array.isArray(existingStudents) ? existingStudents : [];
    const student = studentsList.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: 'Student is not assigned to this teacher' });
    if (classId) {
      const classIds = (student.classIds || []).filter(id => id !== classId);
      if (classIds.length === (student.classIds || []).length) {
        return res.status(404).json({ error: 'Student is not assigned to this class' });
      }
      const classMemberships = (student.classMemberships || [])
        .filter(membership => membership.classId !== classId);
      const updatedStudent = {
        ...student,
        classId: classIds[0] || null,
        className: classMemberships[0]?.className || null,
        classIds,
        classMemberships,
      };
      const updated = studentsList.map(item => item.id === studentId ? updatedStudent : item);
      await writePortalData(studentsKey, updated);
      return res.json({ success: true });
    }
    const updated = studentsList.filter(s => s.id !== studentId);
    await writePortalData(studentsKey, updated);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const batchStudentData = async (req, res) => {
  try {
    const { emails, studentEmails } = req.body;
    const requestedEmails = emails || studentEmails;
    if (!Array.isArray(requestedEmails)) return res.status(400).json({ error: 'emails array required' });
    const ownedStudents = (await readPortalData(`students:${req.user.id}`)) || [];
    const teacherTasks = (await readPortalData(`tasks:${req.user.id}`)) || [];
    const teacherTaskList = Array.isArray(teacherTasks) ? teacherTasks : [];
    const ownedEmails = new Set(Array.isArray(ownedStudents)
      ? ownedStudents.map(student => String(student.email).toLowerCase())
      : []);
    const ownedRequestedEmails = requestedEmails.filter(email =>
      ownedEmails.has(String(email).toLowerCase()),
    );
    const results = {};
    for (const email of ownedRequestedEmails) {
      const streak = (await readPortalData(`student_streak:${email}`)) || { currentStreak: 0, longestStreak: 0, dates: [] };
      const tasks = (await readPortalData(`student_tasks:${email}`)) || [];
      const grades = (await readPortalData(`student_grades:${email}`)) || [];
      const taskList = Array.isArray(tasks) ? [...tasks] : [];
      const gradeList = Array.isArray(grades) ? grades : [];
      let taskListChanged = false;
      for (const grade of gradeList) {
        const taskId = grade.taskId || grade.task_id;
        const sourceTask = teacherTaskList.find(task => task.id === taskId);
        if (!sourceTask || taskList.some(task => task.id === taskId)) continue;
        taskList.push({
          ...sourceTask,
          completed: true,
          grade: grade.grade,
          score: grade.score,
        });
        taskListChanged = true;
      }
      if (taskListChanged) await writePortalData(`student_tasks:${email}`, taskList);
      const gradeScores = Array.isArray(grades)
        ? grades
          .map(grade => {
            const score = Number(grade.score ?? grade.grade);
            const maxScore = Number(grade.maxScore ?? grade.maxPoints ?? 100);
            return Number.isFinite(score) && maxScore > 0 ? (score / maxScore) * 100 : null;
          })
          .filter(score => score !== null)
        : [];
      results[email] = {
        streak,
        streakData: streak,
        taskCount: taskList.length,
        completedCount: taskList.filter(task => task.completed).length,
        taskData: {
          totalCount: taskList.length,
          completedCount: taskList.filter(task => task.completed).length,
        },
        grades,
        averageGrade: gradeScores.length > 0
          ? Math.round(gradeScores.reduce((sum, score) => sum + score, 0) / gradeScores.length)
          : 0,
      };
    }
    return res.json({ students: results, studentsData: results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const saveSingleTaskGrade = async (req, res) => {
  try {
    const user = req.user;
    const { taskId, studentEmail, grade } = req.body;
    if (!taskId || !studentEmail || grade === undefined) return res.status(400).json({ error: 'Missing fields' });
    const allTasks = (await readPortalData(`tasks:${user.id}`)) || [];
    const task = Array.isArray(allTasks) ? allTasks.find(t => t.id === taskId) : null;
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const assignedStudents = (await readPortalData(`students:${user.id}`)) || [];
    const student = Array.isArray(assignedStudents)
      ? assignedStudents.find(item => item.email === studentEmail)
      : null;
    if (!student || (task.classId && student.classId !== task.classId
      && !(Array.isArray(student.classIds) && student.classIds.includes(task.classId)))) {
      return res.status(404).json({ error: 'Student is not assigned to this teacher' });
    }
    const entry = await recordGrade({
      task,
      student,
      studentEmail,
      teacherId: user.id,
      grade,
      score: normalizeScore(grade),
      maxScore: 100,
    });
    return res.json({ success: true, grade: entry });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getProfile, getData, saveStudents, saveClasses, deleteClass, updateManualStudent, createTask, updateTask, deleteTask, addTask, getTaskStudents, getTaskGrades,
  saveGrades, getAllStudents, getTaskStats, updateProfile, deactivateAccount, deleteAccount, getStudentStreak, getStudentTasks, assignStudent,
  unassignStudent, batchStudentData, saveSingleTaskGrade
};
