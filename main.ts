import { Plugin, WorkspaceLeaf, ItemView, TFile, Notice, MarkdownRenderer } from 'obsidian';

const VIEW_TYPE_NOTE_PREVIEW = "canvas-note-preview";

// 側邊欄預覽視圖
class NotePreviewView extends ItemView {
	currentFile: TFile | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_NOTE_PREVIEW;
	}

	getDisplayText(): string {
		return "Note Preview";
	}

	getIcon(): string {
		return "document";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('canvas-note-preview-container');

		const emptyState = container.createDiv({ cls: 'canvas-note-preview-empty' });
		emptyState.setText('Click a note in Canvas to preview');
	}

	async setFile(file: TFile | null) {
		this.currentFile = file;
		const container = this.containerEl.children[1];
		container.empty();

		if (!file) {
			const emptyState = container.createDiv({ cls: 'canvas-note-preview-empty' });
			emptyState.setText('Click a note in Canvas to preview');
			return;
		}

		// 建立標題區
		const header = container.createDiv({ cls: 'canvas-note-preview-header' });
		const title = header.createEl('h3', { text: file.basename });

		// 建立開啟按鈕
		const openButton = header.createEl('button', { text: 'Open' });
		openButton.addClass('canvas-note-preview-open-btn');
		openButton.onclick = () => {
			this.app.workspace.getLeaf(false).openFile(file);
		};

		// 建立內容區
		const content = container.createDiv({ cls: 'canvas-note-preview-content' });

		try {
			const fileContent = await this.app.vault.read(file);

			// 使用 MarkdownRenderer.render 而不是 renderMarkdown
			// 這個方法會正確處理內部連結、圖片嵌入等
			await MarkdownRenderer.render(
				this.app,
				fileContent,
				content,
				file.path,
				this
			);

			console.log('Markdown rendered successfully for:', file.path);
		} catch (error) {
			content.setText('Failed to load note content');
			console.error('Error loading note:', error);
		}
	}

	async onClose() {
		// Cleanup
	}
}

export default class CanvasNotePreviewPlugin extends Plugin {
	private previewLeaf: WorkspaceLeaf | null = null;

	async onload() {
		console.log('Loading Canvas Note Preview plugin');

		// 註冊自定義視圖
		this.registerView(
			VIEW_TYPE_NOTE_PREVIEW,
			(leaf) => new NotePreviewView(leaf)
		);

		// 添加開啟預覽面板的命令
		this.addCommand({
			id: 'open-note-preview',
			name: 'Open Note Preview Panel',
			callback: () => {
				this.activateView();
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

		// 添加樣式
		this.addStyles();

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
			workspace.revealLeaf(leaf);
		}
	}

	setupCanvasListeners(leaf: WorkspaceLeaf) {
		const canvasView = leaf.view as any;

		if (!canvasView.canvas) {
			// Canvas 還沒準備好，稍後再試
			setTimeout(() => this.setupCanvasListeners(leaf), 100);
			return;
		}

		const canvas = canvasView.canvas;
		console.log('Canvas setup, canvas object:', canvas);

		// 使用 DOM 事件監聽點擊，而不是 canvas.on
		const canvasEl = canvasView.containerEl;

		const handleClick = async (event: MouseEvent) => {
			console.log('Canvas clicked');

			// 等待一小段時間讓 Canvas 更新選擇狀態
			setTimeout(() => {
				const selection = canvas.selection;
				console.log('Selection:', selection, 'Size:', selection?.size);

				if (selection && selection.size === 1) {
					const node: any = Array.from(selection)[0];
					console.log('Selected node:', node);

					// 檢查是否為檔案節點
					if (node && node.file && node.file instanceof TFile) {
						console.log('Opening file in preview:', node.file.path);
						this.showNoteInPreview(node.file);
					} else {
						console.log('Node type:', node?.type, 'Has file:', !!node?.file);
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

	addStyles() {
		const style = document.createElement('style');
		style.textContent = `
			.canvas-note-preview-container {
				padding: 20px;
				height: 100%;
				overflow-y: auto;
			}

			.canvas-note-preview-empty {
				display: flex;
				align-items: center;
				justify-content: center;
				height: 100%;
				color: var(--text-muted);
				font-size: 14px;
			}

			.canvas-note-preview-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 20px;
				padding-bottom: 10px;
				border-bottom: 1px solid var(--background-modifier-border);
			}

			.canvas-note-preview-header h3 {
				margin: 0;
				font-size: 18px;
			}

			.canvas-note-preview-open-btn {
				padding: 4px 12px;
				font-size: 12px;
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				border: none;
				border-radius: 4px;
				cursor: pointer;
			}

			.canvas-note-preview-open-btn:hover {
				background: var(--interactive-accent-hover);
			}

			.canvas-note-preview-content {
				font-size: 14px;
				line-height: 1.6;
			}

			.canvas-note-preview-content h1,
			.canvas-note-preview-content h2,
			.canvas-note-preview-content h3 {
				margin-top: 1.5em;
				margin-bottom: 0.5em;
			}

			.canvas-note-preview-content p {
				margin-bottom: 1em;
			}

			.canvas-note-preview-content ul,
			.canvas-note-preview-content ol {
				margin-left: 1.5em;
				margin-bottom: 1em;
			}

			.canvas-note-preview-content code {
				background: var(--code-background);
				padding: 2px 4px;
				border-radius: 3px;
				font-family: var(--font-monospace);
			}

			.canvas-note-preview-content pre {
				background: var(--code-background);
				padding: 10px;
				border-radius: 5px;
				overflow-x: auto;
			}
		`;
		document.head.appendChild(style);
	}

	onunload() {
		console.log('Unloading Canvas Note Preview plugin');
	}
}
