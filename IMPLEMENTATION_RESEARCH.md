# Obsidian Canvas Note Preview - 實現研究報告

## 專案目標

在側邊欄建立一個「專用的筆記標籤頁」，當用戶點擊 Canvas 中不同的節點時，這個標籤頁會自動切換顯示對應的筆記檔案。

## 核心需求分析

### 1. 固定側邊欄面板
- ✅ 在右側邊欄創建固定的視圖
- ✅ 使用自定義 ItemView 而非直接使用 MarkdownView
- ✅ 重複使用同一個 leaf，不創建多個標籤頁

### 2. 檔案切換機制
- ✅ 檢測 Canvas 節點點擊事件
- ✅ 在同一個面板中切換不同檔案
- ✅ 支援編輯和預覽模式

### 3. 用戶體驗
- ✅ 類似 Backlinks/Outline 的固定面板
- ✅ 完整的 Markdown 預覽和編輯功能
- ✅ 自動儲存和狀態指示

## 關鍵 API 研究

### 1. WorkspaceLeaf 管理

#### 獲取或創建固定 Leaf
```typescript
// 方法 1：檢查是否已存在 + 重用
const leaves = workspace.getLeavesOfType(VIEW_TYPE_NOTE_PREVIEW);
if (leaves.length > 0) {
    leaf = leaves[0]; // 重用現有的 leaf
} else {
    leaf = workspace.getRightLeaf(false); // 創建新的
}

// 方法 2：使用 getUnpinnedLeaf（會重用未固定的 leaf）
leaf = workspace.getUnpinnedLeaf();
```

**實際採用方案**：方法 1
- 優點：精確控制，只重用我們自己的視圖
- 確保不會意外覆蓋其他插件的面板

#### 設置 Leaf 的視圖狀態
```typescript
await leaf.setViewState({
    type: VIEW_TYPE_NOTE_PREVIEW,
    active: true,
});
```

#### 顯示 Leaf（帶入焦點）
```typescript
workspace.revealLeaf(leaf);
```

### 2. Canvas 事件偵測

Canvas 沒有官方的 `selection-changed` 事件，需要通過以下方式實現：

#### 方法 A：DOM 事件監聽（已採用）
```typescript
const canvasEl = canvasView.containerEl;

const handleClick = (event: MouseEvent) => {
    setTimeout(() => {
        const selection = canvas.selection;
        if (selection && selection.size === 1) {
            const node = Array.from(selection)[0];
            if (node?.file instanceof TFile) {
                void this.showNoteInPreview(node.file);
            }
        }
    }, 50);
};

canvasEl.addEventListener('click', handleClick);
```

**優點**：
- 簡單可靠
- 不需要訂閱未公開的 API
- 與 Obsidian 更新相容性好

**注意事項**：
- 需要 `setTimeout` 等待 Canvas 更新選擇狀態
- 50ms 延遲足夠且用戶無感

#### 方法 B：active-leaf-change 事件
```typescript
this.registerEvent(
    this.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf?.view.getViewType() === 'canvas') {
            this.setupCanvasListeners(leaf);
        }
    })
);
```

用於：
- 檢測 Canvas 視圖被激活
- 為新打開的 Canvas 設置監聽器

#### 方法 C：canvas:node-menu 事件（官方但有限）
```typescript
workspace.on('canvas:node-menu', (menu: Menu, node: CanvasNode) => {
    // 只在右鍵選單時觸發，不適合我們的用例
});
```

### 3. 在自定義視圖中切換檔案

#### 問題：ItemView vs MarkdownView

**研究發現**：
- ❌ 不能直接使用 MarkdownView 作為側邊欄的自定義視圖
- ✅ 需要創建繼承 ItemView 的自定義視圖
- ✅ 在自定義視圖內部使用 MarkdownRenderer

