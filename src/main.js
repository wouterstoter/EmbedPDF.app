import EmbedPDF from '@embedpdf/snippet';
import './style.css';

if (window.matchMedia) {
  const detectColorScheme = () => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.querySelector('link[rel="manifest"]').href = "manifest-dark.json";
      document.querySelector('meta[name="theme-color"]').content = "#374151";
      document.body.style.backgroundColor = "#374151";
    } else {
      document.querySelector('link[rel="manifest"]').href = "manifest.json";
      document.querySelector('meta[name="theme-color"]').content = "#f1f3f5";
      document.body.style.backgroundColor = "#f1f3f5";
    }
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', detectColorScheme);
  detectColorScheme();
}

const viewer = EmbedPDF.init({
  type: 'container',
  target: document.getElementById('app'),
  worker: true,
  tabBar: 'always',
  theme: {
    preference: 'system'
  },
  wasmUrl: (new URL('./pdfium.wasm',document.location.href)).href,
  stamp: {manifests: [{ url: '/default-stamps/en/manifest.json' }] },
  fontFallback: null,
  fonts: { ui: null, signature: null },
  documentManager: {maxDocuments: Infinity}
})
const registry = await viewer.registry;
const docManager = registry.getPlugin('document-manager')?.provides();
const commands = registry.getPlugin('commands')?.provides();
const ui = registry.getPlugin('ui')?.provides();
const exportPlugin = registry.getPlugin('export')?.provides();

let fileHandles = {};
async function open(file) {
  let id = Math.random().toString(36).replace('0.','');
  while (id in fileHandles) id = Math.random().toString(36).replace('0.','');
  if (file instanceof DataTransferItem) {
    if (file.kind != "file") return;
    file.getAsFileSystemHandle?.().then(handle => fileHandles[id] = handle);
    file = await file.getAsFile();
  }
  if (file instanceof FileSystemFileHandle) {
    fileHandles[id] = file;
    file = await file.getFile();
  }
  if (!(file instanceof File) || file.type != "application/pdf") return;
  docManager.openDocumentBuffer({
    buffer: await file.arrayBuffer(),
    name: file.name,
    documentId: id,
    autoActivate: true
  })
}
async function save(id) {
  id = id || docManager.getActiveDocumentId();
  let fileHandle = fileHandles[id];
  if (!fileHandle) return saveAs(id);
  const writable = await fileHandle.createWritable();
  const contents = await exportPlugin.forDocument(id).saveAsCopy().toPromise();
  await writable.write(contents);
  await writable.close();
}
async function saveAs(id) {
  id = id || docManager.getActiveDocumentId();
  let name = docManager.getDocumentState(id).name;
  if (window.showSaveFilePicker) {
    fileHandles[id] = await window.showSaveFilePicker({
      id: "embedPDF",
      suggestedName: name,
      types: [{accept: { "application/pdf": [".pdf"] }}],
    });
    return save(id);
  } else {
    exportPlugin.forDocument(id).download();
  }
}
docManager.onDocumentClosed((id) => {
  delete fileHandles[id];
});
docManager.onActiveDocumentChanged(e => {
  if (e.currentDocumentId) {
    document.querySelector("#app").style.paddingTop = "0";
  } else {
    document.querySelector("#app").style.paddingTop = "";
  }
});

if ("launchQueue" in window) {
  window.launchQueue.setConsumer((launchParams) => {
    if (launchParams.files) launchParams.files.forEach(open)
  });
}

window.addEventListener("dragover", (e) => {
  const fileItems = [...e.dataTransfer.items].filter(
    (item) => item.kind === "file",
  );
  if (fileItems.length > 0) {
    e.preventDefault();
    if (fileItems.some((item) => item.type == "application/pdf")) {
      e.dataTransfer.dropEffect = "copy";
    } else {
      e.dataTransfer.dropEffect = "none";
    }
  }
});
window.addEventListener("drop", (e) => {
  const fileItems = [...e.dataTransfer.items].filter(
    (item) => item.kind === "file",
  );
  if (fileItems.length > 0) {
    e.preventDefault();
    fileItems.forEach(open);
  }
});

