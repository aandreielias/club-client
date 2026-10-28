import { Node } from '@tiptap/core';

/**
 * A club record linked inside formatted text (mails): an inline chip that moves as one piece. Stored as
 * `<a data-ref="task:<id>">Titel</a>`; the server checks it and writes out the real title and link when the mail is sent.
 */
export const RecordRefNode = Node.create({
  name: 'recordRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return { kind: { default: null }, id: { default: null }, title: { default: '' } };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-ref]',
        getAttrs: (element) => {
          const ref = (element as HTMLElement).dataset.ref ?? '';
          const colon = ref.indexOf(':');
          return colon > 0 ? { kind: ref.slice(0, colon), id: ref.slice(colon + 1), title: element.textContent ?? '' } : false;
        },
      },
    ];
  },

  renderHTML({ node }) {
    return ['a', { 'data-ref': `${node.attrs.kind}:${node.attrs.id}`, class: 'record-ref' }, node.attrs.title];
  },

  renderText({ node }) {
    return node.attrs.title;
  },
});