**原因**：
1. MarkdownView 是 Obsidian 內建的檔案視圖，與 Workspace 檔案系統緊密耦合
2. 自定義側邊欄需要 ItemView 來獲得完整的生命週期控制
3. MarkdownRenderer.render() 可以在任何 DOM 元素中渲染 Markdown

#### 解決方案：自定義 NotePreviewView

```typescript
class NotePreviewView extends ItemView {
    currentFile: TFile | null = null;
    private previewContainer: HTMLElement | null = null;
    
    async setFile(file: TFile | null) {
        this.currentFile = file;
        
        // 清空容器
        container.empty();
        
        // 讀取檔案
        const fileContent = await this.app.vault.read(file);
        
        // 渲染預覽
        await MarkdownRenderer.render(
            this.app,
            fileContent,
            this.previewContainer,
            file.path,
            this
        );
    }
}
```

**關鍵點**：
- `setFile()` 方法允許切換檔案而不創建新 leaf
- 每次切換時 `container.empty()` 清空舊內容
- 同一個視圖實例，不同的檔案內容

### 4. 編輯功能實現

#### 雙模式設計（預覽 + 編輯）
```typescript
class NotePreviewView extends ItemView {
    private isEditMode = false;
    private previewContainer: HTMLElement;
    private editorContainer: HTMLElement;
    private editor: HTMLTextAreaElement;
    
    async toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        if (this.isEditMode) {
            this.showEditor();
        } else {
            await this.saveAndShowPreview();
        }
    }
}
```

#### 自動儲存機制
```typescript
scheduleAutoSave() {
    if (this.saveTimeout) {
        window.clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = window.setTimeout(() => {
        void this.saveContent();
    }, 2000); // 2 秒後自動儲存
}

async saveContent() {
    const newContent = this.editor.value;
    await this.app.vault.modify(this.currentFile, newContent);
}
```

## 架構設計

### 元件分層

```
CanvasNotePreviewPlugin (main.ts)
├── 視圖註冊：registerView(VIEW_TYPE, NotePreviewView)
├── 命令註冊：addCommand('open-note-preview')
├── 事件監聽
│   ├── active-leaf-change：檢測 Canvas 打開
│   └── DOM click：檢測節點選擇
└── 協調邏輯
    ├── activateView()：確保預覽面板存在
    ├── setupCanvasListeners()：為 Canvas 設置監聽
    └── showNoteInPreview()：切換預覽檔案

NotePreviewView (extends ItemView)
├── 狀態管理
│   ├── currentFile：當前顯示的檔案
│   ├── isEditMode：編輯/預覽模式
│   └── saveTimeout：自動儲存計時器
├── UI 元件
│   ├── previewContainer：預覽容器
│   ├── editorContainer：編輯器容器
│   └── saveStatusEl：儲存狀態指示器
└── 核心方法
    ├── setFile()：切換檔案
    ├── toggleEditMode()：切換模式
    ├── saveContent()：儲存檔案
    └── refreshPreview()：更新預覽
```

### 生命週期

```
1. 插件載入 (onload)
   ↓
2. 註冊視圖類型 (registerView)
   ↓
3. 監聽 Canvas 打開 (active-leaf-change)
   ↓
4. 使用者點擊 Canvas 節點
   ↓
5. 檢查預覽面板是否存在
   ├─ 不存在 → activateView() 創建
   └─ 存在 → 重用
   ↓
6. 呼叫 view.setFile(file)
   ↓
7. 清空容器 → 讀取檔案 → 渲染內容
```

## 關鍵技術細節

### 1. Canvas 選擇狀態訪問

```typescript
interface Canvas {
    selection: Set<CanvasNode>;
}

// 獲取選中的節點
const selection = canvas.selection;
if (selection.size === 1) {
    const node = Array.from(selection)[0];
    if (node?.file instanceof TFile) {
        // 處理檔案節點
    }
}
```

### 2. 類型安全的 Canvas 訪問

