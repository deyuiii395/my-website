# ✅ MongoDB 迁移检查清单

## 代码层面

- [x] 从 package.json 中确认添加了 `mongoose: ^7.7.0`
- [x] 从 server.js 中删除了所有 `fs` 模块调用
- [x] 从 server.js 中删除了 `loadData()` 和 `saveData()` 函数
- [x] 删除了本地 JSON 文件路径 `DATA_FILE` 定义
- [x] 添加了 MongoDB 连接逻辑（使用环境变量）
- [x] 创建了三个 Mongoose schemas: Exam, Student, AdminConfig
- [x] 所有 API 端点都改为异步 MongoDB 操作
- [x] 初始化函数会自动写入默认考试数据
- [x] 管理员密码存储在 AdminConfig 集合中
- [x] 所有 API 响应格式保持与原先完全一致（前端零感知）

## 文件检查

- [x] server.js 语法检查: ✅ PASS
- [x] package.json 格式: ✅ PASS
- [x] 依赖列表完整: ✅ PASS
- [x] .gitignore 已更新: ✅ 排除 .env 和敏感文件
- [x] .env.example 已创建: ✅ 提供配置模板

## 本地测试 (前置条件: 已安装 MongoDB)

```bash
# 1. 安装依赖
npm install

# 2. 启动 MongoDB
brew services start mongodb-community  # macOS

# 3. 启动后端
npm start

# 4. 测试公开 API
curl http://localhost:3000/api/data

# 预期输出: { "students": [], "exams": [...], "cutoffs": [...] }
```

- [ ] npm install 成功
- [ ] MongoDB 启动成功
- [ ] npm start 后端启动成功
- [ ] `/api/data` 端点返回正确的 JSON 格式
- [ ] 数据库连接日志显示 "✅ MongoDB 连接成功"
- [ ] 数据库初始化日志显示 "✅ 默认考试数据已写入"

## Render 部署前检查

- [ ] GitHub 仓库已更新最新代码
- [ ] 确认本地测试通过
- [ ] 确认没有敏感信息被 Git 跟踪 (在 .gitignore 中)

## Render 部署步骤

1. [ ] 在 Render 上创建 MongoDB 数据库实例（或使用 Atlas）
2. [ ] 复制 MongoDB 连接字符串 (MONGODB_URI)
3. [ ] 创建 Render Web Service
4. [ ] 设置环境变量:
   - [ ] MONGODB_URI = `[你的连接字符串]`
   - [ ] PORT = `10000` (或留空，默认是 10000)
5. [ ] Build Command: `npm install`
6. [ ] Start Command: `npm start`
7. [ ] 点击 Deploy

## Render 部署后验证

```bash
# 替换 YOUR_APP_URL 为你的 Render 应用 URL
curl https://YOUR_APP_URL/api/data

# 预期:
# { "students": [], "exams": [...], "cutoffs": [...] }
```

- [ ] `/api/data` 端点返回 200 OK
- [ ] JSON 格式正确，包含 students、exams、cutoffs 字段
- [ ] Render 日志显示 "✅ MongoDB 连接成功"
- [ ] 数据库初始化成功 (查看 Render Logs)

## 前端测试

- [ ] 前端 `/` 可正常访问
- [ ] 前端 `/admin.html` 可正常访问
- [ ] 前端可正常调用后端 API（无跨域错误）
- [ ] 登录功能正常（使用默认密码 admin123）
- [ ] 成绩数据可正常加载和修改

## 清理工作

部署到 Render 后，可选:

- [ ] 本地删除 `data/` 目录 (已由 MongoDB 替代)
- [ ] 更新 README.md，说明现在使用 MongoDB
- [ ] 备份原来的 data/store.json (作为历史记录)

## 紧急回滚

如果需要回滚到本地 JSON 存储:

1. [ ] 恢复之前的 server.js (git log 查看)
2. [ ] 恢复 package.json 中的依赖
3. [ ] 删除 .env.example
4. [ ] npm install 重新安装原依赖
5. [ ] 重新启动服务

---

**所有项目完成后，迁移即为成功！** 🎉
