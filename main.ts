import { Plugin, WorkspaceLeaf, ItemView, TFile, MarkdownRenderer } from 'obsidian';

const VIEW_TYPE_NOTE_PREVIEW = "canvas-note-preview";

// Canvas 相關的介面定義
interface CanvasNode {
	file?: TFile;
	type?: string;
}

interface Canvas {
	selection: Set<CanvasNode>;
}

interface CanvasView extends ItemView {
	canvas: Canvas;
	containerEl: HTMLElement;
}

// 側邊欄預覽視圖
class NotePreviewView extends ItemView {
	currentFile: TFile | null = null;
	private isEditMode = false;
	private previewContainer: HTMLElement | null = null;
	private editorContainer: HTMLElement | null = null;
	private editor: HTMLTextAreaElement | null = null;
	private saveTimeout: number | null = null;
	private saveStatusEl: HTMLElement | null = null;
	private toggleBtn: HTMLButtonElement | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_NOTE_PREVIEW;
	}

	getDisplayText(): string {
		return "Note preview";
	}

	getIcon(): string {
		return "document";
	}

	onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('canvas-note-preview-container');

		const emptyState = container.createDiv({ cls: 'canvas-note-preview-empty' });
		emptyState.setText('Click a note in canvas to preview');

		return Promise.resolve();
	}

	async setFile(file: TFile | null) {
		this.currentFile = file;
		const container = this.containerEl.children[1];

		if (!container) {
			console.error('Container not found');
			return;
		}

		container.empty();

		if (!file) {
			const emptyState = container.createDiv({ cls: 'canvas-note-preview-empty' });
			emptyState.setText('Click a note in canvas to preview');
			this.isEditMode = false;
			return;
		}

		// 建立標題區
		const header = container.createDiv({ cls: 'canvas-note-preview-header' });
		header.createEl('h3', { text: file?.basename || 'Untitled' });

		// 建立按鈕容器
		const buttonContainer = header.createDiv({ cls: 'canvas-note-preview-buttons' });

		// 建立切換編輯/預覽按鈕
		this.toggleBtn = buttonContainer.createEl('button', { text: 'Edit' });
		this.toggleBtn.addClass('canvas-note-preview-toggle-btn');
		this.toggleBtn.onclick = () => {
			void this.toggleEditMode();
		};

		// 建立開啟按鈕
		const openButton = buttonContainer.createEl('button', { text: 'Open' });
		openButton.addClass('canvas-note-preview-open-btn');
		openButton.onclick = () => {
			void this.app.workspace.getLeaf(false).openFile(file);
		};

		// 建立儲存狀態指示器
		this.saveStatusEl = header.createDiv({ cls: 'canvas-note-preview-save-status' });
		this.updateSaveStatus('saved');

		// 建立預覽容器
		this.previewContainer = container.createDiv({ cls: 'canvas-note-preview-content' });

		// 建立編輯器容器
		this.editorContainer = container.createDiv({ cls: 'canvas-note-preview-editor' });
		this.editor = this.editorContainer.createEl('textarea', {
			cls: 'canvas-note-preview-textarea'
		});

		// 設置編輯器事件
		this.editor.addEventListener('input', () => {
			this.scheduleAutoSave();
		});

		// 讀取檔案內容
		try {
			const fileContent = await this.app.vault.read(file);

			// 更新編輯器內容
			this.editor.value = fileContent;

			// 渲染預覽
			await MarkdownRenderer.render(
				this.app,
				fileContent,
				this.previewContainer,
				file.path,
				this
			);

			// 預設顯示預覽模式
			this.showPreview();
		} catch (error) {
			if (this.previewContainer) {
				this.previewContainer.setText('Failed to load note content');
			}
			console.error('Error loading note:', error);
		}
	}

	async toggleEditMode() {
		this.isEditMode = !this.isEditMode;

		if (this.isEditMode) {
			this.showEditor();
		} else {
			await this.saveAndShowPreview();
		}
	}

	showEditor() {
		if (!this.previewContainer || !this.editorContainer || !this.editor || !this.toggleBtn) {
			return;
		}

		this.previewContainer.style.display = 'none';
		this.editorContainer.style.display = 'block';
		this.toggleBtn.setText('Preview');
		this.editor.focus();
	}

	showPreview() {
		if (!this.previewContainer || !this.editorContainer || !this.toggleBtn) {
			return;
		}

		this.editorContainer.style.display = 'none';
		this.previewContainer.style.display = 'block';
		this.toggleBtn.setText('Edit');
	}

	async saveAndShowPreview() {
		await this.saveContent();
		await this.refreshPreview();
		this.showPreview();
	}

	scheduleAutoSave() {
		this.updateSaveStatus('unsaved');

		if (this.saveTimeout) {
			window.clearTimeout(this.saveTimeout);
		}

		this.saveTimeout = window.setTimeout(() => {
			void this.saveContent();
		}, 2000);
	}

	async saveContent() {
		if (!this.currentFile || !this.editor) {
			return;
		}

		this.updateSaveStatus('saving');

		try {
			const newContent = this.editor.value;
			await this.app.vault.modify(this.currentFile, newContent);
			this.updateSaveStatus('saved');
		} catch (error) {
			console.error('Error saving file:', error);
			this.updateSaveStatus('error');
		}
	}

	async refreshPreview() {
		if (!this.previewContainer || !this.currentFile || !this.editor) {
			return;
		}

		this.previewContainer.empty();

		try {
			await MarkdownRenderer.render(
				this.app,
				this.editor.value,
				this.previewContainer,
				this.currentFile.path,
				this
			);
		} catch (error) {
			console.error('Error rendering preview:', error);
			this.previewContainer.setText('Failed to render preview');
		}
	}

	updateSaveStatus(status: 'saved' | 'saving' | 'unsaved' | 'error') {
		if (!this.saveStatusEl) {
			return;
		}

		this.saveStatusEl.removeClass('save-status-saved', 'save-status-saving', 'save-status-unsaved', 'save-status-error');

		switch (status) {
			case 'saved':
				this.saveStatusEl.setText('Saved');
				this.saveStatusEl.addClass('save-status-saved');
				break;
			case 'saving':
				this.saveStatusEl.setText('Saving...');
				this.saveStatusEl.addClass('save-status-saving');
				break;
			case 'unsaved':
				this.saveStatusEl.setText('Unsaved changes');
				this.saveStatusEl.addClass('save-status-unsaved');
				break;
			case 'error':
				this.saveStatusEl.setText('Save failed');
				this.saveStatusEl.addClass('save-status-error');
				break;
		}
	}

	async onClose() {
		// 清除定時器
		if (this.saveTimeout) {
			window.clearTimeout(this.saveTimeout);
		}

		// 如果在編輯模式且有未儲存的變更，先儲存
		if (this.isEditMode && this.currentFile && this.editor) {
			await this.saveContent();
		}
	}
}

