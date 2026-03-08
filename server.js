const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'store.json');
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'];

// ===== 考试时间线默认配置（和前端 EXAM_CONFIG 对齐） =====
const DEFAULT_EXAMS = [
  {
    id: 'exam-1',
    name: '① 8月联考',
    date: '',
    cutoffs: {
      special: 413,
      bachelor: 371,
      subjects: { 语文: 82, 数学: 82, 英语: 82, 物理: 55, 化学: 55, 生物: 55, 政治: 55, 历史: 55, 地理: 55 }
    }
  },
  {
    id: 'exam-2',
    name: '② 9月联考',
    date: '',
    cutoffs: {
      special: 454,
      bachelor: 375.5,
      subjects: { 语文: 90, 数学: 90, 英语: 90, 物理: 60, 化学: 60, 生物: 60, 政治: 60, 历史: 60, 地理: 60 }
    }
  },
  {
    id: 'exam-3',
    name: '③ 10月联考',
    date: '',
    cutoffs: {
      special: 421,
      bachelor: 373,
      subjects: { 语文: 84, 数学: 84, 英语: 84, 物理: 56, 化学: 56, 生物: 56, 政治: 56, 历史: 56, 地理: 56 }
    }
  },
  {
    id: 'exam-4',
    name: '④ 12月(1)联考',
    date: '',
    cutoffs: {
      special: 424,
      bachelor: 352,
      subjects: { 语文: 85, 数学: 85, 英语: 85, 物理: 57, 化学: 57, 生物: 57, 政治: 57, 历史: 57, 地理: 57 }
    }
  },
  {
    id: 'exam-5',
    name: '⑤ 12月(2)联考',
    date: '',
    cutoffs: {
      special: 412,
      bachelor: 365,
      subjects: { 语文: 82, 数学: 82, 英语: 82, 物理: 55, 化学: 55, 生物: 55, 政治: 55, 历史: 55, 地理: 55 }
    }
  },
  {
    id: 'exam-6',
    name: '⑥ 1月一模',
    date: '',
    cutoffs: {
      special: 446,
      bachelor: 385,
      subjects: { 语文: 89, 数学: 89, 英语: 89, 物理: 59, 化学: 59, 生物: 59, 政治: 59, 历史: 59, 地理: 59 }
    }
  }
];

function getDefaultExams() {
  // 深拷贝，避免被意外修改
  return JSON.parse(JSON.stringify(DEFAULT_EXAMS));
}

// 确保 data 目录存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// 读取数据
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);

    // 兼容旧版本：如果还没有 exams，就用默认 exams + 旧 cutoffs 填充
    if (!data.exams || !Array.isArray(data.exams) || data.exams.length === 0) {
      const defaults = getDefaultExams();
      if (Array.isArray(data.cutoffs) && data.cutoffs.length === defaults.length) {
        defaults.forEach((exam, idx) => {
          if (data.cutoffs[idx]) {
            exam.cutoffs.special = data.cutoffs[idx].special ?? exam.cutoffs.special;
            exam.cutoffs.bachelor = data.cutoffs[idx].bachelor ?? exam.cutoffs.bachelor;
            if (data.cutoffs[idx].subjects) {
              exam.cutoffs.subjects = {
                ...exam.cutoffs.subjects,
                ...data.cutoffs[idx].subjects
              };
            }
          }
        });
      }
      data.exams = defaults;
    }

    // 确保 cutoffs 和 exams 同步（保留原 cutoffs 字段兼容前端）
    data.cutoffs = (data.exams || getDefaultExams()).map(e => e.cutoffs);

    // 确保每个学生的 scores 长度与考试场次数一致
    ensureStudentScoresLength(data, data.exams.length);

    return data;
  } catch (e) {
    const exams = getDefaultExams();
    return {
      students: [],
      exams,
      cutoffs: exams.map(e => e.cutoffs),
      adminPassword: 'admin123'
    };
  }
}

// 保存数据
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 默认分数线配置
function getDefaultCutoffs() {
  return getDefaultExams().map(e => e.cutoffs);
}

// 创建空白成绩结构
function emptyScores(examCount) {
  const count = typeof examCount === 'number' && examCount > 0 ? examCount : 6;
  return Array(count).fill(null).map((_, i) => ({
    examId: i,
    total: 0,
    rank: 0,
    gradeRank: 0,
    subjects: SUBJECTS.reduce((acc, sub) => {
      acc[sub] = 0;
      return acc;
    }, {})
  }));
}

