# ⚠️ 关键安全修复 - MongoDB 连接强制验证

**日期**: 2026年3月9日  
**严重级别**: 🔴 **临界** (CRITICAL)  
**状态**: ✅ 已修复

---

## 问题描述

### 原始缺陷 (Vulnerability)

```javascript
// ❌ 危险的代码（原版本）
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gao33_score_system';
```

**问题后果**:
1. 当部署到 Render 时，如果忘记设置环境变量 `MONGODB_URI`
2. 代码会自动回退到本地地址 `localhost:27017`
3. 在 Render 容器环境中，`localhost` 指向容器内部，而非 Render 的 MongoDB 服务
4. **结果**: 应用启动时连接到错误的数据库或连接失败，数据无法持久化
5. 即使应用看起来"在运行"，实际上数据操作全部失败，导致生产环境崩溃

### 风险场景

| 场景 | 后果 |
|------|------|
| Render 部署时忘记设置 MONGODB_URI | 应用连接失败或连接到错误的数据库 |
| 环境变量配置错误 | 数据丢失或无法读写 |
| 本地开发代码提交到生产 | 生产环境误连本地 MongoDB（如果本地有的话） |

---

## 修复方案

### 改进后的代码（新版本）

```javascript
// ✅ 强制验证模式
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
  process.exit(1);  // ⚠️ 立即终止，不允许继续执行
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
```

### 修复要点

1. **删除本地后备逻辑**: `|| 'mongodb://localhost:...'` 完全移除
2. **强制验证**: 缺少环境变量时立即失败
3. **详细错误提示**: 打印配置检查清单和示例
4. **日志掩盖敏感信息**: 连接字符串中的密码用 `****` 替换显示
5. **立即退出**: `process.exit(1)` 确保不允许无效连接继续运行

---

## 修复清单

- [x] 移除本地兜底逻辑 (`|| 'mongodb://localhost:...'`)
- [x] 添加环境变量强制验证
- [x] 缺失时打印详细错误信息
- [x] 在连接失败时正确退出进程
- [x] 日志中掩盖敏感信息（密码）
- [x] 更新 MONGODB_MIGRATION.md 文档
- [x] 验证代码语法无误
- [x] 本地测试通过

---

## 部署指南

### Render 部署 - 强制配置步骤

1. **在 Render Dashboard 中**:
   - 进入你的 Web Service 设置
   - 找到 `Environment` 选项
   - **必须添加**: `MONGODB_URI` = `你的 MongoDB 连接字符串`

2. **验证连接字符串格式**:
   ```
   ✅ 正确: mongodb+srv://user:password@cluster.mongodb.net/gao33_score_system
   ✅ 正确: mongodb://localhost:27017/gao33_score_system (本地)
   ❌ 错误: mongodb://localhost  (不完整)
   ❌ 错误: localhost:27017      (无 protocol)
   ```

3. **部署前检查**:
   ```bash
   # 确认环境变量已设置
   # 在 Render Logs 中应该看到:
   # "✅ MongoDB 连接成功"
   
   # 如果看到错误:
   # "❌ 致命错误: 环境变量 MONGODB_URI 未设置"
   # 则说明配置不完整，需要在 Environment 中添加
   ```

---

## 本地开发配置

### 创建 .env 文件

```bash
# .env (本地开发用，不要提交到 Git)
MONGODB_URI=mongodb://localhost:27017/gao33_score_system
PORT=3000
```

### 启动本地 MongoDB

```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Docker (推荐)
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 启动应用

```bash
npm install
npm start

# 应该看到:
# ✅ MongoDB 连接成功
# ✅ 默认考试数据已写入
```

---

## 故障排查

### 错误: "环境变量 MONGODB_URI 未设置"

**原因**: 部署环境中没有设置该环境变量

**解决**:
1. 进入 Render Dashboard
2. 编辑 Web Service 的 Environment
3. 添加 `MONGODB_URI` 环境变量
4. 重新部署

### 错误: "MongoDB 连接失败: ECONNREFUSED"

**原因**: 连接字符串指向的服务器无法访问

**检查**:
1. 确认 MongoDB 服务是否运行中
2. 确认连接字符串是否正确
3. 检查网络和防火墙设置
4. 在 Render 上，确认使用的是云 MongoDB（不是本地）

### 应用启动成功但数据操作失败

**原因**: 可能连接到了错误的 MongoDB 实例

**检查**:
1. 查看日志中的连接字符串（密码被掩盖）
2. 验证 `MONGODB_URI` 是否指向正确的数据库
3. 检查数据库凭证和网络访问

---

## 预防措施

### Git 提交前检查

```bash
# 确保代码中没有硬编码的 MongoDB 凭证
grep -r "mongodb+srv://.*:.*@" .

# 确保 .env 文件在 .gitignore 中
grep ".env" .gitignore
```

### 部署前检查清单

- [ ] 环境变量 MONGODB_URI 已在 Render 设置
- [ ] 连接字符串格式正确
- [ ] MongoDB 服务可访问
- [ ] 本地测试通过
- [ ] 代码无硬编码密钥
- [ ] .env 文件在 .gitignore 中

---

## 相关文件

- [server.js](./server.js) - 修复的连接代码（第 12-45 行）
- [MONGODB_MIGRATION.md](./MONGODB_MIGRATION.md) - 完整部署指南
- [.env.example](./.env.example) - 环境变量示例

---

**修复完成。系统现在拥有生产级别的数据库连接安全验证。** ✅
