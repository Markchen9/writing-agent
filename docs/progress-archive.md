# 项目进度归档

## 归档说明
- 该文件用于保存 `docs/progress.md` 中超出“最近 10 条”的历史记录。
- 归档时间：2026-02-27

### 2026-02-27 - AI 改文统一为“先预览再应用”
- 做了什么：
  1. FloatingBall 产生的改文不再直接写入正文，统一走 DiffPreview。
  2. 普通聊天回复可提交为候选改动，再由用户确认应用。
- 修改了哪些文件：
  - src/renderer/pages/FloatingBall.tsx
  - src/renderer/pages/Editor.tsx

### 2026-02-26 - 创作提示词管理功能
- 做了什么：
  1. 支持多套提示词模板、默认模板、临时调整。
  2. 编辑器和 AI 调用统一注入提示词规则。
- 修改了哪些文件：
  - src/renderer/App.tsx
  - src/renderer/pages/Settings.tsx
  - src/renderer/pages/Editor.tsx

### 2026-02-26 - 选题生成与列表能力增强
- 做了什么：
  1. AI 一次生成多个选题，支持单选/多选与批量创建。
  2. 选题列表支持看板视图、状态管理和基础交互。
- 修改了哪些文件：
  - src/renderer/pages/TopicList.tsx
