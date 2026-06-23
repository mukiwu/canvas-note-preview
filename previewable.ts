export interface PreviewableFile {
	extension: string;
}

const PREVIEWABLE_EXTENSIONS = new Set(['md', 'canvas']);

export function isPreviewableFile(file: PreviewableFile | null | undefined): boolean {
	if (!file || typeof file.extension !== 'string') {
		return false;
	}
	return PREVIEWABLE_EXTENSIONS.has(file.extension);
}
