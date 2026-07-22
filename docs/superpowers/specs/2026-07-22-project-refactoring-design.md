# Obsidian Dashboard 项目重构设计文档

**日期**: 2026-07-22  
**版本**: 1.0  
**状态**: 已批准

## 1. 概述

### 1.1 背景
Obsidian Dashboard 是一个 Obsidian 插件项目，提供玻璃态风格的个人命令中心。当前项目存在以下问题：
- 多个文件过大（`renderer.ts` 130KB+、`view.ts` 56KB+、`library-section.ts` 43KB+）
- 所有50多个源文件都平铺在 `src/` 目录下，没有按功能模块组织
- 模块职责不够清晰，影响可维护性

### 1.2 目标
1. **可维护性优先**：解决文件过大、职责不清的问题
2. **工程规范优先**：按照前端/TypeScript 项目最佳实践组织目录结构
3. **彻底拆分**：将大文件拆分为多个模块，每个模块负责特定功能区域
4. **完全兼容**：这是第一个版本，不需要保持向后兼容性

### 1.3 范围
- 重构整个 `src/` 目录结构
- 拆分所有超过 20KB 的文件
- 建立清晰的模块边界和接口
- 更新构建配置和导入路径

## 2. 架构设计

### 2.1 目录结构

```
src/
├── core/                    # 核心层
│   ├── main.ts             # 插件入口（保持不变）
│   ├── view.ts             # 主视图（精简后约 20KB）
│   └── types.ts            # 所有类型定义（保持不变）
├── data/                    # 数据层
│   ├── parser.ts           # Markdown 解析器（保持不变）
│   ├── sync.ts             # 同步引擎（保持不变）
│   └── storage.ts          # 数据存储抽象（新建，封装 Obsidian Vault API，提供统一的文件读写接口）
├── services/                # 服务层
│   ├── weather.ts          # 天气服务（提取自 weather-service.ts）
│   ├── pomodoro.ts         # 番茄钟服务
│   ├── reading.ts          # 阅读服务
│   ├── book.ts             # 书籍服务
│   ├── tracker.ts          # 追踪服务
│   └── holiday.ts          # 假日服务
├── renderers/               # 渲染层（拆分 renderer.ts）
│   ├── dashboard.ts        # 主渲染器（协调其他渲染器）
│   ├── sidebar.ts          # 侧边栏渲染
│   ├── banner.ts           # 横幅渲染
│   ├── section.ts          # 区域基类/通用渲染
│   └── widgets.ts          # 小组件渲染（天气、农历等）
├── sections/                # 业务区域组件
│   ├── library.ts          # 数据库区域（拆分自 library-section.ts）
│   ├── media.ts            # 媒体区域（拆分自 media-section.ts）
│   ├── calendar.ts         # 日历区域
│   └── heatmap.ts          # 热力图区域
├── modals/                  # 模态框（约25个文件）
│   ├── card-edit.ts        # 卡片编辑模态框
│   ├── countdown.ts        # 倒计时模态框
│   ├── template.ts         # 模板模态框
│   ├── calendar.ts         # 日历模态框
│   ├── weather.ts          # 天气配置模态框
│   ├── library.ts          # 数据库配置模态框
│   ├── media.ts            # 媒体灯箱模态框
│   ├── heatmap.ts          # 热力图配置模态框
│   ├── tracker.ts          # 追踪配置模态框
│   ├── folder.ts           # 文件夹配置模态框
│   ├── widget-type.ts      # 小组件类型模态框
│   ├── lunar.ts            # 农历模态框
│   ├── fortune.ts          # 签文模态框
│   ├── note-popover.ts     # 笔记弹窗模态框
│   └── hover-preview.ts    # 悬停预览模态框
├── components/              # 通用 UI 组件
│   ├── task-tree.ts        # 任务树组件
│   ├── doc-tree.ts         # 文档树组件
│   ├── confirm-dialog.ts   # 确认对话框
│   └── prompt-dialog.ts    # 提示对话框
├── utils/                   # 工具函数
│   ├── dnd.ts              # 拖拽系统
│   ├── i18n.ts             # 国际化入口
│   ├── i18n/               # 语言文件目录
│   │   ├── en.ts           # 英文翻译
│   │   ├── zh.ts           # 中文翻译
│   │   └── index.ts        # 导出入口
│   ├── lunar.ts            # 农历工具
│   ├── file-suggest.ts     # 文件建议
│   └── quotes.json         # 引言数据（静态资源）
```

### 2.2 设计原则

1. **单一职责**：每个文件/模块只做一件事
2. **依赖方向**：`core` → `data` → `services` → `renderers` → `sections` → `modals` → `components` → `utils`
3. **接口隔离**：模块间通过接口通信，减少直接依赖
4. **可测试性**：每层都可以独立测试