```typescript
interface CanvasView extends ItemView {
    canvas: Canvas;
}

const canvasView = leaf.view as CanvasView;
if (!canvasView.canvas) {
    // Canvas 還沒準備好，稍後重試
    setTimeout(() => this.setupCanvasListeners(leaf), 100);
}
```

### 3. 防止事件冒泡干擾

```typescript
// 防止其他插件干擾編輯器
this.editorContainer.addEventListener('click', (e) => e.stopPropagation());
this.editorContainer.addEventListener('focus', (e) => e.stopPropagation(), true);
```

### 4. 清理資源

```typescript
// 註冊清理函數
this.register(() => {
    canvasEl.removeEventListener('click', handleClick);
});

// 視圖關閉時清理
async onClose() {
    if (this.saveTimeout) {
        window.clearTimeout(this.saveTimeout);
    }
    
    if (this.isEditMode && this.currentFile) {
        await this.saveContent(); // 儲存未儲存的變更
    }
}
```

## 參考插件研究

### 1. Hover Editor
- **倉庫**：nothingislost/obsidian-hover-editor
- **學習點**：如何創建彈出式編輯器
- **應用**：類似的編輯器實現模式

### 2. Advanced Canvas
- **倉庫**：Developer-Mike/obsidian-advanced-canvas
- **學習點**：Canvas 事件擴展機制
- **應用**：使用 Proxy 模式創建自定義 Canvas 事件

### 3. Canvas Presentation
- **倉庫**：Quorafind/Obsidian-Canvas-Presentation
- **學習點**：如何操作 Canvas 選擇狀態
- **應用**：
  ```typescript
  canvas.deselectAll();
  canvas.select(node);
  canvas.zoomToSelection();
  ```

## 已知限制與解決方案

### 限制 1：Canvas API 未完全公開
- **問題**：許多 Canvas 功能在 API 中未正式文檔化
- **解決**：使用類型斷言 `as CanvasView` 訪問內部 API
- **風險**：未來 Obsidian 更新可能破壞相容性
- **緩解**：最小化對內部 API 的依賴，專注於公開的 API

### 限制 2：沒有原生的選擇變更事件
- **問題**：Canvas 不提供 `selection-changed` 事件
- **解決**：使用 DOM 點擊事件 + setTimeout
- **效果**：50ms 延遲對用戶無感，實測可靠

### 限制 3：無法使用原生 MarkdownView
- **問題**：MarkdownView 與檔案系統緊耦合
- **解決**：使用 ItemView + MarkdownRenderer
- **權衡**：
  - ✅ 完全控制視圖行為
  - ✅ 可自定義編輯/預覽切換
  - ❌ 需要自行實現編輯器功能

## 最佳實踐總結

### 1. Leaf 重用模式
```typescript
// ✅ 正確：檢查現有 + 重用
const leaves = workspace.getLeavesOfType(VIEW_TYPE);
leaf = leaves.length > 0 ? leaves[0] : workspace.getRightLeaf(false);

// ❌ 錯誤：總是創建新 leaf
leaf = workspace.getRightLeaf(true); // split=true 會創建新的
```

### 2. Canvas 監聽設置
```typescript
// ✅ 正確：等待 Canvas 準備就緒
if (!canvasView.canvas) {
    setTimeout(() => this.setupCanvasListeners(leaf), 100);
    return;
}

// ❌ 錯誤：假設 Canvas 立即可用
const canvas = canvasView.canvas; // 可能 undefined
```

### 3. 視圖狀態管理
```typescript
// ✅ 正確：在 setFile 中完整更新
async setFile(file: TFile) {
    container.empty();
    // 更新所有相關狀態
    this.currentFile = file;
    // 重新渲染
}

// ❌ 錯誤：不清空容器直接追加
async setFile(file: TFile) {
    // 舊內容仍在 DOM 中
    container.appendChild(newElement);
}
```

