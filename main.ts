import {
	AbstractInputSuggest,
	App,
	IconName,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile
} from "obsidian";
import {v4 as uuidv4} from "uuid";

class PinnedNote {
	id: number;
	icon: IconName;
	path: string;
	title: string;


	constructor(
		title: string,
		path: string,
		icon: IconName
	) {
		this.id = uuidv4()
		this.icon = icon;
		this.path = path;
		this.title = title;
	}
}

export interface IPinnedNotesPluginSettings {
	pinnedNotes: PinnedNote[]
}

const DEFAULT_SETTINGS: IPinnedNotesPluginSettings = {
	pinnedNotes: []
}

export default class PinnedNotesPlugin extends Plugin {
	settings: IPinnedNotesPluginSettings
	ribbonIcons: HTMLElement[]

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SettingTab(this.app, this))
	}

	async addPinnedNote(note: PinnedNote) {
		this.settings.pinnedNotes.push(note)
		await this.saveSettings()
		await this.loadSettings()
	}

	async removePinnedNote(noteId: number) {
		const noteIndex = this.settings.pinnedNotes.findIndex((note) => note.id === noteId)
		delete this.settings.pinnedNotes[noteIndex]
		this.settings.pinnedNotes.splice(noteIndex, 1)
		await this.saveSettings()
		await this.loadSettings()
	}


	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.ribbonIcons?.forEach((ribbonIcon, index) => {
			ribbonIcon.remove()
			delete this.ribbonIcons[index]
		})
		this.ribbonIcons = this.settings.pinnedNotes.map((note) =>
			this.addRibbonIcon(
				note.icon === "" ? "file" : note.icon,
				note.title,
				async (e) => {
					await this.app.workspace.openLinkText(note.path, "")
				}
			)
		)
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SettingTab extends PluginSettingTab {
	plugin: PinnedNotesPlugin

	constructor(app: App, plugin: PinnedNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const {containerEl} = this;
		containerEl.empty()
		let isCanBeAddedNewNote = true
		let title = ""
		let path = ""
		let icon: IconName = ""
		let changedTitle: string | undefined;
		let changedPath: string | undefined;
		let changedIcon: string | undefined;
		const addNoteButton = new Setting(containerEl)
			.setName("Add pinned note")
			.setDesc("Provide: 1) file's name that will be displayed on hover 2) path to this file, e.g Folder1/File1 3) Icon name from lucide.dev; if icon won't be provided, default icon \"file\" will be placed instead. RESTART OBSIDIAN AFTER CHANGES")
		isCanBeAddedNewNote && addNoteButton
			.addButton((button) => {
				button.setIcon("plus").onClick(
					() => {
						isCanBeAddedNewNote = false
						this.display()
						new Setting(containerEl)
							.setName("File")
							.addText((text) => text
								.setPlaceholder("Title")
								.onChange((value) => title = value)
							)
							.addText((text) => {
								new FileSuggest(this.app, text.inputEl);
									text
										.setPlaceholder("Path")
										.onChange((value) => path = value)
								}
							)
							.addText((text) => text
								.setPlaceholder("Icon(optional)")
								.onChange((value) => icon = value)
							)
							.addButton((button) => button.setIcon("save").onClick(
								async () => {
									if (title.length !== 0 && path.length !== 0) {
										await this.plugin.addPinnedNote(new PinnedNote(title, path, icon))
										isCanBeAddedNewNote = true
										this.display()
									}
									else {
										new Notice("Provide title and path")
									}
								}
							))
					}
				)
			})

		this.plugin.settings.pinnedNotes.forEach((note, index) => {
			new Setting(containerEl)
				.setName("File " + (index + 1))
				.addText((text) => text
					.setPlaceholder("Title")
					.setValue(note.title)
					.onChange(async (value) => {
						changedTitle = value;
					})
				)
				.addText((text) => {
					new FileSuggest(this.app, text.inputEl)
					text
						.setPlaceholder("Path")
						.setValue(note.path)
						.onChange(async (value) => {
							changedPath = value;
						})
					}
				)
				.addText((text) => text
					.setPlaceholder("Icon(optional)")
					.setValue(note.icon)
					.onChange(async (value) => {
						changedIcon = value;
					})
				)
				.addButton((button) => button.setIcon("save").onClick(
					async () => {
						if (
							(changedTitle === undefined || changedTitle === note.title) &&
							(changedPath === undefined || changedPath === note.path) &&
							(changedIcon === undefined || changedIcon === note.icon)
						) {
							new Notice("Provide any data")
							return;
						}
						if (changedTitle !== undefined) {
							if (changedTitle.length !== 0) {
								note.title = changedTitle
								changedTitle = undefined
							}
							else new Notice("Provide title")
						}
						if (changedPath !== undefined) {
							if (changedPath.length !== 0) {
								note.path = changedPath
								changedPath = undefined
							}
							else new Notice("Provide path")
						}
						if (changedIcon !== undefined) {
							note.icon = changedIcon
							changedIcon = undefined
						}

						await this.plugin.saveSettings()
						await this.plugin.loadSettings()
						this.display()
					})
				)
				.addButton((button) => button.setIcon("trash-2").setWarning().onClick(
					async () => {
						await this.plugin.removePinnedNote(note.id);
						this.display()
					}
				))
		})
	}
}

export class FileSuggest extends AbstractInputSuggest<TFile> {
	textInputEl: HTMLInputElement;

	getSuggestions(inputStr: string): TFile[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const files: TFile[] = [];
		const inputLower = inputStr.toLowerCase();

		abstractFiles.forEach((file: TAbstractFile) => {
			if (
				file instanceof TFile && ["md", "canvas"].contains(file.extension) &&
				file.path.toLowerCase().contains(inputLower)
			) {
				files.push(file);
			}
		});
		return files;
	}

	renderSuggestion(file: TFile, el: HTMLElement) {
		if (file.extension == "md") {
			el.setText(trimFile(file));
		}
		else {
			//we don't use trimFile here as the extension isn't displayed here
			el.setText(file.path.slice(0, -7))
			el.insertAdjacentHTML(
				"beforeend",
				`<div class="nav-file-tag" style="display:inline-block;vertical-align:middle">canvas</div>`
			);
		}
	}

	selectSuggestion(file: TFile) {
		this.textInputEl.value = trimFile(file);
		this.textInputEl.trigger("input");
		this.close();
	}
}

export function trimFile(file: TFile): string {
	if (!file) return "";
	return file.extension == "md" ? file.path.slice(0, -3): file.path;
}