export default class CanvasNotePreviewPlugin extends Plugin {
	private previewLeaf: WorkspaceLeaf | null = null;

	onload() {
		// 註冊自定義視圖
		this.registerView(
			VIEW_TYPE_NOTE_PREVIEW,
			(leaf) => new NotePreviewView(leaf)
		);

		// 添加開啟預覽面板的命令
		this.addCommand({
			id: 'open-note-preview',
			name: 'Open note preview panel',
			callback: () => {
				void this.activateView();
			}
		});

		// 監聽 Canvas 的互動事件
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (leaf?.view.getViewType() === 'canvas') {
					this.setupCanvasListeners(leaf);
				}
			})
		);

		// 如果啟動時已經有 Canvas 打開，立即設置監聽器
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.getViewType() === 'canvas') {
				this.setupCanvasListeners(leaf);
			}
		});
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_NOTE_PREVIEW);

		if (leaves.length > 0) {
			// 如果已經有預覽面板，就激活它
			leaf = leaves[0];
		} else {
			// 否則在右側邊欄建立新的預覽面板
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_NOTE_PREVIEW,
					active: true,
				});
			}
		}

		if (leaf) {
			this.previewLeaf = leaf;
			void workspace.revealLeaf(leaf);
		}
	}

	setupCanvasListeners(leaf: WorkspaceLeaf) {
		const canvasView = leaf.view as CanvasView;

		if (!canvasView.canvas) {
			// Canvas 還沒準備好，稍後再試
			setTimeout(() => this.setupCanvasListeners(leaf), 100);
			return;
		}

		const canvas = canvasView.canvas;

		// 使用 DOM 事件監聽點擊，而不是 canvas.on
		const canvasEl = canvasView.containerEl;

		const handleClick = (event: MouseEvent) => {
			// 等待一小段時間讓 Canvas 更新選擇狀態
			setTimeout(() => {
				const selection = canvas.selection;

				if (selection && selection.size === 1) {
					const node = Array.from(selection)[0];

					// 檢查是否為檔案節點
					if (node && node.file && node.file instanceof TFile) {
						void this.showNoteInPreview(node.file);
					}
				}
			}, 50);
		};

		canvasEl.addEventListener('click', handleClick);

		// 記錄清理函數
		this.register(() => {
			canvasEl.removeEventListener('click', handleClick);
		});
	}

	async showNoteInPreview(file: TFile) {
		// 如果預覽面板還沒打開，先打開它
		if (!this.previewLeaf) {
			await this.activateView();
		}

		// 更新預覽內容
		const view = this.previewLeaf?.view;
		if (view && view instanceof NotePreviewView) {
			await view.setFile(file);
		}
	}
}
