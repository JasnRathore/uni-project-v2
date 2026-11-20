/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
const { readPortalData, writePortalData, deletePortalData, listPortalDataByPrefix, getAuthService, getDatabaseClient } = require('../../../database/services/dbService.ts');
const { recordGrade, normalizeScore } = require('../services/gradeRecordingService.ts');
const { assignTaskToStudents: assignTaskToStudentsDeep } = require('../services/taskAssignmentService.ts');
const classLifecycle = require('../services/classLifecycleService.ts');
const { normalizeLifecycleState } = require('../services/studentState.ts');

const runWithConcurrency = async <T, R>(items: T[], concurrency: number, operation: (item: T, index: number) => Promise<R>): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await operation(items[index], index);
    }
  });
  const outcomes = await Promise.allSettled(workers);
  const failure = outcomes.find(outcome => outcome.status === 'rejected');
  if (failure) throw (failure as PromiseRejectedResult).reason;
  return results;
};

const updateClassLifecycle = async (req: any, res: any) => {
  try {
    return res.json({ class: await classLifecycle.transition({
      classId: req.params.classId, teacherId: req.user.id, status: req.body?.status,
      startsAt: req.body?.startsAt, endsAt: req.body?.endsAt,
    }) });
  } catch (error: any) { return res.status(error.message === 'Class not found' ? 404 : 400).json({ error: error.message }); }
};
const addClassMembership = async (req: any, res: any) => {
  try {
    return res.status(201).json({ membership: await classLifecycle.addMembership({
      classId: req.params.classId, studentId: req.body?.studentId, teacherId: req.user.id, actorId: req.user.id,
    }) });
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
};
const endClassMembership = async (req: any, res: any) => {
  try {
    return res.json({ membership: await classLifecycle.endMembership({
      classId: req.params.classId, studentId: req.params.studentId, teacherId: req.user.id, status: req.body?.status,
    }) });
  } catch (error: any) { return res.status(400).json({ error: error.message }); }
};

const getOwnedStudent = async (teacherId: string, email: string) => {
  const students = (await readPortalData(`students:${teacherId}`)) || [];
  return Array.isArray(students)
    ? students.find((student: any) => String(student.email).toLowerCase() === String(email).toLowerCase())
    : null;
};

const getProfile = async (req: any, res: any) => {
  try {
    const user = req.user;
    const role = user.user_metadata?.role;
    if (role === 'student') return res.status(403).json({ error: 'Access denied. Not a teacher account.' });
    const name = user.user_metadata?.name || user.email?.split('@')[0] || 'Teacher';
    const profile = await readPortalData(`teacher:${user.id}`);
    return res.json({
      teacher: {
        ...user.user_metadata,
        ...profile,
        id: user.id,
        name,
        email: user.email,
        avatar: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
        role: role || 'teacher',
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const getData = async (req: any, res: any) => {
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const saveStudents = async (req: any, res: any) => {
  try {
    const user = req.user;
    const { students } = req.body;
    if (!Array.isArray(students)) return res.status(400).json({ error: 'students array is required' });
    await writePortalData(`students:${user.id}`, students);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const saveClasses = async (req: any, res: any) => {
  try {
    const user = req.user;
    const { classes } = req.body;
    if (!Array.isArray(classes)) return res.status(400).json({ error: 'classes array is required' });
    await writePortalData(`classes:${user.id}`, classes);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteClass = async (req: any, res: any) => {
  try {
    const user = req.user;
    const students = (await readPortalData(`students:${user.id}`)) || [];
    if (Array.isArray(students) && students.some((student: any) =>
      student.classId === req.params.classId || (Array.isArray(student.classIds) && student.classIds.includes(req.params.classId))
    )) {
      return res.status(409).json({ error: 'Cannot delete a class while students are assigned to it' });
    }
    const classesKey = `classes:${user.id}`;
    const classes = (await readPortalData(classesKey)) || [];
    const classList = Array.isArray(classes) ? classes : [];
    if (!classList.some((item: any) => item.id === req.params.classId)) {
      return res.status(404).json({ error: 'Class not found' });
    }
    await writePortalData(classesKey, classList.filter((item: any) => item.id !== req.params.classId));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const updateManualStudent = async (req: any, res: any) => {
  try {
    const studentsKey = `students:${req.user.id}`;
    const saved = (await readPortalData(studentsKey)) || [];
    const students = Array.isArray(saved) ? saved : [];
    const index = students.findIndex((student: any) => String(student.id) === req.params.studentId);
    if (index < 0) return res.status(404).json({ error: 'Student not found' });
    if (students[index].isRegistered) return res.status(403).json({ error: 'Registered student profiles must be updated by that student' });

    const allowedFields = [
      'name', 'prn', 'classId', 'className', 'phone', 'address', 'bio',
    ];
    const updates: Record<string, any> = Object.fromEntries(
      allowedFields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]])
    );
    if (updates.prn === undefined && req.body.rollNumber !== undefined) updates.prn = req.body.rollNumber;
    const { rollNumber: legacyRollNumber, ...currentStudent } = students[index];
    const student = {
      ...currentStudent, ...updates,
      prn: updates.prn ?? currentStudent.prn ?? legacyRollNumber,
      id: students[index].id, email: students[index].email,
    };
    students[index] = student;
    await writePortalData(studentsKey, students);
    return res.json({ success: true, student });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const createClass = async (req: any, res: any) => {
  try {
    const teacherId = req.user.id;
    const classData = req.body?.class;
    if (!classData?.id || !classData?.name || !classData?.subjectId) {
      return res.status(400).json({ error: 'Class ID, name, and catalog subject are required' });
    }
    const classesKey = `classes:${teacherId}`;
    const saved = (await readPortalData(classesKey)) || [];
    const classes = Array.isArray(saved) ? saved : [];
    if (classes.some((item: any) => String(item.id) === String(classData.id))) {
      return res.status(409).json({ error: 'Class ID already exists' });
    }
    await writePortalData(classesKey, [...classes, { ...classData, grade: classData.programYearLabel }]);
    const created = (await readPortalData(classesKey) || []).find((item: any) => String(item.id) === String(classData.id));
    return res.status(201).json({ class: created });
  } catch (err: any) {
    const status = /subject|class id|class name/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ error: err.message });
  }
};

const getOwnedClass = async (teacherId: string, classId: string) => {
  if (!classId) return null;
  const classes = await readPortalData(`classes:${teacherId}`);
  return Array.isArray(classes)
    ? classes.find((classItem: any) => String(classItem.id) === String(classId))
    : null;
};

const createTask = async (req: any, res: any) => {
  try {
    const user = req.user;
    const task = req.body;
    if (!task?.title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const classId = task.classId || task.class_id;
    if (!classId) return res.status(400).json({ error: 'A class is required' });
    const classData = await getOwnedClass(user.id, classId);
    if (!classData) return res.status(404).json({ error: 'Class not found' });
    const newTask = {
      id: task.id || `task-${Date.now()}`,
      title: task.title,
      description: task.description || '',
      maxPoints: task.maxPoints || task.points || 100,
      points: task.points || task.maxPoints || 100,
      dueDate: task.dueDate || task.date || new Date().toISOString().split('T')[0],
      date: task.date || task.dueDate || new Date().toISOString().split('T')[0],
      classId: String(classData.id),
      className: classData.name,
      subjectId: classData.subjectId,
      subject: classData.subject,
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
    let assignedCount: number;
    try {
      assignedCount = await assignTaskToStudentsDeep(user.id, newTask);
    } catch (error) {
      await writePortalData(tasksKey, tasksList.filter((item: any) => item.id !== newTask.id));
      throw error;
    }
    return res.json({ ...newTask, assignedCount });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const addTask = async (req: any, res: any) => {
  try {
    const user = req.user;
    const { title, description, points, date, type, priority } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const classId = req.body.classId || req.body.class_id;
    if (!classId) return res.status(400).json({ error: 'A class is required' });
    const classData = await getOwnedClass(user.id, classId);
    if (!classData) return res.status(404).json({ error: 'Class not found' });
    const task = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      description: description || '',
      points: points || 50,
      maxPoints: points || 50,
      type: type || 'task',
      date: date || new Date().toISOString().split('T')[0],
      dueDate: date || new Date().toISOString().split('T')[0],
      classId: String(classData.id),
      className: classData.name,
      subjectId: classData.subjectId,
      subject: classData.subject,
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
    let assignmentCount: number;
    try {
      assignmentCount = await assignTaskToStudentsDeep(user.id, task);
    } catch (error) {
      await writePortalData(tasksKey, tasksList.filter((item: any) => item.id !== task.id));
      throw error;
    }
    return res.json({ success: true, task, assignedCount: assignmentCount });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const updateTask = async (req: any, res: any) => {
  try {
    const user = req.user;
    const tasksKey = `tasks:${user.id}`;
    const tasks = (await readPortalData(tasksKey)) || [];
    const taskList = Array.isArray(tasks) ? tasks : [];
    const index = taskList.findIndex((task: any) => task.id === req.params.taskId);
    if (index < 0) return res.status(404).json({ error: 'Task not found' });

    const updates = req.body || {};
    if (updates.title !== undefined && !updates.title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const previousTask = taskList[index];
    const classId = updates.classId ?? previousTask.classId;
    if (!classId) return res.status(400).json({ error: 'A class is required' });
    const classData = await getOwnedClass(user.id, classId);
    if (!classData) return res.status(404).json({ error: 'Class not found' });
    const updatedTask = {
      ...previousTask, ...updates, id: previousTask.id, teacherId: user.id,
      classId: String(classData.id), className: classData.name,
      subjectId: classData.subjectId, subject: classData.subject,
    };
    taskList[index] = updatedTask;
    try {
      const teacherStudents = (await readPortalData(`students:${user.id}`)) || [];
      const eligibleEmails = new Set(
        (Array.isArray(teacherStudents) ? teacherStudents : [])
          .filter((student: any) => student?.email && (!updatedTask.classId
            || student.classId === updatedTask.classId
            || (Array.isArray(student.classIds) && student.classIds.includes(updatedTask.classId))))
          .map((student: any) => student.email)
      );
      const studentTaskEntries = await listPortalDataByPrefix('student_tasks:');
      for (const entry of studentTaskEntries) {
        if (!Array.isArray(entry.value)) continue;
        const email = entry.key.slice('student_tasks:'.length);
        let changed = false;
        const updatedStudentTasks = entry.value.flatMap((studentTask: any) => {
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteTask = async (req: any, res: any) => {
  try {
    const user = req.user;
    const tasksKey = `tasks:${user.id}`;
    const tasks = (await readPortalData(tasksKey)) || [];
    const taskList = Array.isArray(tasks) ? tasks : [];
    const task = taskList.find((item: any) => item.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const [studentTaskEntries, studentGradeEntries, notificationEntries, teacherGrades] = await Promise.all([
      listPortalDataByPrefix('student_tasks:'),
      listPortalDataByPrefix('student_grades:'),
      listPortalDataByPrefix('notifications:'),
      readPortalData(`dental_college_grades:${user.id}`),
    ]);
    const updates: Array<() => Promise<any>> = [];
    for (const entry of studentTaskEntries) {
      if (!Array.isArray(entry.value)) continue;
      const filtered = entry.value.filter((item: any) => item.id !== task.id);
      if (filtered.length !== entry.value.length) updates.push(() => writePortalData(entry.key, filtered));
    }
    for (const entry of studentGradeEntries) {
      if (!Array.isArray(entry.value)) continue;
      const grades = entry.value.filter((grade: any) => grade.taskId !== task.id && grade.task_id !== task.id);
      if (grades.length !== entry.value.length) updates.push(() => writePortalData(entry.key, grades));
    }
    for (const entry of notificationEntries) {
      if (!Array.isArray(entry.value)) continue;
      const notifications = entry.value.filter((item: any) => item.taskId !== task.id);
      if (notifications.length !== entry.value.length) updates.push(() => writePortalData(entry.key, notifications));
    }

    if (Array.isArray(teacherGrades)) {
      const filtered = teacherGrades.filter((grade: any) => grade.taskId !== task.id && grade.task_id !== task.id);
      if (filtered.length !== teacherGrades.length) {
        updates.push(() => writePortalData(`dental_college_grades:${user.id}`, filtered));
      }
    }

    await runWithConcurrency(updates, 20, update => update());
    await Promise.all([
      deletePortalData(`task_grades:${task.id}`),
      writePortalData(tasksKey, taskList.filter((item: any) => item.id !== task.id)),
    ]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const getTaskStudents = async (req: any, res: any) => {
  try {
    const user = req.user;
    const { taskId } = req.body;
    const allStudentsRaw = (await readPortalData(`students:${user.id}`)) || [];
    const allStudents = Array.isArray(allStudentsRaw) ? allStudentsRaw : [];
    const tasks = (await readPortalData(`tasks:${user.id}`)) || [];
    const task = Array.isArray(tasks) ? tasks.find((t: any) => t.id === taskId) : null;
    const relevantStudents = task?.classId
      ? allStudents.filter((s: any) => s.classId === task.classId || (Array.isArray(s.classIds) && s.classIds.includes(task.classId)))
      : [];
    const taskGrades = (await readPortalData(`task_grades:${taskId}`)) || {};
    const studentsWithGrades = relevantStudents.map((s: any) => ({ id: s.id, name: s.name, email: s.email, avatar: s.avatar, classId: s.classId, className: s.className, grade: taskGrades[s.id] || null }));
    return res.json({ students: studentsWithGrades });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const getTaskGrades = async (req: any, res: any) => {
  try {
    const tasks = (await readPortalData(`tasks:${req.user.id}`)) || [];
    if (!Array.isArray(tasks) || !tasks.some((task: any) => task.id === req.params.taskId)) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const grades = (await readPortalData(`task_grades:${req.params.taskId}`)) || {};
    return res.json({ grades });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const saveGrades = async (req: any, res: any) => {
  try {
    const user = req.user;
    const { grades } = req.body;
    if (!Array.isArray(grades)) return res.status(400).json({ error: 'grades array is required' });
    if (grades.some((grade: any) => !grade?.studentId || !grade?.classId || !grade?.assignment)) {
      return res.status(400).json({ error: 'Each grade requires a student ID, class, and assignment' });
    }

    const gradesKey = `dental_college_grades:${user.id}`;
    const previousGrades = (await readPortalData(gradesKey)) || [];
    const previousList = Array.isArray(previousGrades) ? previousGrades : [];
    const [ownedStudents, classes, tasks] = await Promise.all([
      readPortalData(`students:${user.id}`),
      readPortalData(`classes:${user.id}`),
      readPortalData(`tasks:${user.id}`),
    ]);
    const normalizedGrades = grades.map((grade: any, index: number) => ({
      ...grade,
      id: grade.id || `grade-${user.id}-${grade.studentId}-${Date.now()}-${index}`,
      studentId: String(grade.studentId),
      classId: String(grade.classId),
      taskId: grade.taskId ? String(grade.taskId) : null,
      teacherId: user.id,
    }));
    for (const grade of normalizedGrades) {
      const student = Array.isArray(ownedStudents)
        ? ownedStudents.find((item: any) => String(item.id) === grade.studentId)
        : null;
      if (!student) return res.status(403).json({ error: 'Cannot grade a student outside your roster' });
      const classData = Array.isArray(classes)
        ? classes.find((item: any) => String(item.id) === grade.classId)
        : null;
      if (!classData) return res.status(403).json({ error: 'Class does not belong to this teacher' });
      if (!(String(student.classId) === grade.classId
        || (Array.isArray(student.classIds) && student.classIds.map(String).includes(grade.classId)))) {
        return res.status(403).json({ error: 'Student is not assigned to this class' });
      }
      if (grade.taskId) {
        const task = Array.isArray(tasks)
          ? tasks.find((item: any) => String(item.id) === grade.taskId)
          : null;
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (String(task.classId) !== grade.classId) {
          return res.status(400).json({ error: 'Grade class must match the task class' });
        }
      }
      grade.studentName = student.name;
      grade.subject = classData.subject;
      grade.className = classData.name;
    }

    for (const oldGrade of previousList) {
      const student = (Array.isArray(ownedStudents) ? ownedStudents : [])
        .find((item: any) => String(item.id) === String(oldGrade.studentId));
      if (!student?.email) continue;
      const studentKey = `student_grades:${student.email}`;
      const studentGrades = (await readPortalData(studentKey)) || [];
      if (!Array.isArray(studentGrades)) continue;
      const filtered = studentGrades.filter((grade: any) => grade.id !== oldGrade.id);
      if (filtered.length !== studentGrades.length) await writePortalData(studentKey, filtered);
    }

    await writePortalData(gradesKey, normalizedGrades);
    for (const grade of normalizedGrades) {
      const student = ownedStudents.find((item: any) => String(item.id) === grade.studentId);
      const studentKey = `student_grades:${student.email}`;
      const stored = (await readPortalData(studentKey)) || [];
      const studentGrades = Array.isArray(stored) ? stored : [];
      const existingIndex = studentGrades.findIndex((item: any) => item.id === grade.id);
      if (existingIndex >= 0) studentGrades[existingIndex] = grade;
      else studentGrades.push(grade);
      await writePortalData(studentKey, studentGrades);

      if (grade.taskId) {
        const taskGradesKey = `task_grades:${grade.taskId}`;
        const taskGrades = (await readPortalData(taskGradesKey)) || {};
        await writePortalData(taskGradesKey, { ...taskGrades, [grade.studentId]: grade.grade ?? grade.score });
        const tasksKey = `student_tasks:${student.email}`;
        const studentTasks = (await readPortalData(tasksKey)) || [];
        if (Array.isArray(studentTasks)) {
          await writePortalData(tasksKey, studentTasks.map((task: any) =>
            task.id === grade.taskId
              ? { ...task, completed: true, grade: grade.grade ?? grade.score, score: grade.score }
              : task
          ));
        }
      }
    }

    return res.json({ success: true, grades: normalizedGrades });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const getAllStudents = async (req: any, res: any) => {
  try {
    const user = req.user;
    const supabase = getAuthService(true);
    const users: any[] = [];
    for (let page = 1; ; page += 1) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      users.push(...(data?.users || []));
      if (!data?.users || data.users.length < 1000) break;
    }
    const students = users.filter((u: any) => u.user_metadata?.role === 'student');
    const academicIdentityRows = (await getDatabaseClient().execute({
      sql: `SELECT s.id AS student_id, s.email, s.cohort_id,
          s.lifecycle_state, d.name AS degree_name,
          c.label AS cohort_label
        FROM students s
        LEFT JOIN graduation_cohorts c ON c.id = s.cohort_id
        LEFT JOIN degrees d ON d.id = c.degree_id`,
    })).rows;
    const averageGradeRows = (await getDatabaseClient().execute({
      sql: `SELECT student_id, AVG(score * 100.0 / max_score) AS average_grade
        FROM grades
        WHERE score IS NOT NULL AND max_score > 0
        GROUP BY student_id`,
    })).rows;
    const averageGradeByStudentId = new Map(averageGradeRows.map((row: any) => {
      const average = Number(row.average_grade);
      return [row.student_id, Number.isFinite(average) ? Math.round(average) : 0];
    }));
    const academicIdentityByEmail = new Map(
      academicIdentityRows.map((row: any) => [String(row.email).toLowerCase(), row]),
    );
    const profileEntries = await listPortalDataByPrefix('student_profile:');
    const profileMap = new Map<string, any>();
    for (const entry of profileEntries) {
      if (entry.value?.email) profileMap.set(String(entry.value.email).toLowerCase(), entry.value);
    }
    const teacherStudents = (await readPortalData(`students:${user.id}`)) || [];
    const assignedByEmail = new Map<string, any>(Array.isArray(teacherStudents)
      ? teacherStudents.map((student: any) => [student.email, student])
      : []);
    const result = students.filter((u: any) => {
      const state = (academicIdentityByEmail.get(String(u.email).toLowerCase()) as any)?.lifecycle_state;
      return state === 'active';
    }).map((u: any) => {
      const profile = profileMap.get(String(u.email).toLowerCase()) || {};
      const meta = u.user_metadata || {};
      const academicIdentity: any = academicIdentityByEmail.get(String(u.email).toLowerCase()) || {};
      const teacherStudent = assignedByEmail.get(u.email);
      const classMemberships = Array.isArray(teacherStudent?.classMemberships)
        ? teacherStudent.classMemberships
        : [];
      const activeMemberships = classMemberships.filter((membership: any) => membership.status === 'active');
      const legacyActiveClass = !classMemberships.length && teacherStudent?.classId && teacherStudent.status !== 'ended';
      const name = profile.name || meta.name || u.email?.split('@')[0] || 'Student';
      return {
        id: u.id, name, email: u.email,
        avatar: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
        prn: profile.prn || profile.rollNumber || meta.prn || meta.rollNumber || '',
        degreeName: academicIdentity.degree_name || null,
        cohortId: academicIdentity.cohort_id || null,
        cohortLabel: academicIdentity.cohort_label || null,
        lifecycleState: normalizeLifecycleState(academicIdentity.lifecycle_state || profile.lifecycleState),
        phone: profile.phone || meta.phone || '',
        currentLevel: profile.currentLevel || 1,
        totalPoints: profile.totalPoints || 0,
        gameProgress: profile.gameProgress || 0,
        lastActive: u.last_sign_in_at || u.created_at,
        subjects: profile.subjects || [],
        averageGrade: averageGradeByStudentId.get(academicIdentity.student_id) ?? 0,
        classId: activeMemberships[0]?.classId || (legacyActiveClass ? teacherStudent.classId : null),
        className: activeMemberships[0]?.className || (legacyActiveClass ? teacherStudent.className : null),
        classIds: activeMemberships.length
          ? activeMemberships.map((membership: any) => membership.classId)
          : legacyActiveClass ? teacherStudent.classIds || [teacherStudent.classId] : [],
        classMemberships,
        isRegistered: true,
        isAssigned: activeMemberships.length > 0 || Boolean(legacyActiveClass),
        registeredAt: u.created_at,
      };
    });
    return res.json({ students: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const getTaskStats = async (req: any, res: any) => {
  try {
    const user = req.user;
    const [tasks, allStudentsRaw] = await Promise.all([
      readPortalData(`tasks:${user.id}`),
      readPortalData(`students:${user.id}`),
    ]);
    const tasksList = Array.isArray(tasks) ? tasks : [];
    const allStudents = Array.isArray(allStudentsRaw) ? allStudentsRaw : [];
    const studentEmails = [...new Set(allStudents.map((student: any) => student.email).filter(Boolean))] as string[];
    const [taskGradeMaps, studentTaskLists] = await Promise.all([
      runWithConcurrency(tasksList, 20, (task: any) => readPortalData(`task_grades:${task.id}`)),
      runWithConcurrency(studentEmails, 20, (email: string) => readPortalData(`student_tasks:${email}`)),
    ]);
    const taskGradesById = new Map<string, any>(tasksList.map((task: any, index: number) => [task.id, taskGradeMaps[index] || {}]));
    const completedTaskIdsByEmail = new Map<string, Set<any>>(studentEmails.map((email, index) => [
      email,
      new Set(Array.isArray(studentTaskLists[index])
        ? studentTaskLists[index].filter((studentTask: any) => studentTask.completed).map((studentTask: any) => studentTask.id)
        : []),
    ]));
    const taskStats: Record<string, any> = {};
    for (const task of tasksList) {
      const relevantStudents = task.classId
        ? allStudents.filter((s: any) => s.classId === task.classId || (Array.isArray(s.classIds) && s.classIds.includes(task.classId)))
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const updateProfile = async (req: any, res: any) => {
  try {
    const user = req.user;
    const allowedFields = [
      'name', 'phone', 'departmentId', 'specialization', 'qualification',
      'experience', 'bio', 'address', 'joinDate', 'notifications', 'preferences',
    ];
    const updates: Record<string, any> = Object.fromEntries(
      allowedFields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]])
    );
    const supabase = getAuthService(true);
    const profile: any = { ...user.user_metadata, ...updates };
    delete profile.department;
    const { error } = await supabase.auth.admin.updateUserById(user.id, { user_metadata: profile });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, profile: { ...profile, ...(await readPortalData(`teacher:${user.id}`)) } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const deactivateAccount = async (req: any, res: any) => {
  try {
    const user = req.user;
    const supabase = getAuthService(true);
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, accountDisabled: true },
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteAccount = async (req: any, res: any) => {
  try {
    const user = req.user;
    const tasksKey = `tasks:${user.id}`;
    const ownedTasks = (await readPortalData(tasksKey)) || [];
    const taskIds = new Set(Array.isArray(ownedTasks) ? ownedTasks.map((task: any) => task.id) : []);
    const teacherGrades = (await readPortalData(`dental_college_grades:${user.id}`)) || [];
    const gradeIds = new Set(Array.isArray(teacherGrades) ? teacherGrades.map((grade: any) => grade.id) : []);
    const assignedStudents = (await readPortalData(`students:${user.id}`)) || [];
    const [studentTaskEntries, studentGradeEntries, notificationEntries, taskGradeEntries] = await Promise.all([
      listPortalDataByPrefix('student_tasks:'),
      listPortalDataByPrefix('student_grades:'),
      listPortalDataByPrefix('notifications:'),
      listPortalDataByPrefix('task_grades:'),
    ]);

    for (const entry of studentTaskEntries) {
      if (!Array.isArray(entry.value)) continue;
      const filtered = entry.value.filter((task: any) => !taskIds.has(task.id));
      if (filtered.length !== entry.value.length) await writePortalData(entry.key, filtered);
    }
    for (const entry of studentGradeEntries) {
      if (!Array.isArray(entry.value)) continue;
      const filtered = entry.value.filter((grade: any) =>
        grade.teacherId !== user.id
        && !gradeIds.has(grade.id)
        && !taskIds.has(grade.taskId || grade.task_id)
      );
      if (filtered.length !== entry.value.length) await writePortalData(entry.key, filtered);
    }
    for (const entry of notificationEntries) {
      if (!Array.isArray(entry.value)) continue;
      const filtered = entry.value.filter((notification: any) => !taskIds.has(notification.taskId));
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const getStudentStreak = async (req: any, res: any) => {
  try {
    if (!(await getOwnedStudent(req.user.id, req.params.email))) {
      return res.status(404).json({ error: 'Student is not assigned to this teacher' });
    }
    const streakData = (await readPortalData(`student_streak:${req.params.email}`)) || { currentStreak: 0, longestStreak: 0, dates: [] };
    return res.json({ streakData });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const getStudentTasks = async (req: any, res: any) => {
  try {
    if (!(await getOwnedStudent(req.user.id, req.params.email))) {
      return res.status(404).json({ error: 'Student is not assigned to this teacher' });
    }
    const tasks = (await readPortalData(`student_tasks:${req.params.email}`)) || [];
    return res.json({ tasks });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const assignStudent = async (req: any, res: any) => {
  try {
    const user = req.user;
    const { studentId, studentEmail, classId, className } = req.body;
    if (!studentEmail || !classId) return res.status(400).json({ error: 'studentEmail and classId are required' });
    const db = getDatabaseClient();
    const activeStudent = await db.execute({
      sql: "SELECT id FROM students WHERE email = ? COLLATE NOCASE AND lifecycle_state = 'active'",
      args: [studentEmail],
    });
    if (!activeStudent.rows[0]) return res.status(404).json({ error: 'Active student not found' });
    const classResult = await db.execute({
      sql: 'SELECT id, name FROM classes WHERE id = ? AND teacher_id = ?',
      args: [String(classId), user.id],
    });
    if (!classResult.rows[0]) return res.status(404).json({ error: 'Class not found' });
    const supabase = getAuthService(true);
    const { data: authData } = await supabase.auth.admin.getUserById(studentId);
    if (!authData?.user || authData.user.email?.toLowerCase() !== String(studentEmail).toLowerCase()) {
      return res.status(400).json({ error: 'Student identity does not match the account' });
    }
    if (authData.user.user_metadata?.role !== 'student') {
      return res.status(400).json({ error: 'Only student accounts can be assigned' });
    }
    const studentName = authData?.user?.user_metadata?.name || studentEmail.split('@')[0];
    const avatar = studentName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    const studentsKey = `students:${user.id}`;
    const existingStudents = (await readPortalData(studentsKey)) || [];
    const studentsList = Array.isArray(existingStudents) ? existingStudents : [];
    const existingIndex = studentsList.findIndex((s: any) => s.email === studentEmail || s.id === studentId);
    const existingStudent: any = existingIndex >= 0 ? studentsList[existingIndex] : {};
    const classIds = [...new Set([...(existingStudent.classIds || []), classId])];
    const classMemberships = [
      ...(existingStudent.classMemberships || []).filter((membership: any) => membership.classId !== classId),
      { classId, className, status: 'active', addedAt: new Date().toISOString() },
    ];
    const studentEntry = {
      ...existingStudent, id: studentId, name: studentName, email: studentEmail, avatar,
      classId: classIds[0], className: classMemberships[0]?.className || classResult.rows[0].name,
      classIds, classMemberships, status: 'active', addedAt: existingStudent.addedAt || new Date().toISOString(),
    };
    if (existingIndex >= 0) studentsList[existingIndex] = studentEntry;
    else studentsList.push(studentEntry);
    await writePortalData(studentsKey, studentsList);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const unassignStudent = async (req: any, res: any) => {
  try {
    const user = req.user;
    const { studentId, classId } = req.body;
    const studentsKey = `students:${user.id}`;
    const existingStudents = (await readPortalData(studentsKey)) || [];
    const studentsList = Array.isArray(existingStudents) ? existingStudents : [];
    const student = studentsList.find((s: any) => s.id === studentId);
    if (!student) return res.status(404).json({ error: 'Student is not assigned to this teacher' });
    if (classId) {
      const classIds = (student.classIds || []).filter((id: any) => id !== classId);
      if (classIds.length === (student.classIds || []).length) {
        return res.status(404).json({ error: 'Student is not assigned to this class' });
      }
      const classMemberships = (student.classMemberships || [])
        .filter((membership: any) => membership.classId !== classId);
      const updatedStudent = {
        ...student,
        classId: classIds[0] || null,
        className: classMemberships[0]?.className || null,
        classIds,
        classMemberships,
      };
      const updated = studentsList.map((item: any) => item.id === studentId ? updatedStudent : item);
      await writePortalData(studentsKey, updated);
      return res.json({ success: true });
    }
    const updated = studentsList.filter((s: any) => s.id !== studentId);
    await writePortalData(studentsKey, updated);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const batchStudentData = async (req: any, res: any) => {
  try {
    const { studentIds, emails, studentEmails } = req.body;
    const requestedStudentIds = Array.isArray(studentIds)
      ? studentIds.map(String)
      : null;
    const requestedEmails = requestedStudentIds ? null : (emails || studentEmails);
    if (!requestedStudentIds && !Array.isArray(requestedEmails)) {
      return res.status(400).json({ error: 'studentIds array required' });
    }
    const ownedStudents = (await readPortalData(`students:${req.user.id}`)) || [];
    const teacherTasks = (await readPortalData(`tasks:${req.user.id}`)) || [];
    const teacherTaskList = Array.isArray(teacherTasks) ? teacherTasks : [];
    const requestedSet = new Set(requestedStudentIds || requestedEmails.map((email: any) => String(email).toLowerCase()));
    const ownedRequestedStudents = (Array.isArray(ownedStudents) ? ownedStudents : [])
      .filter((student: any) => requestedStudentIds
        ? requestedSet.has(String(student.id))
        : requestedSet.has(String(student.email).toLowerCase()));
    const results: Record<string, any> = {};
    for (const student of ownedRequestedStudents) {
      const { email } = student;
      const streak = (await readPortalData(`student_streak:${email}`)) || { currentStreak: 0, longestStreak: 0, dates: [] };
      const tasks = (await readPortalData(`student_tasks:${email}`)) || [];
      const grades = (await readPortalData(`student_grades:${email}`)) || [];
      const taskList = Array.isArray(tasks) ? [...tasks] : [];
      const gradeList = Array.isArray(grades) ? grades : [];
      let taskListChanged = false;
      for (const grade of gradeList) {
        const taskId = grade.taskId || grade.task_id;
        const sourceTask = teacherTaskList.find((task: any) => task.id === taskId);
        if (!sourceTask || taskList.some((task: any) => task.id === taskId)) continue;
        taskList.push({
          ...sourceTask,
          completed: true,
          grade: grade.grade,
          score: grade.score,
        });
        taskListChanged = true;
      }
      if (taskListChanged) await writePortalData(`student_tasks:${email}`, taskList);
      const gradeScores: number[] = Array.isArray(grades)
        ? grades
          .map((grade: any) => {
            const score = Number(grade.score ?? grade.grade);
            const maxScore = Number(grade.maxScore ?? grade.maxPoints ?? 100);
            return Number.isFinite(score) && maxScore > 0 ? (score / maxScore) * 100 : null;
          })
          .filter((score: number | null): score is number => score !== null)
        : [];
      results[student.id] = {
        streak,
        streakData: streak,
        taskCount: taskList.length,
        completedCount: taskList.filter((task: any) => task.completed).length,
        taskData: {
          totalCount: taskList.length,
          completedCount: taskList.filter((task: any) => task.completed).length,
        },
        grades,
        averageGrade: gradeScores.length > 0
          ? Math.round(gradeScores.reduce((sum: number, score: number) => sum + score, 0) / gradeScores.length)
          : 0,
      };
    }
    return res.json({ students: results, studentsData: results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

const saveSingleTaskGrade = async (req: any, res: any) => {
  try {
    const user = req.user;
    const { taskId, studentId, grade } = req.body;
    if (!taskId || !studentId || grade === undefined) return res.status(400).json({ error: 'Task, student ID, and grade are required' });
    const allTasks = (await readPortalData(`tasks:${user.id}`)) || [];
    const task = Array.isArray(allTasks) ? allTasks.find((t: any) => t.id === taskId) : null;
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const assignedStudents = (await readPortalData(`students:${user.id}`)) || [];
    const student = Array.isArray(assignedStudents)
      ? assignedStudents.find((item: any) => String(item.id) === String(studentId))
      : null;
    if (!student || (task.classId && student.classId !== task.classId
      && !(Array.isArray(student.classIds) && student.classIds.includes(task.classId)))) {
      return res.status(404).json({ error: 'Student is not assigned to this teacher' });
    }
    const entry = await recordGrade({
      task,
      student,
      studentId: student.id,
      classId: task.classId,
      teacherId: user.id,
      grade,
      score: normalizeScore(grade),
      maxScore: 100,
    });
    return res.json({ success: true, grade: entry });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getProfile, getData, saveStudents, saveClasses, createClass, deleteClass, updateManualStudent, createTask, updateTask, deleteTask, addTask, getTaskStudents, getTaskGrades,
  saveGrades, getAllStudents, getTaskStats, updateProfile, deactivateAccount, deleteAccount, getStudentStreak, getStudentTasks, assignStudent,
  unassignStudent, batchStudentData, saveSingleTaskGrade, updateClassLifecycle, addClassMembership, endClassMembership
};
