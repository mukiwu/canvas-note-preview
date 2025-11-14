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
		container.empty();

		if (!file) {
			const emptyState = container.createDiv({ cls: 'canvas-note-preview-empty' });
			emptyState.setText('Click a note in canvas to preview');
			return;
		}

		// 建立標題區
		const header = container.createDiv({ cls: 'canvas-note-preview-header' });
		header.createEl('h3', { text: file.basename });

		// 建立開啟按鈕
		const openButton = header.createEl('button', { text: 'Open' });
		openButton.addClass('canvas-note-preview-open-btn');
		openButton.onclick = () => {
			void this.app.workspace.getLeaf(false).openFile(file);
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
