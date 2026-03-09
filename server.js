const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'];

// ===== MongoDB 连接 - 强制验证模式 =====
// 严禁使用本地兜底逻辑，MONGODB_URI 必须由环境变量提供
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ 致命错误: 环境变量 MONGODB_URI 未设置');
  console.error('   请检查:');
  console.error('   1. Render 的 Environment 配置中是否已添加 MONGODB_URI');
  console.error('   2. 本地开发时，.env 文件中是否包含 MONGODB_URI');
  console.error('   3. MongoDB 连接字符串格式是否正确');
  console.error('');
  console.error('   MongoDB 连接字符串示例:');
  console.error('   - 本地: mongodb://localhost:27017/gao33_score_system');
  console.error('   - MongoDB Atlas: mongodb+srv://user:password@cluster.mongodb.net/gao33_score_system');
  console.error('   - Render: mongodb+srv://...@cluster.mongodb.net/...');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB 连接成功');
  initializeDefaultExams();
}).catch(err => {
  console.error('❌ MongoDB 连接失败:', err.message);
  console.error('   连接字符串:', MONGODB_URI.split('@')[0] + '@****');
  process.exit(1);
});

// ===== Mongoose Schemas & Models =====

// Exam Schema
const examSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  date: { type: String, default: '' },
  cutoffs: {
    special: { type: Number, default: 0 },
    bachelor: { type: Number, default: 0 },
    subjects: {
      语文: { type: Number, default: 0 },
      数学: { type: Number, default: 0 },
      英语: { type: Number, default: 0 },
      物理: { type: Number, default: 0 },
      化学: { type: Number, default: 0 },
      生物: { type: Number, default: 0 },
      政治: { type: Number, default: 0 },
      历史: { type: Number, default: 0 },
      地理: { type: Number, default: 0 }
    }
  }
});

// Student Schema
const studentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  scores: [
    {
      examId: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      rank: { type: Number, default: 0 },
      gradeRank: { type: Number, default: 0 },
      subjects: {
        语文: { type: Number, default: 0 },
        数学: { type: Number, default: 0 },
        英语: { type: Number, default: 0 },
        物理: { type: Number, default: 0 },
        化学: { type: Number, default: 0 },
        生物: { type: Number, default: 0 },
        政治: { type: Number, default: 0 },
        历史: { type: Number, default: 0 },
        地理: { type: Number, default: 0 }
      }
    }
  ]
});

// Admin Config Schema (用于存储管理员密码)
const adminConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'admin_config' },
  adminPassword: { type: String, default: 'admin123' }
});

const Exam = mongoose.model('Exam', examSchema);
const Student = mongoose.model('Student', studentSchema);
const AdminConfig = mongoose.model('AdminConfig', adminConfigSchema);

// ===== 默认考试数据 =====
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

// ===== 初始化数据库 =====
async function initializeDefaultExams() {
  try {
    const examCount = await Exam.countDocuments();
    if (examCount === 0) {
      console.log('📝 Exam 集合为空，正在写入默认考试数据...');
      await Exam.insertMany(DEFAULT_EXAMS);
      console.log('✅ 默认考试数据已写入');
    }

    // 确保管理员配置存在
    const adminConfig = await AdminConfig.findOne({ key: 'admin_config' });
    if (!adminConfig) {
      await AdminConfig.create({ key: 'admin_config', adminPassword: 'admin123' });
      console.log('✅ 管理员配置已初始化');
    }
  } catch (err) {
    console.error('❌ 初始化失败:', err);
  }
}

// ===== 工具函数 =====

// 创建空白成绩结构
function emptyScores(examCount) {
  return Array(examCount).fill(null).map((_, i) => ({
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

// 确保学生 scores 数组长度与考试场次一致
function ensureStudentScoresLength(studentScores, examCount) {
  const scores = studentScores.slice(0, examCount);
  while (scores.length < examCount) {
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
  return scores;
}

// 解析 Excel/CSV 行到学生数据
function parseRows(rows, examIndex, examCount) {
  const studentMap = {};
  rows.forEach(row => {
    if (!row[0] || String(row[0]).includes('姓名') || String(row[0]).includes('平均分')) return;
    const id = row[1] ? String(row[1]).trim() : '';
    if (!id) return;
    if (!studentMap[id]) {
      studentMap[id] = {
        name: row[0],
        id,
        scores: emptyScores(examCount)
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

// ===== 中间件 =====
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const upload = multer({ dest: 'uploads/' });

// 管理员验证中间件
async function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  try {
    const adminConfig = await AdminConfig.findOne({ key: 'admin_config' });
    const adminPassword = adminConfig?.adminPassword || 'admin123';
    if (token === adminPassword || token === 'admin_' + adminPassword) {
      next();
    } else {
      res.status(401).json({ error: '未授权' });
    }
  } catch (err) {
    res.status(500).json({ error: '验证失败' });
  }
}

// ========== 公开 API (前端页面使用) ==========

// 获取全部数据
app.get('/api/data', async (req, res) => {
  try {
    const students = await Student.find({});
    const exams = await Exam.find({});
    // cutoffs 由 exams 直接提供
    const cutoffs = exams.map(e => e.cutoffs);
    res.json({ students, cutoffs, exams });
  } catch (err) {
    res.status(500).json({ error: '获取数据失败' });
  }
});

// ========== 管理 API (需登录) ==========

// 登录
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  try {
    const adminConfig = await AdminConfig.findOne({ key: 'admin_config' });
    const adminPassword = adminConfig?.adminPassword || 'admin123';
    if (password === adminPassword) {
      res.json({ ok: true, token: 'admin_' + adminPassword });
    } else {
      res.status(401).json({ error: '密码错误' });
    }
  } catch (err) {
    res.status(500).json({ error: '登录失败' });
  }
});

// ===== 考试时间线管理 =====

// 获取考试列表
app.get('/api/exams', authMiddleware, async (req, res) => {
  try {
    const exams = await Exam.find({}).sort({ id: 1 });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: '获取考试列表失败' });
  }
});

// 新增考试
app.post('/api/exams', authMiddleware, async (req, res) => {
  try {
    const { name, date, cutoffs } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: '考试名称必填' });
    }

    const examCount = await Exam.countDocuments();
    const newId = `exam-${examCount + 1}`;

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

    const exam = new Exam({
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
    });

    await exam.save();

    // 扩展所有学生的 scores 数组
    const students = await Student.find({});
    for (const student of students) {
      student.scores = ensureStudentScoresLength(student.scores, examCount + 1);
      await student.save();
    }

    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: '新增考试失败' });
  }
});

