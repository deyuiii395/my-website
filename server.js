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

// 确保 data 目录存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// 读取数据
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { students: [], cutoffs: getDefaultCutoffs(), adminPassword: 'admin123' };
  }
}

// 保存数据
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 默认分数线配置
function getDefaultCutoffs() {
  const defaults = [
    { special: 413, bachelor: 371 },
    { special: 454, bachelor: 375.5 },
    { special: 421, bachelor: 373 },
    { special: 424, bachelor: 352 },
    { special: 412, bachelor: 365 },
    { special: 446, bachelor: 385 },
  ];
  const subs = { 语文: 82, 数学: 82, 英语: 82, 物理: 55, 化学: 55, 生物: 55, 政治: 55, 历史: 55, 地理: 55 };
  return defaults.map((d, i) => ({
    ...d,
    subjects: i === 1 ? { 语文: 90, 数学: 90, 英语: 90, 物理: 60, 化学: 60, 生物: 60, 政治: 60, 历史: 60, 地理: 60 } :
      i === 2 ? { 语文: 84, 数学: 84, 英语: 84, 物理: 56, 化学: 56, 生物: 56, 政治: 56, 历史: 56, 地理: 56 } :
      i === 3 ? { 语文: 85, 数学: 85, 英语: 85, 物理: 57, 化学: 57, 生物: 57, 政治: 57, 历史: 57, 地理: 57 } :
      i === 5 ? { 语文: 89, 数学: 89, 英语: 89, 物理: 59, 化学: 59, 生物: 59, 政治: 59, 历史: 59, 地理: 59 } :
      subs
  }));
}

// 创建空白成绩结构
function emptyScores() {
  return Array(6).fill(null).map((_, i) => ({
    examId: i,
    total: 0,
    rank: 0,
    gradeRank: 0,
    subjects: { 语文: 0, 数学: 0, 英语: 0, 物理: 0, 化学: 0, 生物: 0, 政治: 0, 历史: 0, 地理: 0 }
  }));
}

// 解析 Excel/CSV 行到学生数据
function parseRows(rows, examIndex) {
  const studentMap = {};
  rows.forEach(row => {
    if (!row[0] || String(row[0]).includes('姓名') || String(row[0]).includes('平均分')) return;
    const id = row[1] ? String(row[1]).trim() : '';
    if (!id) return;
    if (!studentMap[id]) {
      studentMap[id] = {
        name: row[0],
        id,
        scores: emptyScores()
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
  res.json({ students: data.students, cutoffs: data.cutoffs });
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
  const newStudent = {
    name: student.name,
    id: student.id,
    scores: student.scores || emptyScores()
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
  if (Array.isArray(cutoffs) && cutoffs.length === 6) {
    data.cutoffs = cutoffs;
    saveData(data);
    res.json(data.cutoffs);
  } else {
    res.status(400).json({ error: '需要 6 组分数线' });
  }
});

// 批量导入 (Excel/CSV)
app.post('/api/import', authMiddleware, upload.single('file'), (req, res) => {
  const examIndex = parseInt(req.body.examIndex) || 0;
  if (examIndex < 0 || examIndex > 5) {
    return res.status(400).json({ error: '考试索引 0-5' });
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

  const imported = parseRows(rows, examIndex);
  const data = loadData();
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
