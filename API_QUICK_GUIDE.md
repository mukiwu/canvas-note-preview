# Obsidian Canvas Note Preview - API 快速實踐指南

## 核心概念

### 為什麼不能直接用 MarkdownView？

```typescript
// ❌ 這樣不行
class MyView extends MarkdownView { } // MarkdownView 與檔案系統耦合

// ✅ 正確做法
class MyView extends ItemView {
    async setFile(file: TFile) {
        const content = await this.app.vault.read(file);
        await MarkdownRenderer.render(
            this.app,
            content,
            this.containerEl,
            file.path,
            this
        );
    }
}
```

**原因**：MarkdownView 是內建檔案視圖，無法作為自定義側邊欄面板使用。

---

## 1. 創建固定的側邊欄面板

### 步驟 1：註冊視圖
```typescript
// main.ts
const VIEW_TYPE = "my-custom-view";

onload() {
    this.registerView(
        VIEW_TYPE,
        (leaf) => new MyCustomView(leaf)
    );
}
```

### 步驟 2：激活視圖（重用 leaf）
```typescript
async activateView() {
    const { workspace } = this.app;
    
    // 🔑 關鍵：先檢查是否已存在
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    
    if (!leaf) {
        // 不存在才創建新的
        leaf = workspace.getRightLeaf(false); // false = 不分割
        await leaf.setViewState({
            type: VIEW_TYPE,
            active: true,
        });
    }
    
    // 顯示面板
    workspace.revealLeaf(leaf);
    
    return leaf;
}
```

**重點**：
- `getLeavesOfType()` 確保重用現有面板
- `getRightLeaf(false)` 中的 `false` 防止創建新分割

---

## 2. 在同一面板中切換檔案

### 自定義視圖類
```typescript
class MyCustomView extends ItemView {
    currentFile: TFile | null = null;
    
    getViewType() { return VIEW_TYPE; }
    getDisplayText() { return "My View"; }
    getIcon() { return "document"; }
    
    // 🔑 關鍵方法：setFile 允許切換檔案
    async setFile(file: TFile | null) {
        this.currentFile = file;
        
        const container = this.containerEl.children[1];
        container.empty(); // 清空舊內容
        
        if (!file) {
            container.createDiv({ text: 'No file selected' });
            return;
        }
        
        // 讀取並渲染
        const content = await this.app.vault.read(file);
        await MarkdownRenderer.render(
            this.app,
            content,
            container,
            file.path,
            this
        );
    }
}
```

### 從插件更新視圖
```typescript
async showFileInView(file: TFile) {
    const leaf = await this.activateView();
    const view = leaf.view as MyCustomView;
    await view.setFile(file);
}
```

---

## 3. 監聽 Canvas 節點點擊

### 方法：DOM 事件監聽

```typescript
setupCanvasListeners(leaf: WorkspaceLeaf) {
    const canvasView = leaf.view as any;
    
    // 等待 canvas 準備就緒
    if (!canvasView.canvas) {
        setTimeout(() => this.setupCanvasListeners(leaf), 100);
        return;
    }
    
    const canvas = canvasView.canvas;
    const canvasEl = canvasView.containerEl;
    
    const handleClick = () => {
        // 延遲執行，等待 Canvas 更新選擇
        setTimeout(() => {
            const selection = canvas.selection;
            
            if (selection.size === 1) {
                const node = Array.from(selection)[0];
                
                // 檢查是否為檔案節點
                if (node?.file instanceof TFile) {
                    void this.showFileInView(node.file);
                }
            }
        }, 50);
    };
    
    canvasEl.addEventListener('click', handleClick);
    
    // 🔑 記得清理
    this.register(() => {
        canvasEl.removeEventListener('click', handleClick);
    });
}
```

### 自動為所有 Canvas 設置監聽

```typescript
onload() {
    // 監聽新打開的 Canvas
    this.registerEvent(
        this.app.workspace.on('active-leaf-change', (leaf) => {
            if (leaf?.view.getViewType() === 'canvas') {
                this.setupCanvasListeners(leaf);
            }
        })
    );
    
    // 處理已打開的 Canvas
    this.app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view.getViewType() === 'canvas') {
            this.setupCanvasListeners(leaf);
        }
    });
}
```

---

## 4. 實現編輯功能

### 雙容器設計

```typescript
class MyCustomView extends ItemView {
    private previewContainer: HTMLElement;
    private editorContainer: HTMLElement;
    private editor: HTMLTextAreaElement;
    private isEditMode = false;
    
    async onOpen() {
        const container = this.containerEl.children[1];
        
        // 預覽容器
        this.previewContainer = container.createDiv({ 
            cls: 'my-preview' 
        });
        
        // 編輯器容器
        this.editorContainer = container.createDiv({ 
            cls: 'my-editor' 
        });
        this.editor = this.editorContainer.createEl('textarea');
        
        // 預設顯示預覽
        this.showPreview();
    }
    
    async setFile(file: TFile) {
        this.currentFile = file;
        const content = await this.app.vault.read(file);
        
        // 更新兩個容器
        this.editor.value = content;
        
        this.previewContainer.empty();
        await MarkdownRenderer.render(
            this.app,
            content,
            this.previewContainer,
            file.path,
            this
        );
    }
    
    showPreview() {
        this.editorContainer.style.display = 'none';
        this.previewContainer.style.display = 'block';
        this.isEditMode = false;
    }
    
    showEditor() {
        this.previewContainer.style.display = 'none';
        this.editorContainer.style.display = 'block';
        this.isEditMode = true;
    }
}
```

### 自動儲存