// 更新单场考试（名称 / 日期 / 分数线）
app.put('/api/exams/:examId', authMiddleware, async (req, res) => {
  try {
    const { examId } = req.params;
    const payload = req.body || {};

    const exam = await Exam.findOne({ id: examId });
    if (!exam) return res.status(404).json({ error: '考试不存在' });

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

    await exam.save();
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: '更新考试失败' });
  }
});

// 获取学生列表
app.get('/api/students', authMiddleware, async (req, res) => {
  try {
    const students = await Student.find({});
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: '获取学生列表失败' });
  }
});

// 添加学生
app.post('/api/students', authMiddleware, async (req, res) => {
  try {
    const student = req.body;
    if (!student.name || !student.id) {
      return res.status(400).json({ error: '姓名和学号必填' });
    }

    const existing = await Student.findOne({ id: student.id });
    if (existing) {
      return res.status(400).json({ error: '学号已存在' });
    }

    const examCount = await Exam.countDocuments();
    const newStudent = new Student({
      name: student.name,
      id: student.id,
      scores: student.scores || emptyScores(examCount)
    });

    await newStudent.save();
    res.json(newStudent);
  } catch (err) {
    res.status(500).json({ error: '添加学生失败' });
  }
});

// 更新学生
app.put('/api/students/:id', authMiddleware, async (req, res) => {
  try {
    const student = req.body;
    const updated = await Student.findOneAndUpdate(
      { id: req.params.id },
      {
        name: student.name,
        id: student.id,
        scores: student.scores
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: '学生不存在' });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '更新学生失败' });
  }
});

// 删除学生
app.delete('/api/students/:id', authMiddleware, async (req, res) => {
  try {
    const result = await Student.findOneAndDelete({ id: req.params.id });
    if (!result) {
      return res.status(404).json({ error: '学生不存在' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '删除学生失败' });
  }
});

// 更新分数线
app.put('/api/cutoffs', authMiddleware, async (req, res) => {
  try {
    const cutoffs = req.body;
    const exams = await Exam.find({}).sort({ id: 1 });

    if (Array.isArray(cutoffs) && cutoffs.length === exams.length) {
      for (let i = 0; i < exams.length; i++) {
        exams[i].cutoffs = cutoffs[i];
        await exams[i].save();
      }
      res.json(cutoffs);
    } else {
      res.status(400).json({ error: '分数线条数必须与考试场次数一致' });
    }
  } catch (err) {
    res.status(500).json({ error: '更新分数线失败' });
  }
});

// 批量导入 (Excel/CSV)
app.post('/api/import', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const exams = await Exam.find({});
    const examCount = exams.length;
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
        const fs = require('fs');
        const content = fs.readFileSync(file.path, 'utf8');
        rows = content.split('\n').map(line => line.split(',').map(c => c.trim()));
      } else if (['.xls', '.xlsx'].includes(ext)) {
        const wb = XLSX.readFile(file.path);
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      } else {
        const fs = require('fs');
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({ error: '仅支持 CSV/XLS/XLSX' });
      }

      const imported = parseRows(rows, examIndex, examCount);
      const studentMap = {};

      const dbStudents = await Student.find({});
      dbStudents.forEach(s => {
        studentMap[s.id] = s;
      });

      for (const importedStudent of imported) {
        if (studentMap[importedStudent.id]) {
          studentMap[importedStudent.id].scores[examIndex] = importedStudent.scores[examIndex];
          await studentMap[importedStudent.id].save();
        } else {
          const newStudent = new Student(importedStudent);
          await newStudent.save();
          studentMap[importedStudent.id] = newStudent;
        }
      }

      res.json({ ok: true, count: Object.keys(studentMap).length });
    } finally {
      const fs = require('fs');
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
  } catch (err) {
    res.status(500).json({ error: '导入失败' });
  }
});

// 修改管理员密码
app.put('/api/password', authMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: '新密码至少 4 位' });
    }

    let adminConfig = await AdminConfig.findOne({ key: 'admin_config' });
    if (!adminConfig) {
      adminConfig = new AdminConfig({ key: 'admin_config' });
    }
    adminConfig.adminPassword = newPassword;
    await adminConfig.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 启动
app.listen(PORT, () => {
  console.log(`\n🚀 服务已启动: http://localhost:${PORT}`);
  console.log(`   前端页面: http://localhost:${PORT}/`);
  console.log(`   管理后台: http://localhost:${PORT}/admin.html`);
  console.log(`   默认管理员密码: admin123\n`);
});
