import { describe, it, expect } from 'vitest';
import { isPreviewableFile } from './previewable';

describe('isPreviewableFile', () => {
	it('rejects image files so they are never read as text (issue #1)', () => {
		expect(isPreviewableFile({ extension: 'png' })).toBe(false);
	});

	it('allows markdown notes', () => {
		expect(isPreviewableFile({ extension: 'md' })).toBe(true);
	});

	it('allows canvas files', () => {
		expect(isPreviewableFile({ extension: 'canvas' })).toBe(true);
	});

	it('rejects null or undefined without throwing', () => {
		expect(isPreviewableFile(null)).toBe(false);
		expect(isPreviewableFile(undefined)).toBe(false);
	});

	it('rejects other binary attachments that would blow up memory (issue #1)', () => {
		for (const ext of ['jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf', 'mp3', 'mp4']) {
			expect(isPreviewableFile({ extension: ext })).toBe(false);
		}
	});
});
