"use client";

import { useEffect } from "react";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Undo2,
  UnderlineIcon,
  Unlink,
} from "lucide-react";

const editorButtonClass = (active = false) =>
  `inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition ${
    active
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
  }`;

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={editorButtonClass(active)}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TiptapToolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl || "");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({
        href: url.trim(),
        target: "_blank",
        rel: "noopener noreferrer",
      })
      .run();
  };

  const addImage = () => {
    const src = window.prompt("Image URL");
    if (!src?.trim()) return;
    const alt = window.prompt("Alt text") || "";
    editor.chain().focus().setImage({ src: src.trim(), alt }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
      <ToolbarButton label="Paragraph" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()}>
        <Pilcrow className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <ToolbarButton label="Add link" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Remove link" disabled={!editor.isActive("link")} onClick={() => editor.chain().focus().unsetLink().run()}>
        <Unlink className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Add image" onClick={addImage}>
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export default function TiptapArticleEditor({
  html,
  onChange,
}: {
  html: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      ImageExtension.configure({
        HTMLAttributes: {
          loading: "lazy",
          decoding: "async",
        },
      }),
      Placeholder.configure({
        placeholder: "Generate an article, then edit it here.",
      }),
    ],
    content: html,
    editorProps: {
      attributes: {
        class:
          "min-h-[360px] max-h-[420px] overflow-auto bg-white px-4 py-4 text-sm leading-7 text-slate-700 outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (html !== editor.getHTML()) {
      editor.commands.setContent(html || "", { emitUpdate: false });
    }
  }, [editor, html]);

  if (!editor) {
    return (
      <div className="mt-3 min-h-[360px] rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_figure]:my-5 [&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-slate-950 [&_.ProseMirror_h3]:mt-5 [&_.ProseMirror_h3]:text-sm [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-slate-950 [&_.ProseMirror_img]:max-h-80 [&_.ProseMirror_img]:w-full [&_.ProseMirror_img]:rounded-xl [&_.ProseMirror_img]:object-cover [&_.ProseMirror_li]:ml-5 [&_.ProseMirror_li]:list-disc [&_.ProseMirror_p]:my-3">
      <TiptapToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
