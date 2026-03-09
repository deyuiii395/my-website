# MongoDB 迁移部署指南

## 📋 概览

后端存储架构已从本地 JSON 文件(`data/store.json`)完全迁移到 MongoDB，解决了 Render 平台临时文件系统数据丢失的问题。

## ✅ 已完成的重构

### 1. **依赖更新** (package.json)
- ✨ 新增 `mongoose: ^7.7.0` 用于 MongoDB 连接管理

### 2. **彻底移除本地文件操作** (server.js)
- 🗑️ 删除所有 `fs` 模块调用
- 🗑️ 删除 `DATA_FILE` 和本地 `data/store.json` 的读写逻辑
- 🗑️ 删除 `loadData()` 和 `saveData()` 本地文件函数

### 3. **MongoDB 连接与初始化 - 强制验证模式**

⚠️ **关键安全改进**：连接代码采用强制验证，绝不允许本地兜底逻辑

```javascript
// ✅ 正确做法: 强制要求环境变量存在
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ 致命错误: 环境变量 MONGODB_URI 未设置');
  process.exit(1);  // 立即终止，防止连接到本地 MongoDB
}

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
```

**为什么这很重要**:
- ❌ **绝对禁止**: `|| 'mongodb://localhost:27017/...'` 后备逻辑
- ❌ **后果**: 在生产环境缺少 MONGODB_URI 时，会错误地连接到本地 MongoDB（在 Render 上实际上是独立的容器环境）
- ✅ **正确做法**: 环境变量不存在时立即失败，强制配置正确的数据库连接


### 4. **Mongoose 数据模型**

#### Exam 集合
```javascript
{
  id: 'exam-1',           // unique, required
  name: '① 8月联考',      
  date: '',
  cutoffs: {
    special: 413,
    bachelor: 371,
    subjects: {
      语文: 82, 数学: 82, 英语: 82, ...
    }
  }
}
```

#### Student 集合
```javascript
{
  id: '001',              // unique, required
  name: '张三',
  scores: [
    {
      examId: 0,
      total: 520,
      rank: 5,
      gradeRank: 50,
      subjects: {
        语文: 85, 数学: 95, 英语: 88, ...
      }
    },
    // ... 其他考试的成绩
  ]
}
```

#### AdminConfig 集合
```javascript
{
  key: 'admin_config',
  adminPassword: 'admin123'
}
```

### 5. **API 保持兼容**
所有 API 路由、请求体、返回结构完全保持与原先一致，**前端无感知零修改**：
- ✅ `GET /api/data` → 返回 `{ students, cutoffs, exams }`
- ✅ `POST /api/login` → 返回 `{ ok, token }`
- ✅ `GET /api/exams` → 返回 exams 列表
- ✅ `POST /api/exams` → 创建新考试
- ✅ `PUT /api/exams/:examId` → 更新考试
- ✅ `GET /api/students` → 返回学生列表
- ✅ `POST /api/students` → 添加学生
- ✅ `PUT /api/students/:id` → 更新学生
- ✅ `DELETE /api/students/:id` → 删除学生
- ✅ `PUT /api/cutoffs` → 更新分数线
- ✅ `POST /api/import` → Excel/CSV 导入
- ✅ `PUT /api/password` → 修改管理员密码

### 6. **数据库初始化**
首次连接时，如果 Exam 集合为空，自动写入 6 场默认考试：
```
① 8月联考、② 9月联考、③ 10月联考、
④ 12月(1)联考、⑤ 12月(2)联考、⑥ 1月一模
```

## 🚀 部署步骤

### 本地测试
```bash
# 1. 安装依赖
npm install

# 2. 启动本地 MongoDB (需要已安装 MongoDB)
# macOS:
brew services start mongodb-community

# 3. 启动后端
npm start
# 服务将在 http://localhost:3000 运行
```

### 部署到 Render

#### 步骤 1: 准备 MongoDB 实例
1. **选项 A - 使用 Render 的 MongoDB**（推荐）
   - 在 Render Dashboard 创建新的 Database → MongoDB
   - 记下生成的连接字符串 (MONGODB_URI)

