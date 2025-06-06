"use client"

import { useEffect, useState, useRef } from "react"
import Editor, { useMonaco } from "@monaco-editor/react"
import { Loader2, Save, Copy, FileCode2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { editor } from 'monaco-editor'
import { fetchFileContent, saveOrCreateFileContent } from "@/lib/worker-config"
import { FileContent, FileType } from "@/types/types"

interface CodeEditorProps {
  file: FileType
  containerId: string
}

export function CodeEditor({ file, containerId }: CodeEditorProps) {
  const [mounted, setMounted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [language, setLanguage] = useState("")
  const [lineCount, setLineCount] = useState(0)
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [themeReady, setThemeReady] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monaco = useMonaco()

  const [editorContent, setEditorContent] = useState<FileContent>()
  const [originalContent, setOriginalContent] = useState<FileContent>()

  useEffect(() => {
    const fetchContent = async () => {
      if (!file || !containerId) return;

      setIsLoading(true);
      try {
        const data = await fetchFileContent(containerId, file.path);
        setEditorContent(data);
        setOriginalContent(data);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching file content:", error);
        setEditorContent({
          fileName: "",
          fileDir: "",
          fileType: "",
          fileContent: "",
          success: false,
        });
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [file, containerId]);

  // Configure Monaco editor theme before mounting
  useEffect(() => {
    if (monaco) {
      // Define custom theme with better syntax highlighting
      monaco.editor.defineTheme("premium-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "6A9955", fontStyle: "italic" },
          { token: "keyword", foreground: "C586C0" },
          { token: "string", foreground: "CE9178" },
          { token: "number", foreground: "B5CEA8" },
          { token: "regexp", foreground: "D16969" },
          { token: "type", foreground: "4EC9B0" },
          { token: "class", foreground: "4EC9B0" },
          { token: "function", foreground: "DCDCAA" },
          { token: "variable", foreground: "9CDCFE" },
          { token: "variable.predefined", foreground: "4FC1FF" },
          { token: "interface", foreground: "4EC9B0" },
          { token: "namespace", foreground: "4EC9B0" },
        ],
        colors: {
          "editor.background": "#101010",
          "editor.foreground": "#D4D4D4",
          "editorCursor.foreground": "#AEAFAD",
          "editor.lineHighlightBackground": "#2D2D30",
          "editorLineNumber.foreground": "#858585",
          "editor.selectionBackground": "#264F78",
          "editor.inactiveSelectionBackground": "#3A3D41",
          "editorIndentGuide.background": "#404040",
        },
      });

      // Set default theme
      monaco.editor.setTheme("premium-dark");

      setThemeReady(true);

      // Configure TypeScript/JavaScript compiler options
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: "React",
        allowJs: true,
        typeRoots: ["node_modules/@types"],
      })

      // Add React types
      fetch("https://unpkg.com/@types/react@18.2.0/index.d.ts")
        .then((response) => response.text())
        .then((types) => {
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            types,
            "file:///node_modules/@types/react/index.d.ts",
          )
        })
        .catch((error) => console.error("Failed to fetch React types", error))
    }
  }, [monaco])

  // Set mounted state once theme is ready
  useEffect(() => {
    if (themeReady) {
      setMounted(true);
    }
  }, [themeReady]);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor

    const model = editor.getModel()
    if (!model) return

    setLineCount(model.getLineCount())

    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({
        line: e.position.lineNumber,
        column: e.position.column,
      })
    })

    model.onDidChangeContent(() => {
      setLineCount(model.getLineCount())
    })

    // Add format on save
    if (monaco) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        editor.getAction('editor.action.formatDocument')?.run()
      })
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && editorContent) {
      setEditorContent({
        ...editorContent,
        fileContent: value,
      });
    }
  }

  const saveChanges = async () => {
    if (editorContent?.fileContent !== originalContent?.fileContent) {
      setIsSaving(true)

      try {
        // Format the document before saving
        if (editorRef.current) {
          await editorRef.current.getAction('editor.action.formatDocument')?.run()
        }

        await saveOrCreateFileContent(
          containerId,
          `${editorContent?.fileDir}`,
          editorContent?.fileName || '',
          editorContent?.fileContent || '',
        );

        // Update original content to match current content
        setOriginalContent(editorContent);
        setIsSaving(false);
      } catch (error) {
        console.error("Error saving file:", error);
        setIsSaving(false);
      }
    }
  }

  const copyContent = () => {
    navigator.clipboard
      .writeText(editorContent?.fileContent || "")
      .then(() => {
        // Could add a toast notification here
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err)
      })
  }

  // Determine language based on file extension
  useEffect(() => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "plaintext"

    const languageMap: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      jsx: "javascript",
      tsx: "typescript",
      py: "python",
      java: "java",
      json: "json",
      xml: "xml",
      html: "html",
      css: "css",
      scss: "scss",
      less: "less",
      md: "markdown",
      yaml: "yaml",
      yml: "yaml",
      php: "php",
      c: "c",
      cpp: "cpp",
      cs: "csharp",
      go: "go",
      rs: "rust",
      rb: "ruby",
      sh: "shell",
      sql: "sql",
      swift: "swift",
      dart: "dart",
      vue: "html",
      svelte: "html",
    }

    setLanguage(languageMap[extension] || "plaintext")
  }, [file.name])

  if (!mounted || !themeReady) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-black/40">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-black/40">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-[#3C3C3C]">
        <div className="flex items-center">
          <FileCode2 className="h-4 w-4 mr-2 text-blue-400" />
          <span className="text-sm font-medium text-gray-200">{file.name}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={copyContent}
            className="p-1.5 rounded-sm hover:bg-[#3C3C3C] transition-colors"
            title="Copy content"
          >
            <Copy className="h-4 w-4 text-gray-400" />
          </button>
          <button
            onClick={saveChanges}
            className={cn(
              "p-1.5 rounded-sm transition-colors flex items-center",
              editorContent !== originalContent
                ? "text-white bg-blue-600 hover:bg-blue-700"
                : "text-gray-400 hover:bg-[#3C3C3C]",
            )}
            disabled={isSaving}
            title="Save changes"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="h-full w-full flex items-center justify-center bg-[#1E1E1E]">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <Editor
            height="100%"
            defaultLanguage={language}
            language={language}
            value={editorContent?.fileContent}
            theme="premium-dark"
            beforeMount={(monaco) => {
              // Make sure theme is set again right before mount
              monaco.editor.setTheme("premium-dark");
            }}
            onMount={handleEditorDidMount}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: true, scale: 0.75, showSlider: "mouseover" },
              scrollBeyondLastLine: false,
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
              fontLigatures: true,
              lineNumbers: "on",
              renderLineHighlight: "all",
              automaticLayout: true,
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              smoothScrolling: true,
              tabSize: 2,
              wordWrap: "on",
              wrappingIndent: "same",
              renderWhitespace: "selection",
              formatOnPaste: true,
              formatOnType: true,
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: "on",
              quickSuggestions: true,
              padding: { top: 10 },
            }}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-black/10 text-white text-xs border-t border-[#3C3C3C]">
        <div className="flex items-center space-x-4">
        </div>
        <div className="flex items-center space-x-4">
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
          <span>{lineCount} lines</span>
        </div>
      </div>
    </div>
  )
}