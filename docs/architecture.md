# 项目架构说明

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Electron App                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐         ┌─────────────────────────────┐│
│  │   Main Process  │◄───────►│      Preload Scripts        ││
│  │   (Node.js)     │   IPC   │   (Context Isolation)       ││
│  │                 │         │                             ││
│  │ - 窗口管理      │         │ - exposeInMainWorld         ││
│  │ - 文件系统      │         │ - electronAPI               ││
│  │ - LLM 调用       │         │                             ││
│  └─────────────────┘         └─────────────────────────────┘│
│         ▲                              │                     │
│         │                              │                     │
│         └──────────────────────────────┘                     │
│                                    │                         │
│                        ┌───────────▼─────────────────────┐   │
│                        │       Renderer Process          │   │
│                        │         (React 19)              │   │
│                        │                                 │   │
│                        │ - TopicList (选题管理)          │   │
│                        │ - Editor (创作编辑器)           │   │
│                        │ - Settings (设置)               │   │
│                        └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
writing-agent-master/
├── src/
│   ├── main/              # Electron 主进程
│   │   └── index.ts       # 主进程入口（窗口、IPC、文件存储）
│   ├── preload/           # 预加载脚本
│   │   └── index.ts       # 暴露 API 给渲染进程
│   └── renderer/          # React 渲染进程
│       ├── pages/
│       │   ├── TopicList.tsx    # 选题管理（列表/看板视图）
│       │   ├── Editor.tsx       # Markdown 编辑器
│       │   └── Settings.tsx     # 设置页面
│       ├── styles/
│       │   └── global.css       # 全局样式
│       ├── App.tsx              # 根组件
│       └── main.tsx             # React 入口
├── docs/                  # 项目文档
│   ├── progress.md        # 进度日志
│   └── architecture.md    # 项目架构
├── package.json
├── electron.vite.config.ts
└── CLAUDE.md              # 项目规则
```

## 核心模块

### 1. 选题管理模块 (`TopicList.tsx`)

**功能：**
- 列表视图 / 看板视图切换
- 选题的增删改查
- AI 生成选题（一次 3 个，支持多选）
- 看板拖拽（列间移动 + 列内排序）
- 看板搜索（标题、描述、标签）

**状态存储：**
- 选题数据 → 主进程文件系统
- 视图状态 → localStorage
- 列配置 → localStorage

---

### 2. 创作编辑器模块 (`Editor.tsx`)

**功能：**
- Markdown 编辑 + 实时预览
- 自动保存（1 秒防抖）
- 导出 Markdown 文件
- AI 辅助润色（待实现）
- 创作提示词选择（待实现）

---

### 3. 设置模块 (`Settings.tsx`)

**功能：**
- LLM 配置（Provider、API Key、Base URL、模型）
- 创作提示词管理（待实现）
- 测试连接

---

## 数据流

```
用户操作 → Renderer → preloadAPI → IPC → Main Process → 文件系统/LLM
          ◄───────────────────────────────────────────────
```

## 数据类型

### Topic（选题）
```typescript
{
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
  order?: number  // 看板列内排序
  constitutionId: string | null
  temporaryAdjustments: string
}
```

### Config（配置）
```typescript
{
  llm: {
    provider: string
    apiKey: string
    baseUrl: string
    model: string
  }
  creationConstitutions: CreationConstitution[]
}
```

## 本地存储

| 数据类型 | 存储位置 | 说明 |
|----------|----------|------|
| 选题数据 | 主进程文件系统 | JSON 文件 |
| 配置数据 | 主进程文件系统 | JSON 文件 |
| 视图状态 | localStorage | 看板/列表视图切换 |
| 列配置 | localStorage | 看板列的顺序和自定义列 |
