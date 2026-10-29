<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import { untrack } from 'svelte';
  import type { IconName } from '../icons';
  import { RecordDrag } from '../lib/records/RecordDrag';
  import { RefList } from '../lib/records/RefList.svelte';
  import { DROPPABLE } from '../lib/records/refs';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import Field from './Field.svelte';

  /**
   * Formatted text (mails, signatures): toolbar for bold, italic, underline, strike, heading, lists, quote, links; the usual
   * shortcuts (Ctrl/⌘+B, I, U, Z). `value` is HTML, '' when empty. With `records`, club records dragged in become linked chips
   * where they are dropped.
   */
  let {
    value = $bindable(''),
    label,
    placeholder = '',
    records = false,
    rows = 10,
  }: { value: string; label: string; placeholder?: string; records?: boolean; rows?: number } = $props();

  const KINDS = Object.keys(DROPPABLE);
  let element: HTMLDivElement | undefined = $state();
  let editor = $state.raw<Editor | null>(null);
  // Bumped on every change, so the toolbar re-reads which formats are active.
  let version = $state(0);

  // The editor's code loads with the first editor shown, not with the app.
  const loadEditor = () =>
    Promise.all([import('@tiptap/core'), import('@tiptap/starter-kit'), import('@tiptap/extensions'), import('../lib/richtext/RecordRefNode')]);

  $effect(() => {
    const target = element;
    if (!target) return;
    let instance: Editor | null = null;
    let cancelled = false;
    void loadEditor().then(([{ Editor }, { default: StarterKit }, { Placeholder }, { RecordRefNode }]) => {
      if (cancelled) return;
      instance = create(Editor, StarterKit, Placeholder, RecordRefNode, target);
      editor = instance;
    });
    return () => {
      cancelled = true;
      instance?.destroy();
      editor = null;
    };
  });

  type Modules = Awaited<ReturnType<typeof loadEditor>>;
  function create(
    EditorClass: Modules[0]['Editor'],
    StarterKit: Modules[1]['default'],
    Placeholder: Modules[2]['Placeholder'],
    RecordRefNode: Modules[3]['RecordRefNode'],
    target: HTMLElement,
  ): Editor {
    const instance: Editor = new EditorClass({
      element: target,
      content: untrack(() => value),
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          code: false,
          codeBlock: false,
          horizontalRule: false,
          link: {
            openOnClick: false,
            autolink: true,
            defaultProtocol: 'https',
            protocols: ['club'],
            HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
          },
        }),
        Placeholder.configure({ placeholder }),
        RecordRefNode,
      ],
      editorProps: {
        attributes: { class: 'rich-text prose', 'aria-label': label, 'aria-multiline': 'true', role: 'textbox', style: `--rows: ${rows}` },
        handleDOMEvents: {
          dragover: (_view, event) => {
            if (!records || !RecordDrag.carries(event, KINDS)) return false;
            event.preventDefault();
            event.dataTransfer!.dropEffect = 'copy';
            return true;
          },
        },
        handleDrop: (view, event) => {
          if (!records || !RecordDrag.carries(event, KINDS)) return false;
          event.preventDefault();
          event.stopPropagation(); // the surrounding form would attach it as well
          const record = RecordDrag.get(event);
          const ref = record && RefList.toRef(record);
          if (!ref) return true;
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
          instance
            .chain()
            .focus()
            .insertContentAt(at, [
              { type: 'recordRef', attrs: { kind: ref.kind.toLowerCase(), id: ref.id, title: ref.title } },
              { type: 'text', text: ' ' },
            ])
            .run();
          return true;
        },
      },
      onUpdate: ({ editor: e }) => (value = e.isEmpty ? '' : e.getHTML()),
      onTransaction: () => version++,
    });
    return instance;
  }

  // A new value from outside (signature swapped, draft loaded) replaces the content.
  $effect(() => {
    const next = value;
    const current = untrack(() => editor);
    if (!current) return;
    if (next === (current.isEmpty ? '' : current.getHTML())) return;
    current.commands.setContent(next, { emitUpdate: false });
  });

  const isActive = (name: string, attrs?: Record<string, unknown>): boolean => (void version, editor?.isActive(name, attrs) ?? false);

  interface Tool {
    icon: IconName;
    tooltip: string;
    active?: () => boolean;
    run: () => void;
  }
  const chain = () => editor!.chain().focus();
  const tools: (Tool | '|')[] = [
    { icon: 'bold', tooltip: 'Fett (Strg/⌘+B)', active: () => isActive('bold'), run: () => chain().toggleBold().run() },
    { icon: 'italic', tooltip: 'Kursiv (Strg/⌘+I)', active: () => isActive('italic'), run: () => chain().toggleItalic().run() },
    { icon: 'underline', tooltip: 'Unterstrichen (Strg/⌘+U)', active: () => isActive('underline'), run: () => chain().toggleUnderline().run() },
    { icon: 'strike', tooltip: 'Durchgestrichen', active: () => isActive('strike'), run: () => chain().toggleStrike().run() },
    '|',
    {
      icon: 'heading',
      tooltip: 'Überschrift',
      active: () => isActive('heading', { level: 2 }),
      run: () => chain().toggleHeading({ level: 2 }).run(),
    },
    { icon: 'bulletList', tooltip: 'Aufzählung', active: () => isActive('bulletList'), run: () => chain().toggleBulletList().run() },
    { icon: 'orderedList', tooltip: 'Nummerierte Liste', active: () => isActive('orderedList'), run: () => chain().toggleOrderedList().run() },
    { icon: 'quote', tooltip: 'Zitat', active: () => isActive('blockquote'), run: () => chain().toggleBlockquote().run() },
    '|',
    { icon: 'link', tooltip: 'Link einfügen oder ändern', active: () => isActive('link'), run: () => openLink() },
    { icon: 'clearFormat', tooltip: 'Formatierung entfernen', run: () => chain().unsetAllMarks().clearNodes().run() },
    '|',
    { icon: 'undo', tooltip: 'Rückgängig (Strg/⌘+Z)', run: () => chain().undo().run() },
    { icon: 'redo', tooltip: 'Wiederholen (Strg/⌘+Umschalt+Z)', run: () => chain().redo().run() },
  ];

  // Link dialog: the address of the link under the cursor, or a new one for the selected text.
  let linkOpen = $state(false);
  let linkHref = $state('');

  function openLink() {
    linkHref = (editor?.getAttributes('link').href as string | undefined) ?? '';
    linkOpen = true;
  }

  /** "verein.at" → https://, "a@b.at" → mailto:; http(s) and mailto stay. */
  function normalized(href: string): string {
    const text = href.trim();
    if (/^(https?:|mailto:)/i.test(text)) return text;
    return text.includes('@') && !text.includes('/') ? `mailto:${text}` : `https://${text}`;
  }

  function applyLink(event: SubmitEvent) {
    event.preventDefault();
    linkOpen = false;
    if (!editor) return;
    if (!linkHref.trim()) return void chain().extendMarkRange('link').unsetLink().run();
    const href = normalized(linkHref);
    if (editor.state.selection.empty && !isActive('link')) {
      chain()
        .insertContent({ type: 'text', text: linkHref.trim(), marks: [{ type: 'link', attrs: { href } }] })
        .run();
    } else chain().extendMarkRange('link').setLink({ href }).run();
  }
