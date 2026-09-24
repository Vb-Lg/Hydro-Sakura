declare module '@hydrooj/ui-default' {
	export class AutoloadPage {
		constructor(name: string, callback: () => void);
	}

	export function addPage(page: AutoloadPage): void;
}
