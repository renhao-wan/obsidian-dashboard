import { Vault, TFile } from 'obsidian';

export class Storage {
  constructor(private vault: Vault) {}

  async readFile(path: string): Promise<string> {
    const file = this.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      return await this.vault.read(file);
    }
    throw new Error(`File not found: ${path}`);
  }

  async writeFile(path: string, content: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.vault.modify(file, content);
    } else {
      await this.vault.create(path, content);
    }
  }

  async fileExists(path: string): Promise<boolean> {
    return this.vault.getAbstractFileByPath(path) !== null;
  }
}