```typescript
class MyCustomView extends ItemView {
    private saveTimeout: number | null = null;
    
    setupEditor() {
        this.editor.addEventListener('input', () => {
            this.scheduleAutoSave();
        });
    }
    
    scheduleAutoSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = window.setTimeout(() => {
            void this.saveContent();
        }, 2000); // 2 秒後儲存
    }
    
    async saveContent() {
        if (!this.currentFile) return;
        
        const newContent = this.editor.value;
        await this.app.vault.modify(this.currentFile, newContent);
    }
    
    async onClose() {
        // 關閉前儲存
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        if (this.isEditMode && this.currentFile) {
            await this.saveContent();
        }
    }
}
```

---

## 5. Canvas API 使用

### 類型定義

```typescript
interface CanvasNode {
    file?: TFile;
    type?: string;
}

interface Canvas {
    selection: Set<CanvasNode>;
    select(node: CanvasNode): void;
    deselectAll(): void;
}

interface CanvasView extends ItemView {
    canvas: Canvas;
}
```

### 操作選擇

```typescript
// 獲取選中的節點
const selection = canvas.selection;
console.log(`選中 ${selection.size} 個節點`);

// 遍歷選中的節點
Array.from(selection).forEach(node => {
    if (node.file) {
        console.log('檔案節點:', node.file.path);
    }
});

// 程式化選擇
canvas.deselectAll();
canvas.select(someNode);
```

---

## 6. 常見陷阱與解決方案

### 陷阱 1：Canvas 未準備就緒
```typescript
// ❌ 錯誤
const canvas = canvasView.canvas; // 可能 undefined

// ✅ 正確
if (!canvasView.canvas) {
    setTimeout(() => this.setupCanvasListeners(leaf), 100);
    return;
}
```

### 陷阱 2：忘記清空容器
```typescript
// ❌ 錯誤：舊內容仍在 DOM 中
async setFile(file: TFile) {
    const div = container.createDiv();
    div.setText(content);
}

// ✅ 正確
async setFile(file: TFile) {
    container.empty(); // 先清空
    const div = container.createDiv();
    div.setText(content);
}
```

### 陷阱 3：創建多個 leaf
```typescript
// ❌ 錯誤：每次都創建新的
const leaf = workspace.getRightLeaf(true); // split=true

// ✅ 正確：重用現有的
const leaves = workspace.getLeavesOfType(VIEW_TYPE);
const leaf = leaves[0] || workspace.getRightLeaf(false);
```

### 陷阱 4：忘記清理事件
```typescript
// ❌ 錯誤：記憶體洩漏
element.addEventListener('click', handler);

// ✅ 正確
element.addEventListener('click', handler);
this.register(() => {
    element.removeEventListener('click', handler);
});
```

---

## 7. 完整範例流程

```typescript
export default class MyPlugin extends Plugin {
    private viewLeaf: WorkspaceLeaf | null = null;
    
    onload() {
        // 1. 註冊視圖
        this.registerView(VIEW_TYPE, (leaf) => new MyView(leaf));
        
        // 2. 添加命令
        this.addCommand({
            id: 'open-my-view',
            name: 'Open my view',
            callback: () => void this.activateView()
        });
        
        // 3. 監聽 Canvas
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf?.view.getViewType() === 'canvas') {
                    this.setupCanvasListeners(leaf);
                }
            })
        );
    }
    
    async activateView() {
        let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
        
        if (!leaf) {
            leaf = this.app.workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE, active: true });
        }
        
        this.viewLeaf = leaf;
        this.app.workspace.revealLeaf(leaf);
    }
    
    setupCanvasListeners(leaf: WorkspaceLeaf) {
        const canvasView = leaf.view as any;
        
        if (!canvasView.canvas) {
            setTimeout(() => this.setupCanvasListeners(leaf), 100);
            return;
        }
        
        const handleClick = () => {
            setTimeout(() => {
                const selection = canvasView.canvas.selection;
                if (selection.size === 1) {
                    const node = Array.from(selection)[0];
                    if (node?.file) {
                        void this.showFile(node.file);
                    }
                }
            }, 50);
        };
        
        canvasView.containerEl.addEventListener('click', handleClick);
        this.register(() => {
            canvasView.containerEl.removeEventListener('click', handleClick);
        });
    }
    
    async showFile(file: TFile) {
        if (!this.viewLeaf) {
            await this.activateView();
        }
        
        const view = this.viewLeaf?.view as MyView;
        await view.setFile(file);
    }
}
```

---

## 8. 調試技巧

### 檢查 Leaf 狀態
```typescript
console.log('所有 leaf:', this.app.workspace.getLeavesOfType(VIEW_TYPE));
console.log('Leaf 視圖類型:', leaf.view.getViewType());
console.log('Leaf 狀態:', leaf.getViewState());
```

### 檢查 Canvas 選擇
```typescript
console.log('選擇數量:', canvas.selection.size);
console.log('選中的節點:', Array.from(canvas.selection));
```

### 檢查檔案載入
```typescript
async setFile(file: TFile) {
    console.log('切換到檔案:', file.path);
    const content = await this.app.vault.read(file);
    console.log('檔案內容長度:', content.length);
}
```

---

## 快速檢查清單

開發時確認以下項目：

- [ ] 使用 `ItemView` 而非 `MarkdownView`
- [ ] 使用 `getLeavesOfType()` 檢查現有 leaf
- [ ] `getRightLeaf(false)` 使用 `false` 參數
- [ ] 實現 `setFile()` 方法切換檔案
- [ ] 在 `setFile()` 中呼叫 `container.empty()`
- [ ] 使用 `setTimeout` 等待 Canvas 準備
- [ ] 為事件監聽器註冊清理函數
- [ ] 在 `onClose()` 中清理資源
- [ ] 測試多次切換檔案
- [ ] 測試關閉並重新打開面板

---

**提示**：參考 `IMPLEMENTATION_RESEARCH.md` 獲取完整的技術細節和架構說明。
