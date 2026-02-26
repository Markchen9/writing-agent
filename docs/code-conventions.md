# 代码规范

## 命名规范

### 文件命名
- 组件文件：**大驼峰**，如 `TopicList.tsx`、`UserProfile.tsx`
- 工具函数：**小写 + 连字符**，如 `format-date.ts`、`string-utils.ts`
- 样式文件：**小写 + 连字符**，如 `global.css`、`button.css`

### 组件命名
- 使用 **大驼峰**，如 `function TopicList() {}`
- 导出的组件必须与文件名一致

### 变量/函数命名
- 使用 **小驼峰**，如 `selectedTopicId`、`handleSave`
- 布尔值变量用 `is`/`has`/`should` 前缀，如 `isLoading`、`hasError`
- 事件处理函数用 `handle` 前缀，如 `handleClick`、`handleChange`

### 类型命名
- 接口/类型：**大驼峰**，如 `interface Topic {}`、`type FilterStatus = ...`

---

## 代码风格

### 1. 使用中文注释
```typescript
// ✅ 好
const handleSave = () => {
  // 保存选题到本地存储
  await window.electronAPI.saveTopics({ topics })
}

// ❌ 坏
const handleSave = () => {
  // Save topics to local storage
  await window.electronAPI.saveTopics({ topics })
}
```

### 2. 每个文件不超过 200 行
超过 200 行需要考虑拆分：
- 提取子组件
- 抽取工具函数
- 分离样式到独立文件

### 3. 不要写复杂的单行代码
```typescript
// ✅ 好
const filtered = topics.filter(t => t.status === filter)
const sorted = filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

// ❌ 坏（太复杂）
const result = topics.filter(t => t.status === filter).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
```

### 4. React 组件结构
```typescript
import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Topic } from '../App'

// 类型定义放在组件外部
interface TopicListProps {
  topics: Topic[]
  onSelectTopic: (id: string) => void
  onSaveTopics: (topics: Topic[]) => void
}

// 子组件定义（如果有）
function ChildComponent({ ... }: ChildProps) {
  return (...)
}

// 主组件
function TopicList({ topics, onSelectTopic, onSaveTopics }: TopicListProps) {
  // 1. 状态定义
  const [filter, setFilter] = useState('all')

  // 2. useEffect
  useEffect(() => {
    // ...
  }, [])

  // 3. 事件处理函数
  const handleClick = () => {
    // ...
  }

  // 4. 渲染
  return (
    <div>...</div>
  )
}

export default TopicList
```

### 5. 样式组织
- 全局样式：`global.css`
- 组件内联样式：使用 `<style>{\`...\`}</style>` 放在组件末尾
- CSS 类名：使用 `kebab-case`，如 `.topic-list`、`modal-overlay`

---

## Git 提交规范

### Commit 格式
```
类型：描述
```

### 类型说明
| 类型 | 说明 |
|------|------|
| `功能` | 新功能 |
| `修复` | Bug 修复 |
| `样式` | 样式调整（不影响功能） |
| `优化` | 性能优化 |
| `重构` | 代码重构（不改功能） |
| `文档` | 文档更新 |

### 示例
```
功能：添加看板视图拖拽排序
修复：解决选题删除后状态异常的问题
样式：调整按钮颜色和间距
优化：减少不必要的重渲染
```

---

## 安全规范

### 1. 不要在前端存储敏感信息
- API Key 等敏感数据存储在 Electron 主进程
- 通过 IPC 调用，不暴露给渲染进程

### 2. 用户输入需要校验
- 表单输入需要 `trim()` 和长度检查
- JSON 解析需要 `try-catch`

### 3. 遵循 Electron 安全最佳实践
- 启用 `contextIsolation`
- 禁用 `nodeIntegration`（渲染进程）
- 只暴露必要的 API 给渲染进程

---

## 性能规范

### 1. 避免不必要的重渲染
```typescript
// ✅ 好：使用 useCallback
const handleClick = useCallback(() => {
  // ...
}, [dependencies])

// ❌ 坏：每次渲染都创建新函数
const handleClick = () => {
  // ...
}
```

### 2. 大列表使用虚拟滚动
- 超过 100 条数据的列表考虑虚拟滚动

### 3. 防抖/节流
- 搜索输入：防抖 300ms
- 窗口 resize：防抖 200ms
- 自动保存：防抖 1s

---

## 测试规范

（待添加）
