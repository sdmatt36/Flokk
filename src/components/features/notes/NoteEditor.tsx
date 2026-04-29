"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Loader2, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export type TiptapDoc = JSONContent;

export function emptyDoc(): TiptapDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function NoteEditor({
  initialContent,
  onSave,
  placeholder = "Start typing...",
  autoFocus = false,
}: {
  initialContent: TiptapDoc;
  onSave: (content: TiptapDoc) => Promise<boolean>;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        style: [
          "color: #1B3A5C",
          "font-family: 'DM Sans', 'Plus Jakarta Sans', sans-serif",
          "font-size: 14px",
          "line-height: 1.6",
          "min-height: 60px",
          "padding: 10px 12px",
          "outline: none",
        ].join(";"),
      },
    },
    onUpdate: ({ editor }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setStatus("saving");
      debounceRef.current = setTimeout(async () => {
        const ok = await onSave(editor.getJSON() as TiptapDoc);
        setStatus(ok ? "saved" : "error");
        if (ok) {
          setTimeout(() => setStatus((prev) => (prev === "saved" ? "idle" : prev)), 2000);
        }
      }, 500);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!editor) return null;

  const btnBase: React.CSSProperties = {
    padding: "4px 7px",
    fontSize: "12px",
    border: "1px solid",
    borderRadius: "4px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    background: "none",
  };

  const btn = (active: boolean): React.CSSProperties => ({
    ...btnBase,
    color: active ? "#fff" : "#1B3A5C",
    backgroundColor: active ? "#C4664A" : "transparent",
    borderColor: active ? "#C4664A" : "rgba(27,58,92,0.2)",
  });

  return (
    <div style={{
      border: "1px solid rgba(27,58,92,0.15)",
      borderRadius: "8px",
      backgroundColor: "#fff",
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        gap: "4px",
        padding: "6px 8px",
        borderBottom: "1px solid rgba(27,58,92,0.08)",
        alignItems: "center",
      }}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={btn(editor.isActive("bold"))} aria-label="Bold">
          <Bold size={12} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={btn(editor.isActive("italic"))} aria-label="Italic">
          <Italic size={12} />
        </button>
        <div style={{ width: "1px", height: "16px", backgroundColor: "rgba(27,58,92,0.1)", margin: "0 4px" }} />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={btn(editor.isActive("bulletList"))} aria-label="Bullet list">
          <List size={12} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btn(editor.isActive("orderedList"))} aria-label="Numbered list">
          <ListOrdered size={12} />
        </button>

        {/* Save status indicator */}
        <div style={{ marginLeft: "auto", fontSize: "11px", color: "#888", display: "flex", alignItems: "center", gap: "4px" }}>
          {status === "saving" && (
            <>
              <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
              <span>Saving...</span>
            </>
          )}
          {status === "saved" && (
            <>
              <Check size={11} style={{ color: "#5a8a6a" }} />
              <span style={{ color: "#5a8a6a" }}>Saved</span>
            </>
          )}
          {status === "error" && (
            <span style={{ color: "#C4664A" }}>Save failed</span>
          )}
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