// 确保所有学生的 scores 数组长度与考试场次数一致
function ensureStudentScoresLength(data, examCount) {
  const count = typeof examCount === 'number' && examCount > 0 ? examCount : 6;
  data.students = (data.students || []).map(s => {
    if (!Array.isArray(s.scores)) {
      return { ...s, scores: emptyScores(count) };
    }
    const scores = s.scores.slice(0, count);
    while (scores.length < count) {
      scores.push({
        examId: scores.length,
        total: 0,
        rank: 0,
        gradeRank: 0,
        subjects: SUBJECTS.reduce((acc, sub) => {
          acc[sub] = 0;
          return acc;
        }, {})
      });
    }
    return { ...s, scores };
  });
}

// 解析 Excel/CSV 行到学生数据
function parseRows(rows, examIndex, examCount) {
  const studentMap = {};
  const count = typeof examCount === 'number' && examCount > 0 ? examCount : 6;
  rows.forEach(row => {
    if (!row[0] || String(row[0]).includes('姓名') || String(row[0]).includes('平均分')) return;
    const id = row[1] ? String(row[1]).trim() : '';
    if (!id) return;
    if (!studentMap[id]) {
      studentMap[id] = {
        name: row[0],
        id,
        scores: emptyScores(count)
      };
    }
    const rankStr = row[3] ? String(row[3]) : '0/0';
    const rankParts = rankStr.split('/');
    const classRank = parseInt(rankParts[0]) || 0;
    const gradeRank = parseInt(rankParts[1]) || 0;
    studentMap[id].scores[examIndex] = {
      examId: examIndex,
      total: parseFloat(row[2]) || 0,
      rank: classRank,
      gradeRank,
      subjects: {
        语文: parseFloat(row[4]) || 0, 数学: parseFloat(row[6]) || 0, 英语: parseFloat(row[8]) || 0,
        物理: parseFloat(row[10]) || 0, 化学: parseFloat(row[12]) || 0, 生物: parseFloat(row[14]) || 0,
        政治: parseFloat(row[16]) || 0, 历史: parseFloat(row[18]) || 0, 地理: parseFloat(row[20]) || 0
      }
    };
  });
  return Object.values(studentMap);
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const upload = multer({ dest: 'uploads/' });

// 简单管理员验证 (生产环境建议用 JWT)
function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  const data = loadData();
  if (token === data.adminPassword || token === 'admin_' + data.adminPassword) {
    next();
  } else {
    res.status(401).json({ error: '未授权' });
  }
}

// ========== 公开 API (前端页面使用) ==========

// 获取全部数据
app.get('/api/data', (req, res) => {
  const data = loadData();
  res.json({ students: data.students, cutoffs: data.cutoffs, exams: data.exams });
});

// ========== 管理 API (需登录) ==========

// 登录
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const data = loadData();
  if (password === data.adminPassword) {
    res.json({ ok: true, token: 'admin_' + data.adminPassword });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

// ===== 考试时间线管理 =====

// 获取考试列表
app.get('/api/exams', authMiddleware, (req, res) => {
  const data = loadData();
  res.json(data.exams || getDefaultExams());
});

// 新增考试
app.post('/api/exams', authMiddleware, (req, res) => {
  const data = loadData();
  const { name, date, cutoffs } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: '考试名称必填' });
  }

  const nextIndex = (data.exams && data.exams.length) ? data.exams.length : 0;
  const newId = `exam-${nextIndex + 1}`;

  const baseCutoffs = cutoffs && typeof cutoffs === 'object'
    ? cutoffs
    : {
        special: 0,
        bachelor: 0,
        subjects: SUBJECTS.reduce((acc, sub) => {
          acc[sub] = 0;
          return acc;
        }, {})
      };

  const exam = {
    id: newId,
    name,
    date: date || '',
    cutoffs: {
      special: Number(baseCutoffs.special) || 0,
      bachelor: Number(baseCutoffs.bachelor) || 0,
      subjects: SUBJECTS.reduce((acc, sub) => {
        const v = baseCutoffs.subjects && baseCutoffs.subjects[sub];
        acc[sub] = Number(v) || 0;
        return acc;
      }, {})
    }
  };

  data.exams = data.exams || [];
  data.exams.push(exam);

  // 同步 cutoffs 数组，并扩展所有学生的 scores
  data.cutoffs = data.exams.map(e => e.cutoffs);
  ensureStudentScoresLength(data, data.exams.length);

  saveData(data);
  res.json(exam);
});

// 更新单场考试（名称 / 日期 / 分数线）
app.put('/api/exams/:examId', authMiddleware, (req, res) => {
  const data = loadData();
  const { examId } = req.params;
  const idx = (data.exams || []).findIndex(e => e.id === examId);
  if (idx < 0) return res.status(404).json({ error: '考试不存在' });

  const payload = req.body || {};
  const exam = data.exams[idx];

  if (payload.name !== undefined) exam.name = payload.name;
  if (payload.date !== undefined) exam.date = payload.date;
  if (payload.cutoffs) {
    const c = payload.cutoffs;
    if (c.special !== undefined) exam.cutoffs.special = Number(c.special) || 0;
    if (c.bachelor !== undefined) exam.cutoffs.bachelor = Number(c.bachelor) || 0;
    if (c.subjects && typeof c.subjects === 'object') {
      SUBJECTS.forEach(sub => {
        if (c.subjects[sub] !== undefined) {
          exam.cutoffs.subjects[sub] = Number(c.subjects[sub]) || 0;
        }
      });
    }
  }

  data.exams[idx] = exam;
  data.cutoffs = data.exams.map(e => e.cutoffs);
  saveData(data);
  res.json(exam);
});