viewer.registerIcons({
  customSave: {
    viewBox: '60 -900 840 840',
    paths: [
      {
        d: 'M820-671.54v459.23Q820-182 799-161q-21 21-51.31 21H212.31Q182-140 161-161q-21-21-21-51.31v-535.38Q140-778 161-799q21-21 51.31-21h459.23L820-671.54ZM760-646 646-760H212.31q-5.39 0-8.85 3.46t-3.46 8.85v535.38q0 5.39 3.46 8.85t8.85 3.46h535.38q5.39 0 8.85-3.46t3.46-8.85V-646ZM550.77-298.46Q580-327.69 580-369.23q0-41.54-29.23-70.77-29.23-29.23-70.77-29.23-41.54 0-70.77 29.23Q380-410.77 380-369.23q0 41.54 29.23 70.77 29.23 29.23 70.77 29.23 41.54 0 70.77-29.23ZM255.39-564.62h328.45v-139.99H255.39v139.99ZM200-646v446-560 114Z',
        fill: 'currentColor',
        stroke: 'none',
      },
    ],
  },
  customSaveAs: {
    viewBox: '60 -900 840 840',
    paths: [
      {
        d: 'M212.31-140q-29.92 0-51.12-21.19Q140-182.39 140-212.31v-535.38q0-29.92 21.19-51.12Q182.39-820 212.31-820h459.23L820-671.54v196.62q-14.39-5.7-29.69-7.23-15.31-1.54-30.31.3v-164.77L646.62-760H212.31q-5.39 0-8.85 3.46t-3.46 8.85v535.38q0 5.39 3.46 8.85t8.85 3.46h224.61v60H212.31ZM200-760v560-560ZM524.62-60v-105.69l217.15-216.16q7.46-7.46 16.15-10.5 8.69-3.03 17.39-3.03 9.3 0 18.19 3.53 8.88 3.54 15.96 10.62l37 37.38q6.46 7.47 10 16.16Q860-319 860-310.31t-3.23 17.69q-3.23 9-10.31 16.46L630.31-60H524.62Zm287.69-250.31-37-37.38 37 37.38Zm-240 202.62h38l129.84-130.47-18.38-19-18.62-18.76-130.84 130.23v38Zm149.46-149.47-18.62-18.76 37 37.76-18.38-19ZM255.39-564.62h328.45v-139.99H255.39v139.99ZM480-269.23q4.08 0 7.77-.77 3.69-.77 7.38-2.69l81.39-80.39q1.92-4.3 2.69-7.88t.77-8.27q0-41.54-29.23-70.77-29.23-29.23-70.77-29.23-41.54 0-70.77 29.23Q380-410.77 380-369.23q0 41.54 29.23 70.77 29.23 29.23 70.77 29.23Z',
        fill: 'currentColor',
        stroke: 'none',
      },
    ],
  },
});

commands.registerCommand({
  id: 'custom.save',
  label: 'Save',
  icon: 'customSave',
  shortcuts: ['ctrl+s','meta+s'],
  action: e => save(e.documentId),
});
commands.registerCommand({
  id: 'custom.saveAs',
  label: 'Save As',
  icon: 'customSaveAs',
  shortcuts: ['ctrl+shift+s','meta+shift+s'],
  action: e => saveAs(e.documentId),
});

const currentSchema = ui.getSchema();
const mainToolbar = currentSchema.toolbars['main-toolbar'];
if (mainToolbar) {
  const items = structuredClone(mainToolbar.items);
  const rightGroup = items.find((item) => item.id === 'right-group');


  if (rightGroup && Array.isArray(rightGroup.items)) {
    rightGroup.items.push({
      type: 'command-button',
      id: 'save-button',
      commandId: 'custom.save',
      variant: 'icon',
    });
  }
  ui.mergeSchema({
    toolbars: {
      'main-toolbar': {
        ...mainToolbar,
        items,
      },
    },
  });
}

const documentMenu = currentSchema.menus['document-menu'];
if (window.showSaveFilePicker && documentMenu) {
  ui.mergeSchema({
    menus: {
      'document-menu': {
        ...documentMenu,
        items: [
          ...documentMenu.items,
          { type: 'divider', id: 'custom-divider' },
          { type: 'command', id: 'save-button', commandId: 'custom.save' },
          { type: 'command', id: 'saveAs-button', commandId: 'custom.saveAs' },
        ],
      },
    },
  });
}

let host = document.querySelector("#app").children[0];
const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  /* selectors here are guesses: inspect the real class names */
  [data-epdf] {
    min-height: env(titlebar-area-height, 0);
  }
  [data-epdf] > :first-child {
    app-region: drag;
    padding-left: env(titlebar-area-x, 0);
  }
  [data-epdf] > :first-child > :first-child {
    padding-right: calc(100% - env(titlebar-area-x, 0) - env(titlebar-area-width, 100%))
  }
  [data-epdf] > :first-child > :first-child > * {
    app-region: no-drag;
  }
`);
host.shadowRoot.adoptedStyleSheets = [...host.shadowRoot.adoptedStyleSheets, sheet];