## 3. 关键模块拆分策略

### 3.1 `renderer.ts` 拆分（130KB → 5个模块）

**当前问题**：这个文件包含所有渲染逻辑，职责过多。

**拆分方案**：

```
renderers/
├── dashboard.ts        # 主渲染器（约 30KB）
│   - renderDashboard() 主函数
│   - 协调其他渲染器
│   - 处理全局状态
├── sidebar.ts          # 侧边栏渲染（约 25KB）
│   - renderSidebarWidgets()
│   - 侧边栏布局逻辑
├── banner.ts           # 横幅渲染（约 15KB）
│   - Banner 类
│   - 引言轮换逻辑
│   - 背景图片管理
├── section.ts          # 区域渲染（约 35KB）
│   - renderSection() 通用函数
│   - 区域类型分发
│   - 区域内通用逻辑
└── widgets.ts          # 小组件渲染（约 25KB）
    - 天气小组件
    - 农历小组件
    - 倒计时小组件
    - 其他小组件
```

### 3.2 `view.ts` 拆分（56KB → 精简到 20KB）

**当前问题**：混合了视图逻辑、事件处理、渲染协调。

**拆分方案**：
- 移出渲染逻辑到 `renderers/dashboard.ts`
- 移出事件处理到 `utils/dnd.ts` 和各组件
- 保留核心视图生命周期管理

### 3.3 `library-section.ts` 拆分（43KB → 3个模块）

**当前问题**：包含网格、列表、表格、看板四种视图。

**拆分方案**：
```
sections/
├── library.ts              # 主入口（约 15KB）
│   - renderLibrarySection()
│   - 视图切换逻辑
├── library-views.ts        # 视图实现（约 20KB）
│   - GridView
│   - ListView
│   - TableView
│   - KanbanView
└── library-config.ts       # 配置相关（约 8KB）
    - 配置解析
    - 默认值处理
```

### 3.4 `i18n.ts` 拆分（56KB → 3个文件）

**当前问题**：所有翻译都在一个文件，难以维护。

**拆分方案**：
```
utils/
├── i18n.ts           # 入口和工具函数（约 2KB）
│   - t() 函数
│   - 语言检测
└── i18n/
    ├── en.ts         # 英文翻译（约 25KB）
    ├── zh.ts         # 中文翻译（约 25KB）
    └── index.ts      # 导出入口（约 1KB）
```

## 4. 模块间通信和数据流

### 4.1 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户操作                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      modals/ components/                     │
│                    （UI 交互层）                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        core/view.ts                          │
│                   （视图生命周期管理）                         │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────┐       ┌─────────────────────┐
│    renderers/       │       │      sections/       │
│   （渲染协调）       │       │   （业务区域组件）    │
└─────────────────────┘       └─────────────────────┘
              │                           │
              └─────────────┬─────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      services/                               │
│                    （业务服务层）                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       data/                                  │
│               （数据持久化和同步）                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Obsidian Vault Files                         │
│                    （Markdown 文件）                          │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 通信机制

1. **直接调用**：下层模块通过函数调用向上层提供服务
2. **事件系统**：使用 Obsidian 的事件机制处理跨模块通信
3. **依赖注入**：通过构造函数传递依赖，便于测试

### 4.3 状态管理

- **全局状态**：`core/view.ts` 管理视图状态
- **局部状态**：各模块内部状态自行管理
- **数据状态**：`data/sync.ts` 负责数据同步

### 4.4 错误处理策略

1. **边界捕获**：每个渲染函数用 try-catch 包裹
2. **优雅降级**：渲染失败时显示友好错误信息
3. **日志记录**：关键操作记录到控制台
4. **用户通知**：重要错误通过 Obsidian 通知用户

## 5. 核心接口设计

### 5.1 渲染器接口

```typescript
// renderers/types.ts
interface Renderer {
  render(container: HTMLElement, data: any): void;
  cleanup(): void;
}

interface SectionRenderer extends Renderer {
  getConfig(): SectionConfig;
  updateConfig(config: SectionConfig): void;
}
```

### 5.2 服务接口

```typescript
// services/types.ts
interface Service {
  initialize(): Promise<void>;
  destroy(): void;
}

interface DataService<T> extends Service {
  getData(): T;
  setData(data: T): void;
  validate(data: T): boolean;
}
```

### 5.3 模态框接口

```typescript
// modals/types.ts
interface ModalConfig {
  title: string;
  content: HTMLElement | string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface FormModal<T> extends Modal {
  getFormData(): T;
  setFormData(data: T): void;
  validate(): ValidationResult;
}
```

