/**
 * Mock for obsidian module in tests
 */

export function setIcon(el: HTMLElement, icon: string): void {
  // No-op in tests
}

export class TFile {
  path = '';
  name = '';
  stat = { size: 0, ctime: 0, mtime: 0 };
}

export class TFolder {
  path = '';
  name = '';
  children: Array<TFile | TFolder> = [];
}

export class Vault {
  getFiles(): TFile[] {
    return [];
  }

  getAbstractFileByPath(path: string): TFile | TFolder | null {
    return null;
  }

  async read(file: TFile): Promise<string> {
    return '';
  }
}

export class App {
  vault = new Vault();
}

export class ItemView {
  containerEl = document.createElement('div');
}

export class WorkspaceLeaf {
  view = new ItemView();
}

export class HoverPopover {
  close(): void {}
}

export const Platform = {
  isDesktop: true,
  isMobile: false,
};