</script>

<div class="editor">
  <div class="toolbar" role="toolbar" aria-label="Formatierung">
    {#each tools as tool, i (i)}
      {#if tool === '|'}<span class="divider" aria-hidden="true"></span>
      {:else}
        <Button
          size="sm"
          variant="ghost"
          icon={tool.icon}
          tooltip={tool.tooltip}
          pressed={tool.active?.()}
          disabled={!editor}
          onmousedown={(e: MouseEvent) => e.preventDefault()}
          onclick={tool.run}
        />
      {/if}
    {/each}
  </div>
  <div class="area" bind:this={element}></div>
</div>

<Dialog open={linkOpen} title="Link" onclose={() => (linkOpen = false)}>
  <form class="stack" onsubmit={applyLink}>
    <Field label="Adresse" hint="Webseite oder E-Mail-Adresse; leer entfernt den Link.">
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={linkHref} autofocus autocomplete="off" />
    </Field>
    <div class="row">
      <Button type="submit" variant="primary">Übernehmen</Button>
      <Button variant="ghost" onclick={() => (linkOpen = false)}>Abbrechen</Button>
    </div>
  </form>
</Dialog>

<style>
  .editor {
    display: grid;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-field);
    box-shadow: var(--color-shadow-raised);
    transition:
      border-color var(--motion-fast),
      box-shadow var(--motion-fast);
  }
  .editor:hover {
    border-color: var(--color-border-strong);
  }
  .editor:focus-within {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xxs);
    padding: var(--space-xxs);
    border-bottom: 1px solid var(--color-border);
  }
  .divider {
    width: 1px;
    height: 1.25rem;
    margin: 0 var(--space-xxs);
    background: var(--color-border);
  }
  .area :global(.rich-text) {
    min-height: calc(var(--rows) * 1.5em);
    padding: var(--space-sm) var(--control-padding-x);
    outline: none;
    overflow-wrap: anywhere;
  }
  .area :global(.rich-text > :first-child) {
    margin-top: 0;
  }
  .area :global(.rich-text p) {
    margin: 0 0 var(--space-xs);
  }
  .area :global(.rich-text blockquote) {
    margin: var(--space-xs) 0;
    padding-left: var(--space-sm);
    border-left: 3px solid var(--color-border-strong);
    color: var(--color-text-muted);
  }
  .area :global(.rich-text p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    height: 0;
    color: var(--color-text-faint);
    pointer-events: none;
  }
  .area :global(.record-ref) {
    padding: 0 var(--space-xxs);
    border-radius: var(--radius-sm);
    background: var(--color-accent-soft);
    color: inherit;
    text-decoration: none;
    white-space: nowrap;
  }
  .area :global(.record-ref.ProseMirror-selectednode) {
    outline: 2px solid var(--color-accent);
  }
</style>