// 获取学生列表
app.get('/api/students', authMiddleware, (req, res) => {
  const data = loadData();
  res.json(data.students);
});

// 添加学生
app.post('/api/students', authMiddleware, (req, res) => {
  const data = loadData();
  const student = req.body;
  if (!student.name || !student.id) {
    return res.status(400).json({ error: '姓名和学号必填' });
  }
  if (data.students.some(s => s.id === student.id)) {
    return res.status(400).json({ error: '学号已存在' });
  }
  const examCount = (data.exams && data.exams.length) || 6;
  const newStudent = {
    name: student.name,
    id: student.id,
    scores: student.scores || emptyScores(examCount)
  };
  data.students.push(newStudent);
  saveData(data);
  res.json(newStudent);
});

// 更新学生
app.put('/api/students/:id', authMiddleware, (req, res) => {
  const data = loadData();
  const idx = data.students.findIndex(s => s.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '学生不存在' });
  const student = req.body;
  data.students[idx] = {
    name: student.name ?? data.students[idx].name,
    id: student.id ?? data.students[idx].id,
    scores: student.scores ?? data.students[idx].scores
  };
  saveData(data);
  res.json(data.students[idx]);
});

// 删除学生
app.delete('/api/students/:id', authMiddleware, (req, res) => {
  const data = loadData();
  const idx = data.students.findIndex(s => s.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '学生不存在' });
  data.students.splice(idx, 1);
  saveData(data);
  res.json({ ok: true });
});

// 更新分数线
app.put('/api/cutoffs', authMiddleware, (req, res) => {
  const data = loadData();
  const cutoffs = req.body;
  if (Array.isArray(cutoffs) && cutoffs.length === (data.exams || []).length) {
    data.cutoffs = cutoffs;
    // 同步写回 exams 内部的 cutoffs
    if (data.exams && Array.isArray(data.exams)) {
      data.exams = data.exams.map((exam, idx) => ({
        ...exam,
        cutoffs: cutoffs[idx] || exam.cutoffs
      }));
    }
    saveData(data);
    res.json(data.cutoffs);
  } else {
    res.status(400).json({ error: '分数线条数必须与考试场次数一致' });
  }
});

// 批量导入 (Excel/CSV)
app.post('/api/import', authMiddleware, upload.single('file'), (req, res) => {
  const data = loadData();
  const examCount = (data.exams && data.exams.length) || 6;
  const examIndex = parseInt(req.body.examIndex, 10);
  if (Number.isNaN(examIndex) || examIndex < 0 || examIndex >= examCount) {
    return res.status(400).json({ error: `考试索引 0-${examCount - 1}` });
  }
  const file = req.file;
  if (!file) return res.status(400).json({ error: '未上传文件' });

  let rows = [];
  const ext = path.extname(file.originalname).toLowerCase();
  try {
    if (ext === '.csv') {
      const content = fs.readFileSync(file.path, 'utf8');
      rows = content.split('\n').map(line => line.split(',').map(c => c.trim()));
    } else if (['.xls', '.xlsx'].includes(ext)) {
      const wb = XLSX.readFile(file.path);
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    } else {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: '仅支持 CSV/XLS/XLSX' });
    }
  } finally {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  }

  const imported = parseRows(rows, examIndex, examCount);
  const studentMap = {};
  data.students.forEach(s => { studentMap[s.id] = s; });
  imported.forEach(s => {
    if (studentMap[s.id]) {
      studentMap[s.id].scores[examIndex] = s.scores[examIndex];
    } else {
      studentMap[s.id] = s;
    }
  });
  data.students = Object.values(studentMap);
  saveData(data);
  res.json({ ok: true, count: data.students.length });
});

// 修改管理员密码
app.put('/api/password', authMiddleware, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: '新密码至少 4 位' });
  }
  const data = loadData();
  data.adminPassword = newPassword;
  saveData(data);
  res.json({ ok: true });
});

// 启动
app.listen(PORT, () => {
  console.log(`\n🚀 服务已启动: http://localhost:${PORT}`);
  console.log(`   前端页面: http://localhost:${PORT}/index1.html`);
  console.log(`   管理后台: http://localhost:${PORT}/admin.html`);
  console.log(`   默认管理员密码: admin123\n`);
});