### 5.4 组件接口

```typescript
// components/types.ts
interface Component {
  render(container: HTMLElement): void;
  update(data: any): void;
  destroy(): void;
}

interface TreeComponent extends Component {
  expand(nodeId: string): void;
  collapse(nodeId: string): void;
  select(nodeId: string): void;
}
```

### 5.5 国际化接口

```typescript
// utils/i18n/types.ts
interface I18n {
  t(key: string, params?: Record<string, string>): string;
  getLocale(): string;
  setLocale(locale: string): void;
}
```

## 6. 测试和质量保证

### 6.1 测试策略

**单元测试覆盖**：
- `data/parser.ts` - 解析逻辑测试
- `services/*` - 服务层测试
- `utils/*` - 工具函数测试

**集成测试**：
- 渲染流程测试
- 数据同步测试
- 模态框交互测试

**端到端测试**：
- 用户操作流程测试
- 跨模块交互测试

### 6.2 代码质量工具

**ESLint 配置**：
- TypeScript 规则
- Obsidian 插件规则
- 代码风格一致性

**类型检查**：
- TypeScript 严格模式
- 接口完整性检查

### 6.3 性能考虑

**渲染性能**：
- 虚拟滚动（大列表）
- 懒加载（非关键组件）
- 缓存（频繁访问数据）

**内存管理**：
- 及时清理事件监听器
- 销毁不再使用的组件
- 避免内存泄漏

### 6.4 文档要求

**代码注释**：
- 复杂算法注释
- 公开 API 文档
- 配置项说明

**README 更新**：
- 新目录结构说明
- 开发指南更新
- 架构图更新

## 7. 迁移策略

### 7.1 迁移步骤

**阶段一：准备工作**
1. 创建新目录结构
2. 更新构建配置（esbuild.config.mjs）
3. 更新 tsconfig.json 路径映射

**阶段二：核心模块迁移**
1. 移动 `core/` 文件
2. 移动 `data/` 文件
3. 移动 `utils/` 文件
4. 更新所有导入路径

**阶段三：服务层迁移**
1. 移动 `services/` 文件
2. 更新服务依赖

**阶段四：UI 层迁移**
1. 移动 `modals/` 文件
2. 移动 `components/` 文件
3. 更新 UI 依赖

**阶段五：渲染层重构**
1. 拆分 `renderer.ts`
2. 拆分 `view.ts`
3. 更新渲染逻辑

**阶段六：业务区域迁移**
1. 移动 `sections/` 文件
2. 拆分大文件（library、media）

### 7.2 风险评估

**高风险**：
- 渲染逻辑拆分可能引入 bug
- 导入路径更新可能遗漏

**中风险**：
- 模块间接口不匹配
- 性能回退

**低风险**：
- 目录结构调整
- 文件移动

### 7.3 缓解措施

**测试覆盖**：
- 每个阶段完成后运行测试
- 关键路径手动测试

**回滚计划**：
- 每个阶段前创建 git 标签
- 保留旧文件备份（注释掉）

**渐进式迁移**：
- 一次只迁移一个模块
- 验证后再继续

### 7.4 成功标准

**功能完整性**：
- 所有现有功能正常工作
- 无功能回退

**性能基准**：
- 渲染时间不增加
- 内存使用不增加

**代码质量**：
- TypeScript 编译无错误
- ESLint 无警告

## 8. 附录

### 8.1 文件大小统计

| 文件 | 当前大小 | 目标大小 | 拆分后模块数 |
|------|----------|----------|--------------|
| renderer.ts | 130KB | 0KB | 5 |
| view.ts | 56KB | 20KB | 1 |
| library-section.ts | 43KB | 0KB | 3 |
| i18n.ts | 56KB | 2KB | 3 |
| media-section.ts | 30KB | 15KB | 2 |
| sync.ts | 27KB | 27KB | 1 |
| parser.ts | 36KB | 36KB | 1 |

### 8.2 模块依赖矩阵

| 模块 | 依赖 |
|------|------|
| core | data, utils |
| data | utils |
| services | data, utils |
| renderers | services, utils |
| sections | services, utils |
| modals | components, utils |
| components | utils |
| utils | 无 |

### 8.3 接口清单

- `Renderer` - 渲染器基础接口
- `SectionRenderer` - 区域渲染器接口
- `Service` - 服务基础接口
- `DataService<T>` - 数据服务接口
- `ModalConfig` - 模态框配置接口
- `FormModal<T>` - 表单模态框接口
- `Component` - 组件基础接口
- `TreeComponent` - 树形组件接口
- `I18n` - 国际化接口