2. **选项 B - 使用 MongoDB Atlas**（免费云服务）
   - 访问 [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - 创建免费 M0 集群
   - 获取连接字符串格式: `mongodb+srv://username:password@cluster.mongodb.net/gao33_score_system`

#### 步骤 2: 部署到 Render
1. 推送代码到 GitHub
2. 在 Render 创建新 Web Service：
   - 连接你的 GitHub 仓库
   - Runtime: Node.js
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **⚠️ 必须设置环境变量**（应用启动前必须存在）：
   
   | 变量名 | 值 | 说明 |
   |--------|------|------|
   | **MONGODB_URI** | `你的 MongoDB 连接字符串` | **必须设置**，否则应用无法启动 |
   | PORT | `10000` | 可选（Render 默认值） |
   
   **MONGODB_URI 设置示例**:
   - Render MongoDB: `mongodb+srv://user:pass@render-....mongodb.net/gao33_score_system`
   - MongoDB Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/gao33_score_system`
   
   ⚠️ **重要**: 如果 MONGODB_URI 未设置，应用会立即失败并打印详细错误消息，防止误连到本地数据库。

4. 部署！

#### 步骤 3: 验证
```bash
# 测试公开 API
curl https://your-app.onrender.com/api/data

# 应返回:
{
  "students": [],
  "exams": [6 个默认考试...],
  "cutoffs": [对应的分数线...]
}
```

## 🔒 安全注意事项

1. **MongoDB 连接强制验证**
   - ✅ 代码强制要求 `MONGODB_URI` 环境变量存在
   - ✅ 如果变量缺失，应用会立即退出并打印错误信息
   - ❌ **绝对禁止**使用本地后备逻辑 (`|| 'mongodb://localhost:...'`)
   - 防止在生产环境意外连接到本地或错误的数据库

2. **永远不要在代码中硬编码 MongoDB 凭证**
   - ✅ 使用 `process.env.MONGODB_URI`
   - ❌ 避免: `mongodb+srv://user:password@...`

3. **环境变量设置**
   - 在 Render: 使用 Web Service 的 Environment 配置
   - 本地开发: 创建 `.env` 文件（添加到 .gitignore）

3. **MongoDB 访问控制**
   - 限制网络访问白名单（如果使用 MongoDB Atlas）
   - 定期更改管理员密码

## 📊 数据迁移（如果有现有数据）

如果需要从旧的 `data/store.json` 迁移数据：

```javascript
// 一次性迁移脚本 (migrate.js)
const mongoose = require('mongoose');
const fs = require('fs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gao33_score_system';

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  
  const data = JSON.parse(fs.readFileSync('./data/store.json', 'utf8'));
  
  const Exam = mongoose.model('Exam', ...);
  const Student = mongoose.model('Student', ...);
  
  // 导入考试
  await Exam.insertMany(data.exams || []);
  
  // 导入学生
  await Student.insertMany(data.students || []);
  
  console.log('✅ 迁移完成');
  process.exit(0);
}

migrate().catch(console.error);
```

## 🔧 故障排除

### 连接失败: "MongoDB connection failed"
- 检查 `MONGODB_URI` 环境变量是否正确设置
- 验证 MongoDB 服务器是否运行中
- 检查网络连接和防火墙规则

### 数据未初始化
- 检查 MongoDB 是否可写
- 查看后端日志是否有初始化日志

### API 返回 500 错误
- 查看后端日志获取详细错误信息
- 确保 MongoDB 连接正常

## 📝 环境变量清单

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `MONGODB_URI` | MongoDB 连接字符串 | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `PORT` | 服务端口 | `3000` (本地) / `10000` (Render) |

## ✨ 后续改进建议

1. **备份策略**: 定期备份 MongoDB 数据库
2. **索引优化**: 为高频查询字段添加索引
3. **日志集成**: 集成云日志服务(如 Render Logs)
4. **监控告警**: 设置数据库连接监控和告警
5. **灾难恢复**: 制定 MongoDB 故障转移方案

---

**重构完成！所有本地文件依赖已彻底消除，系统现在支持 Render 的无状态部署。** 🎉
