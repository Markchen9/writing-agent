# 项目架构说明

## 技术架构

- 桌面端：Electron
- 前端：React 19 + TypeScript
- 构建：Vite
- 数据：本地 JSON 持久化
- AI 调用：Renderer -> preload -> IPC -> Main Process -> LLM

## 目录结构

```text
writing-agent-master/
├── src/
│   ├── main/                # Electron 主进程
│   ├── preload/             # 预加载层（隔离桥）
│   └── renderer/            # React 渲染层
│       ├── pages/
│       │   ├── TopicList.tsx
│       │   ├── Editor.tsx
│       │   ├── FloatingBall.tsx
│       │   ├── DiffPreview.tsx
│       │   └── Settings.tsx
│       └── App.tsx
└── docs/
    ├── progress.md
    ├── architecture.md
    └── code-conventions.md
```

## 核心模块

### 1. 选题管理模块（TopicList）

- 选题增删改查
- 列表/看板视图
- AI 生成选题

### 2. 创作编辑模块（Editor）

- Markdown 编辑与预览
- 自动保存
- AI 全文润色
- AI 改动撤销/重做
- 创作提示词（选中 + 临时调整）

### 3. AI 助手模块（FloatingBall）

- 悬浮球聊天
- 生成初稿
- 选区改写

### 4. 差异预览模块（DiffPreview）

- 展示原文与改文差异
- 用户确认后才应用

## 创作界面统一逻辑（给后续 AI 的关键约定）

### 状态流（推荐标准）

1. 进入创作页
- 从 Topic 加载：`content`、`constitutionId`、`temporaryAdjustments`、`aiEditHistory`、`chatHistory`
- 初始化页面编辑态

2. 用户触发内容变更
- 手动输入
- 选区 AI 动作
- 悬浮球聊天 AI 动作
- 全文润色 AI 动作

3. AI 改动统一管道
- AI 返回结果先进入 `pendingChange`（候选改动）
- 不直接写入正文
- 展示 Diff 预览
- 用户确认后才应用，取消则丢弃

4. 应用改动
- 统一走 `applyAiContentChange(nextContent)`
- 入 `undoStack`，清空 `redoStack`

5. 持久化
- `content` 变更后 debounce 自动保存
- `constitutionId` / `temporaryAdjustments` 单独保存
- `chatHistory` 单独保存

6. 撤销重做边界
- 当前只跟踪 AI 改动
- 手动输入不进入 AI 历史栈

### 当前代码的一致性风险

- `Editor.tsx` 已有统一入口 `applyAiContentChange`
- `FloatingBall.tsx` 的“生成初稿/局部修改”仍可能存在直接写正文路径
- 后续改造方向：统一为“先预览，后应用”

## 数据流

```text
用户操作
  -> Renderer（Editor/FloatingBall）
  -> preload API
  -> IPC
  -> Main Process
  -> LLM / 文件系统
  -> 返回 Renderer
  -> pendingChange
  -> DiffPreview 确认
  -> applyAiContentChange
  -> autosave 持久化 Topic
```

## 数据类型（关键字段）

### Topic

```ts
{
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  content: string
  chatHistory?: { role: 'user' | 'assistant'; content: string }[]
  constitutionId: string | null
  temporaryAdjustments: string
  aiEditHistory?: {
    undoStack: string[]
    redoStack: string[]
    maxSteps: number
  }
  createdAt: string
  updatedAt: string
}
```

### Config

```ts
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
