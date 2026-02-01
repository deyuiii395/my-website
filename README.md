# 高33班六次联考成绩智能分析系统

包含前端分析页面、后端 API 和管理后台。

## 快速启动

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

服务启动后：
- **分析页面**: http://localhost:3000/index1.html
- **管理后台**: http://localhost:3000/admin.html

默认管理员密码：`admin123`

## 功能说明

### 分析页面 (index1.html)
- 数据大屏、成绩总表、各科分析
- 学生个人学情报告与打印
- 支持 Excel/CSV 导入（页面内）
- 启动服务后自动从后端加载数据

### 管理后台 (admin.html)
- 学生管理：增删改查
- 分数线设置：修改六次考试的特控线、本科线
- 批量导入：按考试上传 Excel/CSV 成绩
- 修改管理员密码

### 数据存储
- 数据保存在 `data/store.json`
- 首次运行会自动创建默认数据