### 4. 事件清理
```typescript
// ✅ 正確：註冊清理函數
this.register(() => {
    element.removeEventListener('click', handler);
});

// ❌ 錯誤：忘記清理
element.addEventListener('click', handler);
// 記憶體洩漏！
```

## API 快速參考

### Workspace 方法
| 方法 | 用途 | 回傳值 |
|------|------|--------|
| `workspace.getRightLeaf(split)` | 獲取右側邊欄的 leaf | `WorkspaceLeaf` |
| `workspace.getLeavesOfType(type)` | 獲取特定類型的所有 leaf | `WorkspaceLeaf[]` |
| `workspace.revealLeaf(leaf)` | 顯示並聚焦 leaf | `void` |
| `workspace.iterateAllLeaves(callback)` | 遍歷所有 leaf | `void` |
| `workspace.on(event, callback)` | 監聽工作區事件 | `EventRef` |

### WorkspaceLeaf 方法
| 方法 | 用途 | 回傳值 |
|------|------|--------|
| `leaf.openFile(file, state?)` | 在 leaf 中打開檔案 | `Promise<void>` |
| `leaf.setViewState(state)` | 設置視圖狀態 | `Promise<void>` |
| `leaf.getViewState()` | 獲取當前視圖狀態 | `ViewState` |
| `leaf.view` | 當前視圖實例 | `View` |

### Canvas 相關
| 屬性/方法 | 用途 | 類型 |
|-----------|------|------|
| `canvas.selection` | 當前選中的節點 | `Set<CanvasNode>` |
| `canvas.select(node)` | 選擇節點 | `void` |
| `canvas.deselectAll()` | 取消所有選擇 | `void` |
| `node.file` | 節點關聯的檔案 | `TFile \| undefined` |

### MarkdownRenderer
| 方法 | 用途 |
|------|------|
| `MarkdownRenderer.render(app, markdown, el, sourcePath, component)` | 渲染 Markdown |

## 實現檢查清單

- [x] 創建自定義 ItemView（NotePreviewView）
- [x] 註冊視圖類型
- [x] 實現 activateView() - 確保只有一個預覽面板
- [x] 監聽 active-leaf-change 事件
- [x] 為 Canvas 設置點擊監聽器
- [x] 實現 setFile() - 切換檔案內容
- [x] 實現預覽模式（MarkdownRenderer）
- [x] 實現編輯模式（textarea）
- [x] 實現自動儲存
- [x] 實現儲存狀態指示
- [x] 添加開啟檔案按鈕
- [x] 清理資源（事件監聽器、計時器）
- [x] 錯誤處理

## 後續優化方向

### 1. 性能優化
- [ ] 大檔案分頁載入
- [ ] 虛擬滾動（長檔案）
- [ ] 防抖處理點擊事件

### 2. 功能增強
- [ ] 支援多選節點（顯示多個檔案）
- [ ] 快捷鍵支援
- [ ] 同步滾動（編輯器與預覽）
- [ ] 語法高亮（CodeMirror）

### 3. 用戶體驗
- [ ] 載入動畫
- [ ] 更美觀的錯誤提示
- [ ] 設置面板（自訂延遲、自動儲存間隔等）

## 相關資源

### 官方文檔
- [Obsidian Plugin Developer Docs](https://marcus.se.net/obsidian-plugin-docs/)
- [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- [Canvas API Definition](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts)

### 社群討論
- [Forum: Canvas node click event](https://forum.obsidian.md/t/get-current-selected-card-id-in-canvas/80444)
- [Forum: ItemView usage](https://forum.obsidian.md/t/how-to-correctly-open-an-itemview/60871)

### 範例插件
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Hover Editor](https://github.com/nothingislost/obsidian-hover-editor)
- [Advanced Canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas)

---

**文檔版本**：1.0  
**最後更新**：2025-11-15  
**作者**：MUKI  
**適用於**：Obsidian API v1.4.0+
